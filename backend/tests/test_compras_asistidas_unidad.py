from decimal import Decimal
import unittest

from app.routes.admin_compra_routes import faltantes_sin_cubrir, idempotencia
from app.services.faltantes_produccion import disponibilidad


class ComprasAsistidasUnidad(unittest.TestCase):
    def test_calculo_decimal_y_stock_suficiente(self):
        self.assertEqual(disponibilidad(Decimal('0.3'), Decimal('0.2'), True),
                         (Decimal('0.1'), 'STOCK_INSUFICIENTE'))
        self.assertEqual(disponibilidad(Decimal('0.1'), Decimal('0.2'), True),
                         (Decimal(0), None))

    def test_inactivo_no_confunde_su_motivo_con_stock(self):
        self.assertEqual(disponibilidad(Decimal('1'), Decimal('0'), False)[1], 'MATERIAL_INACTIVO')
        self.assertEqual(disponibilidad(Decimal('0'), Decimal('0'), True)[1], 'REQUERIMIENTO_INVALIDO')

    def test_cobertura_no_es_stock_y_nunca_es_negativa(self):
        materiales = [
            dict(id_material=1, cantidad_faltante='1.5000', elegible_compra=True),
            dict(id_material=2, cantidad_faltante='2.0000', elegible_compra=False),
            dict(id_material=3, cantidad_faltante='3.0000', elegible_compra=True),
        ]
        self.assertEqual(faltantes_sin_cubrir({'materiales': materiales}, {1: Decimal('.5'), 3: 4}),
                         {1: Decimal('1.0'), 3: Decimal(0)})

    def test_uuid_canonico_y_contenido(self):
        clave = 'F41602FD-90A9-47CA-8AB4-09DD40581DA0'
        datos = dict(clave_solicitud=clave, cantidad='1.0000')
        self.assertEqual(idempotencia(datos), idempotencia({'cantidad': '1.0000', 'clave_solicitud': clave.lower()}))
        self.assertNotEqual(idempotencia(datos), idempotencia({**datos, 'cantidad': '2.0000'}))
        with self.assertRaises(ValueError):
            idempotencia({'clave_solicitud': 'incorrecta'})
