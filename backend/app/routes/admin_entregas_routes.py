"""Toco Madera — Etapa 3.19.5: programación, aviso y entrega de pedidos.

No reemplaza otros Blueprints. El esquema de la etapa usa una columna nueva
entregas.punto_recoleccion (ver migración incluida).
"""
from datetime import datetime, timedelta
from decimal import Decimal
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.extensions import db
from app.utils.permisos import admin_required

admin_entregas_bp = Blueprint('admin_entregas', __name__, url_prefix='/api/v1/admin/entregas')
cliente_seguimiento_bp = Blueprint('cliente_seguimiento', __name__, url_prefix='/api/v1/cliente/seguimiento')


def _fallo(error):
    db.session.rollback()
    current_app.logger.exception(error)
    return jsonify(success=False, message='Error interno al gestionar la entrega.'), 500


def _pendiente_total(id_pedido):
    """Saldo simulado: no confundir con cobro real."""
    total = db.session.execute(text('''
        SELECT COALESCE(SUM(d.cantidad*d.precio_unitario_acordado), 0)
               + COALESCE(p.monto_envio, 0) - COALESCE(p.descuento, 0)
        FROM pedidos p JOIN pedido_detalles d ON d.id_pedido = p.id_pedido
        WHERE p.id_pedido = :id GROUP BY p.id_pedido, p.monto_envio, p.descuento
    '''), {'id': id_pedido}).scalar_one_or_none()
    pagado = db.session.execute(text('''
        SELECT COALESCE(SUM(monto),0) FROM pagos
        WHERE id_pedido = :id AND estado = 'APROBADO_SIMULADO'
    '''), {'id': id_pedido}).scalar_one()
    return max(Decimal('0'), Decimal(str(total or 0))-Decimal(str(pagado or 0)))


def _autorizado_para_entrega(id_pedido):
    estado = db.session.execute(text('''
        SELECT estado FROM autorizaciones_pedido WHERE id_pedido=:id
    '''), {'id':id_pedido}).scalar_one_or_none()
    return estado == 'APROBADO'


def _pedido_bloqueado(id_pedido):
    return db.session.execute(text('''
        SELECT id_pedido, folio, id_cliente, fecha, estado, modalidad_pago,
               tipo_entrega, fecha_entrega_prometida
        FROM pedidos WHERE id_pedido = :id FOR UPDATE
    '''), {'id': id_pedido}).mappings().first()


