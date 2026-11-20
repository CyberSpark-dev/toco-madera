
from flask import Blueprint, jsonify

from app.services.dashboard_service import DashboardService


# ==========================================
# TOCO MADERA - PERMISOS ADMINISTRATIVOS
# ==========================================

# Decorador que exige JWT válido y rol ADMIN.
from app.utils.permisos import admin_required


dashboard_bp = Blueprint(
    "dashboard",
    __name__,
    url_prefix="/api/v1/dashboard"
)


@dashboard_bp.get("/status")
@admin_required
def estado_dashboard():

    resultado = DashboardService.obtener_estado()

    return jsonify(resultado), 200
