
# ============================================================
# TOCO MADERA - ADMINISTRACIÓN DE RECETAS
# Archivo: backend/app/routes/admin_receta_routes.py
# ETAPA 3.17.7
# ============================================================
#
# FUNCIONALIDADES:
# - Listar recetas por producto y versión.
# - Consultar catálogos de productos y materiales.
# - Crear versiones nuevas de recetas.
# - Activar una versión de receta.
# - Conservar las versiones anteriores.
#
# SEGURIDAD:
# - JWT y rol ADMIN mediante @admin_required.
#
# INVENTARIO:
# - Este módulo NO genera movimientos de materiales.
#
# CONCURRENCIA:
# - Bloquea la fila del producto al crear o activar
#   recetas para evitar cambios simultáneos.
#
# NO CREA NI MODIFICA LA ESTRUCTURA DE MYSQL.
# ============================================================

from decimal import Decimal, InvalidOperation
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import (
    MetaData,
    Table,
    select,
    insert,
    update,
    func
)
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.utils.permisos import admin_required


# ============================================================
# 1. BLUEPRINT
# ============================================================

admin_recetas_bp = Blueprint(
    "admin_recetas",
    __name__,
    url_prefix="/api/v1/admin/recetas"
)


# ============================================================
# 2. CARGAR TABLAS REALES
# ============================================================

def cargar_tablas():
    """
    Refleja cuatro tablas existentes en MySQL.

    Usamos una sola instancia de MetaData para
    mantener la resolución de las claves foráneas.
    """

    metadata = MetaData()

    nombres = (
        "productos",
        "materiales",
        "recetas",
        "receta_materiales"
    )

    return {
        nombre: Table(
            nombre,
            metadata,
            autoload_with=db.engine
        )
        for nombre in nombres
    }


# ============================================================
# 3. CONVERTIR DECIMALES PARA JSON
# ============================================================

def convertir(valor):
    if isinstance(valor, Decimal):
        return str(valor)

    return valor


def fila_json(fila):
    return {
        columna: convertir(valor)
        for columna, valor in fila.items()
    }


# ============================================================
# 4. VALIDAR ENTEROS
# ============================================================

def entero_valido(valor, nombre, minimo=0, maximo=65535):
    """
    Valida SMALLINT UNSIGNED y campos similares.
    """

    if type(valor) is not int:
        raise ValueError(
            f"{nombre} debe ser un número entero."
        )

    if not minimo <= valor <= maximo:
        raise ValueError(
            f"{nombre} debe estar entre {minimo} y {maximo}."
        )

    return valor


# ============================================================
# 5. VALIDAR DECIMAL
# ============================================================

def decimal_valido(
    valor,
    nombre,
    enteros,
    decimales,
    positivo=False
):
    """
    Valida DECIMAL con precisión y escala
    sin convertirlo a float.

    Ejemplos:
    DECIMAL(12,2): 10 enteros + 2 decimales.
    DECIMAL(14,4): 10 enteros + 4 decimales.
    """

    if valor is None or isinstance(valor, bool):
        raise ValueError(
            f"{nombre} debe ser numérico."
        )

    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(
            f"{nombre} debe ser numérico."
        )

    if not numero.is_finite():
        raise ValueError(
            f"{nombre} debe ser finito."
        )

    if positivo:
        if numero <= 0:
            raise ValueError(
                f"{nombre} debe ser mayor que cero."
            )
    elif numero < 0:
        raise ValueError(
            f"{nombre} no puede ser negativo."
        )

    maximo = (
        Decimal(10) ** enteros
        - Decimal(10) ** (-decimales)
    )

    if numero > maximo:
        raise ValueError(
            f"{nombre} supera el máximo permitido."
        )

    precision = Decimal(1).scaleb(-decimales)

    if numero != numero.quantize(precision):
        raise ValueError(
            f"{nombre} admite máximo {decimales} decimales."
        )

    return numero


# ============================================================
# 6. VALIDAR UNA RECETA COMPLETA
# ============================================================

