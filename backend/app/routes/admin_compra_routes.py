
# ============================================================
# TOCO MADERA - COMPRAS Y RECEPCIÓN DE MATERIALES
# Archivo: backend/app/routes/admin_compra_routes.py
# ETAPA 3.17
# ============================================================
#
# OPERACIONES:
# - Consultar compras y sus detalles.
# - Registrar compras en estado BORRADOR.
# - Confirmar recepción de materiales.
# - Crear movimientos de entrada de inventario.
# - Cancelar compras que aún no se reciben.
#
# SEGURIDAD:
# - Todos los endpoints requieren rol ADMIN.
# - El JWT se valida mediante @admin_required.
#
# TRANSACCIONES:
# - La compra y sus detalles se guardan juntos.
# - La recepción y sus movimientos se guardan juntos.
# - Cualquier fallo revierte la transacción.
#
# NO MODIFICA LA ESTRUCTURA DE MYSQL.
# ============================================================

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_CEILING
import hashlib
import json
from uuid import UUID

from flask import (
    Blueprint,
    jsonify,
    request,
    current_app
)

from sqlalchemy import (
    MetaData,
    Table,
    select,
    insert,
    update,
    func, delete, text
)
from flask_jwt_extended import get_jwt_identity

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError
)

from app.extensions import db
from app.utils.permisos import admin_required
from app.services.faltantes_produccion import verificar_orden


# ============================================================
# 1. BLUEPRINT
# ============================================================

admin_compras_bp = Blueprint(
    "admin_compras",
    __name__,
    url_prefix="/api/v1/admin/compras"
)


# ============================================================
# 2. CARGAR TABLAS EXISTENTES
# ============================================================

def obtener_tablas():
    """
    Refleja las tablas reales de MySQL.

    No crea, elimina ni modifica tablas.
    """

    metadata = MetaData()

    nombres = (
        "compras",
        "compra_detalles",
        "movimientos_material",
        "proveedores",
        "materiales"
    )

    tablas = {}

    for nombre in nombres:
        tablas[nombre] = Table(
            nombre,
            metadata,
            autoload_with=db.engine
        )

    return tablas


# ============================================================
# 3. CONVERSIÓN DE VALORES
# ============================================================

def valor_json(valor):
    """
    Preparar valores para JSON.

    Los DECIMAL se convierten a string
    para conservar la precisión.
    """

    if isinstance(valor, Decimal):
        return str(valor)

    if isinstance(valor, datetime):
        return valor.isoformat()

    return valor


def fila_json(fila):
    """
    Convertir una fila SQLAlchemy a diccionario.
    """

    return {
        clave: valor_json(valor)
        for clave, valor in fila.items()
    }


# ============================================================
# 4. VALIDAR CANTIDADES Y COSTOS
# ============================================================

def decimal_positivo(valor, campo):
    """
    Validar DECIMAL(14,4).

    Permite números mayores que cero y
    máximo cuatro posiciones decimales.
    """

    if valor is None or isinstance(valor, bool):
        raise ValueError(
            f"{campo} debe ser numérico."
        )

    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(
            f"{campo} debe ser numérico."
        )

    if not numero.is_finite() or numero <= 0:
        raise ValueError(
            f"{campo} debe ser mayor que cero."
        )

    if numero > Decimal("9999999999.9999"):
        raise ValueError(
            f"{campo} supera el máximo permitido."
        )

    if numero != numero.quantize(
        Decimal("0.0001")
    ):
        raise ValueError(
            f"{campo} admite máximo cuatro decimales."
        )

    return numero


# ============================================================
# 5. VALIDAR TEXTO OPCIONAL
# ============================================================

def texto_opcional(datos, campo, maximo):
    """
    Validar campos de texto que permiten NULL.

    No se admiten objetos, arreglos ni valores
    de otro tipo distintos de strings.
    """

    valor = datos.get(campo)

    if valor is None or valor == "":
        return None

    if not isinstance(valor, str):
        raise ValueError(
            f"{campo} debe ser texto."
        )

    valor = valor.strip()

    if len(valor) > maximo:
        raise ValueError(
            f"{campo} admite máximo {maximo} caracteres."
        )

    return valor or None


# ============================================================
# 6. VALIDAR DETALLES DE COMPRA
# ============================================================

