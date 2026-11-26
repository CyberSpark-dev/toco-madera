"""Integración opt-in. Solo escribe en la instancia aislada verificada."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import hashlib
import os
from pathlib import Path
import re
import runpy
import secrets
from threading import Barrier
import unittest
from uuid import uuid4
from unittest.mock import patch

from sqlalchemy.engine import URL, make_url


UUID = os.getenv('TOCO_TEST_UUID', '68630ee8-e925-11f1-b12e-60cf84707dee')
CARPETA = Path(os.getenv('TOCO_TEST_CARPETA', r'C:\Users\angel\AppData\Local\Temp\toco-compras-pruebas-332qpp3r'))
PUERTO = int(os.getenv('TOCO_TEST_PUERTO', '33317'))


@unittest.skipUnless(os.getenv('TOCO_TEST_AISLADO') == '1', 'Pruebas MySQL aisladas opt-in')
class ComprasAisladas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = runpy.run_path(str(Path(__file__).resolve().parents[2]
                                   / 'database/preparar_compras_pruebas.py'))
        cls.m['usar_puerto_aislado'](PUERTO)
        cls.folder = cls.m['workspace'](CARPETA)
        cls.manifest, digest = cls.m['verified_backup'](cls.folder)
        meta = cls.m['read_json'](cls.folder, 'conexion.json')
        if meta['uuid'] != UUID:
            raise RuntimeError('El archivo no corresponde a la instancia de pruebas autorizada.')
        cls.root_args = cls.m['target_args'](meta['password'])
        cls.cert = cls.m['read_json'](cls.folder, 'restauracion-verificada.json')
        cls.account = 'toco_ci_' + secrets.token_hex(6)
        cls.password = secrets.token_urlsafe(28)
        with cls.connect(cls.root_args) as root:
            cls.m['verify_certificate'](cls.cert, cls.m['identity'](root), digest, meta['certificate_key'])
            cls.check_history(root)
            present = cls.m['rows'](root, """
                SELECT COLUMN_NAME FROM information_schema.columns
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='compras'
                  AND COLUMN_NAME IN ('id_orden_produccion','revision','clave_solicitud')
            """)
            if len(present) != 3:
                raise RuntimeError('Falta la migración aislada.')
            cls.m['rows'](root, f"CREATE USER '{cls.account}'@'localhost' IDENTIFIED BY %s", (cls.password,))
            cls.addClassCleanup(cls.drop_test_account)
            cls.m['rows'](root, f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{cls.m['TARGET']}`.* TO '{cls.account}'@'localhost'")
            cls.m['rows'](root, f"GRANT SHOW VIEW ON `{cls.m['TARGET']}`.`vw_saldos_pedidos` TO '{cls.account}'@'localhost'")
        cls.params = dict(cls.root_args, user=cls.account, password=cls.password)
        with cls.connect(cls.params) as conn:
            grants = [row[0] for row in cls.m['rows'](conn, 'SHOW GRANTS')]
            if len(grants) != 3 or not any(
                re.match(r'GRANT SELECT, INSERT, UPDATE, DELETE ON `?'+cls.m['TARGET'], grant)
                for grant in grants
            ) or not any(g.startswith(f'GRANT SHOW VIEW ON `{cls.m["TARGET"]}`.`vw_saldos_pedidos` TO ') for g in grants):
                raise RuntimeError('Los permisos de la cuenta desechable no son los previstos.')
        url = URL.create('mysql+pymysql', username=cls.account, password=cls.password,
                         host='127.0.0.1', port=PUERTO, database=cls.m['TARGET'],
                         query={'charset': 'utf8mb4'})
        env = patch.dict(os.environ, DATABASE_URL=url.render_as_string(hide_password=False),
                         SECRET_KEY=secrets.token_urlsafe(32))
        env.start()
        cls.addClassCleanup(env.stop)
        from app import create_app
        from app.config import Config
        from app.extensions import db
        from flask_jwt_extended import create_access_token
        from sqlalchemy import event
        # unittest puede haber importado la configuración al descubrir otros tests.
        # La fábrica siempre recibe el destino aislado, incluso en ese caso.
        with patch.multiple(Config, SQLALCHEMY_DATABASE_URI=os.environ['DATABASE_URL'],
                            SECRET_KEY=os.environ['SECRET_KEY'], JWT_SECRET_KEY=os.environ['SECRET_KEY']):
            cls.app = create_app()
        cls.app.config.update(TESTING=True)
        cls.token = staticmethod(create_access_token)

        def guard(raw, record, proxy):
            cls.m['assert_isolated'](cls.m['identity'](raw), cls.folder, UUID)
            raw.rollback()

        with cls.app.app_context():
            engine = db.engine
            configured = make_url(cls.app.config['SQLALCHEMY_DATABASE_URI'])
            # El motor puede añadir opciones del controlador. Verificamos por separado
            # la configuración original y el destino y credenciales efectivos.
            if engine.url.set(query={}) != url.set(query={}) or configured != url:
                raise RuntimeError('Flask no recibió la conexión de pruebas exclusiva.')
            engine.echo = False
            engine.hide_parameters = True
            event.listen(engine, 'checkout', guard)
            cls.addClassCleanup(engine.dispose)
            with engine.connect():
                pass
        print(f'Integración aislada verificada: esquema toco_madera_compras_pruebas; puerto {PUERTO}; UUID {UUID}')

    @classmethod
    def connect(cls, params):
        conn = cls.m['pymysql'].connect(**params)
        try:
            cls.m['assert_isolated'](cls.m['identity'](conn), cls.folder, UUID)
            conn.rollback()
        except Exception:
            conn.close()
            raise
        return conn

    @classmethod
    def check_history(cls, conn):
        snapshot = cls.manifest['snapshot']
        for table, (count, expected) in snapshot['rows'].items():
            ddl = snapshot['tables'].get(table)
            projection = '*' if not ddl else ','.join(
                f'`{n}`' for n in re.findall(r'^  `(\w+)`', ddl, re.M)
            )
            records = cls.m['rows'](conn, f'SELECT {projection} FROM `{table}`')
            got = hashlib.sha256(b''.join(sorted(
                hashlib.sha256(repr(row).encode()).digest() for row in records
            ))).hexdigest()
            if (len(records), got) != (count, expected):
                raise RuntimeError('Los registros de la copia no coinciden con el historial esperado.')
        conn.rollback()

    @classmethod
    def drop_test_account(cls):
        with cls.connect(cls.root_args) as conn:
            cls.m['rows'](conn, f"DROP USER '{cls.account}'@'localhost'")

    @classmethod
    def tearDownClass(cls):
        with cls.connect(cls.params) as conn:
            cls.check_history(conn)

    def sql(self, query, params=(), *, id=False):
        with self.connect(self.params) as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                value = cursor.lastrowid if id else cursor.fetchall()
            conn.commit()
            return value

    def insertar(self, tabla, **campos):
        return self.sql(f"INSERT INTO {tabla} ({','.join(campos)}) VALUES ({','.join(['%s']*len(campos))})",
                        tuple(campos.values()), id=True)

    def setUp(self):
        self.tag = uuid4().hex[:18]
        self.admins, self.proveedores = [], []
        self.materiales, self.ordenes, self.recetas = [], [], []
        self.producto = None
        self.addCleanup(self.limpiar)
        roles = dict(self.sql('SELECT nombre,id_rol FROM roles'))
        for rol in ('ADMIN','ADMIN','CLIENTE'):
            self.admins.append(self.insertar('usuarios', id_rol=roles[rol], nombre='Prueba aislada',
                correo=f'{self.tag}-{len(self.admins)}@example.invalid', password_hash='sin acceso'))
        with self.app.app_context():
            self.tokens = [self.token(identity=str(i)) for i in self.admins]
        for i in range(2):
            self.proveedores.append(self.insertar('proveedores', nombre=f'Prueba {self.tag} {i}'))
        unidad = self.sql('SELECT id_unidad FROM unidades_medida ORDER BY id_unidad LIMIT 1')[0][0]
        for i in range(3):
            self.materiales.append(self.insertar('materiales', sku=f'CI-{self.tag}-{i}', nombre=f'Material {i}', id_unidad=unidad))
        categoria = self.sql('SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1')[0][0]
        self.producto = self.insertar('productos', id_categoria=categoria, sku='CI-'+self.tag, nombre='Prueba aislada', precio_lista='5.00')
        self.orden = self.crear_orden(((0,'2.0000'),(1,'3.0000')))
        self.movimiento(0,'1.0000')
        self.movimiento(1,'3.0000')

    def limpiar(self):
        for proveedor in self.proveedores:
            self.sql('DELETE FROM movimientos_material WHERE id_detalle_compra IN (SELECT d.id_detalle_compra FROM compra_detalles d JOIN compras c ON d.id_compra=c.id_compra WHERE c.id_proveedor=%s)', (proveedor,))
            self.sql('DELETE d FROM compra_detalles d JOIN compras c ON d.id_compra=c.id_compra WHERE c.id_proveedor=%s', (proveedor,))
            self.sql('DELETE FROM compras WHERE id_proveedor=%s', (proveedor,))
        for material in self.materiales:
            self.sql('DELETE FROM movimientos_material WHERE id_material=%s', (material,))
            self.sql('DELETE FROM cotizaciones_material WHERE id_material=%s', (material,))
        for orden in self.ordenes:
            self.sql('DELETE FROM consumos_produccion WHERE id_orden=%s', (orden,))
            self.sql('DELETE FROM ordenes_produccion WHERE id_orden=%s', (orden,))
        for receta in self.recetas:
            self.sql('DELETE FROM receta_materiales WHERE id_receta=%s', (receta,))
            self.sql('DELETE FROM recetas WHERE id_receta=%s', (receta,))
        for material in self.materiales:
            self.sql('DELETE FROM materiales WHERE id_material=%s', (material,))
        for proveedor in self.proveedores:
            self.sql('DELETE FROM proveedores WHERE id_proveedor=%s', (proveedor,))
        if self.producto:
            self.sql('DELETE FROM productos WHERE id_producto=%s', (self.producto,))
        for usuario in self.admins:
            self.sql('DELETE FROM usuarios WHERE id_usuario=%s', (usuario,))

    def crear_orden(self, renglones, estado='EN_PROCESO'):
        receta = self.insertar('recetas', id_producto=self.producto, version=len(self.recetas)+1)
        self.recetas.append(receta)
        for indice, cantidad in renglones:
            self.insertar('receta_materiales', id_receta=receta, id_material=self.materiales[indice], cantidad=cantidad)
        orden = self.insertar('ordenes_produccion', id_receta=receta, cantidad=1, estado=estado)
        self.ordenes.append(orden)
        return orden

    def movimiento(self, material, cantidad):
        self.insertar('movimientos_material', id_material=self.materiales[material], tipo='AJUSTE', cantidad_firmada=cantidad)

    def llamada(self, metodo, segmento, datos=None, admin=0):
        with self.app.test_client() as client:
            return client.open('/api/v1/admin/'+segmento, method=metodo, json=datos,
                               headers={} if admin is None else {'Authorization': 'Bearer '+self.tokens[admin]})

    def preparar(self, orden=None, proveedor=None):
        ruta=f'compras/preparacion/{orden or self.orden}'
        if proveedor is not None:
            ruta+=f'?id_proveedor={proveedor}'
        respuesta=self.llamada('GET',ruta)
        self.assertEqual(respuesta.status_code,200)
        return respuesta.json

    def datos(self, *, manual=False, cantidad='1.0000', extra=False):
        renglones=[dict(id_material=self.materiales[0], cantidad=cantidad, costo_unitario='2.0000')]
        if extra:
            renglones.append(dict(id_material=self.materiales[2], cantidad='4.0000', costo_unitario='3.0000'))
        result=dict(id_proveedor=self.proveedores[0], detalles=renglones)
        if not manual:
            result.update(id_orden_produccion=self.orden, clave_solicitud=str(uuid4()))
        return result

    def crear(self, datos=None):
        result=self.llamada('POST','compras/', datos or self.datos())
        self.assertEqual(result.status_code,201)
        return result.json['compra']

    def saldo(self, indice=0):
        return self.sql('SELECT COALESCE(SUM(cantidad_firmada),0) FROM movimientos_material WHERE id_material=%s',
                        (self.materiales[indice],))[0][0]

    def simultaneas(self, acciones):
        barrera=Barrier(len(acciones), timeout=10)
        def trabajo(accion):
            barrera.wait()
            return accion()
        with ThreadPoolExecutor(max_workers=len(acciones)) as pool:
            return list(pool.map(trabajo, acciones))

    def test_faltantes_varios_cambio_stock_y_suficiente(self):
        self.assertEqual([Decimal(m['cantidad_faltante']) for m in self.preparar()['materiales']], [Decimal(1)])
        self.movimiento(1,'-0.5000')
        self.assertEqual([Decimal(m['cantidad_faltante']) for m in self.preparar()['materiales']], [Decimal(1), Decimal('0.5')])
        self.movimiento(0,'1.0000')
        self.movimiento(1,'0.5000')
        result=self.llamada('GET',f'produccion/{self.orden}/verificar-materiales').json
        self.assertTrue(result['puede_consumir'])
        self.assertEqual(self.preparar()['materiales'],[])

    @unittest.skipUnless(PUERTO == 33318, 'Comprobación de la copia actualizada')
    def test_preparacion_orden_7_restaurada(self):
        resultado = self.llamada('GET', 'compras/preparacion/7')
        self.assertEqual(resultado.status_code, 200)
        self.assertEqual(resultado.json['id_orden'], 7)
        self.assertEqual(resultado.json['estado'], 'EN_PROCESO')
        materiales = resultado.json['materiales']
        self.assertEqual(len(materiales), 7)
        for material in materiales:
            self.assertEqual(Decimal(material['cantidad_faltante']),
                             Decimal(material['cantidad_requerida']) - Decimal(material['stock_disponible']))
            self.assertGreater(Decimal(material['cantidad_sugerida']), 0)
        self.assertEqual(self.llamada('GET', 'compras/preparacion/7', admin=2).status_code, 403)

    def test_bloqueos_no_son_faltantes_elegibles(self):
        self.sql('UPDATE materiales SET activo=0 WHERE id_material=%s',(self.materiales[0],))
        result=self.llamada('GET',f'produccion/{self.orden}/verificar-materiales').json
        self.assertEqual(result['materiales'][0]['motivo_bloqueo'],'MATERIAL_INACTIVO')
        self.assertEqual(self.preparar()['materiales'],[])
        self.assertEqual(self.preparar(self.crear_orden(()))['motivo_bloqueo'],'RECETA_VACIA')
        self.assertEqual(self.preparar(self.crear_orden(((0,'1'),),'PLANIFICADA'))['motivo_bloqueo'],'ORDEN_NO_ELEGIBLE')
        self.insertar('consumos_produccion', id_orden=self.orden, id_material=self.materiales[0], cantidad='0.1', costo_unitario_aplicado='0')
        self.assertEqual(self.preparar()['motivo_bloqueo'],'ORDEN_YA_CONSUMIDA')

    def test_borrador_parcial_otro_proveedor_y_material_adicional(self):
        primero=self.crear(self.datos(cantidad='0.4000',extra=True))
        result=self.preparar()
        self.assertEqual(result['borradores'][0]['id_compra'],primero['id_compra'])
        material=result['materiales'][0]
        self.assertEqual(Decimal(material['stock_disponible']),1)
        self.assertEqual(Decimal(material['cobertura_borradores']),Decimal('0.4'))
        self.assertEqual(Decimal(material['cantidad_sugerida']),Decimal('0.6'))
        segundo=self.datos(cantidad='0.8000')
        segundo['id_proveedor']=self.proveedores[1]
        self.crear(segundo)
        self.assertEqual(Decimal(self.preparar()['materiales'][0]['cantidad_sugerida']),0)
        self.assertEqual(self.llamada('POST','compras/',self.datos()).status_code,409)
        self.assertEqual(self.saldo(),1)
        self.assertEqual(self.saldo(2),0)

    def test_presentacion_verificada_y_costo_exactos(self):
        m=self.materiales[0]
        cupo=self.insertar('cotizaciones_material',id_material=m,id_proveedor=self.proveedores[0],
                           fecha='2026-11-25',presentacion='Envase',cantidad_base='2.0000',
                           precio_presentacion='4.00', moneda='MXN',clasificacion='COTIZADA')
        result=self.preparar(proveedor=self.proveedores[0])['materiales'][0]['presentaciones'][0]
        self.assertEqual(result['cantidad_presentaciones_sugerida'],1)
        self.assertEqual(Decimal(result['cantidad_base_sugerida']),2)
        self.assertEqual(self.preparar(proveedor=self.proveedores[1])['materiales'][0]['presentaciones'],[])
        datos=self.datos(cantidad='2.0000')
        datos['detalles'][0].update(id_cotizacion=cupo,cantidad_presentaciones=1)
        compra=self.crear(datos)
        self.assertEqual(Decimal(compra['total']),4)
        self.assertEqual(compra['detalles'][0]['presentacion_aplicada'],'Envase')

    def test_cantidades_y_unidades_invalidas(self):
        for invalida in ('0','-1','1.12345','Infinity'):
            self.assertEqual(self.llamada('POST','compras/',self.datos(cantidad=invalida)).status_code,400)
        datos=self.datos()
        datos['detalles'][0]['id_unidad']=999999
        self.assertEqual(self.llamada('POST','compras/',datos).status_code,400)

    def test_idempotencia_de_doble_envio_y_contenido_conflictivo(self):
        datos=self.datos()
        resultados=self.simultaneas([lambda:self.llamada('POST','compras/',datos)]*2)
        self.assertEqual(sorted(r.status_code for r in resultados),[200,201])
        self.assertEqual(len({r.json['compra']['id_compra'] for r in resultados}),1)
        editado={**datos,'observaciones':'distinto'}
        self.assertEqual(self.llamada('POST','compras/',editado).status_code,409)
        self.assertEqual(self.saldo(),1)

    def test_edicion_concurrente_y_cancelacion(self):
        compra=self.crear()
        camino=f"compras/{compra['id_compra']}"
        datos={**self.datos(manual=True,cantidad='2',extra=True),'revision':1}
        resultados=self.simultaneas([lambda:self.llamada('PUT',camino,datos,0),
                                     lambda:self.llamada('PUT',camino,datos,1)])
        self.assertEqual(sorted(r.status_code for r in resultados),[200,409])
        actual=self.llamada('GET',camino).json['compra']
        self.assertEqual(actual['revision'],2)
        self.assertEqual(len(actual['detalles']),2)
        self.assertEqual(self.llamada('PATCH',camino+'/cancelar').status_code,200)
        self.assertEqual(self.llamada('PUT',camino,{**datos,'revision':2}).status_code,409)
        self.assertEqual(self.saldo(),1)

    def test_editar_mientras_se_recibe_o_cancela(self):
        for accion in ('recibir','cancelar'):
            compra=self.crear(self.datos(manual=True))
            camino=f"compras/{compra['id_compra']}"
            datos={**self.datos(manual=True,cantidad='2'),'revision':1}
            previo=self.saldo()
            editar, cerrar=self.simultaneas([lambda:self.llamada('PUT',camino,datos),
                                             lambda:self.llamada('PATCH',camino+'/'+accion)])
            self.assertEqual(cerrar.status_code,200)
            self.assertIn(editar.status_code,(200,409))
            final=self.llamada('GET',camino).json['compra']
            cantidad=Decimal(final['detalles'][0]['cantidad'])
            self.assertEqual(cantidad,2 if editar.status_code==200 else 1)
            self.assertEqual(self.saldo()-previo,cantidad if accion=='recibir' else 0)

    def test_doble_recepcion_y_compra_manual(self):
        compra=self.crear(self.datos(manual=True))
        self.assertIsNone(compra['id_orden_produccion'])
        ruta=f"compras/{compra['id_compra']}/recibir"
        resultados=self.simultaneas([lambda:self.llamada('PATCH',ruta)]*2)
        self.assertEqual(sorted(r.status_code for r in resultados),[200,409])
        self.assertEqual(self.saldo(),2)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM movimientos_material WHERE id_detalle_compra=%s',
                                  (compra['detalles'][0]['id_detalle_compra'],))[0][0],1)

    @unittest.skipUnless(PUERTO == 33318, 'Flujo de cierre en la copia actualizada')
    def test_flujo_representativo_compras_asistidas(self):
        produccion = f'produccion/{self.orden}/verificar-materiales'
        inicial = self.llamada('GET', produccion)
        self.assertEqual(inicial.status_code, 200)
        self.assertFalse(inicial.json['puede_consumir'])
        [faltante] = self.preparar()['materiales']
        self.assertEqual(faltante['id_material'], self.materiales[0])
        self.assertEqual(Decimal(faltante['cantidad_sugerida']), 1)
        compra = self.crear(self.datos(cantidad=faltante['cantidad_sugerida']))
        self.assertEqual(compra['estado'], 'BORRADOR')
        self.assertEqual(self.saldo(), 1)
        [cubierto] = self.preparar()['materiales']
        self.assertEqual(Decimal(cubierto['stock_disponible']), 1)
        self.assertEqual(Decimal(cubierto['cantidad_sugerida']), 0)
        ruta = f"compras/{compra['id_compra']}"
        editada = self.llamada('PUT', ruta, {
            **self.datos(manual=True, cantidad='2', extra=True), 'revision': compra['revision'],
        })
        self.assertEqual(editada.status_code, 200)
        self.assertEqual(editada.json['compra']['revision'], compra['revision'] + 1)
        self.assertEqual((self.saldo(), self.saldo(2)), (1, 0))
        self.assertEqual(self.llamada('PATCH', ruta + '/recibir').status_code, 200)
        self.assertEqual(self.llamada('PATCH', ruta + '/recibir').status_code, 409)
        movimientos = self.sql(
            'SELECT m.id_material, m.tipo, m.cantidad_firmada FROM movimientos_material m '
            'JOIN compra_detalles d ON d.id_detalle_compra=m.id_detalle_compra '
            'WHERE d.id_compra=%s', (compra['id_compra'],),
        )
        self.assertCountEqual(movimientos, [
            (self.materiales[0], 'COMPRA', Decimal(2)),
            (self.materiales[2], 'COMPRA', Decimal(4)),
        ])
        inventario = self.llamada('GET', 'inventario/')
        self.assertEqual(inventario.status_code, 200)
        existencias = {m['id_material']: Decimal(m['existencia']) for m in inventario.json['inventario']}
        self.assertEqual((existencias[self.materiales[0]], existencias[self.materiales[2]]), (3, 4))
        final = self.llamada('GET', produccion)
        self.assertEqual(final.status_code, 200)
        self.assertTrue(final.json['puede_consumir'])
        self.assertEqual(self.preparar()['materiales'], [])

    def test_texto_grabado_en_checkout_y_consultas(self):
        cliente = self.admins[2]

        def limpiar_pedidos():
            for (pedido,) in self.sql('SELECT id_pedido FROM pedidos WHERE id_cliente=%s', (cliente,)):
                self.sql('DELETE FROM pagos WHERE id_pedido=%s', (pedido,))
                self.sql('DELETE FROM pedido_detalles WHERE id_pedido=%s', (pedido,))
                self.sql('DELETE FROM pedidos WHERE id_pedido=%s', (pedido,))

        self.addCleanup(limpiar_pedidos)
        texto = 'Lucía y Toño\nFeliz año'
        linea = dict(id_producto=self.producto, cantidad=1, texto_grabado=texto)
        detalles = [linea, {**linea, 'texto_grabado': 'Otro texto'}]
        datos = dict(clave_solicitud=str(uuid4()), modalidad_pago='ANTICIPO_50',
                     metodo_pago='TRANSFERENCIA_SIMULADA', detalles=detalles)
        auth = {'Authorization': 'Bearer ' + self.tokens[2]}
        ruta = '/api/v1/cliente/pedidos/'
        with self.app.test_client() as client:
            creado = client.post(ruta, json=datos, headers=auth)
            self.assertEqual(creado.status_code, 201)
            pedido = creado.json['pedido']['id_pedido']
            recuperado = client.get(ruta + str(pedido), headers=auth)
            self.assertEqual(recuperado.status_code, 200)
            self.assertEqual(client.post(ruta, json=datos, headers=auth).status_code, 200)
        revision = self.llamada('GET', f'revision-pedidos/{pedido}')
        self.assertEqual(revision.status_code, 200)
        for renglones in (creado.json['pedido']['detalles'], recuperado.json['pedido']['detalles'],
                          revision.json['detalles']):
            self.assertEqual([d['texto_grabado'] for d in renglones], [texto, 'Otro texto'])
            self.assertTrue(all(d.get('estilo_grabado') is None for d in renglones))

    def test_recepcion_fallida_revierte_movimientos(self):
        from app.routes import admin_compra_routes as modulo
        from sqlalchemy.exc import SQLAlchemyError
        compra=self.crear(self.datos(manual=True,extra=True))
        original=modulo.insert
        contador=0
        def falla_segundo(table):
            nonlocal contador
            if table.name=='movimientos_material':
                contador+=1
                if contador==2:
                    raise SQLAlchemyError('fallo de prueba')
            return original(table)
        with patch.object(modulo,'insert',side_effect=falla_segundo):
            self.assertEqual(self.llamada('PATCH',f"compras/{compra['id_compra']}/recibir").status_code,500)
        self.assertEqual(contador,2)
        self.assertEqual(self.saldo(),1)
        self.assertEqual(self.saldo(2),0)
        self.assertEqual(self.llamada('GET',f"compras/{compra['id_compra']}").json['compra']['estado'],'BORRADOR')

    def pedido_para_cancelar(self, monto=None, estado='CONFIRMADO', modalidad='ANTICIPO_50'):
        pedido = self.insertar('pedidos', folio='TM-' + uuid4().hex, id_cliente=self.admins[2],
                               estado=estado, modalidad_pago=modalidad, tipo_entrega='RECOLECCION')

        def limpiar():
            self.sql('DELETE r FROM reservas_producto r JOIN pedido_detalles d ON r.id_detalle_pedido=d.id_detalle_pedido WHERE d.id_pedido=%s', (pedido,))
            self.sql('DELETE FROM entregas WHERE id_pedido=%s', (pedido,))
            self.sql('DELETE FROM pagos WHERE id_pedido=%s', (pedido,))
            self.sql('DELETE FROM autorizaciones_pedido WHERE id_pedido=%s', (pedido,))
            self.sql('DELETE FROM ordenes_produccion WHERE id_detalle_pedido IN (SELECT id_detalle_pedido FROM pedido_detalles WHERE id_pedido=%s)', (pedido,))
            self.sql('DELETE FROM pedido_detalles WHERE id_pedido=%s', (pedido,))
            self.sql('DELETE FROM pedidos WHERE id_pedido=%s', (pedido,))

        self.addCleanup(limpiar)
        detalle = self.insertar('pedido_detalles', id_pedido=pedido, id_producto=self.producto,
                                cantidad=1, precio_unitario_acordado='350.02', tipo_surtido='FABRICACION')
        if monto is not None:
            self.insertar('pagos', id_pedido=pedido, monto=monto, metodo='TARJETA_SIMULADA',
                          estado='APROBADO_SIMULADO', referencia='CI-' + uuid4().hex)
        return pedido, detalle

    def pedido_cliente(self, id_pedido, cancelar=False, usuario=2):
        ruta = f'/api/v1/cliente/pedidos/{id_pedido}'
        headers = {} if usuario is None else {'Authorization': 'Bearer ' + self.tokens[usuario]}
        with self.app.test_client() as client:
            if not cancelar:
                return client.get(ruta, headers=headers)
            return client.post(ruta + '/cancelar', headers=headers, json={'acepta_condiciones': True})

    def pagos_dashboard(self):
        with self.app.test_client() as client:
            respuesta = client.get('/api/v1/dashboard/estadisticas',
                                   headers={'Authorization': 'Bearer ' + self.tokens[0]})
        self.assertEqual(respuesta.status_code, 200)
        kpis = respuesta.json['kpis']
        self.assertEqual(set(kpis), {'ventas_confirmadas', 'pedidos_pendientes', 'clientes_compradores',
                                    'unidades_vendidas', 'pagos_simulados_aprobados'})
        return Decimal(str(kpis['pagos_simulados_aprobados']))

    def test_cancelacion_conserva_pagos_y_estadisticas(self):
        existe_tabla = self.sql("SHOW TABLES LIKE 'devoluciones_pago'")
        movimientos = self.sql('SELECT * FROM devoluciones_pago ORDER BY id_pago') if existe_tabla else None
        for monto, modalidad in ((None, 'ANTICIPO_50'), ('175.01', 'ANTICIPO_50'), ('350.02', 'TOTAL')):
            with self.subTest(monto=monto):
                pedido, _ = self.pedido_para_cancelar(monto, modalidad=modalidad)
                pagos = self.sql('SELECT * FROM pagos WHERE id_pedido=%s', (pedido,))
                antes = self.pagos_dashboard()
                self.assertTrue(self.pedido_cliente(pedido).json['pedido']['puede_cancelar'])
                self.assertEqual(self.pedido_cliente(pedido, cancelar=True).status_code, 200)
                historial = self.pedido_cliente(pedido).json['pedido']
                self.assertEqual(historial['estado'], 'CANCELADO')
                self.assertFalse(historial['puede_cancelar'])
                self.assertEqual(self.pedido_cliente(pedido, cancelar=True).status_code, 409)
                revision = self.llamada('GET', f'revision-pedidos/{pedido}')
                self.assertEqual(revision.json['pedido']['estado'], 'CANCELADO')
                self.assertEqual(self.sql('SELECT * FROM pagos WHERE id_pedido=%s', (pedido,)), pagos)
                self.assertEqual(antes - self.pagos_dashboard(), Decimal(monto or '0.00'))
        if existe_tabla:
            self.assertEqual(self.sql('SELECT * FROM devoluciones_pago ORDER BY id_pago'), movimientos)

    def test_cancelacion_autorizada_y_concurrente(self):
        pedido, _ = self.pedido_para_cancelar('350.02')
        self.assertEqual(self.pedido_cliente(pedido, cancelar=True, usuario=None).status_code, 401)
        self.assertEqual(self.pedido_cliente(pedido, cancelar=True, usuario=0).status_code, 403)
        self.assertEqual(self.llamada('POST', f'revision-pedidos/{pedido}/decision', {'decision': 'APROBADO'}).status_code, 200)
        self.assertTrue(self.pedido_cliente(pedido).json['pedido']['puede_cancelar'])
        resultados = self.simultaneas([lambda: self.pedido_cliente(pedido, cancelar=True)] * 2)
        self.assertEqual(sorted(r.status_code for r in resultados), [200, 409])

    def test_cancelacion_bloqueada_por_compromisos(self):
        lote = self.insertar('lotes_producto', id_producto=self.producto)
        self.addCleanup(self.sql, 'DELETE FROM lotes_producto WHERE id_lote=%s', (lote,))
        produccion, detalle = self.pedido_para_cancelar()
        self.insertar('ordenes_produccion', id_receta=self.recetas[0], id_detalle_pedido=detalle,
                      cantidad=1, estado='PLANIFICADA')
        reserva, detalle = self.pedido_para_cancelar()
        self.insertar('reservas_producto', id_lote=lote, id_detalle_pedido=detalle, cantidad=1, estado='ACTIVA')
        entrega, _ = self.pedido_para_cancelar()
        self.insertar('entregas', id_pedido=entrega, estado='PROGRAMADA')
        entregado, _ = self.pedido_para_cancelar(estado='ENTREGADO')
        for pedido in (produccion, reserva, entrega, entregado):
            with self.subTest(pedido=pedido):
                datos = self.pedido_cliente(pedido).json['pedido']
                self.assertFalse(datos['puede_cancelar'])
                self.assertEqual(self.pedido_cliente(pedido, cancelar=True).status_code, 409)
                self.assertEqual(self.pedido_cliente(pedido).json['pedido']['estado'], datos['estado'])

    def test_consumo_concurrente_con_recepcion_no_deja_saldo_negativo(self):
        compra=self.crear()
        consumir, recibir=self.simultaneas([
            lambda:self.llamada('POST',f'produccion/{self.orden}/consumir-materiales'),
            lambda:self.llamada('PATCH',f"compras/{compra['id_compra']}/recibir"),
        ])
        self.assertEqual(recibir.status_code,200)
        self.assertIn(consumir.status_code,(200,409))
        self.assertEqual(self.saldo(),0 if consumir.status_code==200 else 2)

    def test_rol_y_sesion(self):
        ruta=f'compras/preparacion/{self.orden}'
        self.assertEqual(self.llamada('GET',ruta,admin=None).status_code,401)
        self.assertEqual(self.llamada('GET',ruta,admin=2).status_code,403)
        self.assertEqual(self.llamada('POST','compras/',self.datos(),admin=2).status_code,403)
