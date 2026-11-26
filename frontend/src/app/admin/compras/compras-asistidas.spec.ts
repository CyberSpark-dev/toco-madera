import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMateriales } from '../../core/services/admin-materiales';
import { AdminProveedores } from '../../core/services/admin-proveedores';
import { Notificaciones } from '../../core/services/notificaciones';
import { ComprasAdmin } from './compras';

const url = 'http://127.0.0.1:5000/api/v1/admin/compras';
const faltante = {
  id_material: 2, nombre: 'Barniz', unidad: 'mL', cantidad_requerida: '300.0000',
  stock_disponible: '25.0000', cantidad_faltante: '275.0000', cobertura_borradores: '25.0000',
  cantidad_sugerida: '250.0000', presentaciones: [],
};
const oferta = {
  id_cotizacion: 4, presentacion: 'Envase de 500 mL', unidad: 'mL', cantidad_base: '500.0000',
  precio_presentacion: '50.00', cantidad_presentaciones_sugerida: 1, cantidad_base_sugerida: '500.0000',
  costo_unitario: '0.1000',
};
const compra = {
  id_compra: 8, id_proveedor: 1, id_orden_produccion: 17, estado: 'BORRADOR', revision: 2,
  referencia_documento: null, observaciones: null,
  detalles: [{ id_material: 2, cantidad: '250.0000', costo_unitario: '0.1200' }],
};

