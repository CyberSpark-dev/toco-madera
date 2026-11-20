
# ============================================================
# TOCO MADERA - CREACIÓN SEGURA DE ADMINISTRADORES
# Archivo: backend/scripts/crear_admin.py
# ============================================================
#
# OBJETIVO:
# Crear una cuenta con rol ADMIN directamente desde
# el backend, sin utilizar el registro público.
#
# SEGURIDAD:
# - La contraseña se solicita sin mostrarla.
# - La contraseña se almacena mediante hashing.
# - El rol ADMIN se obtiene desde MySQL.
# - No se convierten cuentas existentes en ADMIN.
# - No se muestran contraseñas ni hashes.
# - Si falla el INSERT, se revierte la transacción.
# ============================================================

import sys
import re

from pathlib import Path
from getpass import getpass

# ------------------------------------------------------------
# 1. CONFIGURAR LA RUTA DEL PROYECTO
# ------------------------------------------------------------

# Permite importar "app" cuando ejecutamos:
# python scripts/crear_admin.py
CARPETA_BACKEND = Path(__file__).resolve().parent.parent

sys.path.insert(
    0,
    str(CARPETA_BACKEND)
)

# ------------------------------------------------------------
# 2. IMPORTACIONES DE FLASK Y MYSQL
# ------------------------------------------------------------

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.extensions import db

from app.models.rol import Rol
from app.models.usuario import Usuario


# ------------------------------------------------------------
# 3. FUNCIÓN PARA VALIDAR CONTRASEÑAS
# ------------------------------------------------------------

def validar_password(password):
    """
    Reglas mínimas para la cuenta administrativa:

    - Entre 12 y 128 caracteres.
    - Al menos una letra.
    - Al menos un número.
    - Al menos un carácter especial.
    """

    if not 12 <= len(password) <= 128:
        return False

    if not re.search(r"[A-Za-z]", password):
        return False

    if not re.search(r"\d", password):
        return False

    if not re.search(r"[^A-Za-z0-9]", password):
        return False

    return True


# ------------------------------------------------------------
# 4. FUNCIÓN PRINCIPAL
# ------------------------------------------------------------

def crear_administrador():
    """
    Solicita los datos y registra un usuario ADMIN.
    """

    print()
    print("==========================================")
    print(" TOCO MADERA - CREAR ADMINISTRADOR")
    print("==========================================")
    print()

    # --------------------------------------------------------
    # PASO 1: SOLICITAR NOMBRE
    # --------------------------------------------------------

    nombre = input(
        "Nombre del administrador: "
    ).strip()

    if not 2 <= len(nombre) <= 120:
        print(
            "ERROR: El nombre debe tener "
            "entre 2 y 120 caracteres."
        )
        return

    # --------------------------------------------------------
    # PASO 2: SOLICITAR CORREO
    # --------------------------------------------------------

    correo = input(
        "Correo del administrador: "
    ).strip().lower()

    patron_correo = (
        r"^[A-Za-z0-9._%+\-]+@"
        r"[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"
    )

    if (
        len(correo) > 190
        or not re.fullmatch(patron_correo, correo)
    ):
        print("ERROR: Correo electrónico inválido.")
        return

    # --------------------------------------------------------
    # PASO 3: SOLICITAR CONTRASEÑA
    # --------------------------------------------------------

    # getpass evita mostrar lo escrito en pantalla.
    password = getpass(
        "Contraseña administrativa: "
    )

    if not validar_password(password):
        print()
        print(
            "ERROR: Utiliza una contraseña "
            "de 12 a 128 caracteres con letras, "
            "números y símbolos."
        )
        return

    confirmar = getpass(
        "Confirmar contraseña: "
    )

    if password != confirmar:
        print("ERROR: Las contraseñas no coinciden.")
        return

    # --------------------------------------------------------
    # PASO 4: CREAR APLICACIÓN FLASK
    # --------------------------------------------------------

    app = create_app()

    # El contexto permite utilizar db.session
    # fuera de una petición HTTP.
    with app.app_context():

        try:

            # ------------------------------------------------
            # PASO 5: COMPROBAR SI EL CORREO EXISTE
            # ------------------------------------------------

            existente = db.session.scalar(
                select(Usuario).where(
                    Usuario.correo == correo
                )
            )

            if existente is not None:
                print()
                print(
                    "ERROR: Ya existe una cuenta "
                    "con ese correo."
                )
                print(
                    "No se modificó su rol."
                )
                return

            # ------------------------------------------------
            # PASO 6: OBTENER EL ROL ADMIN
            # ------------------------------------------------

            rol_admin = db.session.scalar(
                select(Rol).where(
                    Rol.nombre == "ADMIN"
                )
            )

            if rol_admin is None:
                print()
                print(
                    "ERROR: No existe el rol ADMIN."
                )
                print(
                    "Ejecuta primero el script "
                    "de configuración de roles."
                )
                return

            # ------------------------------------------------
            # PASO 7: CREAR EL USUARIO
            # ------------------------------------------------

            administrador = Usuario(
                nombre=nombre,
                correo=correo,
                id_rol=rol_admin.id_rol,
                activo=True
            )

            # ------------------------------------------------
            # PASO 8: PROTEGER LA CONTRASEÑA
            # ------------------------------------------------

            # Utiliza generate_password_hash()
            # definido dentro del modelo Usuario.
            administrador.establecer_password(
                password
            )

            # ------------------------------------------------
            # PASO 9: GUARDAR EN MYSQL
            # ------------------------------------------------

            db.session.add(administrador)

            db.session.commit()

            # ------------------------------------------------
            # PASO 10: CONFIRMACIÓN
            # ------------------------------------------------

            print()
            print("==========================================")
            print(" ADMINISTRADOR CREADO CORRECTAMENTE")
            print("==========================================")
            print("ID:", administrador.id_usuario)
            print("Nombre:", administrador.nombre)
            print("Correo:", administrador.correo)
            print("Rol:", rol_admin.nombre)
            print("==========================================")

        except IntegrityError:

            # Si hay una colisión de correo
            # u otra restricción de MySQL.
            db.session.rollback()

            print(
                "ERROR: MySQL rechazó el registro. "
                "No se creó el administrador."
            )

        except SQLAlchemyError:

            # Revertir cambios ante un fallo de base de datos.
            db.session.rollback()

            print(
                "ERROR: No fue posible completar "
                "la operación en MySQL."
            )


# ------------------------------------------------------------
# 5. PUNTO DE ENTRADA
# ------------------------------------------------------------

if __name__ == "__main__":
    crear_administrador()
