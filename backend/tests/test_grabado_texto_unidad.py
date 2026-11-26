from decimal import Decimal
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy import Column, Integer, MetaData, String, Table

from app.routes import cliente_pedido_routes as modulo


class GrabadoSinColumnaEstilo(TestCase):
    def test_checkout_emite_el_texto_sin_requerir_columna_de_estilo(self):
        metadata = MetaData()
        productos = Table(
            'productos', metadata, Column('id_producto', Integer), Column('activo', Integer),
            Column('precio_lista', Integer), Column('permite_grabado', Integer),
            Column('max_caracteres_grabado', Integer),
        )
        detalle = Table('pedido_detalles', metadata, Column('texto_grabado', String(120)))
        texto = 'Lucía y Toño\nFeliz año'
        db = SimpleNamespace(session=SimpleNamespace(execute=lambda _: SimpleNamespace(
            mappings=lambda: SimpleNamespace(first=lambda: dict(
                activo=1, precio_lista=20, permite_grabado=1, max_caracteres_grabado=40,
            )),
        )))
        with patch.object(modulo, 'db', db):
            detalles, total = modulo.validar_detalles(
                {'detalles': [{'id_producto': 1, 'cantidad': 2, 'texto_grabado': texto}]},
                {'productos': productos, 'pedido_detalles': detalle},
            )
        self.assertEqual(detalles[0]['texto_grabado'], texto)
        self.assertNotIn('estilo_grabado', detalles[0])
        self.assertEqual(total, Decimal('40.00'))
