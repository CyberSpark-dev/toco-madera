"""Toco Madera | Etapa 3.19.2: planificación e inicio de órdenes.

Endpoints ADMIN bajo /api/v1/admin/produccion/.
No consume inventario, no crea lotes ni confirma entregas (subetapas siguientes).
Adaptado a las tablas verificadas en CSV del 20-11-2026.
"""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.extensions import db

admin_produccion_bp = Blueprint(
    'admin_produccion', __name__, url_prefix='/api/v1/admin/produccion'
)


def _serializar(valor):
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return valor


def _diccionario(fila):
    return {clave: _serializar(valor) for clave, valor in fila.items()}


def _validar_admin():
    """Consulta rol/activo actuales en BD; no confía solo en el rol del frontend."""
    identidad = get_jwt_identity()
    if not isinstance(identidad, (str, int)) or not str(identidad).strip():
        raise PermissionError('Identidad JWT inválida.')
    valor = str(identidad).strip()
    if valor.isdecimal():
        condicion, params = 'u.id_usuario = :identidad', {'identidad': int(valor)}
    else:
        condicion, params = 'u.correo = :identidad', {'identidad': valor}
    fila = db.session.execute(text(f'''
        SELECT u.id_usuario, u.activo, r.nombre AS rol
        FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE {condicion}
        LIMIT 1
    '''), params).mappings().first()
    if not fila or not bool(fila['activo']) or str(fila['rol']).upper() != 'ADMIN':
        raise PermissionError('Solo un administrador activo puede gestionar producción.')
    return int(fila['id_usuario'])


def _error_interno(mensaje):
    db.session.rollback()
    current_app.logger.exception(mensaje)
    return jsonify(success=False, message='Error interno al gestionar producción.'), 500


@admin_produccion_bp.get('/pendientes')
@jwt_required()
def detalles_pendientes():
    """Detalles de pedidos FABRICACION aún sin cubrir por órdenes activas."""
    try:
        _validar_admin()
        rows = db.session.execute(text('''
            SELECT d.id_detalle_pedido, d.id_pedido, p.folio,
                   p.estado AS estado_pedido,
                    u.nombre AS cliente_nombre, u.correo AS cliente_correo,
                    u.telefono AS cliente_telefono, d.id_producto,
                   pr.nombre AS producto, d.cantidad, d.texto_grabado,
                   COALESCE(op.planificado, 0) AS cantidad_planificada,
                   d.cantidad - COALESCE(op.planificado, 0) AS cantidad_pendiente,
                   (SELECT COUNT(*) FROM recetas r
                    WHERE r.id_producto = d.id_producto AND r.vigente = 1)
                    AS recetas_vigentes
            FROM pedido_detalles d
            INNER JOIN pedidos p ON p.id_pedido = d.id_pedido
            INNER JOIN productos pr ON pr.id_producto = d.id_producto
            INNER JOIN usuarios u ON u.id_usuario = p.id_cliente
            LEFT JOIN (
                SELECT id_detalle_pedido, SUM(cantidad) AS planificado
                FROM ordenes_produccion
                WHERE estado <> 'CANCELADA' AND id_detalle_pedido IS NOT NULL
                GROUP BY id_detalle_pedido
            ) op ON op.id_detalle_pedido = d.id_detalle_pedido
            WHERE d.tipo_surtido = 'FABRICACION'
              AND p.estado IN ('CONFIRMADO', 'EN_PRODUCCION')
              AND d.cantidad > COALESCE(op.planificado, 0)
            ORDER BY d.id_detalle_pedido DESC
            LIMIT 200
        ''')).mappings().all()
        return jsonify(success=True, total=len(rows), detalles=[_diccionario(x) for x in rows]), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except SQLAlchemyError:
        return _error_interno('Error al listar detalles de fabricación pendientes')


