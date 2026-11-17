
from flask import Blueprint, jsonify

from app.services.dashboard_service import DashboardService

dashboard_bp = Blueprint(
    "dashboard",
    __name__,
    url_prefix="/api/v1/dashboard"
)


@dashboard_bp.get("/status")
def estado_dashboard():

    resultado = DashboardService.obtener_estado()

    return jsonify(resultado), 200