describe('Compras asistidas', () => {
  let http: HttpTestingController;
  let navegador: RouterTestingHarness;
  let vista: ComprasAdmin;

  beforeEach(async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'admin/compras', component: ComprasAdmin }]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminMateriales, useValue: {
        listarMateriales: () => of({ materiales: [{ id_material: 2, activo: 1, nombre: 'Barniz', id_unidad: 3 }] }),
        listarUnidades: () => of({ unidades: [{ id_unidad: 3, nombre: 'mL' }] }),
      } },
      { provide: AdminProveedores, useValue: { listarProveedores: () => of({
        proveedores: [{ id_proveedor: 1, activo: 1, nombre: 'Tienda' }, { id_proveedor: 2, activo: 1, nombre: 'Otro' }],
      }) } },
    ] });
    http = TestBed.inject(HttpTestingController);
    navegador = await RouterTestingHarness.create();
    vista = await navegador.navigateByUrl('/admin/compras?orden=17&folio=PED-17', ComprasAdmin);
    http.expectOne(url + '/').flush({ compras: [] });
    http.expectOne((r) => r.url.endsWith('/costos-materiales/')).flush({ costos: [] });
  });

  afterEach(() => {
    try { http.verify(); } finally { vi.restoreAllMocks(); TestBed.resetTestingModule(); }
  });

  function preparar(proveedor?: number, presentaciones = false): void {
    const sufijo = proveedor ? '?id_proveedor=' + proveedor : '';
    const consulta = http.expectOne(url + '/preparacion/17' + sufijo);
    expect(consulta.request.method).toBe('GET');
    consulta.flush({ success: true, id_orden: 17, estado: 'EN_PROCESO',
      materiales: [{ ...faltante, presentaciones: presentaciones ? [oferta] : [] }], borradores: [] });
  }

  it('representa los subtotales exactos y redondea en pantalla después de sumar', () => {
    preparar();
    const linea = { ...vista.formulario.detalles[0], cantidad: '0.1000', costo_unitario: '10.0500' };
    vista.formulario.detalles = [linea, { ...linea }];
    expect(vista.subtotalDetalle(linea)).toBe('1.00500000');
    expect(vista.dinero(vista.subtotalDetalle(linea))).toBe('$1.01');
    expect(vista.dinero(vista.totalFormulario())).toBe('$2.01');
    expect(linea.costo_unitario).toBe('10.0500');
  });

  it('precarga el faltante sin cubrir desde la URL y sincroniza el campo', async () => {
    preparar();
    navegador.detectChanges();
    await navegador.fixture.whenStable();
    const pagina = navegador.routeNativeElement!;
    expect(pagina.textContent).toContain('PED-17');
    expect(pagina.textContent).toContain('Cobertura');
    expect(pagina.querySelector<HTMLInputElement>('#cantidad-0')?.value).toBe('250');
    const cantidad = pagina.querySelector<HTMLInputElement>('#cantidad-0')!;
    cantidad.value = '275';
    cantidad.dispatchEvent(new Event('input'));
    expect(vista.formulario.detalles[0].cantidad).toBe('275');
  });

  it.each([
    [0, 'conectar'], [401, 'sesión'], [403, 'permiso'], [404, 'no se encontró'], [500, 'comprobar'],
  ])('distingue el error %s de preparación', (status, mensaje) => {
    const consulta = http.expectOne(url + '/preparacion/17');
    if (status === 0) consulta.error(new ProgressEvent('error'));
    else consulta.flush({}, { status, statusText: 'Error' });
    expect(vista.errorPreparacion()).toContain(mensaje);
    expect(vista.mostrarFormulario()).toBe(false);
  });

  it('explica la falta de habilitación y conserva la compra manual', () => {
    http.expectOne(url + '/preparacion/17').flush({ codigo: 'COMPRAS_ASISTIDAS_NO_HABILITADAS' },
      { status: 503, statusText: 'Service Unavailable' });
    expect(vista.errorPreparacion()).toContain('compras manuales');
    expect(vista.mostrarFormulario()).toBe(false);
    vista.nuevaCompra();
    expect(vista.mostrarFormulario()).toBe(true);
    expect(vista.ordenFormulario()).toBeNull();
  });

  it('conserva un solo aviso y el contexto durante reintentos idénticos', () => {
    const avisos = TestBed.inject(Notificaciones);
    const fallar = () => http.expectOne(url + '/preparacion/17').flush(
      { codigo: 'COMPRAS_ASISTIDAS_NO_HABILITADAS' },
      { status: 503, statusText: 'Service Unavailable' });
    fallar();
    const aviso = avisos.mensajes()[0];
    vista.cargarPreparacion(17);
    expect(vista.errorPreparacion()).toBe(aviso.texto);
    fallar();
    expect(avisos.mensajes()).toEqual([aviso]);
    avisos.cerrar(aviso.id);
    vista.cargarPreparacion(17, 0, true);
    fallar();
    expect(avisos.mensajes()).toEqual([]);
    expect(vista.errorPreparacion()).toBe(aviso.texto);
    vista.cargarPreparacion(17, 0, true);
    preparar();
    expect(vista.errorPreparacion()).toBe('');
    expect(vista.formulario.detalles[0].cantidad).toBe('250');
  });

  it('muestra un estado informativo si la orden no tiene faltantes', () => {
    http.expectOne(url + '/preparacion/17').flush({
      success: true, id_orden: 17, estado: 'EN_PROCESO', motivo_bloqueo: null, materiales: [], borradores: [],
    });
    navegador.detectChanges();
    expect(navegador.routeNativeElement?.textContent).toContain('No hay materiales faltantes');
    expect(vista.errorPreparacion()).toBe('');
    expect(vista.mostrarFormulario()).toBe(false);
  });

  it('solo propone presentaciones del proveedor consultado y conserva la cantidad real', () => {
    preparar();
    const [detalle] = vista.formulario.detalles;
    vista.cambiarProveedor(1);
    expect(vista.presentaciones(detalle)).toEqual([]);
    preparar(1, true);
    vista.elegirPresentacion(detalle, 4);
    expect(detalle).toMatchObject({ cantidad: '500', cantidad_presentaciones: 1, costo_unitario: '0.1000' });
    vista.cambiarProveedor(2);
    preparar(2);
    expect(detalle.id_cotizacion).toBeUndefined();
    expect(vista.presentaciones(detalle)).toEqual([]);
  });

  it('ofrece abrir el borrador vinculado cuando ya cubre todo el faltante', () => {
    http.expectOne(url + '/preparacion/17').flush({
      success: true, id_orden: 17, estado: 'EN_PROCESO',
      materiales: [{ ...faltante, cobertura_borradores: '275', cantidad_sugerida: '0' }],
      borradores: [compra],
    });
    navegador.detectChanges();
    expect(vista.mostrarFormulario()).toBe(false);
    expect(vista.haySugerencias()).toBe(false);
    expect(navegador.routeNativeElement?.textContent).toContain('Abrir borrador #8');
  });

  it('conserva el contrato de la compra manual y permite agregar o quitar un renglón', () => {
    preparar();
    vista.nuevaCompra();
    vista.agregarDetalle();
    expect(vista.formulario.detalles.length).toBe(2);
    vista.quitarDetalle(1);
    expect(vista.formulario.detalles.length).toBe(1);
    vista.formulario.detalles[0].cantidad = '250';
    vista.formulario.detalles[0].costo_unitario = '0.12';
    vista.guardarCompra();
    const manual = http.expectOne({ method: 'POST', url: url + '/' });
    expect(manual.request.body.id_orden_produccion).toBeUndefined();
    expect(manual.request.body.clave_solicitud).toBeUndefined();
    manual.flush({ success: true, compra: { ...compra, id_orden_produccion: null } });
    http.expectOne(url + '/').flush({ compras: [] });
    expect(vista.mostrarFormulario()).toBe(false);
  });

  it('bloquea doble envío, reutiliza el UUID y lo cambia al editar datos', () => {
    preparar();
    vista.cambiarProveedor(1);
    preparar(1);
    vista.formulario.detalles[0].costo_unitario = '0.12';
    vista.guardarCompra();
    vista.guardarCompra();
    const primero = http.expectOne({ method: 'POST', url: url + '/' });
    expect(primero.request.body.id_orden_produccion).toBe(17);
    expect(primero.request.body.clave_solicitud).toMatch(/^[a-f0-9-]{36}$/);
    expect(vista.mensaje()).toBe('');
    primero.flush({}, { status: 500, statusText: 'Error' });
    vista.guardarCompra();
    const segundo = http.expectOne({ method: 'POST', url: url + '/' });
    expect(segundo.request.body.clave_solicitud).toBe(primero.request.body.clave_solicitud);
    segundo.flush({}, { status: 500, statusText: 'Error' });
    vista.formulario.detalles[0].cantidad = '260';
    vista.guardarCompra();
    const tercero = http.expectOne({ method: 'POST', url: url + '/' });
    expect(tercero.request.body.clave_solicitud).not.toBe(primero.request.body.clave_solicitud);
    tercero.flush({ success: true, compra, reutilizada: true });
    preparar(1);
    http.expectOne(url + '/').flush({ compras: [compra] });
    expect(vista.borrador()?.id_compra).toBe(8);
  });

  it('usa la revisión del borrador y solo reemplaza datos al recargar explícitamente', () => {
    preparar();
    vista.abrirBorrador(8);
    http.expectOne(url + '/8').flush({ success: true, compra });
    preparar(1);
    vista.formulario.detalles[0].cantidad = '300';
    vista.guardarCompra();
    const edicion = http.expectOne({ method: 'PUT', url: url + '/8' });
    expect(edicion.request.body.revision).toBe(2);
    expect(edicion.request.body.id_orden_produccion).toBeUndefined();
    edicion.flush({}, { status: 409, statusText: 'Conflicto' });
    expect(vista.conflictoEdicion()).toBe(true);
    expect(vista.formulario.detalles[0].cantidad).toBe('300');
    vista.abrirBorrador(8);
    http.expectOne(url + '/8').flush({ success: true, compra: { ...compra, revision: 3 } });
    preparar(1);
    expect(vista.conflictoEdicion()).toBe(false);
    expect(vista.formulario.detalles[0].cantidad).toBe('250');
    expect(vista.borrador()?.revision).toBe(3);
  });

  it('ofrece volver a verificar la orden después de confirmar una sola recepción', () => {
    preparar();
    vista.solicitarAccion(compra as unknown as NonNullable<ReturnType<ComprasAdmin['borrador']>>, 'RECIBIR');
    vista.confirmarAccion();
    vista.confirmarAccion();
    const recepcion = http.expectOne({ method: 'PATCH', url: url + '/8/recibir' });
    expect(vista.mensaje()).toBe('');
    recepcion.flush({ success: true, compra: { ...compra, estado: 'RECIBIDA' } });
    preparar();
    http.expectOne(url + '/').flush({ compras: [] });
    navegador.detectChanges();
    expect(vista.mensaje()).toBe('Compra recibida. Las existencias se actualizaron correctamente.');
    expect(navegador.routeNativeElement?.querySelector('a[href="/admin/operaciones?orden=17"]')).toBeTruthy();
  });
});
