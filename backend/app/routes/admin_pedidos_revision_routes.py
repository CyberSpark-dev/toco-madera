"""Toco Madera 3.20.2 — Revisión/autorización administrativa de pedidos.

Los pagos simulados confirman la COMPRA (pedidos.estado='CONFIRMADO');
la aprobación ADMIN queda en una tabla separada. Nunca emitir cobros ni reembolsos.
Ejecutar database/01_autorizaciones_pedido.sql ANTES de registrar este Blueprint.
"""
from datetime import date, datetime
from decimal import Decimal
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.utils.permisos import admin_required

admin_revision_pedidos_bp = Blueprint('admin_revision_pedidos', __name__, url_prefix='/api/v1/admin/revision-pedidos')


def _serializar(row):
    out = {}
    for k, value in dict(row).items():
        if isinstance(value, Decimal):
            out[k] = str(value)
        elif isinstance(value, (datetime, date)):
            out[k] = value.isoformat(sep=' ') if isinstance(value, datetime) else value.isoformat()
        else:
            out[k] = value
    return out


def _admin_actual():
    """No confiar en el rol del frontend, consultar MySQL con identidad JWT."""
    identidad = str(get_jwt_identity() or '').strip()
    if not identidad:
        raise PermissionError('Identidad no valida.')
    filtro = 'u.id_usuario=:identidad' if identidad.isdecimal() else 'u.correo=:identidad'
    valor = int(identidad) if identidad.isdecimal() else identidad
    usuario = db.session.execute(text(f'''
        SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol
        WHERE {filtro} AND u.activo=1 AND UPPER(r.nombre)='ADMIN'
    '''), {'identidad':valor}).scalar_one_or_none()
    if usuario is None:
        raise PermissionError('No tienes permisos de administrador.')
    return int(usuario)


def _error():
    db.session.rollback()
    current_app.logger.exception('Error en revisión administrativa de pedidos')
    return jsonify(success=False, message='No fue posible consultar o actualizar el pedido.'), 500


@admin_revision_pedidos_bp.get('/')
@admin_required
def listar_pedidos():
    try:
        rows = db.session.execute(text('''
            SELECT p.id_pedido,p.folio,p.fecha,p.estado,p.modalidad_pago,
                   p.tipo_entrega,p.fecha_entrega_prometida,
                   u.nombre AS cliente_nombre,u.correo AS cliente_correo,u.telefono AS cliente_telefono,
                   COALESCE(a.estado,'POR_REVISAR') AS autorizacion,
                   a.fecha_decision,a.motivo,
                   (SELECT COUNT(*) FROM pedido_detalles d WHERE d.id_pedido=p.id_pedido) AS articulos,
                   (SELECT COALESCE(SUM(d.cantidad),0) FROM pedido_detalles d WHERE d.id_pedido=p.id_pedido) AS unidades,
                   (SELECT COALESCE(SUM(d.cantidad*d.precio_unitario_acordado),0)
                    FROM pedido_detalles d WHERE d.id_pedido=p.id_pedido)
                    +p.monto_envio-p.descuento AS total,
                   (SELECT COALESCE(SUM(pg.monto),0) FROM pagos pg
                    WHERE pg.id_pedido=p.id_pedido AND pg.estado='APROBADO_SIMULADO') AS pagado
            FROM pedidos p JOIN usuarios u ON u.id_usuario=p.id_cliente
            LEFT JOIN autorizaciones_pedido a ON a.id_pedido=p.id_pedido
            ORDER BY p.id_pedido DESC LIMIT 200
        ''')).mappings().all()
        pedidos=[]
        for row in rows:
            entry=_serializar(row)
            entry['saldo']=str(max(Decimal('0'),Decimal(str(row['total']))-Decimal(str(row['pagado']))))
            pedidos.append(entry)
        return jsonify(success=True, pedidos=pedidos),200
    except SQLAlchemyError:
        return _error()


