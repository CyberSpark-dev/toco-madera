
# ============================================================
# TOCO MADERA - CRUD ADMINISTRATIVO DE PRODUCTOS
# Archivo: backend/app/routes/admin_producto_routes.py
# ============================================================
#
# FUNCIONES:
# GET   /api/v1/admin/productos/
# POST  /api/v1/admin/productos/
# PUT   /api/v1/admin/productos/<id>
# PATCH /api/v1/admin/productos/<id>/estado
#
# SEGURIDAD:
# Todos los endpoints requieren JWT válido
# y un usuario activo con rol ADMIN.
#
# IMPORTANTE:
# El inventario físico se administra mediante
# lotes y movimientos, no desde este CRUD.
# ============================================================

import re
from decimal import Decimal, InvalidOperation

from flask import (
    Blueprint,
    jsonify,
    request,
    current_app
)

from sqlalchemy import select
from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError
)

from app.extensions import db
from app.models.producto import Producto
from app.models.categoria import Categoria
from app.utils.permisos import admin_required



# ============================================================
# 1. CREAR BLUEPRINT ADMINISTRATIVO
# ============================================================

admin_productos_bp = Blueprint(
    "admin_productos",
    __name__,
    url_prefix="/api/v1/admin/productos"
)


# ============================================================
# 2. CONVERTIR PRODUCTO A FORMATO JSON
# ============================================================

def producto_a_json(producto):
    """
    Prepara los datos comerciales de un producto.

    El precio se devuelve como string
    para conservar su precisión decimal.
    """

    return {
        "id_producto": producto.id_producto,
        "id_categoria": producto.id_categoria,
        "sku": producto.sku,
        "nombre": producto.nombre,
        "descripcion": producto.descripcion,
        "precio_lista": str(producto.precio_lista),
        "permite_grabado": bool(
            producto.permite_grabado
        ),
        "max_caracteres_grabado":
            producto.max_caracteres_grabado,
        "activo": bool(producto.activo)
    }


# ============================================================
# 3. OBTENER LÍMITE REAL DE UNA COLUMNA
# ============================================================

def longitud_columna(nombre_columna, predeterminado):
    """
    Lee la longitud configurada en el modelo
    SQLAlchemy para no duplicar límites.
    """

    columna = Producto.__table__.columns[nombre_columna]
    longitud = getattr(columna.type, "length", None)

    return longitud or predeterminado


# ============================================================
# 4. VALIDAR INFORMACIÓN COMERCIAL
# ============================================================

