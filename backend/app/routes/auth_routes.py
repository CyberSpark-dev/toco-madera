
# ==============================================
# TOCO MADERA - RUTAS DE AUTENTICACIÓN
# Archivo: backend/app/routes/auth_routes.py
# ==============================================

# Flask permite recibir JSON y devolver respuestas.
from flask import Blueprint, request, jsonify

# Herramientas para validar tokens.
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity
)

# Conexión con MySQL.
from app.extensions import db

# Servicio de autenticación.
from app.services.auth_service import AuthService

# Modelo de usuarios.
from app.models.usuario import Usuario

# Decorador para verificar permisos administrativos.
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
    """
    Endpoint público.

    Registra exclusivamente usuarios CLIENTE.
    """

    # Leer el cuerpo JSON de la petición.
    datos = request.get_json(silent=True)

    # Ejecutar la lógica del servicio.
    respuesta, codigo = (
        AuthService.registrar_cliente(datos)
    )

    # Enviar la respuesta HTTP.
    return jsonify(respuesta), codigo


# ==============================================
# 3. INICIAR SESIÓN
# ==============================================

@auth_bp.post("/login")
def login():
    """
    Validar credenciales y devolver
    un token JWT.
    """

    datos = request.get_json(silent=True)

    respuesta, codigo = (
        AuthService.iniciar_sesion(datos)
    )

    return jsonify(respuesta), codigo


# ==============================================
# 4. CONSULTAR USUARIO AUTENTICADO
# ==============================================

@auth_bp.get("/me")
@jwt_required()
def obtener_usuario_actual():
    """
    Endpoint protegido.

    Solo responde si llega un JWT válido.
    """

    # Obtener el ID guardado en el token.
    identidad = get_jwt_identity()

    # Buscar el usuario real en MySQL.
    try:
        usuario_id = int(identidad)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Identidad inválida."
        }), 401

    usuario = db.session.get(
        Usuario,
        usuario_id
    )

    # Comprobar que todavía existe
    # y que su cuenta permanece activa.
    if usuario is None or not usuario.activo:
        return jsonify({
            "success": False,
            "message": "Usuario no disponible."
        }), 401

    # Devolver información no sensible.
    return jsonify({
        "success": True,
        "usuario": AuthService.usuario_publico(
            usuario
        )
    }), 200

# ============================================================
# TOCO MADERA - VERIFICAR ACCESO ADMINISTRATIVO
# Endpoint: GET /api/v1/auth/admin-check
# ============================================================

@auth_bp.get("/admin-check")
@admin_required
def verificar_administrador():
    """
    Ruta de prueba de autorización.

    Respuesta esperada:
    - Sin JWT: HTTP 401.
    - CLIENTE autenticado: HTTP 403.
    - ADMIN autenticado: HTTP 200.
    """

    return jsonify({
        "success": True,
        "message": "Acceso administrativo autorizado."
    }), 200