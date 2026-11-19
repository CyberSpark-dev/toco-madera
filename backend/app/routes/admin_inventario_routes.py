
# ============================================================
# TOCO MADERA - INVENTARIO DE MATERIAS PRIMAS
# Archivo: backend/app/routes/admin_inventario_routes.py
# ETAPA 3.17.6
# ============================================================
#
# REGLAS:
# - Inventario calculado desde movimientos_material.
# - Entradas positivas; salidas negativas.
# - No modifica existencias ni crea movimientos.
# - Incluye materiales activos e inactivos.
# - Todos los endpoints requieren ADMIN y JWT.
# ============================================================

from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import MetaData, Table, select, func
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.utils.permisos import admin_required


admin_inventario_bp = Blueprint(
    "admin_inventario",
    __name__,
    url_prefix="/api/v1/admin/inventario"
)


# ============================================================
# 1. REFLEJAR TABLAS REALES
# ============================================================

def cargar_tablas():
    """
    Consulta el esquema existente de MySQL.
    No crea ni modifica tablas.
    """
    metadata = MetaData()

    materiales = Table(
        "materiales",
        metadata,
        autoload_with=db.engine
    )

    movimientos = Table(
        "movimientos_material",
        metadata,
        autoload_with=db.engine
    )

    return materiales, movimientos


# ============================================================
# 2. SERIALIZACIÓN JSON
# ============================================================

def valor_json(valor):
    if isinstance(valor, Decimal):
        return str(valor)

    if isinstance(valor, (date, datetime)):
        return valor.isoformat()

    return valor


def fila_json(fila):
    return {
        columna: valor_json(valor)
        for columna, valor in fila.items()
    }


# ============================================================
# 3. GET - EXISTENCIAS Y STOCK MÍNIMO
# ============================================================

@admin_inventario_bp.get("/")
@admin_required
def consultar_inventario():
    """
    Obtiene existencias mediante SUM(cantidad_firmada).

    IMPORTANTE:
    El stock mínimo no es el inventario disponible;
    únicamente se utiliza para calcular alertas.
    """

    try:
        materiales, movimientos = cargar_tablas()

        # Calcular existencias por material.
        subconsulta = (
            select(
                movimientos.c.id_material.label("id_material"),
                func.sum(
                    movimientos.c.cantidad_firmada
                ).label("existencia")
            )
            .group_by(movimientos.c.id_material)
            .subquery("existencias")
        )

        # Incluir incluso materiales sin movimientos.
        consulta = (
            select(
                materiales.c.id_material,
                materiales.c.sku,
                materiales.c.nombre,
                materiales.c.id_unidad,
                materiales.c.stock_minimo,
                materiales.c.activo,
                func.coalesce(
                    subconsulta.c.existencia,
                    0
                ).label("existencia")
            )
            .select_from(
                materiales.outerjoin(
                    subconsulta,
                    materiales.c.id_material ==
                    subconsulta.c.id_material
                )
            )
            .order_by(materiales.c.nombre)
        )

        filas = db.session.execute(
            consulta
        ).mappings().all()

        inventario = []

        bajo_minimo = 0
        sin_existencia = 0

        for fila in filas:

            existencia = Decimal(str(fila["existencia"]))
            minimo = Decimal(str(fila["stock_minimo"]))

            # El umbral se evalúa de manera independiente.
            alerta = existencia < minimo

            if alerta:
                bajo_minimo += 1

            if existencia <= 0:
                sin_existencia += 1

            inventario.append({
                "id_material": fila["id_material"],
                "sku": fila["sku"],
                "nombre": fila["nombre"],
                "id_unidad": fila["id_unidad"],
                "stock_minimo": str(minimo),
                "existencia": str(existencia),
                "activo": bool(fila["activo"]),
                "bajo_minimo": alerta
            })

        return jsonify({
            "success": True,
            "total": len(inventario),
            "bajo_minimo": bajo_minimo,
            "sin_existencia": sin_existencia,
            "inventario": inventario
        }), 200

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al consultar inventario"
        )

        return jsonify({
            "success": False,
            "message": (
                "No fue posible consultar el inventario."
            )
        }), 500


# ============================================================
# 4. GET - HISTORIAL DE MOVIMIENTOS
# ============================================================

@admin_inventario_bp.get("/movimientos")
@admin_required
def consultar_movimientos():
    """
    Devuelve movimientos recientes.

    Filtros opcionales:
      ?id_material=1
      ?limite=100

    Se limita la cantidad de resultados para
    evitar cargar un historial sin restricciones.
    """

    try:
        materiales, movimientos = cargar_tablas()

        id_texto = request.args.get("id_material")
        limite_texto = request.args.get("limite", "100")

        try:
            limite = int(limite_texto)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "El límite debe ser un entero."
            }), 400

        if limite < 1 or limite > 500:
            return jsonify({
                "success": False,
                "message": (
                    "El límite debe estar entre 1 y 500."
                )
            }), 400

        # Asociar el movimiento con el nombre del material.
        consulta = (
            select(
                movimientos,
                materiales.c.nombre.label("nombre_material"),
                materiales.c.sku.label("sku_material")
            )
            .join(
                materiales,
                movimientos.c.id_material ==
                materiales.c.id_material
            )
        )

        if id_texto is not None:

            try:
                id_material = int(id_texto)
            except (ValueError, TypeError):
                return jsonify({
                    "success": False,
                    "message": "id_material debe ser entero."
                }), 400

            if id_material <= 0:
                return jsonify({
                    "success": False,
                    "message": "id_material debe ser positivo."
                }), 400

            consulta = consulta.where(
                movimientos.c.id_material == id_material
            )

        consulta = consulta.order_by(
            movimientos.c.id_movimiento.desc()
        ).limit(limite)

        filas = db.session.execute(
            consulta
        ).mappings().all()

        return jsonify({
            "success": True,
            "total": len(filas),
            "movimientos": [
                fila_json(fila)
                for fila in filas
            ]
        }), 200

    except SQLAlchemyError:
        db.session.rollback()

        current_app.logger.exception(
            "Error al consultar movimientos"
        )

        return jsonify({
            "success": False,
            "message": (
                "No fue posible consultar movimientos."
            )
        }), 500
