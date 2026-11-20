"""Toco Madera - Etapa 3.18: checkout transaccional y consulta de pedidos propios.

IMPORTANTE: construir la respuesta ANTES de confirmar la transacción evita
responder HTTP 500 por una consulta posterior a un commit que sí tuvo éxito.
Cada checkout debe enviar el mismo UUID en todos sus reintentos.
"""
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import MetaData, Table, select, insert, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db

cliente_pedidos_bp = Blueprint(
    'cliente_pedidos', __name__, url_prefix='/api/v1/cliente/pedidos'
)
CENTAVOS = Decimal('0.01')
MODALIDADES = {'ANTICIPO_50', 'TOTAL'}
# Solo dos métodos permitidos en nuevos pedidos; registros históricos de efectivo permanecen intactos.
METODOS = {'TARJETA_SIMULADA', 'TRANSFERENCIA_SIMULADA'}


def cargar_tablas():
    """Reflejar las tablas y vista de la estructura existente (sin crear tablas)."""
    metadata = MetaData()
    return {
        nombre: Table(nombre, metadata, autoload_with=db.engine)
        for nombre in ('usuarios', 'roles', 'productos', 'pedidos',
                       'pedido_detalles', 'pagos', 'vw_saldos_pedidos')
    }


def valor_json(valor):
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


def fila_json(fila):
    return {k: valor_json(v) for k, v in fila.items()}


def obtener_cliente(tablas):
    """Nunca aceptar id_cliente de Angular; usar identidad JWT y rol MySQL."""
    identidad = get_jwt_identity()
    if not isinstance(identidad, (str, int)) or not str(identidad).strip():
        raise PermissionError('Identidad JWT inválida.')
    u, r = tablas['usuarios'], tablas['roles']
    valor = str(identidad).strip()
    condicion = u.c.id_usuario == int(valor) if valor.isdigit() else u.c.correo == valor
    usuario = db.session.execute(
        select(u.c.id_usuario, u.c.activo, r.c.nombre.label('rol'))
        .join(r, u.c.id_rol == r.c.id_rol).where(condicion)
    ).mappings().first()
    if not usuario or not bool(usuario['activo']):
        raise PermissionError('La cuenta no está disponible.')
    if str(usuario['rol']).upper() != 'CLIENTE':
        raise PermissionError('Esta operación requiere una cuenta CLIENTE.')
    return int(usuario['id_usuario'])


def folio_checkout(datos):
    clave = datos.get('clave_solicitud')
    try:
        if not isinstance(clave, str):
            raise ValueError()
        return 'TM-' + UUID(clave).hex.upper()  # VARCHAR(35) en MySQL
    except (TypeError, ValueError, AttributeError):
        raise ValueError('La clave_solicitud debe ser un UUID válido.')


def validar_detalles(datos, tablas):
    items = datos.get('detalles')
    if not isinstance(items, list) or not 1 <= len(items) <= 50:
        raise ValueError('El carrito debe tener entre 1 y 50 artículos.')
    productos = tablas['productos']
    detalles, total = [], Decimal('0.00')
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Artículo de carrito inválido.')
        identificador, cantidad = item.get('id_producto'), item.get('cantidad')
        if type(identificador) is not int or identificador <= 0:
            raise ValueError('Producto inválido.')
        if type(cantidad) is not int or not 1 <= cantidad <= 100:
            raise ValueError('Cantidad debe estar entre 1 y 100 unidades.')
        p = db.session.execute(
            select(productos.c.id_producto, productos.c.activo,
                   productos.c.precio_lista, productos.c.permite_grabado,
                   productos.c.max_caracteres_grabado)
            .where(productos.c.id_producto == identificador)
        ).mappings().first()
        if not p or not bool(p['activo']):
            raise ValueError(f'Producto {identificador} no disponible.')
        texto, notas = item.get('texto_grabado'), item.get('notas')
        if texto is not None and not isinstance(texto, str):
            raise ValueError('El grabado debe ser texto.')
        if notas is not None and not isinstance(notas, str):
            raise ValueError('Las notas deben ser texto.')
        texto = texto.strip() or None if texto is not None else None
        notas = notas.strip() or None if notas is not None else None
        if notas and len(notas) > 200:
            raise ValueError('Notas de producto: máximo 200 caracteres.')
        if texto:
            if not bool(p['permite_grabado']):
                raise ValueError(f'El producto {identificador} no permite grabado.')
            maximo = min(int(p['max_caracteres_grabado'] or 0), 120)
            if len(texto) > maximo:
                raise ValueError(f'Grabado: máximo {maximo} caracteres.')
        precio = Decimal(str(p['precio_lista']))
        if not precio.is_finite() or precio <= 0:
            raise ValueError(f'Producto {identificador} sin precio válido.')
        total += precio * cantidad
        detalles.append(dict(
            id_producto=identificador, cantidad=cantidad,
            precio_unitario_acordado=precio,
            texto_grabado=texto, tipo_surtido='FABRICACION', notas=notas
        ))
    if total > Decimal('9999999999.99'):
        raise ValueError('El total supera el máximo permitido.')
    return detalles, total


def obtener_pedido(tablas, id_pedido, id_cliente):
    """Consultar pedido y relaciones exclusivamente si pertenece al cliente JWT."""
    p, d, pagos, saldos = (
        tablas['pedidos'], tablas['pedido_detalles'], tablas['pagos'],
        tablas['vw_saldos_pedidos']
    )
    pedido = db.session.execute(
        select(p).where(p.c.id_pedido == id_pedido, p.c.id_cliente == id_cliente)
    ).mappings().first()
    if pedido is None:
        return None
    detalles = db.session.execute(
        select(d).where(d.c.id_pedido == id_pedido).order_by(d.c.id_detalle_pedido)
    ).mappings().all()
    filas_pago = db.session.execute(
        select(pagos).where(pagos.c.id_pedido == id_pedido).order_by(pagos.c.id_pago)
    ).mappings().all()
    saldo = db.session.execute(
        select(saldos).where(saldos.c.id_pedido == id_pedido)
    ).mappings().first()
    return {
        **fila_json(pedido),
        'detalles': [fila_json(row) for row in detalles],
        'pagos': [fila_json(row) for row in filas_pago],
        'resumen': fila_json(saldo) if saldo is not None else None,
    }


