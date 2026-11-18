
# ==========================================
# TOCO MADERA - MODELO CATEGORÍA
# ==========================================

from sqlalchemy import String
from sqlalchemy.dialects.mysql import SMALLINT
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Categoria(db.Model):
    """
    Representa las categorías del catálogo.
    """

    __tablename__ = "categorias"

    # Identificador único de categoría.
    id_categoria: Mapped[int] = mapped_column(
        SMALLINT(unsigned=True),
        primary_key=True,
        autoincrement=True
    )

    # Nombre único de la categoría.
    nombre: Mapped[str] = mapped_column(
        String(90),
        nullable=False,
        unique=True
    )
