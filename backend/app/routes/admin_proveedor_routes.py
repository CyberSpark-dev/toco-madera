
# ============================================================
# TOCO MADERA - CRUD ADMINISTRATIVO DE PROVEEDORES
# Archivo: backend/app/routes/admin_proveedor_routes.py
# ============================================================
#
# ENDPOINTS:
# GET   /api/v1/admin/proveedores/
# POST  /api/v1/admin/proveedores/
# PUT   /api/v1/admin/proveedores/<id>
# PATCH /api/v1/admin/proveedores/<id>/estado
#
# SEGURIDAD:
# Todas las rutas necesitan JWT válido y rol ADMIN.
#
# BASE DE DATOS:
# Se utiliza la tabla proveedores existente.
# No se crean ni eliminan tablas.
# No se eliminan proveedores físicamente.
# ============================================================

import re

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
    update
)

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError
)

from app.extensions import db
from app.utils.permisos import admin_required


# ============================================================
# 1. BLUEPRINT
# ============================================================

admin_proveedores_bp = Blueprint(
    "admin_proveedores",
    __name__,
    url_prefix="/api/v1/admin/proveedores"
)


# ============================================================
# 2. OBTENER LA TABLA EXISTENTE
# ============================================================

def obtener_tabla_proveedores():
    """
    Consulta la estructura real de proveedores
    mediante SQLAlchemy.

    No crea la tabla ni altera sus columnas.
    """

    metadata = MetaData()

    return Table(
        "proveedores",
        metadata,
        autoload_with=db.engine
    )


# ============================================================
# 3. CONVERTIR REGISTRO A JSON
# ============================================================

def proveedor_a_json(registro):
    """
    Convierte una fila de MySQL a un diccionario
    para devolverla en la respuesta HTTP.
    """

    return {
        "id_proveedor": registro["id_proveedor"],
        "nombre": registro["nombre"],
        "contacto": registro["contacto"],
        "telefono": registro["telefono"],
        "correo": registro["correo"],
        "direccion": registro["direccion"],
        "sitio_web": registro["sitio_web"],
        "activo": bool(registro["activo"])
    }


# ============================================================
# 4. VALIDAR DATOS DEL PROVEEDOR
# ============================================================

def validar_proveedor(datos, tabla):
    """
    Valida los datos enviados desde Angular.

    Lee la longitud máxima de cada VARCHAR
    directamente del esquema MySQL.

    Devuelve:
        (datos_limpios, error)
    """

    if not isinstance(datos, dict):
        return None, "Debes enviar un objeto JSON."

    campos = [
        "nombre",
        "contacto",
        "telefono",
        "correo",
        "direccion",
        "sitio_web"
    ]

    resultado = {}

    for campo in campos:

        valor = datos.get(campo)

        # Nombre obligatorio.
        if campo == "nombre":

            if not isinstance(valor, str):
                return None, "El nombre es obligatorio."

            valor = valor.strip()

            if len(valor) < 2:
                return None, (
                    "El nombre debe tener "
                    "al menos dos caracteres."
                )

        else:

            # Los campos secundarios pueden omitirse,
            # respetando la nulabilidad de la tabla.
            if valor is None:
                valor = ""
            elif not isinstance(valor, str):
                return None, (
                    f"El campo {campo} debe ser texto."
                )
            else:
                valor = valor.strip()

        # Obtener límite desde la columna real.
        limite = getattr(
            tabla.c[campo].type,
            "length",
            None
        )

        if limite and len(valor) > limite:
            return None, (
                f"El campo {campo} admite "
                f"máximo {limite} caracteres."
            )

        # Conservar None únicamente si la columna
        # permite NULL.
        if not valor and tabla.c[campo].nullable:
            resultado[campo] = None
        else:
            resultado[campo] = valor

    # Validación básica de correo, si se proporcionó.
    correo = resultado["correo"]

    if correo and not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+",
        correo
    ):
        return None, "El correo no tiene un formato válido."

    # Validar sitio web.
    sitio = resultado["sitio_web"]

    if sitio and not sitio.startswith(
        ("http://", "https://")
    ):
        return None, (
            "El sitio web debe comenzar "
            "con http:// o https://."
        )

    return resultado, None


# ============================================================
# 5. CONSULTAR TODOS LOS PROVEEDORES
# GET /api/v1/admin/proveedores/
# ============================================================