def validar_datos(datos, tablas):
    """
    Valida información general e ingredientes.

    La selección de producto se verifica de nuevo
    dentro de la transacción, bloqueando su fila.
    """

    if not isinstance(datos, dict):
        raise ValueError(
            "Debes enviar un objeto JSON."
        )

    id_producto = datos.get("id_producto")

    if type(id_producto) is not int or id_producto <= 0:
        raise ValueError(
            "Selecciona un producto válido."
        )

    minutos_fabricacion = entero_valido(
        datos.get("minutos_fabricacion"),
        "minutos_fabricacion"
    )

    minutos_grabado = entero_valido(
        datos.get("minutos_grabado"),
        "minutos_grabado"
    )

    costo_hora = decimal_valido(
        datos.get("costo_hora_mano_obra"),
        "costo_hora_mano_obra",
        10,
        2
    )

    costo_indirecto = decimal_valido(
        datos.get("costo_indirecto_unitario"),
        "costo_indirecto_unitario",
        10,
        2
    )

    observaciones = datos.get("observaciones")

    if observaciones is not None:
        if not isinstance(observaciones, str):
            raise ValueError(
                "Las observaciones deben ser texto."
            )

        observaciones = observaciones.strip() or None

        if observaciones and len(observaciones) > 300:
            raise ValueError(
                "Las observaciones admiten máximo 300 caracteres."
            )

    # --------------------------------------------------------
    # MATERIALES DE LA RECETA
    # --------------------------------------------------------

    ingredientes = datos.get("materiales")

    if not isinstance(ingredientes, list):
        raise ValueError(
            "Debes enviar una lista de materiales."
        )

    if not 1 <= len(ingredientes) <= 100:
        raise ValueError(
            "La receta debe incluir entre 1 y 100 materiales."
        )

    ids = set()
    materiales_limpios = []

    tabla_materiales = tablas["materiales"]

    for numero, item in enumerate(ingredientes, start=1):

        if not isinstance(item, dict):
            raise ValueError(
                f"El ingrediente {numero} no es válido."
            )

        id_material = item.get("id_material")

        if type(id_material) is not int or id_material <= 0:
            raise ValueError(
                f"El ingrediente {numero} tiene un material inválido."
            )

        if id_material in ids:
            raise ValueError(
                "No repitas materiales en la misma receta."
            )

        ids.add(id_material)

        material = db.session.execute(
            select(
                tabla_materiales.c.id_material,
                tabla_materiales.c.activo
            ).where(
                tabla_materiales.c.id_material == id_material
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

        cantidad = decimal_valido(
            item.get("cantidad"),
            "cantidad",
            10,
            4,
            positivo=True
        )

        materiales_limpios.append({
            "id_material": id_material,
            "cantidad": cantidad
        })

    return {
        "id_producto": id_producto,
        "minutos_fabricacion": minutos_fabricacion,
        "minutos_grabado": minutos_grabado,
        "costo_hora_mano_obra": costo_hora,
        "costo_indirecto_unitario": costo_indirecto,
        "observaciones": observaciones,
        "materiales": materiales_limpios
    }


# ============================================================
# 7. OBTENER RECETAS CON SUS MATERIALES
# ============================================================

def consultar_recetas(tablas):
    """
    Devuelve todas las recetas y sus ingredientes.

    Los datos quedan agrupados para evitar
    que Angular deba reconstruir relaciones.
    """

    recetas = tablas["recetas"]
    detalles = tablas["receta_materiales"]
    productos = tablas["productos"]
    materiales = tablas["materiales"]

    filas = db.session.execute(
        select(
            recetas,
            productos.c.nombre.label("nombre_producto"),
            productos.c.sku.label("sku_producto")
        )
        .join(
            productos,
            recetas.c.id_producto == productos.c.id_producto
        )
        .order_by(
            recetas.c.id_producto,
            recetas.c.version.desc()
        )
    ).mappings().all()

    resultado = []

    for receta in filas:

        ingredientes = db.session.execute(
            select(
                detalles.c.id_material,
                detalles.c.cantidad,
                materiales.c.nombre.label("nombre_material"),
                materiales.c.sku.label("sku_material"),
                materiales.c.id_unidad
            )
            .join(
                materiales,
                detalles.c.id_material == materiales.c.id_material
            )
            .where(
                detalles.c.id_receta == receta["id_receta"]
            )
            .order_by(materiales.c.nombre)
        ).mappings().all()

        item = fila_json(receta)
        item["vigente"] = bool(item["vigente"])
        item["materiales"] = [
            fila_json(fila)
            for fila in ingredientes
        ]

        resultado.append(item)

    return resultado


# ============================================================
# 8. GET - LISTAR RECETAS
# ============================================================

@admin_recetas_bp.get("/")
@admin_required
def listar_recetas():

    try:
        tablas = cargar_tablas()

        resultado = consultar_recetas(tablas)

        return jsonify({
            "success": True,
            "total": len(resultado),
            "recetas": resultado
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al listar recetas"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar las recetas."
        }), 500


# ============================================================
# 9. GET - CATÁLOGOS
# ============================================================

@admin_recetas_bp.get("/catalogos")
@admin_required
def listar_catalogos():

    try:
        tablas = cargar_tablas()

        productos = tablas["productos"]
        materiales = tablas["materiales"]

        filas_productos = db.session.execute(
            select(
                productos.c.id_producto,
                productos.c.sku,
                productos.c.nombre,
                productos.c.activo
            ).order_by(productos.c.nombre)
        ).mappings().all()

        filas_materiales = db.session.execute(
            select(
                materiales.c.id_material,
                materiales.c.sku,
                materiales.c.nombre,
                materiales.c.id_unidad,
                materiales.c.activo
            ).order_by(materiales.c.nombre)
        ).mappings().all()

        return jsonify({
            "success": True,
            "productos": [
                {
                    **fila_json(fila),
                    "activo": bool(fila["activo"])
                }
                for fila in filas_productos
            ],
            "materiales": [
                {
                    **fila_json(fila),
                    "activo": bool(fila["activo"])
                }
                for fila in filas_materiales
            ]
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al consultar catálogos de recetas"
        )

        return jsonify({
            "success": False,
            "message": (
                "No fue posible consultar productos y materiales."
            )
        }), 500


# ============================================================
# 10. POST - CREAR NUEVA VERSIÓN
# ============================================================

@admin_recetas_bp.post("/")
@admin_required
def crear_receta():

    datos = request.get_json(silent=True)

    try:
        tablas = cargar_tablas()

        limpio = validar_datos(datos, tablas)

        productos = tablas["productos"]
        recetas = tablas["recetas"]
        detalles = tablas["receta_materiales"]

        id_producto = limpio["id_producto"]

        # ----------------------------------------------------
        # BLOQUEO DEL PRODUCTO
        # ----------------------------------------------------
        # Serializa creación y activación de versiones
        # de un mismo producto.

        producto = db.session.execute(
            select(
                productos.c.id_producto,
                productos.c.activo
            )
            .where(productos.c.id_producto == id_producto)
            .with_for_update()
        ).mappings().first()

        if producto is None:
            raise ValueError(
                "El producto seleccionado no existe."
            )

        if not bool(producto["activo"]):
            raise ValueError(
                "No se permiten recetas nuevas para productos inactivos."
            )

        # Obtener última versión de este producto.
        version_maxima = db.session.execute(
            select(func.max(recetas.c.version)).where(
                recetas.c.id_producto == id_producto
            )
        ).scalar()

        nueva_version = int(version_maxima or 0) + 1

        # SMALLINT UNSIGNED.
        if nueva_version > 65535:
            raise ValueError(
                "Se alcanzó el máximo de versiones permitido."
            )

        # Desactivar versión anterior antes de insertar.
        db.session.execute(
            update(recetas)
            .where(recetas.c.id_producto == id_producto)
            .values(vigente=False)
        )

        # ----------------------------------------------------
        # INSERTAR RECETA
        # ----------------------------------------------------

        resultado = db.session.execute(
            insert(recetas).values(
                id_producto=id_producto,
                version=nueva_version,
                vigente=True,
                minutos_fabricacion=limpio["minutos_fabricacion"],
                minutos_grabado=limpio["minutos_grabado"],
                costo_hora_mano_obra=limpio["costo_hora_mano_obra"],
                costo_indirecto_unitario=limpio["costo_indirecto_unitario"],
                observaciones=limpio["observaciones"]
            )
        )

        id_receta = resultado.inserted_primary_key[0]

        # ----------------------------------------------------
        # INSERTAR INGREDIENTES
        # ----------------------------------------------------

        for ingrediente in limpio["materiales"]:

            db.session.execute(
                insert(detalles).values(
                    id_receta=id_receta,
                    **ingrediente
                )
            )

        # Confirmar cabecera, detalles y vigencia juntos.
        db.session.commit()

        return jsonify({
            "success": True,
            "message": (
                f"Receta versión {nueva_version} "
                "registrada correctamente."
            ),
            "id_receta": id_receta,
            "version": nueva_version
        }), 201

    except ValueError as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(error)
        }), 400

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo registrar la receta "
                "por un conflicto con los datos existentes."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al crear receta"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible registrar la receta."
        }), 500