@admin_produccion_bp.get('/')
@jwt_required()
def listar_ordenes():
    try:
        _validar_admin()
        rows = db.session.execute(text('''
            SELECT op.id_orden, op.id_receta, op.id_detalle_pedido,
                   op.cantidad, op.estado, op.texto_grabado,
                   op.fecha_inicio, op.fecha_fin, op.observaciones,
                   r.version AS version_receta, r.id_producto,
                   pr.nombre AS producto, d.id_pedido, p.folio,
                    u.nombre AS cliente_nombre, u.correo AS cliente_correo,
                    u.telefono AS cliente_telefono
            FROM ordenes_produccion op
            INNER JOIN recetas r ON r.id_receta = op.id_receta
            INNER JOIN productos pr ON pr.id_producto = r.id_producto
            LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
            LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
             LEFT JOIN usuarios u ON u.id_usuario = p.id_cliente
            ORDER BY op.id_orden DESC LIMIT 200
        ''')).mappings().all()
        return jsonify(success=True, total=len(rows), ordenes=[_diccionario(x) for x in rows]), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except SQLAlchemyError:
        return _error_interno('Error al listar órdenes')


@admin_produccion_bp.get('/<int:id_orden>')
@jwt_required()
def consultar_orden(id_orden):
    try:
        _validar_admin()
        row = db.session.execute(text('''
            SELECT op.id_orden, op.id_receta, op.id_detalle_pedido,
                   op.cantidad, op.estado, op.texto_grabado,
                   op.fecha_inicio, op.fecha_fin, op.observaciones,
                   r.id_producto, r.version AS version_receta,
                   pr.nombre AS producto, d.id_pedido, p.folio,
                    u.nombre AS cliente_nombre, u.correo AS cliente_correo,
                    u.telefono AS cliente_telefono
            FROM ordenes_produccion op
            INNER JOIN recetas r ON r.id_receta = op.id_receta
            INNER JOIN productos pr ON pr.id_producto = r.id_producto
            LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
            LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
             LEFT JOIN usuarios u ON u.id_usuario = p.id_cliente
            WHERE op.id_orden = :id
        '''), {'id': id_orden}).mappings().first()
        if not row:
            return jsonify(success=False, message='Orden no encontrada.'), 404
        materials = db.session.execute(text('''
            SELECT rm.id_material, m.nombre, rm.cantidad AS cantidad_por_unidad,
                   rm.cantidad * :cantidad AS cantidad_requerida
            FROM receta_materiales rm
            JOIN materiales m ON m.id_material = rm.id_material
            WHERE rm.id_receta = :receta ORDER BY rm.id_material
        '''), {'cantidad': int(row['cantidad']), 'receta': int(row['id_receta'])}).mappings().all()
        return jsonify(success=True, orden=_diccionario(row),
                       materiales=[_diccionario(x) for x in materials]), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except SQLAlchemyError:
        return _error_interno('Error al consultar orden')


