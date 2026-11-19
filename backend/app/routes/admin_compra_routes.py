
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
from decimal import Decimal, InvalidOperation

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
    func
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

@admin_compras_bp.post("/")
@admin_required
def registrar_compra():
    """
    Guarda una compra y todos sus materiales.

    ESTADO INICIAL:
        BORRADOR

    En este momento NO se crean movimientos
    de inventario ni aumentan las existencias.
    """

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "success": False,
            "message": "Debes enviar un objeto JSON."
        }), 400

    try:
        tablas = obtener_tablas()

        compras = tablas["compras"]
        detalles_tabla = tablas["compra_detalles"]
        proveedores = tablas["proveedores"]

        # ----------------------------------------------------
        # VALIDAR PROVEEDOR
        # ----------------------------------------------------

        id_proveedor = datos.get("id_proveedor")

        if (
            type(id_proveedor) is not int
            or id_proveedor <= 0
        ):
            raise ValueError(
                "Selecciona un proveedor válido."
            )

        proveedor = db.session.execute(
            select(
                proveedores.c.id_proveedor,
                proveedores.c.activo
            ).where(
                proveedores.c.id_proveedor == id_proveedor
            )
        ).mappings().first()

        if proveedor is None:
            raise ValueError(
                "El proveedor seleccionado no existe."
            )

        if not bool(proveedor["activo"]):
            raise ValueError(
                "No se permiten compras a proveedores inactivos."
            )

        # ----------------------------------------------------
        # VALIDAR DATOS GENERALES
        # ----------------------------------------------------

        referencia = texto_opcional(
            datos,
            "referencia_documento",
            90
        )

        observaciones = texto_opcional(
            datos,
            "observaciones",
            300
        )

        # ----------------------------------------------------
        # VALIDAR DETALLES
        # ----------------------------------------------------

        detalles = validar_detalles(
            datos.get("detalles"),
            tablas
        )

        # ----------------------------------------------------
        # INSERTAR CABECERA
        # ----------------------------------------------------

        # id_usuario_registro se deja en NULL,
        # permitido por el esquema actual.
        #
        # La auditoría por identidad del JWT
        # podrá añadirse sin alterar este flujo.

        resultado = db.session.execute(
            insert(compras).values(
                id_proveedor=id_proveedor,
                estado="BORRADOR",
                referencia_documento=referencia,
                observaciones=observaciones
            )
        )

        id_compra = resultado.inserted_primary_key[0]

        # ----------------------------------------------------
        # INSERTAR TODOS LOS DETALLES
        # ----------------------------------------------------

        for item in detalles:

            db.session.execute(
                insert(detalles_tabla).values(
                    id_compra=id_compra,
                    **item
                )
            )

        # ----------------------------------------------------
        # CONFIRMAR TRANSACCIÓN
        # ----------------------------------------------------

        # Solo confirmar después de insertar
        # cabecera y todos los detalles.
        db.session.commit()

        compra = obtener_compra_completa(
            id_compra,
            tablas
        )

        return jsonify({
            "success": True,
            "message": "Compra registrada en borrador.",
            "compra": compra
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
                "No se pudo registrar la compra. "
                "Verifica las relaciones y restricciones."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al registrar compra"
        )

        return jsonify({
            "success": False,
            "message": "No fue posible registrar la compra."
        }), 500


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
            )
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
