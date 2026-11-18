
# ==========================================
# TOCO MADERA - SERVICIO DE PRODUCTOS
# ==========================================

# select permite construir consultas SQLAlchemy.
from sqlalchemy import select

# Instancia de conexión a la base de datos.
from app.extensions import db

# Modelo de la tabla productos.
from app.models.producto import Producto


class ProductoService:

    @staticmethod
    def listar_activos():
        """
        Consultar los productos activos.

        Devuelve información lista para
        convertirse a JSON.
        """

        # Preparar la consulta.
        consulta = (
            select(Producto)
            .where(Producto.activo.is_(True))
            .order_by(Producto.id_producto)
        )

        # Ejecutar la consulta en MySQL.
        productos = db.session.scalars(
            consulta
        ).all()

        # Transformar cada producto a diccionario.
        resultado = []

        for producto in productos:
            resultado.append({
                "id_producto": producto.id_producto,
                "sku": producto.sku,
                "nombre": producto.nombre,
                "descripcion": producto.descripcion,

                # Enviar el precio como texto decimal
                # para conservar la precisión.
                "precio_lista": str(producto.precio_lista),

                "permite_grabado": producto.permite_grabado,
                "max_caracteres_grabado":
                    producto.max_caracteres_grabado
            })

        return resultado