@admin_produccion_bp.post('/')
@jwt_required()
def planificar_orden():
    """Asocia receta vigente al detalle FABRICACION con bloqueo transaccional."""
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        return jsonify(success=False, message='Se requiere objeto JSON.'), 400
    detalle_id = datos.get('id_detalle_pedido')
    cantidad = datos.get('cantidad')
    observaciones = datos.get('observaciones')
    if type(detalle_id) is not int or detalle_id <= 0:
        return jsonify(success=False, message='id_detalle_pedido debe ser entero positivo.'), 400
    if type(cantidad) is not int or not 1 <= cantidad <= 100000:
        return jsonify(success=False, message='cantidad debe ser entero entre 1 y 100000.'), 400
    if observaciones is not None and not isinstance(observaciones, str):
        return jsonify(success=False, message='observaciones debe ser texto.'), 400
    if observaciones and len(observaciones.strip()) > 300:
        return jsonify(success=False, message='Máximo 300 caracteres en observaciones.'), 400
    try:
        _validar_admin()
        # Bloquear detalle de pedido: serializa planificación concurrente para el mismo detalle.
        fila = db.session.execute(text('''
            SELECT d.id_detalle_pedido, d.id_producto, d.cantidad,
                   d.texto_grabado, d.tipo_surtido, p.estado AS estado_pedido
            FROM pedido_detalles d
            INNER JOIN pedidos p ON p.id_pedido = d.id_pedido
            WHERE d.id_detalle_pedido = :id
            FOR UPDATE
        '''), {'id': detalle_id}).mappings().first()
        if not fila:
            db.session.rollback()
            return jsonify(success=False, message='Detalle no encontrado.'), 404
        if fila['tipo_surtido'] != 'FABRICACION' or fila['estado_pedido'] not in ('CONFIRMADO', 'EN_PRODUCCION'):
            db.session.rollback()
            return jsonify(success=False, message='El pedido no está confirmado o el detalle no requiere fabricación.'), 409
        receta = db.session.execute(text('''
            SELECT id_receta, version FROM recetas
            WHERE id_producto = :producto AND vigente = 1
            ORDER BY version DESC, id_receta DESC LIMIT 1
        '''), {'producto': fila['id_producto']}).mappings().first()
        if not receta:
            db.session.rollback()
            return jsonify(success=False, message='El producto no tiene receta vigente.'), 409
        ya_planificado = db.session.execute(text('''
            SELECT COALESCE(SUM(cantidad), 0) FROM ordenes_produccion
            WHERE id_detalle_pedido = :id AND estado <> 'CANCELADA'
        '''), {'id': detalle_id}).scalar_one()
        restante = int(fila['cantidad']) - int(ya_planificado)
        if restante < cantidad:
            db.session.rollback()
            return jsonify(success=False,
                           message=f'Cantidad excedida. Solo quedan {max(0, restante)} unidades sin planificar.'), 409
        # No usar texto_grabado suministrado por el cliente HTTP: se toma del detalle real.
        res = db.session.execute(text('''
            INSERT INTO ordenes_produccion
                (id_receta, id_detalle_pedido, cantidad, estado,
                 texto_grabado, observaciones)
            VALUES (:receta, :detalle, :cantidad, 'PLANIFICADA', :grabado, :observaciones)
        '''), {'receta': receta['id_receta'], 'detalle': detalle_id,
               'cantidad': cantidad, 'grabado': fila['texto_grabado'],
               'observaciones': (observaciones or '').strip() or None})
        nueva_id = int(res.lastrowid)
        db.session.commit()
        return jsonify(success=True, message='Orden planificada. No se ha consumido inventario.',
                       id_orden=nueva_id, estado='PLANIFICADA',
                       id_receta=int(receta['id_receta']),
                       version_receta=int(receta['version'])), 201
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except SQLAlchemyError:
        return _error_interno('Error al crear orden de producción')


@admin_produccion_bp.post('/<int:id_orden>/iniciar')
@jwt_required()
def iniciar_orden(id_orden):
    """Transición PLANIFICADA -> EN_PROCESO (sin consumir materiales aún)."""
    try:
        _validar_admin()
        orden = db.session.execute(text('''
            SELECT op.id_orden, op.estado, op.id_detalle_pedido, p.estado AS estado_pedido
            FROM ordenes_produccion op
            LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
            LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
             LEFT JOIN usuarios u ON u.id_usuario = p.id_cliente
            WHERE op.id_orden = :id FOR UPDATE
        '''), {'id': id_orden}).mappings().first()
        if not orden:
            db.session.rollback()
            return jsonify(success=False, message='Orden no encontrada.'), 404
        if orden['estado'] != 'PLANIFICADA':
            db.session.rollback()
            return jsonify(success=False, message='Solo puede iniciarse una orden PLANIFICADA.'), 409
        if orden['id_detalle_pedido'] is not None and orden['estado_pedido'] not in ('CONFIRMADO', 'EN_PRODUCCION'):
            db.session.rollback()
            return jsonify(success=False, message='El pedido ya no admite producción.'), 409
        db.session.execute(text('''
            UPDATE ordenes_produccion
            SET estado='EN_PROCESO', fecha_inicio=COALESCE(fecha_inicio, NOW())
            WHERE id_orden=:id
        '''), {'id': id_orden})
        db.session.commit()
        return jsonify(success=True, id_orden=id_orden, estado='EN_PROCESO',
                       message='Orden iniciada. Consumo de materiales pendiente de la Etapa 3.19.3.'), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except SQLAlchemyError:
        return _error_interno('Error al iniciar orden de producción')


