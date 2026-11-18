# ==========================================
# TOCO MADERA - CONFIGURACIÓN DEL BACKEND
# ==========================================

import os
from datetime import timedelta

from dotenv import load_dotenv

# Cargar variables desde backend/.env.
load_dotenv()


class Config:
    """
    Configuración central de Flask.
    """

    # Clave secreta general.
    SECRET_KEY = os.getenv("SECRET_KEY")

    # Conexión privada con MySQL 8.
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL"
    )

    # Desactivar seguimiento extra de cambios.
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Utilizamos nuestra clave secreta
    # para firmar tokens de autenticación.
    JWT_SECRET_KEY = os.getenv("SECRET_KEY")

    # Los tokens durarán 30 minutos.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=30
    )

    # Angular enviará el token mediante
    # el encabezado Authorization: Bearer.
    JWT_TOKEN_LOCATION = ["headers"]