def _verificar_productos(id_pedido, bloquear=False):
    """Verificar que cada detalle tenga inventario terminado suficiente.

    Para FABRICACION, el lote debe pertenecer al detalle del pedido.
    Para EXISTENCIA, solo se admite un lote genérico (sin orden ni grabado).
    """
    detalles = db.session.execute(text('''
        SELECT id_detalle_pedido, id_producto, cantidad, tipo_surtido, texto_grabado
        FROM pedido_detalles WHERE id_pedido = :id ORDER BY id_detalle_pedido
    '''), {'id': id_pedido}).mappings().all()
    if not detalles:
        return False, [], 'El pedido no tiene productos.'
    asignaciones = []
    for d in detalles:
        if d['tipo_surtido'] == 'FABRICACION':
            lotes = db.session.execute(text('''
                SELECT lp.id_lote FROM lotes_producto lp
                JOIN ordenes_produccion op ON op.id_orden=lp.id_orden
                WHERE lp.id_detalle_pedido=:detalle
                  AND lp.id_producto=:producto AND op.estado='FINALIZADA'
                ORDER BY lp.id_lote
            '''), {'detalle': d['id_detalle_pedido'], 'producto': d['id_producto']}).scalars().all()
        else:
            # No entregar un producto personalizado utilizando inventario ajeno.
            if d['texto_grabado']:
                return False, [], 'Un detalle personalizado debe fabricarse antes de entregar.'
            lotes = db.session.execute(text('''
                SELECT id_lote FROM lotes_producto
                WHERE id_producto=:producto AND id_orden IS NULL
                  AND id_detalle_pedido IS NULL AND texto_grabado IS NULL
                ORDER BY id_lote
            '''), {'producto': d['id_producto']}).scalars().all()
        restante = int(d['cantidad'])
        for lote_id in lotes:
            if bloquear:
                db.session.execute(text('''SELECT id_lote FROM lotes_producto
                                            WHERE id_lote=:id FOR UPDATE'''), {'id': lote_id}).first()
            # Lectura consistente; al entregar se bloquean movimientos existentes.
            sql_mov = ('SELECT cantidad_firmada FROM movimientos_producto '
                       'WHERE id_lote=:id' + (' FOR UPDATE' if bloquear else ''))
            valores = db.session.execute(text(sql_mov), {'id': lote_id}).scalars().all()
            saldo = sum(int(v) for v in valores)
            reservas = db.session.execute(text('''
                SELECT rp.cantidad, pd.id_pedido
                FROM reservas_producto rp JOIN pedido_detalles pd
                  ON pd.id_detalle_pedido=rp.id_detalle_pedido
                WHERE rp.id_lote=:id AND rp.estado='ACTIVA'
            '''), {'id': lote_id}).mappings().all()
            reservado_ajeno = sum(int(r['cantidad']) for r in reservas if int(r['id_pedido']) != int(id_pedido))
            cantidad = min(restante, max(0, saldo - reservado_ajeno))
            if cantidad:
                asignaciones.append({'id_detalle_pedido':int(d['id_detalle_pedido']),
                                     'id_lote':int(lote_id), 'cantidad':cantidad})
                restante -= cantidad
            if restante == 0:
                break
        if restante:
            return False, [], f"Stock de producto terminado insuficiente para detalle {d['id_detalle_pedido']}."
    return True, asignaciones, ''


@admin_entregas_bp.get('/pedidos')
@admin_required
def pedidos_para_entrega():
    """Lista administrativa de pedidos, fecha y punto de entrega."""
    try:
        filas = db.session.execute(text('''
            SELECT p.id_pedido,p.folio,p.estado,p.fecha,p.tipo_entrega,
                   p.fecha_entrega_prometida,
                   u.nombre AS cliente_nombre,u.correo AS cliente_correo,
                   u.telefono AS cliente_telefono,
                   e.estado AS estado_entrega, e.programada, e.entregada,
                   e.punto_recoleccion
            FROM pedidos p JOIN usuarios u ON u.id_usuario=p.id_cliente
            LEFT JOIN entregas e ON e.id_pedido=p.id_pedido
            WHERE p.estado <> 'CANCELADO'
            ORDER BY p.id_pedido DESC LIMIT 100
        ''')).mappings().all()
        return jsonify(success=True, pedidos=[{
            **{k:(v.isoformat(sep=' ') if isinstance(v,datetime) else v)
               for k,v in dict(f).items()},
            'saldo_simulado': str(_pendiente_total(f['id_pedido']))
        } for f in filas]),200
    except SQLAlchemyError:
        return _fallo('No fue posible consultar pedidos para entrega')


