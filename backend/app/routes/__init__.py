
# Importaciones principales
from flask import Flask
from flask_cors import CORS

# Configuración y base de datos
from app.config import Config
from app.extensions import db

# Blueprints del proyecto
from app.routes.health_routes import health_bp
from app.routes.dashboard_routes import dashboard_bp


def create_app():
    """
    Crear y configurar la aplicación
    Flask de Toco Madera.
    """

    # 1. Crear la aplicación Flask
    app = Flask(__name__)

    # 2. Cargar las configuraciones
    app.config.from_object(Config)

    # 3. Permitir comunicación con Angular
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

    # 4. Preparar conexión a MySQL
    # Todavía no conectaremos la base de datos.
    database_url = app.config.get(
        "SQLALCHEMY_DATABASE_URI"
    )

    if database_url:
        db.init_app(app)

    # 5. Registrar Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(dashboard_bp)

    # 6. Devolver siempre la aplicación
    return app
