"""TOCO MADERA | ETAPA 3.19.4: finalizar orden y dar alta a lote terminado.

Blueprint independiente: NO reemplaza admin_produccion_routes.py (3.19.3).
Depende del decorador admin_required del proyecto.
"""
from decimal import Decimal
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.extensions import db
from app.utils.permisos import admin_required

admin_producto_terminado_bp = Blueprint(
    'admin_producto_terminado', __name__,
    url_prefix='/api/v1/admin/producto-terminado'
)


def _orden_bloqueada(id_orden):
    """Bloquea la orden para serializar solicitudes repetidas concurrentes."""
    return db.session.execute(text('''
        SELECT op.id_orden, op.id_receta, op.id_detalle_pedido,
               op.cantidad, op.estado, op.texto_grabado,
               r.id_producto, d.texto_grabado AS grabado_pedido,
               d.id_producto AS producto_pedido,
               p.estado AS estado_pedido
        FROM ordenes_produccion op
        JOIN recetas r ON r.id_receta = op.id_receta
        LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
        LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
        WHERE op.id_orden = :id FOR UPDATE
    '''), {'id': id_orden}).mappings().first()


def _verificar_consumos(orden):
    """Valida insumos de receta sin basarse en flags enviados desde Angular.

    Los consumos de producción deben existir para TODOS los materiales
    de la receta y cubrir la cantidad requerida por la orden.
    """
    filas = db.session.execute(text('''
        SELECT rm.id_material,
               rm.cantidad * :cantidad AS requerida,
               COALESCE(SUM(cp.cantidad), 0) AS consumida,
               COUNT(cp.id_consumo) AS registros
        FROM receta_materiales rm
        LEFT JOIN consumos_produccion cp
          ON cp.id_material = rm.id_material AND cp.id_orden = :orden
        WHERE rm.id_receta = :receta
        GROUP BY rm.id_material, rm.cantidad
        ORDER BY rm.id_material
    '''), {
        'cantidad': orden['cantidad'],
        'orden': orden['id_orden'],
        'receta': orden['id_receta']
    }).mappings().all()
    if not filas:
        return False, [], 'La receta no tiene materiales; no puede finalizarse.'
    detalles = []
    completo = True
    for f in filas:
        requerido = Decimal(str(f['requerida']))
        consumido = Decimal(str(f['consumida']))
        valido = requerido > 0 and consumido == requerido and f['registros'] == 1
        completo = completo and valido
        detalles.append({
            'id_material': int(f['id_material']),
            'cantidad_requerida': str(requerido),
            'cantidad_consumida': str(consumido),
            'correcto': bool(valido)
        })
    # También comprobar que no se consumieron materiales ajenos a la receta.
    extras = db.session.execute(text('''
        SELECT COUNT(*) FROM consumos_produccion cp
        WHERE cp.id_orden = :orden
          AND NOT EXISTS (
            SELECT 1 FROM receta_materiales rm
            WHERE rm.id_receta = :receta AND rm.id_material = cp.id_material
          )
    '''), {'orden': orden['id_orden'], 'receta': orden['id_receta']}).scalar_one()
    if extras:
        completo = False
    return completo, detalles, ('' if completo else 'El consumo de materias primas no coincide con la receta completa.')


def _lote_existente(id_orden):
    return db.session.execute(text('''
        SELECT lp.id_lote,
               COALESCE(SUM(CASE WHEN mp.tipo = 'PRODUCCION' THEN mp.cantidad_firmada ELSE 0 END), 0) AS entradas
        FROM lotes_producto lp
        LEFT JOIN movimientos_producto mp ON mp.id_lote = lp.id_lote
        WHERE lp.id_orden = :id
        GROUP BY lp.id_lote
        ORDER BY lp.id_lote
    '''), {'id': id_orden}).mappings().all()


