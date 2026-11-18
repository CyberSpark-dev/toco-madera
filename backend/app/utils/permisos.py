# ============================================================
# TOCO MADERA - CONTROL DE PERMISOS
# Archivo: backend/app/utils/permisos.py
# ============================================================
#
# Objetivo:
# Proteger los endpoints administrativos de Flask.
#
# Reglas:
# 1. El usuario debe presentar un JWT válido.
# 2. Su cuenta debe existir en MySQL.
# 3. Su cuenta debe permanecer activa.
# 4. Su rol actual debe ser ADMIN.
#
# IMPORTANTE:
# No confiamos únicamente en el rol que muestra Angular.
# El backend comprueba el permiso directamente en MySQL.
# ============================================================

# Preserva el nombre y los metadatos de las funciones decoradas.
from functools import wraps

# Permite construir respuestas JSON.
from flask import jsonify

# Herramientas de autenticación JWT.
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity
)

# Conexión SQLAlchemy.
from app.extensions import db

# Modelo correspondiente a la tabla usuarios.
from app.models.usuario import Usuario


# ============================================================
# DECORADOR: ADMIN_REQUIRED
# ============================================================

def admin_required(funcion):
    """
    Decorador que permite ejecutar una ruta solamente
    cuando el usuario tiene el rol ADMIN en MySQL.

    Ejemplo de uso:

        @admin_required
        def mi_ruta():
            return jsonify({"success": True})
    """

    # Conservar los metadatos de la función original.
    @wraps(funcion)

    # Primero, verificar el token JWT.
    @jwt_required()
    def funcion_protegida(*args, **kwargs):

        # ----------------------------------------------------
        # PASO 1: OBTENER LA IDENTIDAD DEL TOKEN
        # ----------------------------------------------------

        # El login guardó el identificador del usuario
        # como una cadena de texto en el JWT.
        identidad = get_jwt_identity()

        # Convertir la identidad a un ID numérico.
        try:
            usuario_id = int(identidad)

        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "message": "Identidad de usuario inválida."
            }), 401

        # ----------------------------------------------------
        # PASO 2: CONSULTAR EL USUARIO EN MYSQL
        # ----------------------------------------------------

        usuario = db.session.get(
            Usuario,
            usuario_id
        )

        # ----------------------------------------------------
        # PASO 3: VALIDAR QUE LA CUENTA ESTÉ ACTIVA
        # ----------------------------------------------------

        if usuario is None or not usuario.activo:
            return jsonify({
                "success": False,
                "message": "La cuenta no existe o está desactivada."
            }), 401

        # ----------------------------------------------------
        # PASO 4: VERIFICAR EL ROL ADMINISTRATIVO
        # ----------------------------------------------------

        # Consultamos el rol relacionado con el usuario.
        # No usamos un ID fijo: verificamos el nombre.
        if usuario.rol is None or usuario.rol.nombre != "ADMIN":
            return jsonify({
                "success": False,
                "message": "No tienes permisos de administrador."
            }), 403

        # ----------------------------------------------------
        # PASO 5: PERMITIR EL ACCESO
        # ----------------------------------------------------

        # El usuario tiene JWT válido, cuenta activa
        # y rol ADMIN. Ejecutamos la ruta original.
        return funcion(*args, **kwargs)

    # Devolver la función protegida.
    return funcion_protegida