def validar_detalles(detalles, tablas):
    """
    Comprobar los materiales y sus cantidades.

    No permite materiales inexistentes,
    inactivos o repetidos en una misma compra.
    """

    if not isinstance(detalles, list):
        raise ValueError(
            "Debes enviar una lista de materiales."
        )

    if not 1 <= len(detalles) <= 100:
        raise ValueError(
            "La compra debe tener entre 1 y 100 materiales."
        )

    materiales = tablas["materiales"]

    resultado = []
    ids_utilizados = set()

    for indice, item in enumerate(detalles, start=1):

        if not isinstance(item, dict):
            raise ValueError(
                f"El detalle {indice} no es válido."
            )

        id_material = item.get("id_material")

        if (
            type(id_material) is not int
            or id_material <= 0
        ):
            raise ValueError(
                f"El detalle {indice} tiene un material inválido."
            )

        if id_material in ids_utilizados:
            raise ValueError(
                "Un material no puede repetirse en la misma compra."
            )

        ids_utilizados.add(id_material)

        # Verificar que el material exista y esté activo.
        material = db.session.execute(
            select(
                materiales.c.id_material,
                materiales.c.activo
            ).where(
                materiales.c.id_material == id_material
            )
        ).mappings().first()

        if material is None:
            raise ValueError(
                f"El material {id_material} no existe."
            )

        if not bool(material["activo"]):
            raise ValueError(
                f"El material {id_material} está inactivo."
            )

        cantidad = decimal_positivo(
            item.get("cantidad"),
            "cantidad"
        )

        costo = decimal_positivo(
            item.get("costo_unitario"),
            "costo_unitario"
        )

        resultado.append({
            "id_material": id_material,
            "cantidad": cantidad,
            "costo_unitario": costo
        })

    return resultado


# ============================================================
# 7. CONSULTAR UNA COMPRA CON SUS DETALLES
# ============================================================

def obtener_compra_completa(id_compra, tablas):
    """
    Devuelve los datos de la compra y su detalle.

    También calcula el subtotal de cada
    material y el total general.
    """

    compras = tablas["compras"]
    detalles = tablas["compra_detalles"]

    compra = db.session.execute(
        select(compras).where(
            compras.c.id_compra == id_compra
        )
    ).mappings().first()

    if compra is None:
        return None

    filas_detalle = db.session.execute(
        select(detalles).where(
            detalles.c.id_compra == id_compra
        ).order_by(
            detalles.c.id_detalle_compra
        )
    ).mappings().all()

    total = Decimal("0")

    resultado_detalles = []

    for fila in filas_detalle:

        subtotal = (
            Decimal(str(fila["cantidad"])) *
            Decimal(str(fila["costo_unitario"]))
        )

        total += subtotal

        item = fila_json(fila)
        item["subtotal"] = str(subtotal)

        resultado_detalles.append(item)

    resultado = fila_json(compra)
    resultado.pop("huella_solicitud", None)

    resultado["detalles"] = resultado_detalles
    resultado["total"] = str(total)

    return resultado


# ============================================================
# 8. GET - LISTAR COMPRAS
# ============================================================

@admin_compras_bp.get("/")
@admin_required
def listar_compras():
    """
    Devuelve las compras ordenadas por fecha.

    Cada compra incluye su información general,
    detalles y total calculado.
    """

    try:
        tablas = obtener_tablas()
        compras = tablas["compras"]

        filas = db.session.execute(
            select(compras).order_by(
                compras.c.id_compra.desc()
            )
        ).mappings().all()

        resultado = []

        for fila in filas:

            compra = obtener_compra_completa(
                fila["id_compra"],
                tablas
            )

            resultado.append(compra)

        return jsonify({
            "success": True,
            "total": len(resultado),
            "compras": resultado
        }), 200

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al listar compras"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar las compras."
        }), 500


# ============================================================
# 9. GET - CONSULTAR UNA COMPRA
# ============================================================

@admin_compras_bp.get("/<int:id_compra>")
@admin_required
def consultar_compra(id_compra):
    """
    Consulta una compra con sus materiales.
    """

    try:
        tablas = obtener_tablas()

        compra = obtener_compra_completa(
            id_compra,
            tablas
        )

        if compra is None:
            return jsonify({
                "success": False,
                "message": "Compra no encontrada."
            }), 404

        return jsonify({
            "success": True,
            "compra": compra
        }), 200

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al consultar compra"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar la compra."
        }), 500


