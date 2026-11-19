
# ============================================================
# TOCO MADERA - CRUD ADMINISTRATIVO DE MATERIAS PRIMAS
# Archivo: backend/app/routes/admin_material_routes.py
# Etapa 3.16
# ============================================================
#
# ENDPOINTS:
#
# GET   /api/v1/admin/materiales/
# GET   /api/v1/admin/materiales/unidades
# POST  /api/v1/admin/materiales/
# PUT   /api/v1/admin/materiales/<id>
# PATCH /api/v1/admin/materiales/<id>/estado
#
# SEGURIDAD:
# JWT obligatorio y rol ADMIN.
#
# REGLAS DE NEGOCIO:
# - SKU único.
# - Unidad de medida existente.
# - Stock mínimo no negativo.
# - Desactivación lógica.
# - No modificar las existencias reales.
#
# Este archivo NO crea ni elimina tablas.
# ============================================================

import re
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, time

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
    SQLAlchemyError,
    IntegrityError
)

from app.extensions import db
from app.utils.permisos import admin_required


# ============================================================
# 1. CREAR BLUEPRINT
# ============================================================

admin_materiales_bp = Blueprint(
    "admin_materiales",
    __name__,
    url_prefix="/api/v1/admin/materiales"
)


# ============================================================
# 2. CONSULTAR TABLA EXISTENTE
# ============================================================

def obtener_tabla_materiales():
    """
    Refleja la tabla materiales desde MySQL.

    Respeta:
    - Tipos de columna.
    - Claves primarias.
    - Claves foráneas.
    - Restricciones existentes.
    """

    metadata = MetaData()

    return Table(
        "materiales",
        metadata,
        autoload_with=db.engine
    )


# ============================================================
# 3. LOCALIZAR TABLA DE UNIDADES DE MEDIDA
# ============================================================

def obtener_tabla_unidades(tabla_materiales):
    """
    Obtiene la tabla relacionada con id_unidad
    utilizando la clave foránea real.

    No suponemos que la tabla se llame
    unidades o unidades_medida.
    """

    columna = tabla_materiales.c.id_unidad

    claves_foraneas = list(columna.foreign_keys)

    if not claves_foraneas:
        raise ValueError(
            "No existe una clave foránea para id_unidad."
        )

    # SQLAlchemy obtiene la tabla referenciada
    # mediante la relación existente en MySQL.
    columna_referenciada = claves_foraneas[0].column

    return (
        columna_referenciada.table,
        columna_referenciada
    )


# ============================================================
# 4. CONVERTIR VALORES PARA JSON
# ============================================================

def convertir_valor(valor):
    """
    Convierte tipos de Python a valores
    compatibles con respuestas JSON.
    """

    if isinstance(valor, Decimal):
        return str(valor)

    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()

    if isinstance(valor, bytes):
        return valor.hex()

    return valor


def material_a_json(fila):
    """
    Transforma una fila de MySQL en un
    diccionario JSON.
    """

    return {
        columna: convertir_valor(valor)
        for columna, valor in fila.items()
    }


# ============================================================
# 5. VALIDAR DATOS COMERCIALES DEL MATERIAL
# ============================================================

