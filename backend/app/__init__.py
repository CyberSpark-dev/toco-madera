
# ============================================================
# TOCO MADERA - APPLICATION FACTORY
# Archivo: backend/app/__init__.py
# ============================================================
#
# Este archivo es el punto central de configuración
# de la aplicación Flask.
#
# RESPONSABILIDADES:
#
# 1. Crear la instancia principal de Flask.
# 2. Cargar la configuración del proyecto.
# 3. Configurar CORS para Angular.
# 4. Inicializar SQLAlchemy y MySQL.
# 5. Inicializar la autenticación JWT.
# 6. Registrar los modelos SQLAlchemy.
# 7. Registrar todos los Blueprints.
# 8. Devolver la aplicación configurada.
#
# ARQUITECTURA:
# Application Factory + Blueprints + SQLAlchemy.
#
# IMPORTANTE:
# Este archivo NO crea ni modifica las tablas MySQL.
# ============================================================


# ============================================================
# 1. IMPORTACIONES PRINCIPALES
# ============================================================

# Framework utilizado para construir nuestra API REST.
from flask import Flask

# Permite peticiones desde Angular hacia Flask.
from flask_cors import CORS

# Clase que contiene la configuración del backend.
from app.config import Config

# Extensiones compartidas de la aplicación:
#
# db:
#   ORM SQLAlchemy para interactuar con MySQL.
#
# jwt:
#   Autenticación mediante JSON Web Tokens.
from app.extensions import db, jwt


# ============================================================
# 2. IMPORTACIONES DE BLUEPRINTS
# ============================================================

# ------------------------------------------------------------
# 2.1. ESTADO DEL SERVIDOR
# ------------------------------------------------------------

# Permite comprobar que el backend funciona.
from app.routes.health_routes import health_bp


# ------------------------------------------------------------
# 2.2. DASHBOARD ADMINISTRATIVO
# ------------------------------------------------------------

# Contiene rutas protegidas del dashboard.
from app.routes.dashboard_routes import dashboard_bp


# ------------------------------------------------------------
# 2.3. CATÁLOGO PÚBLICO
# ------------------------------------------------------------

# Permite consultar productos desde la tienda.
from app.routes.producto_routes import productos_bp


# ------------------------------------------------------------
# 2.4. AUTENTICACIÓN
# ------------------------------------------------------------

# Registro, inicio de sesión y consulta del perfil.
from app.routes.auth_routes import auth_bp


# ------------------------------------------------------------
# 2.5. ADMINISTRACIÓN DE PRODUCTOS - ETAPA 3.15
# ------------------------------------------------------------

# Permite listar, registrar, editar y cambiar
# el estado lógico de los productos.
from app.routes.admin_producto_routes import admin_productos_bp


# ------------------------------------------------------------
# 2.6. ADMINISTRACIÓN DE PROVEEDORES - ETAPA 3.16
# ------------------------------------------------------------

# Permite gestionar los proveedores registrados
# sin eliminar su historial de compras.
from app.routes.admin_proveedor_routes import admin_proveedores_bp


# ------------------------------------------------------------
# 2.7. CONSULTA DE MATERIAS PRIMAS - ETAPA 3.16
# ------------------------------------------------------------

# Permite consultar materiales existentes desde Angular.
from app.routes.admin_material_routes import admin_materiales_bp



# ============================================================
# 3. APPLICATION FACTORY
# ============================================================