# ============================================================
# 11. PATCH - ACTIVAR VERSIÓN EXISTENTE
# ============================================================

@admin_recetas_bp.patch("/<int:id_receta>/activar")
@admin_required
def activar_receta(id_receta):

    try:
        tablas = cargar_tablas()

        productos = tablas["productos"]
        recetas = tablas["recetas"]

        # Consultar el producto asociado a la receta.
        receta = db.session.execute(
            select(recetas).where(
                recetas.c.id_receta == id_receta
            )
        ).mappings().first()

        if receta is None:
            return jsonify({
                "success": False,
                "message": "Receta no encontrada."
            }), 404

        id_producto = receta["id_producto"]

        # Bloquear producto durante cambio de vigencia.
        producto = db.session.execute(
            select(
                productos.c.id_producto,
                productos.c.activo
            )
            .where(productos.c.id_producto == id_producto)
            .with_for_update()
        ).mappings().first()

        if producto is None or not bool(producto["activo"]):
            db.session.rollback()
            return jsonify({
                "success": False,
                "message": "El producto no está disponible."
            }), 409

        # Revalidar la existencia de la receta después
        # de adquirir el bloqueo.
        receta_actual = db.session.execute(
            select(recetas.c.id_receta).where(
                recetas.c.id_receta == id_receta
            )
        ).first()

        if receta_actual is None:
            db.session.rollback()
            return jsonify({
                "success": False,
                "message": "Receta no encontrada."
            }), 404

        # Una sola versión vigente por producto.
        db.session.execute(
            update(recetas)
            .where(recetas.c.id_producto == id_producto)
            .values(vigente=False)
        )

        db.session.execute(
            update(recetas)
            .where(recetas.c.id_receta == id_receta)
            .values(vigente=True)
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Versión de receta activada correctamente."
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al activar receta"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible activar la receta."
        }), 500