@admin_producto_terminado_bp.get('/orden/<int:id_orden>/verificar')
@admin_required
def verificar_terminacion(id_orden):
    """Solo lectura: permite revisar prerequisitos antes de finalizar."""
    try:
        orden = db.session.execute(text('''
            SELECT op.id_orden, op.id_receta, op.id_detalle_pedido,
                   op.cantidad, op.estado, op.texto_grabado,
                   r.id_producto, d.texto_grabado AS grabado_pedido,
                   d.id_producto AS producto_pedido, p.estado AS estado_pedido
            FROM ordenes_produccion op
            JOIN recetas r ON r.id_receta = op.id_receta
            LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
            LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
            WHERE op.id_orden = :id
        '''), {'id': id_orden}).mappings().first()
        if not orden:
            return jsonify(success=False, message='Orden no encontrada.'), 404
        correcto, materiales, observacion = _verificar_consumos(orden)
        lotes = _lote_existente(id_orden)
        coincide = (orden['id_detalle_pedido'] is None or
                    orden['producto_pedido'] == orden['id_producto'])
        pedido_valido = (orden['id_detalle_pedido'] is None or
                         orden['estado_pedido'] in ('CONFIRMADO', 'EN_PRODUCCION'))
        puede_finalizar = (orden['estado'] == 'EN_PROCESO' and
                           int(orden['cantidad']) > 0 and correcto and
                           not lotes and coincide and pedido_valido)
        return jsonify(
            success=True, id_orden=id_orden, estado=orden['estado'],
            id_producto=orden['id_producto'], cantidad=orden['cantidad'],
            id_detalle_pedido=orden['id_detalle_pedido'],
            texto_grabado=orden['texto_grabado'] or orden['grabado_pedido'],
            materiales=materiales, consumos_completos=correcto,
            lotes_existentes=len(lotes), puede_finalizar=puede_finalizar,
            observacion=observacion
        ), 200
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error verificando terminación de orden')
        return jsonify(success=False, message='Error al verificar la terminación.'), 500


@admin_producto_terminado_bp.post('/orden/<int:id_orden>/finalizar')
@admin_required
def finalizar_orden(id_orden):
    """Finaliza fabricación y crea lote+movimiento en UNA transacción.

    No recibe cantidades ni IDs de producto del cliente HTTP: utiliza los
    valores registrados en la orden y receta de MySQL.
    """
    try:
        orden = _orden_bloqueada(id_orden)
        if orden is None:
            db.session.rollback()
            return jsonify(success=False, message='Orden no encontrada.'), 404
        if orden['estado'] != 'EN_PROCESO':
            db.session.rollback()
            return jsonify(success=False,
                           message='Solo puedes finalizar órdenes en proceso.'), 409
        if int(orden['cantidad']) <= 0:
            db.session.rollback()
            return jsonify(success=False, message='Cantidad inválida.'), 409
        if _lote_existente(id_orden):
            db.session.rollback()
            return jsonify(success=False,
                           message='La orden ya tiene un lote. No se duplicará producto terminado.'), 409
        if (orden['id_detalle_pedido'] is not None and
            (orden['estado_pedido'] not in ('CONFIRMADO', 'EN_PRODUCCION') or
             orden['producto_pedido'] != orden['id_producto'])):
            db.session.rollback()
            return jsonify(success=False,
                           message='El pedido no es válido para finalizar la fabricación.'), 409
        completo, _, observacion = _verificar_consumos(orden)
        if not completo:
            db.session.rollback()
            return jsonify(success=False, message=observacion), 409
        grabado = orden['texto_grabado'] or orden['grabado_pedido']
        if grabado and len(grabado) > 120:
            db.session.rollback()
            return jsonify(success=False, message='Grabado excede 120 caracteres.'), 409
        lote_id = db.session.execute(text('''
            INSERT INTO lotes_producto
              (id_producto, id_orden, id_detalle_pedido, texto_grabado)
            VALUES (:producto, :orden, :detalle, :grabado)
        '''), {
            'producto': orden['id_producto'], 'orden': id_orden,
            'detalle': orden['id_detalle_pedido'], 'grabado': grabado
        }).lastrowid
        db.session.execute(text('''
            INSERT INTO movimientos_producto
              (id_lote, tipo, cantidad_firmada, id_detalle_pedido, observaciones)
            VALUES (:lote, 'PRODUCCION', :cantidad, :detalle, :observaciones)
        '''), {
            'lote': lote_id, 'cantidad': int(orden['cantidad']),
            'detalle': orden['id_detalle_pedido'],
            'observaciones': f'Entrada de producto terminado de orden {id_orden}'
        })
        db.session.execute(text('''
            UPDATE ordenes_produccion
            SET estado = 'FINALIZADA', fecha_fin = CURRENT_TIMESTAMP
            WHERE id_orden = :id AND estado = 'EN_PROCESO'
        '''), {'id': id_orden})
        db.session.commit()
        return jsonify(
            success=True, message='Fabricación finalizada y lote registrado.',
            id_orden=id_orden, id_lote=lote_id,
            id_producto=orden['id_producto'], cantidad=int(orden['cantidad']),
            estado='FINALIZADA', texto_grabado=grabado
        ), 200
    except IntegrityError:
        db.session.rollback()
        current_app.logger.exception('Restricción al registrar lote terminado')
        return jsonify(success=False, message='No se registró el lote: restricción de integridad.'), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error transaccional finalizando fabricación')
        return jsonify(success=False, message='Error interno al finalizar la orden.'), 500
