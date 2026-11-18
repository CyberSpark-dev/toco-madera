
# ==========================================
# TOCO MADERA - MODELO DE ROLES
# Archivo: backend/app/models/rol.py
# ==========================================

# Importaciones necesarias para columnas.
from sqlalchemy import String
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

# Instancia SQLAlchemy que utiliza Flask.
from app.extensions import db


class Rol(db.Model):
    """
    Representa la tabla 'roles' de MySQL.

    Define los tipos de usuario autorizados
    a interactuar con Toco Madera.
    """

    # Nombre exacto de la tabla en MySQL.
    __tablename__ = "roles"

    # Identificador único del rol.
    id_rol: Mapped[int] = mapped_column(
        TINYINT(unsigned=True),
        primary_key=True,
        autoincrement=True
    )

    # Nombre del rol: ADMIN o CLIENTE.
    nombre: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True
    )

    # Explicación del rol.
    descripcion: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )
