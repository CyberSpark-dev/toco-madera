
# ==========================================
# TOCO MADERA - APPLICATION FACTORY
# Archivo: backend/app/__init__.py
# ==========================================

# ==========================================
# 1. IMPORTACIONES PRINCIPALES
# ==========================================

# Flask: framework del backend.
from flask import Flask

# CORS: permite las peticiones desde Angular.
from flask_cors import CORS

# Configuración de la aplicación.
from app.config import Config

# Extensiones:
# db  -> conexión SQLAlchemy con MySQL.
# jwt -> autenticación mediante tokens JWT.
from app.extensions import db, jwt


# ==========================================
# 2. IMPORTAR LOS BLUEPRINTS
# ==========================================

# Comprobación del servidor.
from app.routes.health_routes import health_bp

# Dashboard administrativo.
from app.routes.dashboard_routes import dashboard_bp

# Catálogo de productos.
from app.routes.producto_routes import productos_bp

# Registro, login y perfil de usuario.
from app.routes.auth_routes import auth_bp


# ==================================================
# TOCO MADERA - ADMINISTRACIÓN DE PRODUCTOS
# ==================================================

from app.routes.admin_producto_routes import admin_productos_bp


# ==========================================
# 3. APPLICATION FACTORY
# ==========================================

def create_app():
    """
    Crea y configura la aplicación Flask.

    Se encarga de:
    - Cargar la configuración.
    - Habilitar CORS.
    - Inicializar SQLAlchemy.
    - Inicializar JWT.
    - Registrar los modelos.
    - Registrar los Blueprints.
    """

    # ======================================
    # PASO 1: CREAR FLASK
    # ======================================

    app = Flask(__name__)


    # ======================================
    # PASO 2: CARGAR CONFIGURACIÓN
    # ======================================

    # Obtener las variables de la clase Config.
    app.config.from_object(Config)


    # ======================================
    # PASO 3: CONFIGURAR CORS
    # ======================================

    # Permitir peticiones a /api/* desde Angular.
    # Estas direcciones se utilizan en desarrollo.
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:4200",
                    "http://127.0.0.1:4200"
                ]
            }
        }
    )


    # ======================================
    # PASO 4: INICIALIZAR MYSQL
    # ======================================

    # Recuperar la URL de conexión desde Config.
    database_url = app.config.get(
        "SQLALCHEMY_DATABASE_URI"
    )

    # Inicializar la extensión si existe una URL.
    if database_url:
        db.init_app(app)


    # ======================================
    # PASO 5: INICIALIZAR JWT
    # ======================================

    # Configurar el gestor de tokens.
    jwt.init_app(app)


    # ======================================
    # PASO 6: REGISTRAR MODELOS ORM
    # ======================================

    # Importar los modelos definidos en models/.
    # Esta instrucción no crea ni modifica
    # las tablas existentes de MySQL.
    from app import models


    # ======================================
    # PASO 7: REGISTRAR BLUEPRINTS
    # ======================================

    # Endpoint de salud del servidor.
    app.register_blueprint(health_bp)

    # Endpoints del dashboard.
    app.register_blueprint(dashboard_bp)

    # Endpoints del catálogo.
    app.register_blueprint(productos_bp)

    # Endpoints de autenticación.
    app.register_blueprint(auth_bp)


    # Registrar rutas administrativas de productos.
    app.register_blueprint(admin_productos_bp)


    


    # ======================================
    # PASO 8: DEVOLVER FLASK
    # ======================================

    # IMPORTANTE:
    # Debe estar fuera del if database_url.
    # Así create_app() siempre devuelve Flask.
    return app
