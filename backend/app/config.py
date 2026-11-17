
import os
from dotenv import load_dotenv

# Carga las variables definidas en .env
load_dotenv()


class Config:
    """
    Configuración general de Toco Madera.
    """

    SECRET_KEY = os.getenv("SECRET_KEY")

    # Se configurará cuando conectemos MySQL.
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