def validar_producto(datos, producto_actual=None):
    """
    Valida los datos enviados por Angular.

    Devuelve:
    (datos_limpios, error)

    error será None si todo es válido.
    """

    if not isinstance(datos, dict):
        return None, "Debes enviar un objeto JSON."

    # --------------------------------------------------------
    # CATEGORÍA
    # --------------------------------------------------------

    id_categoria = datos.get("id_categoria")

    # bool también es int en Python;
    # por eso usamos type(...) is int.
    if (
        type(id_categoria) is not int
        or id_categoria <= 0
    ):
        return None, "Selecciona una categoría válida."

    categoria = db.session.get(
        Categoria,
        id_categoria
    )

    if categoria is None:
        return None, "La categoría no existe."

    # --------------------------------------------------------
    # SKU
    # --------------------------------------------------------

    sku = datos.get("sku")

    if not isinstance(sku, str):
        return None, "El SKU debe ser texto."

    sku = sku.strip().upper()

    limite_sku = longitud_columna(
        "sku",
        50
    )

    if not (2 <= len(sku) <= limite_sku):
        return None, (
            f"El SKU debe tener entre 2 y "
            f"{limite_sku} caracteres."
        )

    # Evitar espacios y caracteres problemáticos.
    if not re.fullmatch(r"[A-Z0-9_-]+", sku):
        return None, (
            "El SKU solo admite letras, números, "
            "guiones y guiones bajos."
        )

    # Comprobar SKU duplicado.
    existente = db.session.scalar(
        select(Producto).where(
            Producto.sku == sku
        )
    )

    if (
        existente is not None
        and (
            producto_actual is None
            or existente.id_producto !=
            producto_actual.id_producto
        )
    ):
        return None, "El SKU ya está registrado."

    # --------------------------------------------------------
    # NOMBRE DEL PRODUCTO
    # --------------------------------------------------------

    nombre = datos.get("nombre")

    if not isinstance(nombre, str):
        return None, "El nombre debe ser texto."

    nombre = nombre.strip()

    limite_nombre = longitud_columna(
        "nombre",
        120
    )

    if not (2 <= len(nombre) <= limite_nombre):
        return None, (
            f"El nombre debe tener entre 2 y "
            f"{limite_nombre} caracteres."
        )

    # --------------------------------------------------------
    # DESCRIPCIÓN
    # --------------------------------------------------------

    descripcion = datos.get("descripcion")

    if descripcion is not None:
        if not isinstance(descripcion, str):
            return None, "La descripción debe ser texto."

        descripcion = descripcion.strip() or None

    limite_descripcion = getattr(
        Producto.__table__.columns["descripcion"].type,
        "length",
        None
    )

    if (
        limite_descripcion is not None
        and descripcion is not None
        and len(descripcion) > limite_descripcion
    ):
        return None, "La descripción es demasiado larga."

    # --------------------------------------------------------
    # PRECIO
    # --------------------------------------------------------

    precio_entrada = datos.get("precio_lista")

    if (
        isinstance(precio_entrada, bool)
        or precio_entrada is None
    ):
        return None, "Ingresa un precio válido."

    try:
        precio = Decimal(
            str(precio_entrada)
        )
    except (InvalidOperation, ValueError):
        return None, "El precio debe ser numérico."

    if not precio.is_finite():
        return None, "El precio debe ser finito."

    if precio <= Decimal("0"):
        return None, "El precio debe ser mayor que cero."

    # DECIMAL(12,2): máximo 10 dígitos enteros.
    if precio > Decimal("9999999999.99"):
        return None, "El precio supera el máximo permitido."

    if precio != precio.quantize(Decimal("0.01")):
        return None, "El precio admite máximo dos decimales."

    # --------------------------------------------------------
    # PERSONALIZACIÓN
    # --------------------------------------------------------

    permite_grabado = datos.get("permite_grabado")

    if not isinstance(permite_grabado, bool):
        return None, (
            "permite_grabado debe ser true o false."
        )

    max_caracteres = datos.get(
        "max_caracteres_grabado"
    )

    if (
        type(max_caracteres) is not int
        or max_caracteres < 0
    ):
        return None, (
            "La cantidad máxima de caracteres "
            "debe ser un entero no negativo."
        )

    # Compatibilidad con SMALLINT UNSIGNED,
    # que admite hasta 65535.
    if max_caracteres > 65535:
        return None, "El máximo de caracteres es excesivo."

    # Si el producto no admite grabado,
    # deshabilitamos el límite de caracteres.
    if not permite_grabado:
        max_caracteres = 0

    elif max_caracteres == 0:
        return None, (
            "Indica cuántos caracteres admite el grabado."
        )

    # --------------------------------------------------------
    # RESULTADO VALIDADO
    # --------------------------------------------------------

    return {
        "id_categoria": id_categoria,
        "sku": sku,
        "nombre": nombre,
        "descripcion": descripcion,
        "precio_lista": precio,
        "permite_grabado": permite_grabado,
        "max_caracteres_grabado": max_caracteres
    }, None


# ============================================================
# 5. GET - LISTAR PRODUCTOS
# ============================================================

@admin_productos_bp.get("/")
@admin_required
def listar_productos_admin():
    """
    Lista productos activos e inactivos.
    """

    try:
        productos = db.session.scalars(
            select(Producto).order_by(
                Producto.id_producto
            )
        ).all()

        return jsonify({
            "success": True,
            "total": len(productos),
            "productos": [
                producto_a_json(producto)
                for producto in productos
            ]
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al consultar productos"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar los productos."
        }), 500


