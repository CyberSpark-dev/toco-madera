
# ==============================================
# TOCO MADERA - SERVICIO DE AUTENTICACIÓN
#
# Archivo:
# backend/app/services/auth_service.py
#
# ETAPA 3.19 - TELÉFONO OBLIGATORIO
#
# FUNCIONES:
# 1. Registrar clientes.
# 2. Validar nombre, correo y contraseña.
# 3. Exigir teléfono mexicano de 10 dígitos.
# 4. Evitar correos duplicados.
# 5. Asignar exclusivamente el rol CLIENTE.
# 6. Guardar contraseñas cifradas.
# 7. Permitir iniciar sesión con JWT.
# 8. Devolver datos públicos del usuario.
#
# IMPORTANTE:
# No modifica la estructura de MySQL.
# Conserva la compatibilidad con usuarios antiguos.
# ==============================================

import re

# Construcción de consultas SQLAlchemy.
from sqlalchemy import select

# Captura errores de restricciones de MySQL.
from sqlalchemy.exc import IntegrityError

# Generación de tokens JWT.
from flask_jwt_extended import create_access_token

# Conexión compartida con MySQL.
from app.extensions import db

# Modelos existentes.
from app.models.usuario import Usuario
from app.models.rol import Rol


class AuthService:
    """
    Servicio que contiene la lógica de registro,
    inicio de sesión y representación pública
    de los usuarios de Toco Madera.
    """

    # ==========================================
    # 1. CONVERTIR USUARIO A JSON SEGURO
    # ==========================================

    @staticmethod
    def usuario_publico(usuario):
        """
        Devuelve los datos públicos del usuario.

        Nunca incluye:
        - password_hash
        - contraseña original
        - token JWT

        El teléfono puede ser None en cuentas
        registradas antes de esta actualización.
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
        Registra una cuenta nueva con rol CLIENTE.

        El teléfono es obligatorio:
        - Solo números.
        - Exactamente 10 dígitos.
        - Sin espacios ni guiones.

        Devuelve:
        (respuesta_json, codigo_http)
        """

        # --------------------------------------
        # A. COMPROBAR CUERPO JSON
        # --------------------------------------

        if not isinstance(datos, dict):
            return {
                "success": False,
                "message": "Se requiere un objeto JSON."
            }, 400

        # --------------------------------------
        # B. OBTENER DATOS
        # --------------------------------------

        nombre = str(
            datos.get("nombre") or ""
        ).strip()

        correo = str(
            datos.get("correo") or ""
        ).strip().lower()

        password = datos.get("password")

        # Obtener el teléfono sin convertir
        # tipos incorrectos automáticamente.
        telefono = datos.get("telefono")

        # --------------------------------------
        # C. VALIDAR NOMBRE
        # --------------------------------------

        if not (2 <= len(nombre) <= 120):
            return {
                "success": False,
                "message": (
                    "El nombre debe tener entre "
                    "2 y 120 caracteres."
                )
            }, 400

        # --------------------------------------
        # D. VALIDAR CORREO
        # --------------------------------------

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

        # --------------------------------------
        # E. VALIDAR TELÉFONO OBLIGATORIO
        # --------------------------------------

        # Rechazar valores ausentes, números
        # enviados como tipo numérico y otros
        # tipos diferentes de texto.
        if not isinstance(telefono, str):
            return {
                "success": False,
                "message": (
                    "El número de teléfono es obligatorio "
                    "y debe contener exactamente 10 dígitos."
                )
            }, 400

        # Eliminar espacios al principio y al final.
        telefono = telefono.strip()

        # Validar formato nacional mexicano.
        #
        # Ejemplo aceptado:
        # 4771234567
        #
        # Ejemplos rechazados:
        # 477123456
        # 47712345678
        # 477-123-4567
        # abc1234567

        if not re.fullmatch(r"[0-9]{10}", telefono):
            return {
                "success": False,
                "message": (
                    "El teléfono es obligatorio y debe "
                    "contener exactamente 10 dígitos "
                    "numéricos, sin espacios ni guiones."
                )
            }, 400

        # --------------------------------------
        # F. VALIDAR CONTRASEÑA
        # --------------------------------------

        if (
            not isinstance(password, str)
            or not (8 <= len(password) <= 128)
        ):
            return {
                "success": False,
                "message": (
                    "La contraseña debe tener entre "
                    "8 y 128 caracteres."
                )
            }, 400

        # --------------------------------------
        # G. VERIFICAR CORREO DUPLICADO
        # --------------------------------------

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

        # --------------------------------------
        # H. OBTENER EL ROL CLIENTE
        # --------------------------------------

        rol_cliente = db.session.scalar(
            select(Rol).where(
                Rol.nombre == "CLIENTE"
            )
        )

        if rol_cliente is None:
            return {
                "success": False,
                "message": (
                    "El rol CLIENTE no está configurado."
                )
            }, 500

        # --------------------------------------
        # I. CREAR USUARIO
        # --------------------------------------

        # El rol se obtiene desde MySQL.
        # Nunca se acepta id_rol desde el
        # formulario público de registro.

        usuario = Usuario(
            id_rol=rol_cliente.id_rol,
            nombre=nombre,
            correo=correo,

            # Ahora siempre contiene 10 dígitos.
            telefono=telefono,

            activo=True
        )

        # --------------------------------------
        # J. CIFRAR CONTRASEÑA
        # --------------------------------------

        # Utiliza el método del modelo Usuario.
        # Nunca guardamos contraseñas en texto plano.

        usuario.establecer_password(password)

        # --------------------------------------
        # K. GUARDAR EN MYSQL
        # --------------------------------------

        try:
            db.session.add(usuario)

            # Confirmar la transacción.
            db.session.commit()

        except IntegrityError:

            # Deshacer cualquier inserción parcial.
            db.session.rollback()

            return {
                "success": False,
                "message": (
                    "No se pudo registrar la cuenta. "
                    "Verifica el correo."
                )
            }, 409

        # --------------------------------------
        # L. RESPUESTA EXITOSA
        # --------------------------------------

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
        Verifica correo y contraseña.

        Cuando las credenciales son correctas,
        devuelve un JWT y el perfil del usuario.

        Este proceso funciona tanto para CLIENTE
        como para ADMIN.
        """

        # --------------------------------------
        # A. VALIDAR JSON
        # --------------------------------------

        if not isinstance(datos, dict):
            return {
                "success": False,
                "message": "Se requiere un objeto JSON."
            }, 400

        # --------------------------------------
        # B. OBTENER CREDENCIALES
        # --------------------------------------

        correo = datos.get("correo")
        password = datos.get("password")

        if (
            not isinstance(correo, str)
            or not isinstance(password, str)
        ):
            return {
                "success": False,
                "message": (
                    "Correo y contraseña son obligatorios."
                )
            }, 400

        correo = correo.strip().lower()

        # --------------------------------------
        # C. BUSCAR USUARIO
        # --------------------------------------

        usuario = db.session.scalar(
            select(Usuario).where(
                Usuario.correo == correo
            )
        )

        # --------------------------------------
        # D. VERIFICAR CONTRASEÑA
        # --------------------------------------

        # Respuesta genérica para no revelar
        # si un correo específico existe.

        if (
            usuario is None
            or not usuario.verificar_password(password)
        ):
            return {
                "success": False,
                "message": "Credenciales incorrectas."
            }, 401

        # --------------------------------------
        # E. VERIFICAR CUENTA ACTIVA
        # --------------------------------------

        if not usuario.activo:
            return {
                "success": False,
                "message": "La cuenta está desactivada."
            }, 403

        # --------------------------------------
        # F. GENERAR JWT
        # --------------------------------------

        # El token contiene como identidad
        # el identificador del usuario.
        #
        # No incluye contraseñas.

        token = create_access_token(
            identity=str(usuario.id_usuario)
        )

        # --------------------------------------
        # G. RESPONDER AL FRONTEND
        # --------------------------------------

        return {
            "success": True,
            "message": "Inicio de sesión correcto.",
            "access_token": token,
            "token_type": "Bearer",
            "usuario": AuthService.usuario_publico(
                usuario
            )
        }, 200
