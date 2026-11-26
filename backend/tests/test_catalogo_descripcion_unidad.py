from decimal import Decimal
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from app.services import producto_service


class DescripcionRodillo(TestCase):
    def test_proyecta_descripcion_vigente_y_respeta_las_ediciones(self):
        antigua = 'Grabado solo en asas; acabado apto para alimentos'
        producto = dict(id_producto=3, sku='TM-RC-01', nombre='Rodillo de cocina',
                        precio_lista=Decimal('330.00'), permite_grabado=True,
                        max_caracteres_grabado=25)
        legado = SimpleNamespace(**producto, descripcion=antigua)
        editado = SimpleNamespace(**producto, descripcion='Descripción del taller')
        distinto = SimpleNamespace(**(producto | {'sku': 'OTRO-SKU'}), descripcion=antigua)
        with patch.object(producto_service, 'db') as db:
            db.session.scalars.return_value.all.return_value = [legado, editado, distinto]
            resultado = producto_service.ProductoService.listar_activos()
        self.assertIn('cuerpo del rodillo', resultado[0]['descripcion'])
        self.assertEqual(resultado[0]['precio_lista'], '330.00')
        self.assertEqual(resultado[1]['descripcion'], editado.descripcion)
        self.assertEqual(resultado[2]['descripcion'], antigua)
        self.assertEqual(legado.descripcion, antigua)