@cliente_pedidos_bp.get('/')
@jwt_required()
def listar_mis_pedidos():
    try:
        t = cargar_tablas()
        cliente = obtener_cliente(t)
        p = t['pedidos']
        ids = db.session.execute(
            select(p.c.id_pedido).where(p.c.id_cliente == cliente)
            .order_by(p.c.id_pedido.desc())
        ).scalars().all()
        resultados = [obtener_pedido(t, i, cliente) for i in ids]
        return jsonify(success=True, total=len(resultados), pedidos=resultados), 200
    except PermissionError as ex:
        db.session.rollback()
        return jsonify(success=False, message=str(ex)), 403
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error al listar pedidos del cliente')
        return jsonify(success=False, message='Error al consultar tus pedidos.'), 500


@cliente_pedidos_bp.get('/<int:id_pedido>')
@jwt_required()
def consultar_mi_pedido(id_pedido):
    try:
        t = cargar_tablas()
        cliente = obtener_cliente(t)
        pedido = obtener_pedido(t, id_pedido, cliente)
        return (jsonify(success=True, pedido=pedido), 200) if pedido else (
            jsonify(success=False, message='Pedido no encontrado.'), 404
        )
    except PermissionError as ex:
        db.session.rollback()
        return jsonify(success=False, message=str(ex)), 403
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error al consultar pedido')
        return jsonify(success=False, message='Error al consultar el pedido.'), 500


@cliente_pedidos_bp.post('/')
@jwt_required()
def confirmar_checkout():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        return jsonify(success=False, message='Debes enviar un objeto JSON.'), 400

    try:
        t = cargar_tablas()
        cliente = obtener_cliente(t)
        p, d, pagos = t['pedidos'], t['pedido_detalles'], t['pagos']
        folio = folio_checkout(datos)
        modalidad, metodo = datos.get('modalidad_pago'), datos.get('metodo_pago')
        if modalidad not in MODALIDADES:
            raise ValueError('La modalidad debe ser ANTICIPO_50 o TOTAL.')
        if metodo not in METODOS:
            raise ValueError('Método de pago simulado inválido.')
        notas = datos.get('notas')
        if notas is not None and not isinstance(notas, str):
            raise ValueError('Las notas del pedido deben ser texto.')
        notas = notas.strip() or None if notas is not None else None
        if notas and len(notas) > 500:
            raise ValueError('Las notas del pedido admiten máximo 500 caracteres.')

        existente = db.session.execute(
            select(p.c.id_pedido, p.c.id_cliente).where(p.c.folio == folio)
        ).mappings().first()
        if existente:
            if int(existente['id_cliente']) != cliente:
                return jsonify(success=False, message='Operación no disponible.'), 409
            anterior = obtener_pedido(t, existente['id_pedido'], cliente)
            return jsonify(success=True, message='Checkout ya registrado.',
                           pedido=anterior, repetido=True), 200

        detalles, total = validar_detalles(datos, t)
        pago_inicial = (total * Decimal('0.50')).quantize(
            CENTAVOS, rounding=ROUND_HALF_UP
        ) if modalidad == 'ANTICIPO_50' else total
        if pago_inicial <= 0:
            raise ValueError('El importe del pago debe ser positivo.')

        resultado = db.session.execute(insert(p).values(
            folio=folio, id_cliente=cliente, id_direccion=None,
            estado='PENDIENTE_ANTICIPO', modalidad_pago=modalidad,
            tipo_entrega='RECOLECCION', monto_envio=Decimal('0.00'),
            descuento=Decimal('0.00'), notas=notas
        ))
        id_pedido = resultado.inserted_primary_key[0]
        for detalle in detalles:
            db.session.execute(insert(d).values(id_pedido=id_pedido, **detalle))
        db.session.execute(insert(pagos).values(
            id_pedido=id_pedido, monto=pago_inicial, metodo=metodo,
            estado='APROBADO_SIMULADO', referencia='SIM-' + uuid4().hex.upper()
        ))
        db.session.execute(update(p).where(p.c.id_pedido == id_pedido).values(
            estado='CONFIRMADO'
        ))
        # CRÍTICO: consultar ANTES de commit. Si la vista falla, se revierte
        # toda la operación y no se envía un 500 después de haberla confirmado.
        db.session.flush()
        pedido = obtener_pedido(t, id_pedido, cliente)
        if not pedido or pedido['resumen'] is None:
            raise ValueError('No se pudo calcular el saldo del pedido.')
        db.session.commit()
        return jsonify(success=True, message='Pedido y pago simulado confirmados.',
                       pedido=pedido, repetido=False), 201

    except PermissionError as ex:
        db.session.rollback()
        return jsonify(success=False, message=str(ex)), 403
    except ValueError as ex:
        db.session.rollback()
        return jsonify(success=False, message=str(ex)), 400
    except IntegrityError:
        db.session.rollback()
        current_app.logger.exception('Conflicto al insertar pedido')
        return jsonify(success=False, message='Conflicto: consulta Mis pedidos antes de reintentar.'), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Error SQLAlchemy al confirmar pedido')
        return jsonify(success=False, message='Error interno al registrar pedido; revisa el log Flask.'), 500