@admin_entregas_bp.post('/pedido/<int:id_pedido>/programar')
@admin_required
def programar_recoleccion(id_pedido):
    """Confirmar fecha/hora y punto de recolección, sin inventar domicilio."""
    datos=request.get_json(silent=True)
    if not isinstance(datos,dict):
        return jsonify(success=False,message='Envía JSON.'),400
    fecha=datos.get('programada')
    punto=datos.get('punto_recoleccion')
    if not isinstance(fecha,str) or not isinstance(punto,str) or not (5<=len(punto.strip())<=200):
        return jsonify(success=False,message='Indica fecha/hora y punto de recolección (5 a 200 caracteres).'),400
    try:
        fecha_dt=datetime.strptime(fecha,'%Y-%m-%d %H:%M:%S')
    except ValueError:
        return jsonify(success=False,message='Usa fecha YYYY-MM-DD HH:MM:SS.'),400
    if fecha_dt <= datetime.now() or fecha_dt > datetime.now()+timedelta(days=365):
        return jsonify(success=False,message='Programa una fecha futura razonable, hora local de León.'),400
    try:
        p=_pedido_bloqueado(id_pedido)
        if not p:
            db.session.rollback();return jsonify(success=False,message='Pedido no encontrado.'),404
        if p['tipo_entrega'] != 'RECOLECCION':
            db.session.rollback();return jsonify(success=False,message='Este pedido no es de recolección.'),409
        if p['estado'] in ('CANCELADO','ENTREGADO','PENDIENTE_ANTICIPO'):
            db.session.rollback();return jsonify(success=False,message='Estado de pedido incompatible con programación.'),409
        if not _autorizado_para_entrega(id_pedido):
            db.session.rollback();return jsonify(success=False,message='Debes autorizar el pedido antes de programar la entrega.'),409
        existente=db.session.execute(text('SELECT id_entrega,estado FROM entregas WHERE id_pedido=:id FOR UPDATE'),{'id':id_pedido}).mappings().first()
        if existente and existente['estado']=='ENTREGADA':
            db.session.rollback();return jsonify(success=False,message='Entrega ya realizada.'),409
        if existente:
            db.session.execute(text('''UPDATE entregas SET programada=:f,estado='PROGRAMADA',
                                   punto_recoleccion=:p WHERE id_pedido=:id'''),{'f':fecha_dt,'p':punto.strip(),'id':id_pedido})
        else:
            db.session.execute(text('''INSERT INTO entregas (id_pedido, programada,estado,punto_recoleccion)
                                   VALUES (:id,:f,'PROGRAMADA',:p)'''),{'id':id_pedido,'f':fecha_dt,'p':punto.strip()})
        db.session.execute(text('UPDATE pedidos SET fecha_entrega_prometida=:f WHERE id_pedido=:id'),{'f':fecha_dt,'id':id_pedido})
        db.session.commit()
        return jsonify(success=True,id_pedido=id_pedido,programada=fecha_dt.isoformat(sep=' '),punto_recoleccion=punto.strip(),message='Fecha y punto confirmados. Ya son visibles para el cliente mediante seguimiento.'),200
    except (IntegrityError,SQLAlchemyError):
        return _fallo('Error programando la entrega')


@admin_entregas_bp.post('/pedido/<int:id_pedido>/listo')
@admin_required
def marcar_listo(id_pedido):
    """Confirma existencias y marca pedido LISTO; no descuenta inventario."""
    try:
        p=_pedido_bloqueado(id_pedido)
        if not p:
            db.session.rollback();return jsonify(success=False,message='Pedido no encontrado.'),404
        if p['estado'] not in ('CONFIRMADO','EN_PRODUCCION'):
            db.session.rollback();return jsonify(success=False,message='El pedido no admite marcarse como listo.'),409
        if not _autorizado_para_entrega(id_pedido):
            db.session.rollback();return jsonify(success=False,message='Autoriza el pedido antes de marcarlo como listo.'),409
        correcto,_,mensaje=_verificar_productos(id_pedido, bloquear=True)
        if not correcto:
            db.session.rollback();return jsonify(success=False,message=mensaje),409
        db.session.execute(text("UPDATE pedidos SET estado='LISTO' WHERE id_pedido=:id"),{'id':id_pedido})
        db.session.commit()
        return jsonify(success=True,id_pedido=id_pedido,estado='LISTO',message='Producto terminado. Aviso disponible en Mis pedidos.'),200
    except SQLAlchemyError:
        return _fallo('Error al marcar pedido listo')


