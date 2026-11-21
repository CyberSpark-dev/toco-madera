"""Gestión administrativa de clientes: consulta y activación/desactivación.
Los importes son valores de pedidos válidos; NO importes cobrados.
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from app.extensions import db
from app.models.usuario import Usuario
from app.models.rol import Rol
from app.utils.permisos import admin_required
from app.services.auth_service import AuthService

admin_clientes_bp = Blueprint('admin_clientes', __name__, url_prefix='/api/v1/admin/clientes')
ESTADOS_VALIDOS = ('CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'ENTREGADO')


def _cliente(id_cliente):
    return db.session.execute(select(Usuario).join(Rol).where(
        Usuario.id_usuario == id_cliente, Rol.nombre == 'CLIENTE'
    )).scalar_one_or_none()


def _resumen(id_cliente):
    """Agrega cada pedido una vez: evita duplicar envío o descuento."""
    base = db.session.execute(text("""
        SELECT COUNT(*) cantidad, COALESCE(SUM(x.total),0) total
        FROM (
            SELECT p.id_pedido,
                   COALESCE(SUM(d.cantidad*d.precio_unitario_acordado),0)
                   + p.monto_envio-p.descuento AS total
            FROM pedidos p
            LEFT JOIN pedido_detalles d ON d.id_pedido=p.id_pedido
            WHERE p.id_cliente=:uid
              AND p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
            GROUP BY p.id_pedido, p.monto_envio, p.descuento
        ) x
    """), {'uid':id_cliente}).mappings().one()
    # Solo productos realmente comprados, ordenados por unidades.
    # Los pedidos cancelados no cuentan como compras.
    filas = db.session.execute(text("""
        SELECT d.id_producto, pr.nombre, SUM(d.cantidad) AS unidades
        FROM pedidos p
        JOIN pedido_detalles d ON d.id_pedido = p.id_pedido
        JOIN productos pr ON pr.id_producto = d.id_producto
        WHERE p.id_cliente = :uid
          AND p.estado IN ('CONFIRMADO','EN_PRODUCCION','LISTO','ENTREGADO')
        GROUP BY d.id_producto, pr.nombre
    """), {'uid': id_cliente}).mappings().all()
    productos = [
        {'id_producto': int(x['id_producto']),
         'nombre': x['nombre'],
         'unidades': int(x['unidades'])}
        for x in filas
    ]
    mas = sorted(productos, key=lambda x: (-x['unidades'], x['nombre']))[:5]
    menos = sorted(productos, key=lambda x: (x['unidades'], x['nombre']))[:5]

    # CANCELADO es un estado del pedido. RECHAZADO es una decisión
    # administrativa distinta; NO se convierten entre sí automáticamente.
    cancelados = db.session.execute(text("""
        SELECT p.id_pedido, p.folio, p.fecha, p.estado
        FROM pedidos p
        WHERE p.id_cliente = :uid AND p.estado = 'CANCELADO'
        ORDER BY p.fecha DESC, p.id_pedido DESC
    """), {'uid': id_cliente}).mappings().all()
    rechazados = db.session.execute(text("""
        SELECT p.id_pedido, p.folio, a.fecha_decision, a.motivo
        FROM pedidos p
        JOIN autorizaciones_pedido a ON a.id_pedido = p.id_pedido
        WHERE p.id_cliente = :uid AND a.estado = 'RECHAZADO'
        ORDER BY a.fecha_decision DESC, p.id_pedido DESC
    """), {'uid': id_cliente}).mappings().all()

    return {
        'pedidos_validos': int(base['cantidad']),
        'total_compras': round(float(base['total']), 2),
        'productos_mas_comprados': mas,
        'productos_menos_comprados': menos,
        'total_cancelaciones': len(cancelados),
        'cancelaciones': [
            {'id_pedido': int(x['id_pedido']),
             'folio': x['folio'],
             'fecha': x['fecha'].isoformat() if x['fecha'] else None}
            for x in cancelados
        ],
        'total_rechazos': len(rechazados),
        'pedidos_rechazados': [
            {'id_pedido': int(x['id_pedido']),
             'folio': x['folio'],
             'fecha': x['fecha_decision'].isoformat() if x['fecha_decision'] else None,
             'motivo': x['motivo']}
            for x in rechazados
        ],
    }


def _datos(usuario):
    return {**AuthService.usuario_publico(usuario), 'creado_en':usuario.creado_en.isoformat() if usuario.creado_en else None,
            **_resumen(usuario.id_usuario)}



@admin_clientes_bp.get('/')
@admin_required
def listar():
    try:
        usuarios=db.session.execute(select(Usuario).join(Rol).where(Rol.nombre=='CLIENTE').order_by(Usuario.id_usuario.desc())).scalars().all()
        return jsonify(success=True, clientes=[_datos(u) for u in usuarios]),200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False,message='No se pudo consultar la información de clientes.'),500

@admin_clientes_bp.get('/<int:id_cliente>')
@admin_required
def detalle(id_cliente):
    usuario=_cliente(id_cliente)
    if not usuario: return jsonify(success=False,message='Cliente no encontrado.'),404
    try: return jsonify(success=True,cliente=_datos(usuario)),200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False,message='Error al consultar el historial.'),500


@admin_clientes_bp.patch('/<int:id_cliente>/estado')
@admin_required
def estado(id_cliente):
    usuario=_cliente(id_cliente)
    if not usuario: return jsonify(success=False,message='Cliente no encontrado.'),404
    datos=request.get_json(silent=True)
    if not isinstance(datos,dict) or type(datos.get('activo')) is not bool:
        return jsonify(success=False,message='Envía activo como verdadero o falso.'),400
    usuario.activo=datos['activo']
    try:
        db.session.commit()
        return jsonify(success=True,message='Cuenta activada.' if usuario.activo else 'Cuenta desactivada. El historial permanece intacto.',cliente=_datos(usuario)),200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(success=False,message='No fue posible cambiar el estado.'),500
