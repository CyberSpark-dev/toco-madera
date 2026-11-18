
# ==========================================
# TOCO MADERA - MODELO DE USUARIOS
# Archivo: backend/app/models/usuario.py
# ==========================================

from datetime import datetime

# Tipos de datos y relaciones.
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    text
)

# Tipos de enteros específicos de MySQL.
from sqlalchemy.dialects.mysql import (
    BIGINT,
    TINYINT
)

# Herramientas de SQLAlchemy ORM.
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship
)

# Herramientas para proteger contraseñas.
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from app.extensions import db


class Usuario(db.Model):
    """
    Representa la tabla 'usuarios'.

    Contiene los datos de acceso de clientes
    y administradores de Toco Madera.
    """

    __tablename__ = "usuarios"

    # Clave primaria de cada cuenta.
    id_usuario: Mapped[int] = mapped_column(
        BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True
    )

    # Clave foránea hacia la tabla roles.
    id_rol: Mapped[int] = mapped_column(
        TINYINT(unsigned=True),
        ForeignKey("roles.id_rol"),
        nullable=False
    )

    # Nombre del usuario.
    nombre: Mapped[str] = mapped_column(
        String(120),
        nullable=False
    )

    # Correo único utilizado para iniciar sesión.
    correo: Mapped[str] = mapped_column(
        String(190),
        unique=True,
        nullable=False
    )

    # Almacena un hash, NO la contraseña original.
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    # Teléfono opcional.
    telefono: Mapped[str | None] = mapped_column(
        String(25),
        nullable=True
    )

    # Permite desactivar cuentas sin eliminarlas.
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    # Fecha de creación de la cuenta.
    creado_en: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # MySQL actualiza este valor al modificar
    # los datos del usuario.
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relación ORM con el modelo Rol.
    # Permite consultar usuario.rol.nombre.
    rol: Mapped["Rol"] = relationship("Rol")

    # ======================================
    # PROTECCIÓN DE CONTRASEÑAS
    # ======================================

    def establecer_password(self, password: str) -> None:
        """
        Convierte una contraseña en un hash.

        Nunca guardamos la contraseña original
        en la base de datos.
        """
        self.password_hash = generate_password_hash(
            password
        )

    def verificar_password(self, password: str) -> bool:
        """
        Comprueba si la contraseña ingresada
        corresponde con el hash almacenado.
        """
        return check_password_hash(
            self.password_hash,
            password
        )