# ============================================================
# 10. POST - REGISTRAR COMPRA EN BORRADOR
# ============================================================

class ConflictoCompra(ValueError):
    """La compra o el faltante cambió antes de guardar."""


def validar_cabecera(datos, tablas):
    id_proveedor = datos.get("id_proveedor")
    if type(id_proveedor) is not int or id_proveedor <= 0:
        raise ValueError("Selecciona un proveedor válido.")
    proveedores = tablas["proveedores"]
    activo = db.session.execute(select(proveedores.c.activo).where(
        proveedores.c.id_proveedor == id_proveedor
    )).scalar_one_or_none()
    if not activo:
        raise ValueError("Selecciona un proveedor activo.")
    return {
        "id_proveedor": id_proveedor,
        "referencia_documento": texto_opcional(datos, "referencia_documento", 90),
        "observaciones": texto_opcional(datos, "observaciones", 300),
    }


def cotizaciones_verificadas(proveedor, material):
    # Solo cotizaciones del proveedor elegido, con cantidad en la unidad base
    # del material y con un costo representable en los campos existentes.
    cotizaciones = db.session.execute(text("""
        SELECT c.id_cotizacion, c.presentacion, c.cantidad_base, c.precio_presentacion,
               u.nombre AS unidad
        FROM cotizaciones_material c
        JOIN materiales m ON m.id_material=c.id_material
        JOIN unidades_medida u ON u.id_unidad=m.id_unidad
        JOIN proveedores p ON p.id_proveedor=c.id_proveedor
        WHERE c.id_proveedor=:proveedor AND c.id_material=:material
          AND c.clasificacion='COTIZADA' AND c.moneda='MXN' AND p.activo=1
          AND c.precio_presentacion>0 AND c.cantidad_base>0
        ORDER BY c.fecha DESC, c.id_cotizacion DESC
    """), {'proveedor': proveedor, 'material': material}).mappings()
    return [c for c in cotizaciones if
            (c['precio_presentacion'] / c['cantidad_base']).quantize(Decimal('0.0001'))
            * c['cantidad_base'] == c['precio_presentacion']]


def validar_renglones(datos, tablas, proveedor):
    originales = datos.get('detalles')
    detalles = validar_detalles(originales, tablas)
    for original, detalle in zip(originales, detalles):
        material = db.session.execute(text("""
            SELECT id_unidad FROM materiales WHERE id_material=:id
        """), {'id': detalle['id_material']}).mappings().one()
        if 'id_unidad' in original and (
            type(original['id_unidad']) is not int or original['id_unidad'] != material['id_unidad']
        ):
            raise ValueError('La unidad seleccionada no corresponde al material.')
        id_cotizacion = original.get('id_cotizacion')
        if id_cotizacion is None:
            if original.get('cantidad_presentaciones') is not None:
                raise ValueError('Selecciona una presentación verificada.')
            continue
        cantidad = original.get('cantidad_presentaciones')
        if type(id_cotizacion) is not int or type(cantidad) is not int or not 1 <= cantidad <= 4294967295:
            raise ValueError('Indica una presentación y un número entero positivo de envases.')
        cotizacion = next((c for c in cotizaciones_verificadas(proveedor, detalle['id_material'])
                          if c['id_cotizacion'] == id_cotizacion), None)
        if cotizacion is None:
            raise ValueError('La presentación no está verificada para este proveedor y material.')
        factor = cotizacion['cantidad_base']
        precio = cotizacion['precio_presentacion']
        if detalle['cantidad'] != factor * cantidad or detalle['costo_unitario'] * factor != precio:
            raise ValueError('La cantidad y el costo deben coincidir con la presentación seleccionada.')
        detalle.update(
            id_cotizacion=id_cotizacion, presentacion_aplicada=cotizacion['presentacion'],
            unidad_base_aplicada=cotizacion['unidad'], cantidad_presentaciones=cantidad,
            factor_presentacion=factor, precio_presentacion_aplicado=precio,
        )
    return detalles


def idempotencia(datos):
    clave = datos.get('clave_solicitud')
    if clave is None:
        return None, None
    if not isinstance(clave, str):
        raise ValueError('La clave de solicitud debe ser un UUID válido.')
    try:
        clave = str(UUID(clave))
        canonica = json.dumps({**datos, 'clave_solicitud': clave},
                              sort_keys=True, separators=(',', ':'), allow_nan=False)
    except ValueError:
        raise ValueError('La solicitud o su clave no son válidas.') from None
    return clave, hashlib.sha256(canonica.encode()).hexdigest()


def compra_por_clave(tablas, clave, huella):
    compras = tablas['compras']
    anterior = db.session.execute(select(compras.c.id_compra, compras.c.huella_solicitud)
                                  .where(compras.c.clave_solicitud == clave)).mappings().first()
    if anterior is None:
        return None
    if anterior['huella_solicitud'] != huella:
        raise ConflictoCompra('La clave de solicitud ya se usó con datos diferentes.')
    return jsonify(success=True, reutilizada=True,
                   compra=obtener_compra_completa(anterior['id_compra'], tablas)), 200


def borradores_y_cobertura(tablas, id_orden, *, bloquear=False):
    compras, detalles = tablas['compras'], tablas['compra_detalles']
    consulta = select(compras.c.id_compra, compras.c.id_proveedor, compras.c.revision).where(
        compras.c.id_orden_produccion == id_orden, compras.c.estado == 'BORRADOR'
    ).order_by(compras.c.id_compra)
    borradores = db.session.execute(consulta.with_for_update() if bloquear else consulta).mappings().all()
    cobertura = {}
    for borrador in borradores:
        consulta = select(detalles.c.id_material, detalles.c.cantidad).where(
            detalles.c.id_compra == borrador['id_compra']
        )
        for material, cantidad in db.session.execute(consulta.with_for_update() if bloquear else consulta):
            cobertura[material] = cobertura.get(material, Decimal(0)) + cantidad
    return borradores, cobertura


def faltantes_sin_cubrir(verificacion, cobertura):
    return {
        m['id_material']: max(Decimal(0), Decimal(m['cantidad_faltante']) - cobertura.get(m['id_material'], 0))
        for m in verificacion['materiales'] if m['elegible_compra']
    }


@admin_compras_bp.get('/preparacion/<int:id_orden>')
@admin_required
def preparar_compra(id_orden):
    try:
        tablas = obtener_tablas()
        if 'id_orden_produccion' not in tablas['compras'].c:
            current_app.logger.info('Preparación de compra no disponible: orden=%s, motivo=COMPRAS_ASISTIDAS_NO_HABILITADAS', id_orden)
            return jsonify(success=False, codigo='COMPRAS_ASISTIDAS_NO_HABILITADAS',
                           message='La compra asistida aún no está disponible.'), 503
        proveedor = request.args.get('id_proveedor', type=int)
        if 'id_proveedor' in request.args and (proveedor is None or proveedor <= 0):
            raise ValueError('Selecciona un proveedor válido.')
        verificacion = verificar_orden(db.session, id_orden)
        if verificacion is None:
            return jsonify(success=False, message='Orden no encontrada.'), 404
        borradores, cobertura = borradores_y_cobertura(tablas, id_orden)
        pendientes = faltantes_sin_cubrir(verificacion, cobertura)
        materiales = []
        for m in verificacion.pop('materiales'):
            if m['id_material'] not in pendientes:
                continue
            id_material = m['id_material']
            sugerida = pendientes[id_material]
            presentaciones = []
            if proveedor and sugerida:
                for cotizacion in cotizaciones_verificadas(proveedor, id_material):
                    factor = cotizacion['cantidad_base']
                    envases = int((sugerida / factor).to_integral_value(rounding=ROUND_CEILING))
                    if envases <= 4294967295 and envases * factor <= Decimal('9999999999.9999'):
                        presentaciones.append({
                            **fila_json(cotizacion), 'cantidad_presentaciones_sugerida': envases,
                            'cantidad_base_sugerida': str(envases * factor),
                            'costo_unitario': str((cotizacion['precio_presentacion'] / factor).quantize(Decimal('0.0001'))),
                        })
            materiales.append({
                **m, 'cobertura_borradores': str(cobertura.get(id_material, Decimal(0))),
                'cantidad_sugerida': str(sugerida),
                'presentaciones': presentaciones,
            })
        return jsonify(success=True, **verificacion, materiales=materiales,
                       borradores=[dict(b) for b in borradores]), 200
    except ValueError as error:
        return jsonify(success=False, message=str(error)), 400
    except SQLAlchemyError as error:
        db.session.rollback()
        numero = getattr(getattr(error, 'orig', None), 'args', (None,))
        codigo = numero[0] if numero and isinstance(numero[0], int) else None
        current_app.logger.error('Error en preparación de compra: orden=%s, tipo=%s, código=%s',
                                 id_orden, type(error).__name__, codigo)
        return jsonify(success=False, message='No fue posible preparar la compra.'), 500