def create_app():
    """
    Crea y configura la aplicación Flask.

    Esta función aplica el patrón Application Factory.

    Beneficios:
    - Organizar la configuración.
    - Facilitar pruebas.
    - Mantener módulos independientes.
    - Centralizar la inicialización de extensiones.
    - Registrar las rutas de la API.
    """

    # ========================================================
    # PASO 1: CREAR LA INSTANCIA DE FLASK
    # ========================================================

    # __name__ permite a Flask identificar el módulo
    # desde el que se ejecuta la aplicación.
    app = Flask(__name__)


    # ========================================================
    # PASO 2: CARGAR LA CONFIGURACIÓN
    # ========================================================

    # Cargar los valores establecidos en app/config.py.
    #
    # Ejemplos:
    # SQLALCHEMY_DATABASE_URI
    # JWT_SECRET_KEY
    # SQLALCHEMY_TRACK_MODIFICATIONS
    app.config.from_object(Config)


    # ========================================================
    # PASO 3: CONFIGURAR CORS
    # ========================================================

    # CORS permite que el frontend Angular,
    # ejecutado en el puerto 4200, pueda realizar
    # peticiones HTTP hacia Flask.
    #
    # Se permite únicamente el origen de desarrollo
    # y se restringe la configuración a rutas /api/*.
    #
    # NOTA:
    # Las URL deben escribirse directamente, sin
    # formato Markdown ni corchetes.

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


    # ========================================================
    # PASO 4: INICIALIZAR SQLALCHEMY
    # ========================================================

    # Recuperar la URL de conexión configurada.
    database_url = app.config.get(
        "SQLALCHEMY_DATABASE_URI"
    )

    # Mantener el comportamiento de nuestro proyecto:
    # SQLAlchemy se inicializa cuando hay una URL
    # de base de datos configurada.
    if database_url:

        # Asociar SQLAlchemy a esta instancia de Flask.
        db.init_app(app)

    # IMPORTANTE:
    # No ejecutamos db.create_all().
    #
    # Las tablas ya existen en MySQL 8 y
    # fueron creadas mediante los scripts SQL
    # de nuestro proyecto.


    # ========================================================
    # PASO 5: INICIALIZAR AUTENTICACIÓN JWT
    # ========================================================

    # Registrar JWTManager en Flask.
    #
    # Esto permite utilizar los decoradores y
    # funciones de Flask-JWT-Extended.
    jwt.init_app(app)


    # ========================================================
    # PASO 6: IMPORTAR MODELOS SQLALCHEMY
    # ========================================================

    # Registrar los modelos definidos en app/models/.
    #
    # Importarlos no crea las tablas ni modifica
    # su estructura.
    #
    # El registro de modelos permite a SQLAlchemy
    # conocer sus relaciones y configuraciones.
    from app import models


    # ========================================================
    # PASO 7: REGISTRAR BLUEPRINTS
    # ========================================================

    # --------------------------------------------------------
    # 7.1. ESTADO DEL SERVIDOR
    # --------------------------------------------------------

    # Endpoint para verificar que Flask responde.
    app.register_blueprint(health_bp)


    # --------------------------------------------------------
    # 7.2. DASHBOARD ADMINISTRATIVO
    # --------------------------------------------------------

    # Rutas protegidas relacionadas con el dashboard.
    app.register_blueprint(dashboard_bp)


    # --------------------------------------------------------
    # 7.3. CATÁLOGO PÚBLICO
    # --------------------------------------------------------

    # Permite que Angular consulte los productos
    # disponibles en la tienda.
    app.register_blueprint(productos_bp)


    # --------------------------------------------------------
    # 7.4. AUTENTICACIÓN DE USUARIOS
    # --------------------------------------------------------

    # Registro de clientes, login y perfil.
    app.register_blueprint(auth_bp)


    # --------------------------------------------------------
    # 7.5. CRUD ADMINISTRATIVO DE PRODUCTOS
    # --------------------------------------------------------

    # Módulo desarrollado durante la Etapa 3.15.
    #
    # Incluye:
    # - Listar productos.
    # - Consultar categorías.
    # - Registrar productos.
    # - Editar productos.
    # - Activar/desactivar productos.
    app.register_blueprint(admin_productos_bp)


    # --------------------------------------------------------
    # 7.6. CRUD ADMINISTRATIVO DE PROVEEDORES
    # --------------------------------------------------------

    # Módulo correspondiente a la Etapa 3.16.
    #
    # Incluye:
    # - Listar proveedores.
    # - Registrar proveedores.
    # - Editar proveedores.
    # - Activar/desactivar proveedores.
    #
    # Sus rutas requieren autenticación administrativa.
    app.register_blueprint(admin_proveedores_bp)


    # ------------------------------------------------------------
    # 7.7. ADMINISTRACIÓN DE MATERIAS PRIMAS
    # ------------------------------------------------------------

    # Primera implementación: consulta protegida.
    # Los endpoints de escritura se incorporarán
    # después de validar el esquema de materiales.
    app.register_blueprint(admin_materiales_bp)



    # ========================================================
    # PASO 8: DEVOLVER LA APLICACIÓN
    # ========================================================

    # Devolver la instancia de Flask completamente
    # configurada.
    #
    # IMPORTANTE:
    # Este return debe permanecer fuera del
    # condicional if database_url.
    return app