# ============================================================
# 6. POST - REGISTRAR PRODUCTO
# ============================================================

@admin_productos_bp.post("/")
@admin_required
def registrar_producto():
    """
    Crea un producto nuevo.

    No modifica directamente el inventario.
    """

    datos = request.get_json(silent=True)

    try:
        datos_limpios, error = validar_producto(
            datos
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        nuevo_producto = Producto(
            **datos_limpios,
            activo=True
        )

        db.session.add(nuevo_producto)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Producto registrado correctamente.",
            "producto": producto_a_json(
                nuevo_producto
            )
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo registrar. "
                "Revisa el SKU y la categoría."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al registrar producto"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible registrar el producto."
        }), 500


# ============================================================
# 7. PUT - EDITAR PRODUCTO
# ============================================================

@admin_productos_bp.put("/<int:id_producto>")
@admin_required
def editar_producto(id_producto):
    """
    Actualiza los datos comerciales.

    El ID del producto no cambia.
    El estado activo tampoco se modifica aquí.
    """

    datos = request.get_json(silent=True)

    try:
        producto = db.session.get(
            Producto,
            id_producto
        )

        if producto is None:
            return jsonify({
                "success": False,
                "message": "Producto no encontrado."
            }), 404

        datos_limpios, error = validar_producto(
            datos,
            producto_actual=producto
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        for campo, valor in datos_limpios.items():
            setattr(
                producto,
                campo,
                valor
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Producto actualizado correctamente.",
            "producto": producto_a_json(
                producto
            )
        }), 200

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "El SKU ya existe o los datos son inválidos."
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al editar producto"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible editar el producto."
        }), 500


# ============================================================
# 8. PATCH - ACTIVAR O DESACTIVAR
# ============================================================

@admin_productos_bp.patch(
    "/<int:id_producto>/estado"
)
@admin_required
def cambiar_estado_producto(id_producto):
    """
    Cambia únicamente la columna activo.

    No borra físicamente el registro.
    """

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "success": False,
            "message": "Debes enviar un objeto JSON."
        }), 400

    nuevo_estado = datos.get("activo")

    if not isinstance(nuevo_estado, bool):
        return jsonify({
            "success": False,
            "message": "activo debe ser true o false."
        }), 400

    try:
        producto = db.session.get(
            Producto,
            id_producto
        )

        if producto is None:
            return jsonify({
                "success": False,
                "message": "Producto no encontrado."
            }), 404

        producto.activo = nuevo_estado
        db.session.commit()

        return jsonify({
            "success": True,
            "message": (
                "Producto activado correctamente."
                if nuevo_estado
                else "Producto desactivado correctamente."
            ),
            "producto": producto_a_json(
                producto
            )
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al cambiar estado del producto"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible cambiar el estado."
        }), 500



# ============================================================
# TOCO MADERA - LISTAR CATEGORÍAS ADMINISTRATIVAS
#
# Endpoint:
# GET /api/v1/admin/productos/categorias
#
# Seguridad:
# JWT válido y rol ADMIN.
# ============================================================

@admin_productos_bp.get("/categorias")
@admin_required
def listar_categorias_admin():
    """
    Devuelve las categorías disponibles en MySQL.

    Se utilizarán para llenar el selector
    de categoría del formulario Angular.
    """

    try:

        # Consultar categorías ordenadas por nombre.
        categorias = db.session.scalars(
            select(Categoria).order_by(
                Categoria.nombre
            )
        ).all()

        # Preparar datos para Angular.
        resultado = [
            {
                "id_categoria": categoria.id_categoria,
                "nombre": categoria.nombre
            }
            for categoria in categorias
        ]

        return jsonify({
            "success": True,
            "total": len(resultado),
            "categorias": resultado
        }), 200

    except SQLAlchemyError:

        # Revertir el estado de la sesión
        # si ocurrió un error de MySQL.
        db.session.rollback()

        current_app.logger.exception(
            "Error al consultar categorías"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar las categorías."
        }), 500
