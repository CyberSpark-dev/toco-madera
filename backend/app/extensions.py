
# ==========================================
# TOCO MADERA - EXTENSIONES DE FLASK
# ==========================================

# Conexión ORM con MySQL.
from flask_sqlalchemy import SQLAlchemy

# Gestión de tokens para autenticación.
from flask_jwt_extended import JWTManager


# Instancia compartida de SQLAlchemy.
db = SQLAlchemy()

# Administrador de tokens JWT.
jwt = JWTManager()
