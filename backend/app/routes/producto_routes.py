
# ==========================================
# TOCO MADERA - RUTAS DE PRODUCTOS
# ==========================================

from flask import Blueprint, jsonify

from app.services.producto_service import (
    ProductoService
)

# Crear el Blueprint de productos.
productos_bp = Blueprint(
    "productos",
    __name__,
    url_prefix="/api/v1/productos"
)


# Consultar el catálogo público.
@productos_bp.get("/")
def listar_productos():

    # Obtener la lista desde el servicio.
    productos = ProductoService.listar_activos()

    # Devolver una respuesta JSON.
    return jsonify({
        "success": True,
        "total": len(productos),
        "productos": productos
    }), 200