@admin_revision_pedidos_bp.get('/<int:id_pedido>')
@admin_required
def detalle_pedido(id_pedido):
    try:
        pedido=db.session.execute(text('''
            SELECT p.*, u.nombre AS cliente_nombre,u.correo AS cliente_correo,
                   u.telefono AS cliente_telefono,
                   COALESCE(a.estado,'POR_REVISAR') AS autorizacion,
                   a.motivo,a.fecha_decision
            FROM pedidos p JOIN usuarios u ON u.id_usuario=p.id_cliente
            LEFT JOIN autorizaciones_pedido a ON a.id_pedido=p.id_pedido
            WHERE p.id_pedido=:id
        '''),{'id':id_pedido}).mappings().first()
        if not pedido:
            return jsonify(success=False,message='Pedido no encontrado.'),404
        items=db.session.execute(text('''
            SELECT d.id_detalle_pedido,d.id_producto, pr.nombre AS producto,
                   d.cantidad,d.precio_unitario_acordado,d.texto_grabado,
                   d.tipo_surtido,d.notas
            FROM pedido_detalles d JOIN productos pr ON pr.id_producto=d.id_producto
            WHERE d.id_pedido=:id ORDER BY d.id_detalle_pedido
        '''),{'id':id_pedido}).mappings().all()
        pagos=db.session.execute(text('''
            SELECT id_pago,monto,metodo,estado,referencia
            FROM pagos WHERE id_pedido=:id ORDER BY id_pago
        '''),{'id':id_pedido}).mappings().all()
        entrega=db.session.execute(text('''
            SELECT estado,programada,entregada,punto_recoleccion
            FROM entregas WHERE id_pedido=:id
        '''),{'id':id_pedido}).mappings().first()
        return jsonify(success=True,pedido=_serializar(pedido),
                       detalles=[_serializar(x) for x in items],
                       pagos=[_serializar(x) for x in pagos],
                       entrega=_serializar(entrega) if entrega else None),200
    except SQLAlchemyError:
        return _error()


@admin_revision_pedidos_bp.post('/<int:id_pedido>/decision')
@admin_required
def decidir(id_pedido):
    datos=request.get_json(silent=True)
    if not isinstance(datos,dict) or datos.get('decision') not in ('APROBADO','RECHAZADO'):
        return jsonify(success=False,message='La decisión debe ser APROBADO o RECHAZADO.'),400
    motivo=datos.get('motivo','')
    if not isinstance(motivo,str) or len(motivo.strip())>300:
        return jsonify(success=False,message='Motivo inválido (máximo 300 caracteres).'),400
    motivo=motivo.strip()
    decision=datos['decision']
    if decision=='RECHAZADO' and len(motivo)<5:
        return jsonify(success=False,message='Escribe el motivo de rechazo (mínimo 5 caracteres).'),400
    try:
        admin_id=_admin_actual()
        p=db.session.execute(text('''SELECT id_pedido,estado FROM pedidos
                                     WHERE id_pedido=:id FOR UPDATE'''),{'id':id_pedido}).mappings().first()
        if not p:
            db.session.rollback()
            return jsonify(success=False,message='Pedido no encontrado.'),404
        if p['estado']!='CONFIRMADO':
            db.session.rollback()
            return jsonify(success=False,message='Solo se revisan pedidos CONFIRMADO que no han avanzado en producción o entrega.'),409
        previo=db.session.execute(text('''SELECT estado FROM autorizaciones_pedido
                                         WHERE id_pedido=:id FOR UPDATE'''),{'id':id_pedido}).scalar_one_or_none()
        if previo:
            db.session.rollback()
            return jsonify(success=False,message=f'Este pedido ya tiene decisión {previo}. No se puede duplicar.'),409
        # Impedir rechazar o aprobar retroactivamente una producción ya iniciada.
        ordenes=db.session.execute(text('''
            SELECT COUNT(*) FROM ordenes_produccion op
            JOIN pedido_detalles d ON d.id_detalle_pedido=op.id_detalle_pedido
            WHERE d.id_pedido=:id
        '''),{'id':id_pedido}).scalar_one()
        entregas=db.session.execute(text('''SELECT COUNT(*) FROM entregas WHERE id_pedido=:id'''),{'id':id_pedido}).scalar_one()
        if ordenes or entregas:
            db.session.rollback()
            return jsonify(success=False,message='Este pedido ya tiene producción o programación. No admite decisión inicial.'),409
        db.session.execute(text('''
            INSERT INTO autorizaciones_pedido (id_pedido,estado,id_admin,motivo)
            VALUES (:id,:estado,:admin,:motivo)
        '''),{'id':id_pedido,'estado':decision,'admin':admin_id,'motivo':motivo or None})
        db.session.commit()
        return jsonify(success=True,id_pedido=id_pedido,autorizacion=decision,
                       message=('Pedido autorizado para gestión administrativa.' if decision=='APROBADO'
                                else 'Pedido rechazado para fabricación. Revisar gestión manual del pago SIMULADO.')),200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False,message=str(exc)),403
    except SQLAlchemyError:
        return _error()