def validar_material(datos, tabla, id_actual=None):
    """
    Valida los campos editables.

    No permite modificar:
    - id_material.
    - activo.
    - Existencias reales.

    Devuelve:
       (datos_limpios, error)
    """

    if not isinstance(datos, dict):
        return None, "Debes enviar un objeto JSON."

    # --------------------------------------------------------
    # SKU
    # --------------------------------------------------------

    sku = datos.get("sku")

    if not isinstance(sku, str):
        return None, "El SKU debe ser texto."

    sku = sku.strip().upper()

    if not re.fullmatch(r"[A-Z0-9_-]{2,40}", sku):
        return None, (
            "El SKU debe tener entre 2 y 40 caracteres. "
            "Solo admite letras, números y guiones."
        )

    # Evitar duplicados antes de enviar a MySQL.
    consulta_sku = select(
        tabla.c.id_material
    ).where(
        tabla.c.sku == sku
    )

    if id_actual is not None:
        consulta_sku = consulta_sku.where(
            tabla.c.id_material != id_actual
        )

    duplicado = db.session.execute(
        consulta_sku
    ).first()

    if duplicado is not None:
        return None, "El SKU ya está registrado."

    # --------------------------------------------------------
    # NOMBRE
    # --------------------------------------------------------

    nombre = datos.get("nombre")

    if not isinstance(nombre, str):
        return None, "El nombre debe ser texto."

    nombre = nombre.strip()

    if not (2 <= len(nombre) <= 150):
        return None, (
            "El nombre debe tener entre "
            "2 y 150 caracteres."
        )

    # --------------------------------------------------------
    # DESCRIPCIÓN
    # --------------------------------------------------------

    descripcion = datos.get("descripcion")

    if descripcion is not None:

        if not isinstance(descripcion, str):
            return None, "La descripción debe ser texto."

        descripcion = descripcion.strip() or None

    if descripcion and len(descripcion) > 250:
        return None, (
            "La descripción admite máximo "
            "250 caracteres."
        )

    # --------------------------------------------------------
    # UNIDAD DE MEDIDA
    # --------------------------------------------------------

    id_unidad = datos.get("id_unidad")

    if (
        type(id_unidad) is not int
        or id_unidad <= 0
        or id_unidad > 65535
    ):
        return None, "Selecciona una unidad válida."

    tabla_unidades, columna_id = obtener_tabla_unidades(
        tabla
    )

    # Comprobar que existe en la tabla referenciada.
    unidad = db.session.execute(
        select(columna_id).where(
            columna_id == id_unidad
        )
    ).first()

    if unidad is None:
        return None, "La unidad de medida no existe."

    # --------------------------------------------------------
    # STOCK MÍNIMO
    # --------------------------------------------------------

    stock_entrada = datos.get("stock_minimo")

    if (
        stock_entrada is None
        or isinstance(stock_entrada, bool)
    ):
        return None, "Ingresa un stock mínimo válido."

    try:
        stock = Decimal(str(stock_entrada))
    except (InvalidOperation, ValueError):
        return None, "El stock mínimo debe ser numérico."

    if not stock.is_finite():
        return None, "El stock mínimo debe ser finito."

    if stock < Decimal("0"):
        return None, (
            "El stock mínimo no puede ser negativo."
        )

    # DECIMAL(14,4):
    # máximo 10 dígitos enteros y 4 decimales.
    if stock > Decimal("9999999999.9999"):
        return None, "El stock mínimo es demasiado grande."

    if stock != stock.quantize(Decimal("0.0001")):
        return None, (
            "El stock mínimo admite máximo "
            "cuatro decimales."
        )

    # --------------------------------------------------------
    # RESULTADO VALIDADO
    # --------------------------------------------------------

    return {
        "sku": sku,
        "nombre": nombre,
        "descripcion": descripcion,
        "id_unidad": id_unidad,
        "stock_minimo": stock
    }, None


# ============================================================
# 6. GET - LISTAR MATERIALES
# ============================================================

@admin_materiales_bp.get("/")
@admin_required
def listar_materiales_admin():
    """
    Devuelve materiales activos e inactivos.

    También conserva la lista de columnas
    utilizada por nuestra pantalla Angular.
    """

    try:
        tabla = obtener_tabla_materiales()

        filas = db.session.execute(
            select(tabla).order_by(
                tabla.c.id_material
            )
        ).mappings().all()

        materiales = [
            material_a_json(fila)
            for fila in filas
        ]

        columnas = [
            {
                "nombre": columna.name,
                "tipo": str(columna.type),
                "permite_null": columna.nullable,
                "clave_primaria": columna.primary_key
            }
            for columna in tabla.columns
        ]

        return jsonify({
            "success": True,
            "total": len(materiales),
            "columnas": columnas,
            "materiales": materiales
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al consultar materiales"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible consultar materiales."
        }), 500


# ============================================================
# 7. GET - CONSULTAR UNIDADES DE MEDIDA
# ============================================================