@admin_compras_bp.post("/")
@admin_required
def registrar_compra():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        return jsonify(success=False, message='Revisa los datos de la compra.'), 400
    clave = huella = None
    try:
        tablas = obtener_tablas()
        compras, detalle_tabla = tablas['compras'], tablas['compra_detalles']
        clave, huella = idempotencia(datos)
        id_orden = datos.get('id_orden_produccion')
        if id_orden is not None and (type(id_orden) is not int or id_orden <= 0 or clave is None):
            raise ValueError('Indica una orden válida y una clave de solicitud para la compra asistida.')
        asistida = id_orden is not None or clave is not None
        if asistida and 'id_orden_produccion' not in compras.c:
            return jsonify(success=False, message='La compra asistida aún no está disponible.'), 503
        if clave:
            anterior = compra_por_clave(tablas, clave, huella)
            if anterior is not None:
                return anterior
        cabecera = validar_cabecera(datos, tablas)
        if id_orden is not None:
            existe = db.session.execute(text(
                'SELECT id_orden FROM ordenes_produccion WHERE id_orden=:id FOR UPDATE'
            ), {'id': id_orden}).first()
            if not existe:
                return jsonify(success=False, message='Orden no encontrada.'), 404
            # Tras esperar la orden, una lectura actual detecta reintentos ya confirmados.
            if clave:
                registro = db.session.execute(select(compras.c.id_compra, compras.c.huella_solicitud)
                    .where(compras.c.clave_solicitud == clave).with_for_update()).mappings().first()
                if registro:
                    db.session.rollback()
                    return compra_por_clave(tablas, clave, huella)
            _, cobertura = borradores_y_cobertura(tablas, id_orden, bloquear=True)
            orden = verificar_orden(db.session, id_orden, bloquear=True)
            pendientes = faltantes_sin_cubrir(orden, cobertura)
        detalles = validar_renglones(datos, tablas, cabecera['id_proveedor'])
        if id_orden is not None:
            if not any(pendientes.get(d['id_material'], 0) > 0 for d in detalles):
                raise ConflictoCompra('No quedan faltantes sin cubrir para los materiales seleccionados. Revisa los borradores.')
            if any(d['id_material'] in pendientes and not pendientes[d['id_material']] for d in detalles):
                raise ConflictoCompra('Un borrador ya cubre uno de los materiales seleccionados.')
        if asistida:
            cabecera.update(id_orden_produccion=id_orden, clave_solicitud=clave,
                            huella_solicitud=huella, id_usuario_registro=int(get_jwt_identity()))
        if 'id_cotizacion' not in detalle_tabla.c and any('id_cotizacion' in d for d in detalles):
            return jsonify(success=False, message='Las presentaciones aún no están disponibles.'), 503
        id_compra = db.session.execute(insert(compras).values(
            **cabecera, estado='BORRADOR'
        )).inserted_primary_key[0]
        for detalle in detalles:
            db.session.execute(insert(detalle_tabla).values(id_compra=id_compra, **detalle))
        compra = obtener_compra_completa(id_compra, tablas)
        db.session.commit()
        return jsonify(success=True, message='Compra registrada como borrador.', compra=compra), 201
    except ConflictoCompra as error:
        db.session.rollback()
        return jsonify(success=False, message=str(error)), 409
    except ValueError as error:
        db.session.rollback()
        return jsonify(success=False, message=str(error)), 400
    except IntegrityError:
        db.session.rollback()
        if clave:
            try:
                anterior = compra_por_clave(tablas, clave, huella)
                if anterior is not None:
                    return anterior
            except ConflictoCompra as error:
                return jsonify(success=False, message=str(error)), 409
        return jsonify(success=False, message='No se pudo registrar la compra. Actualiza y vuelve a intentarlo.'), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.error('No se pudo registrar la compra')
        return jsonify(success=False, message='No fue posible registrar la compra.'), 500


@admin_compras_bp.put('/<int:id_compra>')
@admin_required
def editar_borrador(id_compra):
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict) or type(datos.get('revision')) is not int or datos['revision'] < 1:
        return jsonify(success=False, message='Indica la revisión actual del borrador.'), 400
    if any(campo in datos for campo in ('id_orden_produccion', 'clave_solicitud', 'estado')):
        return jsonify(success=False, message='El origen, la clave y el estado de la compra se conservan.'), 400
    try:
        tablas = obtener_tablas()
        compras, detalles = tablas['compras'], tablas['compra_detalles']
        if 'revision' not in compras.c:
            return jsonify(success=False, message='La edición de borradores aún no está disponible.'), 503
        compra = db.session.execute(select(compras).where(compras.c.id_compra == id_compra)
                                    .with_for_update()).mappings().first()
        if not compra:
            return jsonify(success=False, message='Compra no encontrada.'), 404
        if compra['estado'] != 'BORRADOR' or compra['revision'] != datos['revision']:
            raise ConflictoCompra('La compra cambió. Actualízala antes de editar.')
        cabecera = validar_cabecera(datos, tablas)
        renglones = validar_renglones(datos, tablas, cabecera['id_proveedor'])
        actuales = {fila.id_material: fila.id_detalle_compra for fila in db.session.execute(
            select(detalles.c.id_material, detalles.c.id_detalle_compra)
            .where(detalles.c.id_compra == id_compra).with_for_update()
        )}
        campos_presentacion = ('id_cotizacion', 'presentacion_aplicada', 'unidad_base_aplicada',
                              'cantidad_presentaciones', 'factor_presentacion', 'precio_presentacion_aplicado')
        for renglon in renglones:
            id_detalle = actuales.pop(renglon['id_material'], None)
            if id_detalle is None:
                db.session.execute(insert(detalles).values(id_compra=id_compra, **renglon))
            else:
                valores = {**dict.fromkeys(campos_presentacion), **renglon}
                db.session.execute(update(detalles).where(detalles.c.id_detalle_compra == id_detalle)
                                   .values(**valores))
        if actuales:
            db.session.execute(delete(detalles).where(detalles.c.id_detalle_compra.in_(actuales.values())))
        db.session.execute(update(compras).where(compras.c.id_compra == id_compra)
                           .values(**cabecera, revision=compra['revision'] + 1))
        resultado = obtener_compra_completa(id_compra, tablas)
        db.session.commit()
        return jsonify(success=True, message='Borrador actualizado.', compra=resultado), 200
    except ConflictoCompra as error:
        db.session.rollback()
        return jsonify(success=False, message=str(error)), 409
    except ValueError as error:
        db.session.rollback()
        return jsonify(success=False, message=str(error)), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify(success=False, message='La compra cambió. Actualiza antes de volver a guardar.'), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.error('No se pudo editar el borrador')
        return jsonify(success=False, message='No fue posible editar el borrador.'), 500


# ============================================================
# 11. PATCH - RECIBIR COMPRA
# ============================================================