@admin_entregas_bp.post('/pedido/<int:id_pedido>/liquidar-saldo')
@admin_required
def liquidar_saldo_simulado(id_pedido):
    # Esta operación no es un cobro real ni solicita datos bancarios.
    try:
        pedido = _pedido_bloqueado(id_pedido)
        if not pedido:
            db.session.rollback()
            return jsonify(success=False, message='Pedido no encontrado.'), 404
        if pedido['estado'] in ('ENTREGADO','CANCELADO','PENDIENTE_ANTICIPO'):
            db.session.rollback()
            return jsonify(success=False, message='Estado incompatible con liquidación.'), 409
        saldo = _pendiente_total(id_pedido)
        if saldo <= 0:
            db.session.rollback()
            return jsonify(success=False, message='No existe saldo pendiente.'), 409
        referencia=f'SALDO-ENTREGA-{id_pedido}'
        db.session.execute(text("""INSERT INTO pagos
            (id_pedido,monto,metodo,estado,referencia)
            VALUES (:id,:monto,'TRANSFERENCIA_SIMULADA','APROBADO_SIMULADO',:referencia)"""),
            {'id':id_pedido,'monto':saldo,'referencia':referencia})
        db.session.commit()
        return jsonify(success=True,id_pedido=id_pedido,monto=str(saldo),
            metodo='TRANSFERENCIA_SIMULADA',
            message='Saldo liquidado con un pago simulado.'),200
    except IntegrityError:
        db.session.rollback()
        return jsonify(success=False,message='El saldo ya fue liquidado.'),409
    except SQLAlchemyError:
        return _fallo('Error al liquidar saldo simulado')


@admin_entregas_bp.post('/pedido/<int:id_pedido>/entregar')
@admin_required
def entregar_pedido(id_pedido):
    """Registra una entrega única con salida de inventario transaccional."""
    datos=request.get_json(silent=True)
    if not isinstance(datos,dict) or not isinstance(datos.get('receptor'),str) or not (2<=len(datos['receptor'].strip())<=120):
        return jsonify(success=False,message='Indica nombre del receptor (2-120 caracteres).'),400
    try:
        p=_pedido_bloqueado(id_pedido)
        if not p:
            db.session.rollback();return jsonify(success=False,message='Pedido no encontrado.'),404
        if p['estado'] != 'LISTO':
            db.session.rollback();return jsonify(success=False,message='Solo puedes entregar pedidos listos.'),409
        e=db.session.execute(text('''SELECT id_entrega,estado,programada,punto_recoleccion
                                    FROM entregas WHERE id_pedido=:id FOR UPDATE'''),{'id':id_pedido}).mappings().first()
        if not e or e['estado']!='PROGRAMADA' or not e['punto_recoleccion']:
            db.session.rollback();return jsonify(success=False,message='Primero confirma fecha y punto de recolección.'),409
        if p['tipo_entrega']!='RECOLECCION':
            db.session.rollback();return jsonify(success=False,message='Entrega local no habilitada en esta prueba.'),409
        saldo=_pendiente_total(id_pedido)
        if saldo > Decimal('0.00'):
            db.session.rollback();return jsonify(success=False,message=f'Saldo simulado pendiente: ${saldo}. Registra la liquidación antes de entregar.'),409
        correcto,items,mensaje=_verificar_productos(id_pedido,bloquear=True)
        if not correcto:
            db.session.rollback();return jsonify(success=False,message=mensaje),409
        for item in items:
            db.session.execute(text('''INSERT INTO movimientos_producto
                (id_lote,tipo,cantidad_firmada,id_detalle_pedido,observaciones)
                VALUES (:lote,'ENTREGA',:cantidad,:detalle,:obs)'''),{
                'lote':item['id_lote'],'cantidad':-item['cantidad'],
                'detalle':item['id_detalle_pedido'],
                'obs':f'Entrega de pedido {id_pedido}'})
        # Marcar reservas del mismo pedido como consumidas para no dejarlas activas.
        db.session.execute(text('''UPDATE reservas_producto rp
            JOIN pedido_detalles d ON d.id_detalle_pedido=rp.id_detalle_pedido
            SET rp.estado='CONSUMIDA'
            WHERE d.id_pedido=:id AND rp.estado='ACTIVA' '''), {'id':id_pedido})
        db.session.execute(text('''UPDATE entregas SET estado='ENTREGADA',
            entregada=CURRENT_TIMESTAMP,receptor=:receptor WHERE id_pedido=:id'''),{
            'receptor':datos['receptor'].strip(),'id':id_pedido})
        db.session.execute(text("UPDATE pedidos SET estado='ENTREGADO' WHERE id_pedido=:id"),{'id':id_pedido})
        db.session.commit()
        return jsonify(success=True,id_pedido=id_pedido,estado='ENTREGADO',movimientos=len(items),message='Entrega confirmada; se descontó producto terminado una sola vez.'),200
    except (IntegrityError,SQLAlchemyError):
        return _fallo('Error al entregar pedido')