# ================================================================
# ETAPA 3.19.3 - CONSUMO TRANSACCIONAL DE MATERIAS PRIMAS
# ================================================================
# No se altera el estado EN_PROCESO: finalizar la orden y crear el
# lote del producto terminado corresponden a la etapa 3.19.4.
#
# Existencias = SUM(movimientos_material.cantidad_firmada).
# La tabla materiales no tiene columna stock.
# ================================================================

_ESCALA = Decimal('0.0001')


def _cantidad_decimal(valor):
    """Convierte cantidades SQL a Decimal, conservando precisión monetaria."""
    return Decimal(str(valor)).quantize(_ESCALA, rounding=ROUND_HALF_UP)


def _preparar_materiales_orden(id_orden):
    """Construye requerimientos y saldos; se invoca dentro de transacción."""
    rows = db.session.execute(text('''
        SELECT rm.id_material, m.sku, m.nombre,
               rm.cantidad AS cantidad_por_unidad,
               m.stock_minimo, m.activo,
               COALESCE(SUM(mm.cantidad_firmada), 0) AS disponible
        FROM ordenes_produccion op
        INNER JOIN receta_materiales rm ON rm.id_receta = op.id_receta
        INNER JOIN materiales m ON m.id_material = rm.id_material
        LEFT JOIN movimientos_material mm ON mm.id_material = m.id_material
        WHERE op.id_orden = :orden
        GROUP BY rm.id_material, m.sku, m.nombre,
                 rm.cantidad, m.stock_minimo, m.activo
        ORDER BY rm.id_material
    '''), {'orden': id_orden}).mappings().all()
    return rows


@admin_produccion_bp.get('/<int:id_orden>/verificar-materiales')
@jwt_required()
def verificar_materiales_orden(id_orden):
    """Vista previa de consumo sin descontar ni escribir en la BD."""
    try:
        _validar_admin()
        orden = db.session.execute(text('''
            SELECT id_orden, estado, cantidad FROM ordenes_produccion
            WHERE id_orden = :id
        '''), {'id': id_orden}).mappings().first()
        if not orden:
            db.session.rollback()
            return jsonify(success=False, message='Orden no encontrada.'), 404
        rows = _preparar_materiales_orden(id_orden)
        ya_consumida = bool(db.session.execute(text('''
            SELECT EXISTS(SELECT 1 FROM consumos_produccion WHERE id_orden = :id)
                OR EXISTS(SELECT 1 FROM movimientos_material
                          WHERE id_orden_produccion = :id AND tipo = 'CONSUMO')
        '''), {'id': id_orden}).scalar_one())
        materiales = []
        for fila in rows:
            requerido = _cantidad_decimal(
                _cantidad_decimal(fila['cantidad_por_unidad']) * int(orden['cantidad'])
            )
            disponible = _cantidad_decimal(fila['disponible'])
            materiales.append({
                'id_material': int(fila['id_material']),
                'sku': fila['sku'],
                'nombre': fila['nombre'],
                'cantidad_por_unidad': str(_cantidad_decimal(fila['cantidad_por_unidad'])),
                'cantidad_requerida': str(requerido),
                'stock_disponible': str(disponible),
                'stock_despues': str(disponible - requerido),
                'stock_minimo': str(_cantidad_decimal(fila['stock_minimo'])),
                'activo': bool(fila['activo']),
                'suficiente': bool(fila['activo']) and requerido > 0 and disponible >= requerido,
            })
        disponible_para_consumir = (
            orden['estado'] == 'EN_PROCESO'
            and not ya_consumida and bool(materiales)
            and all(x['suficiente'] for x in materiales)
        )
        return jsonify(
            success=True, id_orden=id_orden,
            estado=orden['estado'], ya_consumida=ya_consumida,
            puede_consumir=disponible_para_consumir,
            materiales=materiales,
            # Lectura orientativa: las existencias podrían cambiar antes de confirmar.
            advertencia='La disponibilidad se valida nuevamente dentro de la transacción al consumir.'
        ), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except (SQLAlchemyError, ValueError, InvalidOperation):
        return _error_interno('Error al verificar materiales para consumo')