@admin_materiales_bp.get("/unidades")
@admin_required
def listar_unidades_admin():
    """
    Obtiene las unidades de medida desde la
    tabla que realmente referencia id_unidad.
    """

    try:
        tabla = obtener_tabla_materiales()

        tabla_unidades, columna_id = obtener_tabla_unidades(
            tabla
        )

        filas = db.session.execute(
            select(tabla_unidades).order_by(columna_id)
        ).mappings().all()

        resultado = []

        for fila in filas:

            # Preferir un nombre descriptivo.
            # Se mantiene compatibilidad con
            # distintos nombres de columnas.
            nombre = (
                fila.get("nombre")
                or fila.get("descripcion")
                or fila.get("simbolo")
                or fila.get("abreviatura")
                or str(fila[columna_id.name])
            )

            resultado.append({
                "id_unidad": fila[columna_id.name],
                "nombre": str(nombre)
            })

        return jsonify({
            "success": True,
            "total": len(resultado),
            "unidades": resultado
        }), 200

    except (SQLAlchemyError, ValueError):
        db.session.rollback()
        current_app.logger.exception(
            "Error al consultar unidades"
        )

        return jsonify({
            "success": False,
            "message": (
                "No fue posible consultar las "
                "unidades de medida."
            )
        }), 500


# ============================================================
# 8. POST - REGISTRAR MATERIA PRIMA
# ============================================================

@admin_materiales_bp.post("/")
@admin_required
def registrar_material():
    """
    Registra un material nuevo con estado activo.

    No crea movimientos de inventario.
    """

    datos = request.get_json(silent=True)

    try:
        tabla = obtener_tabla_materiales()

        datos_limpios, error = validar_material(
            datos,
            tabla
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        datos_limpios["activo"] = True

        resultado = db.session.execute(
            insert(tabla).values(**datos_limpios)
        )

        id_nuevo = resultado.inserted_primary_key[0]

        db.session.commit()

        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_material == id_nuevo
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": "Material registrado correctamente.",
            "material": material_a_json(fila)
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo registrar el material. "
                "Revisa el SKU y la unidad."
            )
        }), 409

    except (SQLAlchemyError, ValueError):
        db.session.rollback()
        current_app.logger.exception(
            "Error al registrar material"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible registrar el material."
        }), 500


# ============================================================
# 9. PUT - EDITAR MATERIA PRIMA
# ============================================================

@admin_materiales_bp.put("/<int:id_material>")
@admin_required
def editar_material(id_material):
    """
    Modifica los datos comerciales de un material.

    Conserva:
    - Su identificador.
    - Su estado.
    - Su historial.
    """

    datos = request.get_json(silent=True)

    try:
        tabla = obtener_tabla_materiales()

        existe = db.session.execute(
            select(tabla.c.id_material).where(
                tabla.c.id_material == id_material
            )
        ).first()

        if existe is None:
            return jsonify({
                "success": False,
                "message": "Material no encontrado."
            }), 404

        datos_limpios, error = validar_material(
            datos,
            tabla,
            id_actual=id_material
        )

        if error:
            return jsonify({
                "success": False,
                "message": error
            }), 400

        db.session.execute(
            update(tabla)
            .where(
                tabla.c.id_material == id_material
            )
            .values(**datos_limpios)
        )

        db.session.commit()

        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_material == id_material
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": "Material actualizado correctamente.",
            "material": material_a_json(fila)
        }), 200

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "No se pudo actualizar el material "
                "por una restricción de MySQL."
            )
        }), 409

    except (SQLAlchemyError, ValueError):
        db.session.rollback()
        current_app.logger.exception(
            "Error al actualizar material"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible actualizar el material."
        }), 500


# ============================================================
# 10. PATCH - ACTIVAR O DESACTIVAR MATERIAL
# ============================================================

@admin_materiales_bp.patch(
    "/<int:id_material>/estado"
)
@admin_required
def cambiar_estado_material(id_material):
    """
    Actualiza el campo activo.

    No elimina registros ni movimientos históricos.
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
        tabla = obtener_tabla_materiales()

        existe = db.session.execute(
            select(tabla.c.id_material).where(
                tabla.c.id_material == id_material
            )
        ).first()

        if existe is None:
            return jsonify({
                "success": False,
                "message": "Material no encontrado."
            }), 404

        db.session.execute(
            update(tabla)
            .where(
                tabla.c.id_material == id_material
            )
            .values(activo=nuevo_estado)
        )

        db.session.commit()

        fila = db.session.execute(
            select(tabla).where(
                tabla.c.id_material == id_material
            )
        ).mappings().first()

        return jsonify({
            "success": True,
            "message": (
                "Material activado correctamente."
                if nuevo_estado
                else "Material desactivado correctamente."
            ),
            "material": material_a_json(fila)
        }), 200

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Error al cambiar estado del material"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible cambiar el estado."
        }), 500
