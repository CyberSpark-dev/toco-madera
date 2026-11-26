"""Lecturas compartidas de materiales de una orden de producción."""
from decimal import Decimal

from sqlalchemy import text


def disponibilidad(requerido, disponible, activo):
    faltante = max(Decimal('0.0000'), requerido - disponible)
    motivo = ('MATERIAL_INACTIVO' if not activo else
              'REQUERIMIENTO_INVALIDO' if requerido <= 0 else
              'STOCK_INSUFICIENTE' if faltante else None)
    return faltante, motivo


def verificar_orden(session, id_orden, *, bloquear=False):
    bloqueo = ' FOR UPDATE' if bloquear else ''
    orden = session.execute(text("""
        SELECT op.id_orden, op.id_receta, op.estado, op.cantidad, op.id_detalle_pedido,
               p.estado AS estado_pedido
        FROM ordenes_produccion op
        LEFT JOIN pedido_detalles d ON d.id_detalle_pedido=op.id_detalle_pedido
        LEFT JOIN pedidos p ON p.id_pedido=d.id_pedido
        WHERE op.id_orden=:id
    """ + bloqueo), {'id': id_orden}).mappings().first()
    if orden is None:
        return None

    consumos = session.execute(text(
        'SELECT id_consumo FROM consumos_produccion WHERE id_orden=:id LIMIT 1' + bloqueo
    ), {'id': id_orden}).first()
    movimientos = session.execute(text("""
        SELECT id_movimiento FROM movimientos_material
        WHERE id_orden_produccion=:id AND tipo='CONSUMO' LIMIT 1
    """ + bloqueo), {'id': id_orden}).first()
    consumida = bool(consumos or movimientos)
    ingredientes = session.execute(text("""
        SELECT rm.id_material, rm.cantidad, m.sku, m.nombre, m.activo,
               m.stock_minimo, u.id_unidad, u.codigo, u.nombre AS unidad
        FROM receta_materiales rm
        JOIN materiales m ON m.id_material=rm.id_material
        JOIN unidades_medida u ON u.id_unidad=m.id_unidad
        WHERE rm.id_receta=:receta ORDER BY rm.id_material
    """ + bloqueo), {'receta': orden['id_receta']}).mappings().all()
    orden_elegible = (
        orden['estado'] == 'EN_PROCESO' and
        (orden['id_detalle_pedido'] is None or orden['estado_pedido'] in ('CONFIRMADO', 'EN_PRODUCCION'))
    )
    motivo_orden = ('ORDEN_YA_CONSUMIDA' if consumida else
                    'ORDEN_NO_ELEGIBLE' if not orden_elegible else
                    'RECETA_VACIA' if not ingredientes else None)
    materiales = []
    for fila in ingredientes:
        parametros = {'id': fila['id_material']}
        if bloquear:
            movimientos = session.execute(text("""
                SELECT cantidad_firmada FROM movimientos_material WHERE id_material=:id FOR UPDATE
            """), parametros).scalars()
            disponible = sum(movimientos, Decimal('0.0000'))
        else:
            disponible = session.execute(text("""
                SELECT COALESCE(SUM(cantidad_firmada), 0.0000)
                FROM movimientos_material WHERE id_material=:id
            """), parametros).scalar_one()
        requerido = fila['cantidad'] * orden['cantidad']
        faltante, motivo = disponibilidad(requerido, disponible, fila['activo'])
        materiales.append({
            'id_material': fila['id_material'], 'sku': fila['sku'], 'nombre': fila['nombre'],
            'id_unidad': fila['id_unidad'], 'codigo_unidad': fila['codigo'], 'unidad': fila['unidad'],
            'cantidad_por_unidad': str(fila['cantidad']), 'cantidad_requerida': str(requerido),
            'stock_disponible': str(disponible), 'stock_despues': str(disponible - requerido),
            'stock_minimo': str(fila['stock_minimo']), 'cantidad_faltante': str(faltante),
            'activo': bool(fila['activo']), 'suficiente': motivo is None,
            'estado_disponibilidad': motivo or 'DISPONIBLE', 'motivo_bloqueo': motivo or motivo_orden,
            'elegible_compra': motivo_orden is None and motivo == 'STOCK_INSUFICIENTE',
        })
    return {
        'id_orden': id_orden, 'estado': orden['estado'], 'ya_consumida': consumida,
        'puede_consumir': motivo_orden is None and all(m['suficiente'] for m in materiales),
        'motivo_bloqueo': motivo_orden or next((m['motivo_bloqueo'] for m in materiales if not m['suficiente']), None),
        'materiales': materiales,
    }
