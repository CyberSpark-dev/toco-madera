import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMateriales } from '../../core/services/admin-materiales';
import { AdminOperacionesService, PendienteProduccion, ResultadoOperacion } from '../../core/services/admin-operaciones';
import { AdminPedidosService } from '../../core/services/admin-pedidos';
import { OperacionesAdmin } from './operaciones';

function detalle(id: number, cantidad: string): PendienteProduccion {
  // El servicio declara number y la respuesta real también puede contener una cadena.
  return {
    id_detalle_pedido: id, id_pedido: id, recetas_vigentes: 1,
    producto: 'Repisa', cantidad_pendiente: cantidad,
  } as unknown as PendienteProduccion;
}

describe('Planificar orden', () => {
  let componente: OperacionesAdmin;
  const pendientes = vi.fn();
  const planificar = vi.fn();
  const ordenes = vi.fn();
  const filas = [detalle(1, '1'), detalle(2, '2')];

  beforeEach(() => {
    pendientes.mockReset().mockReturnValue(of({ success: true, detalles: filas }));
    planificar.mockReset().mockReturnValue(of({ success: true }));
    ordenes.mockReset().mockReturnValue(of({ success: true, ordenes: [] }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const pedidos = [1, 2].map((id_pedido) => ({ id_pedido, estado: 'CONFIRMADO' }));
    TestBed.configureTestingModule({ providers: [
      { provide: AdminOperacionesService, useValue: {
        pendientes, planificar, ordenes, pedidos: () => of({ success: true, pedidos }),
      } },
      { provide: AdminPedidosService, useValue: {
        listar: () => of({ success: true, pedidos: pedidos.map((p) => ({ ...p, autorizacion: 'APROBADO' })) }),
      } },
      { provide: AdminMateriales, useValue: {
        listarMateriales: () => of({ materiales: [] }), listarUnidades: () => of({ unidades: [] }),
      } },
    ] });
    componente = TestBed.runInInjectionContext(() => new OperacionesAdmin());
    componente.ngOnInit();
  });

  afterEach(() => vi.restoreAllMocks());

  it('solo ofrece una compra para faltantes que el servidor marca como elegibles', () => {
    const material = { nombre: 'Barniz', cantidad_requerida: '5', stock_disponible: '2', suficiente: false };
    const verificacion = { success: true, puede_consumir: false, ya_consumida: false, materiales: [material] };
    expect(componente.tieneFaltantesComprables(verificacion)).toBe(false);
    expect(componente.tieneFaltantesComprables({ ...verificacion,
      materiales: [{ ...material, elegible_compra: true, cantidad_faltante: '0' }],
    })).toBe(false);
    expect(componente.tieneFaltantesComprables({ ...verificacion,
      materiales: [{ ...material, elegible_compra: true, cantidad_faltante: '3' }],
    })).toBe(true);
  });

  it('envía el 1 inicial como número sin editar el campo', () => {
    const [actual] = componente.pendientesPedido();
    expect(componente.cantidadPlanificar(actual)).toBe(1);
    componente.planificar(actual);
    expect(planificar).toHaveBeenCalledExactlyOnceWith(1, 1);
  });

  it('envía 2 cuando el administrador aumenta de 1 a 2 dentro del límite', () => {
    componente.seleccionar(2);
    const [actual] = componente.pendientesPedido();
    componente.cambiarCantidad(2, 1);
    componente.cambiarCantidad(2, 2);
    componente.planificar(actual);
    expect(planificar).toHaveBeenCalledExactlyOnceWith(2, 2);
  });

  it.each([0, -1, 2, 0.5, null])('bloquea y explica el valor %s', (cantidad) => {
    const [actual] = componente.pendientesPedido();
    componente.cambiarCantidad(1, cantidad);
    expect(componente.errorCantidadPlanificar(actual)).toBe('Ingresa un número entero entre 1 y 1.');
    componente.planificar(actual);
    expect(planificar).not.toHaveBeenCalled();
  });

  it('recalcula el inicial al cambiar de pedido', () => {
    componente.seleccionar(2);
    expect(componente.cantidadPlanificar(componente.pendientesPedido()[0])).toBe(2);
    componente.cambiarCantidad(2, 1);
    componente.seleccionar(1);
    componente.seleccionar(2);
    expect(componente.cantidadPlanificar(componente.pendientesPedido()[0])).toBe(2);
  });

  it('explica la falta de receta', () => {
    const [actual] = componente.pendientesPedido();
    expect(componente.bloqueoPlanificacion({ ...actual, recetas_vigentes: 0 }))
      .toBe('El producto necesita una receta vigente.');
  });

  it('conserva la cantidad cuando falla el envío y permite reintentar', () => {
    planificar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const [actual] = componente.pendientesPedido();
    componente.planificar(actual);
    expect(componente.error()).toContain('Inténtalo nuevamente');
    expect(componente.cantidadPlanificar(actual)).toBe(1);
    expect(componente.ocupado()).toBe(false);
    componente.planificar(actual);
    expect(planificar).toHaveBeenCalledTimes(2);
  });

  it('evita otro envío mientras guarda o actualiza y muestra una sola orden', () => {
    const envio = new Subject<ResultadoOperacion>();
    const refresco = new Subject<{ success: boolean; detalles: PendienteProduccion[] }>();
    planificar.mockReturnValueOnce(envio);
    pendientes.mockReturnValueOnce(refresco);
    const orden = { id_orden: 17, id_pedido: 1 };
    ordenes.mockReturnValueOnce(of({ success: true, ordenes: [orden] }));
    const [actual] = componente.pendientesPedido();
    componente.planificar(actual);
    componente.planificar(actual);
    envio.next({ success: true });
    envio.complete();
    expect(componente.ocupado()).toBe(true);
    componente.planificar(actual);
    expect(planificar).toHaveBeenCalledTimes(1);
    refresco.next({ success: true, detalles: [filas[1]] });
    refresco.complete();
    expect(componente.pendientesPedido()).toEqual([]);
    expect(componente.ordenesPedido()).toEqual([orden]);
    expect(componente.ocupado()).toBe(false);
  });
});
