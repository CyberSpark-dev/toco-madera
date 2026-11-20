
# ==========================================
# TOCO MADERA - MODELO PRODUCTO
# Archivo: backend/app/models/producto.py
# ==========================================

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    text
)

from sqlalchemy.dialects.mysql import (
    BIGINT,
    SMALLINT
)

from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Producto(db.Model):
    """Representación ORM de la tabla productos."""

    __tablename__ = "productos"

    # Clave primaria autoincremental.
    id_producto: Mapped[int] = mapped_column(
        BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True
    )

    # Clave foránea hacia categorias.
    id_categoria: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        ForeignKey("categorias.id_categoria"),
        nullable=False
    )

    # Código único de inventario.
    sku: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        nullable=False
    )

    # Nombre y descripción comercial.
    nombre: Mapped[str] = mapped_column(
        String(160),
        nullable=False
    )

    descripcion: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    # Usamos Decimal para conservar precisión monetaria.
    precio_lista: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    # Parámetros de personalización.
    permite_grabado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    max_caracteres_grabado: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        nullable=False,
        server_default=text("40")
    )

    # Permite ocultar productos sin eliminarlos.
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    # Fecha en la que se registró.
    creado_en: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )
