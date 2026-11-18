
from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import db

from app.routes.health_routes import health_bp
from app.routes.dashboard_routes import dashboard_bp

from app.routes.producto_routes import productos_bp


def create_app():

    # Crear aplicación Flask
    app = Flask(__name__)

    # Cargar configuración
    app.config.from_object(Config)

    # Configurar comunicación con Angular
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

    # Inicializar MySQL cuando esté configurado
    database_url = app.config.get(
        "SQLALCHEMY_DATABASE_URI"
    )

    if database_url:
        db.init_app(app)

    # Registrar Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(productos_bp)#nuevo agregado 3.5

    # IMPORTANTE: esta línea debe ejecutarse siempre
    return app
