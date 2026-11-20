# ==============================================
# TOCO MADERA - RUTAS DE AUTENTICACIÓN
# Archivo: backend/app/routes/auth_routes.py
# ==============================================

import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.services.auth_service import AuthService
from app.models.usuario import Usuario
from app.utils.permisos import admin_required

# ==============================================
# 1. CREAR BLUEPRINT
# ==============================================

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/v1/auth"
)

# ==============================================
# 2. REGISTRAR NUEVO CLIENTE
# ==============================================

@auth_bp.post("/registro")
def registro():
    """Registra exclusivamente usuarios CLIENTE.

    El teléfono es obligatorio para nuevas cuentas.
    El servicio AuthService sigue gestionando el alta,
    el hash de contraseña y la asignación del rol.
    """
    datos = request.get_json(silent=True)

    # Evitar fallos con JSON nulo, listas u otros tipos.
    if not isinstance(datos, dict):
        return jsonify({
            "success": False,
            "message": "Envía un objeto JSON válido."
        }), 400

    telefono = datos.get("telefono")

    if not isinstance(telefono, str):
        return jsonify({
            "success": False,
            "message": "El teléfono es obligatorio y debe contener exactamente 10 dígitos."
        }), 400

    telefono = telefono.strip()

    # Validar formato nacional de México (10 dígitos).
    if not re.fullmatch(r"[0-9]{10}", telefono):
        return jsonify({
            "success": False,
            "message": "El teléfono es obligatorio y debe contener exactamente 10 dígitos."
        }), 400

    # Normalizar antes de entregar datos al servicio.
    datos["telefono"] = telefono

    respuesta, codigo = AuthService.registrar_cliente(datos)
    return jsonify(respuesta), codigo

# ==============================================
# 3. INICIAR SESIÓN
# ==============================================

@auth_bp.post("/login")
def login():
    """Validar credenciales y devolver un JWT."""
    datos = request.get_json(silent=True)
    respuesta, codigo = AuthService.iniciar_sesion(datos)
    return jsonify(respuesta), codigo

# ==============================================
# 4. CONSULTAR USUARIO AUTENTICADO
# ==============================================

@auth_bp.get("/me")
@jwt_required()
def obtener_usuario_actual():
    """Devuelve perfil público de un usuario activo."""
    identidad = get_jwt_identity()
    try:
        usuario_id = int(identidad)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Identidad inválida."
        }), 401

    usuario = db.session.get(Usuario, usuario_id)

    if usuario is None or not usuario.activo:
        return jsonify({
            "success": False,
            "message": "Usuario no disponible."
        }), 401

    return jsonify({
        "success": True,
        "usuario": AuthService.usuario_publico(usuario)
    }), 200

# ==============================================
# 5. VERIFICAR ACCESO ADMINISTRATIVO
# ==============================================

@auth_bp.get("/admin-check")
@admin_required
def verificar_administrador():
    """Sin JWT: 401; CLIENTE: 403; ADMIN: 200."""
    return jsonify({
        "success": True,
        "message": "Acceso administrativo autorizado."
    }), 200