@admin_compras_bp.patch(
    "/<int:id_compra>/recibir"
)
@admin_required
def recibir_compra(id_compra):
    """
    Confirma la recepción física de materiales.

    PASOS:
    1. Bloquear la compra para evitar recepción doble.
    2. Verificar que esté en BORRADOR.
    3. Obtener sus detalles.
    4. Crear movimientos de inventario tipo COMPRA.
    5. Cambiar su estado a RECIBIDA.
    6. Confirmar todos los cambios juntos.

    La restricción única sobre id_detalle_compra
    también protege contra entradas duplicadas.
    """

    try:
        tablas = obtener_tablas()

        compras = tablas["compras"]
        detalles = tablas["compra_detalles"]
        movimientos = tablas["movimientos_material"]

        # ----------------------------------------------------
        # BLOQUEAR COMPRA DURANTE LA RECEPCIÓN
        # ----------------------------------------------------

        compra = db.session.execute(
            select(compras).where(
                compras.c.id_compra == id_compra
            ).with_for_update()
        ).mappings().first()

        if compra is None:
            db.session.rollback()

            return jsonify({
                "success": False,
                "message": "Compra no encontrada."
            }), 404

        # No recibir dos veces.
        if compra["estado"] != "BORRADOR":
            db.session.rollback()

            return jsonify({
                "success": False,
                "message": (
                    "Solo pueden recibirse compras "
                    "en estado BORRADOR."
                )
            }), 409

        # ----------------------------------------------------
        # OBTENER DETALLES
        # ----------------------------------------------------

        filas = db.session.execute(
            select(detalles).where(
                detalles.c.id_compra == id_compra
            ).order_by(detalles.c.id_material).with_for_update()
        ).mappings().all()

        if not filas:
            db.session.rollback()

            return jsonify({
                "success": False,
                "message": (
                    "No se puede recibir una compra "
                    "sin materiales."
                )
            }), 400

        # ----------------------------------------------------
        # CREAR MOVIMIENTOS DE ENTRADA
        # ----------------------------------------------------

        materiales = tablas['materiales']
        db.session.execute(select(materiales.c.id_material).where(
            materiales.c.id_material.in_([d['id_material'] for d in filas])
        ).order_by(materiales.c.id_material).with_for_update()).all()
        for detalle in filas:

            # La cantidad es positiva porque
            # es una entrada de materiales.
            db.session.execute(
                insert(movimientos).values(
                    id_material=detalle["id_material"],
                    tipo="COMPRA",
                    cantidad_firmada=detalle["cantidad"],
                    costo_unitario_aplicado=(
                        detalle["costo_unitario"]
                    ),
                    id_detalle_compra=(
                        detalle["id_detalle_compra"]
                    ),
                    observaciones=(
                        f"Recepción de compra {id_compra}"
                    )
                )
            )

        # ----------------------------------------------------
        # ACTUALIZAR ESTADO
        # ----------------------------------------------------

        db.session.execute(
            update(compras)
            .where(
                compras.c.id_compra == id_compra
            )
            .values(estado="RECIBIDA")
        )

        # ----------------------------------------------------
        # CONFIRMAR RECEPCIÓN ATÓMICA
        # ----------------------------------------------------

        db.session.commit()

        compra_actualizada = obtener_compra_completa(
            id_compra,
            tablas
        )

        return jsonify({
            "success": True,
            "message": (
                "Compra recibida correctamente. "
                "Las existencias fueron actualizadas."
            ),
            "compra": compra_actualizada
        }), 200

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "La recepción no pudo completarse. "
                "Verifica que no existan movimientos duplicados."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al recibir compra"
        )

        return jsonify({
            "success": False,
            "message": (
                "No fue posible recibir la compra. "
                "No se confirmaron movimientos parciales."
            )
        }), 500


# ============================================================
# 12. PATCH - CANCELAR BORRADOR
# ============================================================

@admin_compras_bp.patch(
    "/<int:id_compra>/cancelar"
)
@admin_required
def cancelar_compra(id_compra):
    """
    Cancela únicamente compras en BORRADOR.

    No altera inventario porque un borrador
    todavía no tiene recepción registrada.
    """

    try:
        tablas = obtener_tablas()
        compras = tablas["compras"]

        # Bloquear fila para evitar una recepción
        # y cancelación simultáneas.
        compra = db.session.execute(
            select(compras).where(
                compras.c.id_compra == id_compra
            ).with_for_update()
        ).mappings().first()

        if compra is None:
            db.session.rollback()

            return jsonify({
                "success": False,
                "message": "Compra no encontrada."
            }), 404

        if compra["estado"] != "BORRADOR":
            db.session.rollback()

            return jsonify({
                "success": False,
                "message": (
                    "Solo pueden cancelarse compras "
                    "en estado BORRADOR."
                )
            }), 409

        db.session.execute(
            update(compras)
            .where(
                compras.c.id_compra == id_compra
            )
            .values(estado="CANCELADA")
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Compra cancelada correctamente."
        }), 200

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al cancelar compra"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible cancelar la compra."
        }), 500