@cliente_seguimiento_bp.get('/mis-pedidos')
@jwt_required()
def consultar_seguimiento():
    """El usuario solo puede ver sus propios pedidos; no expone datos de otros clientes."""
    try:
        try:
            id_cliente=int(get_jwt_identity())
        except (TypeError,ValueError):
            return jsonify(success=False,message='Identidad inválida.'),401
        usuario=db.session.execute(text('''SELECT u.id_usuario,r.nombre AS rol,u.activo
            FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=:id'''),{'id':id_cliente}).mappings().first()
        if not usuario or not usuario['activo'] or usuario['rol']!='CLIENTE':
            return jsonify(success=False,message='Acceso reservado al cliente.'),403
        filas=db.session.execute(text('''
            SELECT p.id_pedido,p.folio,p.fecha,p.estado,p.tipo_entrega,
                p.fecha_entrega_prometida,e.programada,e.estado AS estado_entrega,
                e.punto_recoleccion,e.entregada
            FROM pedidos p LEFT JOIN entregas e ON e.id_pedido=p.id_pedido
            WHERE p.id_cliente=:id ORDER BY p.id_pedido DESC
        '''),{'id':id_cliente}).mappings().all()
        resultados=[]
        for f in filas:
            x={k:(v.isoformat(sep=' ') if isinstance(v,datetime) else v) for k,v in dict(f).items()}
            piezas=db.session.execute(text('''SELECT COALESCE(SUM(cantidad),0) FROM pedido_detalles
                WHERE id_pedido=:id'''),{'id':f['id_pedido']}).scalar_one()
            total=db.session.execute(text('''SELECT COALESCE(SUM(cantidad*precio_unitario_acordado),0)
                FROM pedido_detalles WHERE id_pedido=:id'''),{'id':f['id_pedido']}).scalar_one()
            if piezas>=10 or Decimal(str(total))>=Decimal('2500'):
                plazo='5 a 7 días hábiles orientativos; cotización y fecha acordada obligatorias.'
            elif f['estado'] in ('LISTO','ENTREGADO'):
                plazo='Producto terminado.'
            else:
                grabado=db.session.execute(text('''SELECT COUNT(*) FROM pedido_detalles
                    WHERE id_pedido=:id AND (tipo_surtido='FABRICACION' OR texto_grabado IS NOT NULL)'''),{'id':f['id_pedido']}).scalar_one()
                plazo='2 a 3 días hábiles, sujetos a confirmación del taller.' if grabado else '3 a 6 horas, sujeto a horario y disponibilidad.'
            x['plazo_orientativo']=plazo
            x['aviso']='Tu pedido está listo. Revisa el lugar y la fecha acordados.' if f['estado']=='LISTO' else ('Entrega realizada.' if f['estado']=='ENTREGADO' else 'Consulta aquí las actualizaciones de tu pedido.')
            resultados.append(x)
        return jsonify(success=True,pedidos=resultados),200
    except SQLAlchemyError:
        return _fallo('Error consultando el seguimiento del cliente')
