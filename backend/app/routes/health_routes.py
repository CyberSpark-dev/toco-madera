
from flask import Blueprint, jsonify

# Creamos un Blueprint llamado health
health_bp = Blueprint(
    "health",
    __name__,
    url_prefix="/api/v1"
)


# Ruta GET para comprobar la API
@health_bp.get("/health")
def comprobar_servidor():

    return jsonify({
        "success": True,
        "project": "Toco Madera",
        "message": "API funcionando correctamente",
        "version": "1.0.0"
    }), 200