@admin_proveedores_bp.get("/")
@admin_required
def listar_proveedores():

    try:

        tabla = obtener_tabla_proveedores()

        consulta = (
            select(tabla)
            .order_by(tabla.c.nombre)
        )

        filas = db.session.execute(
            consulta
        ).mappings().all()

        proveedores = [
            proveedor_a_json(fila)
            for fila in filas
        ]

        return jsonify({
            "success": True,
            "total": len(proveedores),
            "proveedores": proveedores
        }), 200

    except SQLAlchemyError:

        db.session.rollback()

        current_app.logger.exception(
            "Error al consultar proveedores"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar proveedores."
        }), 500


# ============================================================
# 6. REGISTRAR PROVEEDOR
# POST /api/v1/admin/proveedores/
# ============================================================

@admin_proveedores_bp.post("/")
@admin_required
def registrar_proveedor():

    datos = request.get_json(silent=True)

    try:

        tabla = obtener_tabla_proveedores()

        datos_limpios, error = validar_proveedor(
            datos,
            tabla
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        # Los proveedores nuevos quedan activos.
        datos_limpios["activo"] = True

        consulta = insert(tabla).values(
            **datos_limpios
        )

        resultado = db.session.execute(
            consulta
        )

        id_nuevo = resultado.inserted_primary_key[0]

        db.session.commit()

        # Recuperar el registro guardado.
        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_proveedor == id_nuevo
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": "Proveedor registrado correctamente.",
            "proveedor": proveedor_a_json(fila)
        }), 201

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo registrar el proveedor. "
                "Revisa los datos y sus restricciones."
            )
        }), 409

    except SQLAlchemyError:

        db.session.rollback()

        current_app.logger.exception(
            "Error al registrar proveedor"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible registrar el proveedor."
        }), 500


# ============================================================
# 7. EDITAR PROVEEDOR
# PUT /api/v1/admin/proveedores/<id>
# ============================================================

@admin_proveedores_bp.put(
    "/<int:id_proveedor>"
)
@admin_required
def editar_proveedor(id_proveedor):

    datos = request.get_json(silent=True)

    try:

        tabla = obtener_tabla_proveedores()

        existe = db.session.execute(
            select(tabla.c.id_proveedor).where(
                tabla.c.id_proveedor == id_proveedor
            )
        ).first()

        if existe is None:
            return jsonify({
                "success": False,
                "message": "Proveedor no encontrado."
            }), 404

        datos_limpios, error = validar_proveedor(
            datos,
            tabla
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        db.session.execute(
            update(tabla)
            .where(
                tabla.c.id_proveedor == id_proveedor
            )
            .values(**datos_limpios)
        )

        db.session.commit()

        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_proveedor == id_proveedor
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": "Proveedor actualizado correctamente.",
            "proveedor": proveedor_a_json(fila)
        }), 200

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo actualizar por una "
                "restricción de la base de datos."
            )
        }), 409

    except SQLAlchemyError:

        db.session.rollback()

        current_app.logger.exception(
            "Error al actualizar proveedor"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible actualizar el proveedor."
        }), 500


# ============================================================
# 8. ACTIVAR O DESACTIVAR PROVEEDOR
# PATCH /api/v1/admin/proveedores/<id>/estado
# ============================================================

@admin_proveedores_bp.patch(
    "/<int:id_proveedor>/estado"
)
@admin_required
def cambiar_estado_proveedor(id_proveedor):

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

        tabla = obtener_tabla_proveedores()

        existe = db.session.execute(
            select(tabla.c.id_proveedor).where(
                tabla.c.id_proveedor == id_proveedor
            )
        ).first()

        if existe is None:
            return jsonify({
                "success": False,
                "message": "Proveedor no encontrado."
            }), 404

        db.session.execute(
            update(tabla)
            .where(
                tabla.c.id_proveedor == id_proveedor
            )
            .values(activo=nuevo_estado)
        )

        db.session.commit()

        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_proveedor == id_proveedor
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": (
                "Proveedor activado correctamente."
                if nuevo_estado
                else "Proveedor desactivado correctamente."
            ),
            "proveedor": proveedor_a_json(fila)
        }), 200

    except SQLAlchemyError:

        db.session.rollback()

        current_app.logger.exception(
            "Error al cambiar estado del proveedor"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible cambiar el estado."
        }), 500
