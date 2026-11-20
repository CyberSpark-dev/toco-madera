
# ==============================================
# TOCO MADERA - SERVICIO DE AUTENTICACIÓN
# Archivo: backend/app/services/auth_service.py
# ==============================================

import re

# Permite construir consultas SQLAlchemy.
from sqlalchemy import select

# Captura errores de restricciones de MySQL.
from sqlalchemy.exc import IntegrityError

# Generación de tokens de acceso.
from flask_jwt_extended import create_access_token

# Conexión compartida con MySQL.
from app.extensions import db

# Modelos de usuarios y roles.
from app.models.usuario import Usuario
from app.models.rol import Rol


class AuthService:
    """
    Contiene la lógica del registro
    y del inicio de sesión.
    """

    # ==========================================
    # 1. CONVERTIR USUARIO A JSON SEGURO
    # ==========================================

    @staticmethod
    def usuario_publico(usuario):
        """
        Devolver únicamente información pública.

        Nunca devolver password_hash.
        """

        return {
            "id_usuario": usuario.id_usuario,
            "nombre": usuario.nombre,
            "correo": usuario.correo,
            "telefono": usuario.telefono,
            "rol": usuario.rol.nombre,
            "activo": bool(usuario.activo)
        }

    # ==========================================
    # 2. REGISTRAR NUEVO CLIENTE
    # ==========================================

    @staticmethod
    def registrar_cliente(datos):
        """
        Registrar una cuenta con rol CLIENTE.

        Devuelve:
        (respuesta, codigo_http)
        """

        # Comprobar que recibimos un objeto JSON.
        if not isinstance(datos, dict):
            return {
                "success": False,
                "message": "Se requiere un objeto JSON."
            }, 400

        # Obtener y limpiar los datos.
        nombre = str(
            datos.get("nombre") or ""
        ).strip()

        correo = str(
            datos.get("correo") or ""
        ).strip().lower()

        password = datos.get("password")

        telefono = str(
            datos.get("telefono") or ""
        ).strip() or None

        # Validar nombre.
        if not (2 <= len(nombre) <= 120):
            return {
                "success": False,
                "message": "El nombre debe tener entre 2 y 120 caracteres."
            }, 400

        # Validar formato y longitud del correo.
        patron_correo = (
            r"^[A-Za-z0-9._%+\-]+@"
            r"[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"
        )

        if (
            len(correo) > 190
            or not re.fullmatch(patron_correo, correo)
        ):
            return {
                "success": False,
                "message": "Ingresa un correo válido."
            }, 400

        # Validar contraseña.
        if (
            not isinstance(password, str)
            or not (8 <= len(password) <= 128)
        ):
            return {
                "success": False,
                "message": "La contraseña debe tener entre 8 y 128 caracteres."
            }, 400

        # Validar teléfono si se proporciona.
        if telefono and len(telefono) > 25:
            return {
                "success": False,
                "message": "El teléfono supera los 25 caracteres."
            }, 400

        # Buscar un usuario con el mismo correo.
        existente = db.session.scalar(
            select(Usuario).where(
                Usuario.correo == correo
            )
        )

        if existente:
            return {
                "success": False,
                "message": "El correo ya está registrado."
            }, 409

        # Buscar el rol CLIENTE en MySQL.
        rol_cliente = db.session.scalar(
            select(Rol).where(
                Rol.nombre == "CLIENTE"
            )
        )

        if rol_cliente is None:
            return {
                "success": False,
                "message": "El rol CLIENTE no está configurado."
            }, 500

        # Crear la cuenta.
        # IMPORTANTE: no aceptamos id_rol del cliente.
        usuario = Usuario(
            id_rol=rol_cliente.id_rol,
            nombre=nombre,
            correo=correo,
            telefono=telefono,
            activo=True
        )

        # Convertir la contraseña a hash.
        usuario.establecer_password(password)

        try:
            # Preparar el nuevo registro.
            db.session.add(usuario)

            # Guardar la transacción en MySQL.
            db.session.commit()

        except IntegrityError:
            # Revertir si MySQL rechaza el registro.
            db.session.rollback()

            return {
                "success": False,
                "message": "No se pudo registrar la cuenta. Verifica el correo."
            }, 409

        # Devolver el usuario sin su contraseña.
        return {
            "success": True,
            "message": "Cliente registrado correctamente.",
            "usuario": AuthService.usuario_publico(
                usuario
            )
        }, 201

    # ==========================================
    # 3. INICIAR SESIÓN
    # ==========================================

    @staticmethod
    def iniciar_sesion(datos):
        """
        Comprobar correo y contraseña.

        Si son correctos, emitir un JWT.
        """

        if not isinstance(datos, dict):
            return {
                "success": False,
                "message": "Se requiere un objeto JSON."
            }, 400

        correo = datos.get("correo")
        password = datos.get("password")

        # Validar los tipos de datos recibidos.
        if (
            not isinstance(correo, str)
            or not isinstance(password, str)
        ):
            return {
                "success": False,
                "message": "Correo y contraseña son obligatorios."
            }, 400

        correo = correo.strip().lower()

        # Localizar el usuario en MySQL.
        usuario = db.session.scalar(
            select(Usuario).where(
                Usuario.correo == correo
            )
        )

        # Usamos un mensaje genérico para no
        # revelar qué dato de acceso fue incorrecto.
        if (
            usuario is None
            or not usuario.verificar_password(password)
        ):
            return {
                "success": False,
                "message": "Credenciales incorrectas."
            }, 401

        # Comprobar que la cuenta está activa.
        if not usuario.activo:
            return {
                "success": False,
                "message": "La cuenta está desactivada."
            }, 403

        # El identificador del token será texto.
        # No almacenamos la contraseña en el JWT.
        token = create_access_token(
            identity=str(usuario.id_usuario)
        )

        return {
            "success": True,
            "message": "Inicio de sesión correcto.",
            "access_token": token,
            "token_type": "Bearer",
            "usuario": AuthService.usuario_publico(
                usuario
            )
        }, 200