@admin_produccion_bp.post('/<int:id_orden>/consumir-materiales')
@jwt_required()
def consumir_materiales_orden(id_orden):
    """Descuenta todos los materiales de la receta en una única transacción.

    Seguridad:
      - ADMIN activo y JWT válido.
      - Solo órdenes EN_PROCESO.
      - Bloquea la orden y filas de materiales con SELECT ... FOR UPDATE.
      - Valida stock del movimiento y no permite saldos negativos.
      - Bloquea consumo duplicado mediante índices únicos existentes.
      - No usa un precio ni cantidades enviados desde el frontend.

    Nota: otros módulos que escriban ajustes de stock deben adoptar
    el mismo bloqueo de filas de materiales para serialización completa.
    """
    try:
        _validar_admin()
        orden = db.session.execute(text('''
            SELECT op.id_orden, op.id_receta, op.cantidad, op.estado,
                   op.id_detalle_pedido, p.estado AS estado_pedido
            FROM ordenes_produccion op
            LEFT JOIN pedido_detalles d ON d.id_detalle_pedido = op.id_detalle_pedido
            LEFT JOIN pedidos p ON p.id_pedido = d.id_pedido
            WHERE op.id_orden = :id
            FOR UPDATE
        '''), {'id': id_orden}).mappings().first()
        if not orden:
            db.session.rollback()
            return jsonify(success=False, message='Orden no encontrada.'), 404
        if orden['estado'] != 'EN_PROCESO':
            db.session.rollback()
            return jsonify(success=False,
                           message='Solo se pueden consumir materiales de órdenes EN_PROCESO.'), 409
        if orden['id_detalle_pedido'] is not None and orden['estado_pedido'] not in ('CONFIRMADO', 'EN_PRODUCCION'):
            db.session.rollback()
            return jsonify(success=False, message='El pedido ya no admite producción.'), 409

        # La orden bloqueada serializa solicitudes concurrentes para la misma orden.
        tiene_consumo = db.session.execute(text('''
            SELECT EXISTS(SELECT 1 FROM consumos_produccion WHERE id_orden = :id)
                OR EXISTS(SELECT 1 FROM movimientos_material
                          WHERE id_orden_produccion = :id AND tipo = 'CONSUMO')
        '''), {'id': id_orden}).scalar_one()
        if tiene_consumo:
            db.session.rollback()
            return jsonify(success=False, message='Esta orden ya tiene consumos registrados; no se permite repetir el descuento.'), 409

        receta_materiales = db.session.execute(text('''
            SELECT rm.id_material, rm.cantidad AS cantidad_por_unidad
            FROM receta_materiales rm
            WHERE rm.id_receta = :receta
            ORDER BY rm.id_material
        '''), {'receta': orden['id_receta']}).mappings().all()
        if not receta_materiales:
            db.session.rollback()
            return jsonify(success=False,
                           message='La receta no contiene materiales; no se realizó ningún descuento.'), 409

        detalles = []
        # Bloquear en orden creciente evita interbloqueos entre órdenes que
        # consumen los mismos materiales. Las operaciones de compra y ajuste
        # deberían seguir la misma convención de bloqueo.
        for receta_material in receta_materiales:
            id_material = int(receta_material['id_material'])
            material = db.session.execute(text('''
                SELECT id_material, nombre, activo FROM materiales
                WHERE id_material = :id FOR UPDATE
            '''), {'id': id_material}).mappings().first()
            if not material or not bool(material['activo']):
                db.session.rollback()
                return jsonify(success=False, message=f'El material {id_material} no existe o está inactivo.'), 409
            cantidad_requerida = (
                _cantidad_decimal(receta_material['cantidad_por_unidad']) * int(orden['cantidad'])
            ).quantize(_ESCALA)
            if cantidad_requerida <= 0 or cantidad_requerida > Decimal('9999999999.9999'):
                db.session.rollback()
                return jsonify(success=False, message=f'Cantidad inválida en receta para material {id_material}.'), 409
            # Lectura bloqueante: evita usar una instantánea desactualizada
            # en MySQL REPEATABLE READ después de la consulta del rol ADMIN.
            movimientos = db.session.execute(text('''
                SELECT cantidad_firmada FROM movimientos_material
                WHERE id_material = :id FOR UPDATE
            '''), {'id': id_material}).scalars().all()
            saldo = _cantidad_decimal(sum(
                (_cantidad_decimal(mov) for mov in movimientos), Decimal('0')
            ))
            if saldo < cantidad_requerida:
                db.session.rollback()
                return jsonify(
                    success=False,
                    message=f'Stock insuficiente de {material["nombre"]}. Disponible: {saldo}; requerido: {cantidad_requerida}.',
                    id_material=id_material,
                    disponible=str(saldo), requerido=str(cantidad_requerida)
                ), 409
            # Costo unitario de la última compra (referencia histórica).
            # Si las existencias provienen de ajustes sin costo, se registra
            # explícitamente 0.0000; no se inventa un precio.
            ultimo_costo = db.session.execute(text('''
                SELECT costo_unitario_aplicado
                FROM movimientos_material
                WHERE id_material = :id AND tipo = 'COMPRA'
                  AND cantidad_firmada > 0
                  AND costo_unitario_aplicado IS NOT NULL
                ORDER BY fecha DESC, id_movimiento DESC
                LIMIT 1
            '''), {'id': id_material}).scalar_one_or_none()
            costo = _cantidad_decimal(ultimo_costo) if ultimo_costo is not None else Decimal('0.0000')
            detalles.append({
                'id_material': id_material,
                'material': material['nombre'],
                'cantidad': cantidad_requerida,
                'costo': costo,
                'saldo_antes': saldo,
                'saldo_despues': saldo-cantidad_requerida,
            })

        # TODO O NADA: ambas tablas se escriben y confirman en el mismo commit.
        for item in detalles:
            db.session.execute(text('''
                INSERT INTO consumos_produccion
                    (id_orden, id_material, cantidad, costo_unitario_aplicado)
                VALUES (:orden, :material, :cantidad, :costo)
            '''), {
                'orden': id_orden,
                'material': item['id_material'],
                'cantidad': item['cantidad'],
                'costo': item['costo'],
            })
            db.session.execute(text('''
                INSERT INTO movimientos_material
                    (id_material, tipo, cantidad_firmada, costo_unitario_aplicado,
                     id_orden_produccion, observaciones)
                VALUES (:material, 'CONSUMO', :cantidad, :costo, :orden, :observaciones)
            '''), {
                'material': item['id_material'],
                'cantidad': -item['cantidad'],
                'costo': item['costo'],
                'orden': id_orden,
                'observaciones': f'Consumo de materia prima por orden de producción {id_orden}',
            })
        db.session.commit()
        return jsonify(
            success=True, id_orden=id_orden, estado='EN_PROCESO',
            message='Materiales consumidos correctamente en una sola transacción.',
            total_materiales=len(detalles),
            materiales=[{
                'id_material': item['id_material'],
                'nombre': item['material'],
                'cantidad_consumida': str(item['cantidad']),
                'stock_antes': str(item['saldo_antes']),
                'stock_despues': str(item['saldo_despues']),
                'costo_unitario_aplicado': str(item['costo']),
            } for item in detalles]
        ), 200
    except PermissionError as exc:
        db.session.rollback()
        return jsonify(success=False, message=str(exc)), 403
    except IntegrityError:
        db.session.rollback()
        return jsonify(success=False,
                       message='El consumo ya está registrado o viola una restricción; no se realizaron descuentos parciales.'), 409
    except (SQLAlchemyError, ValueError, InvalidOperation):
        return _error_interno('Error al registrar consumo transaccional de materiales')
