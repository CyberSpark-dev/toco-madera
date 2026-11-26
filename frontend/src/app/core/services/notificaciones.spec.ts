import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorCantidadProducto } from './carrito';
import { Notificaciones } from './notificaciones';
import { NotificacionesVista } from './notificaciones-vista';

describe('Notificaciones globales', () => {
  afterEach(() => vi.useRealTimers());

  it('deduplica, conserva errores y retira éxitos automáticamente', () => {
    vi.useFakeTimers();
    const avisos = new Notificaciones();
    const id = avisos.mostrar('error', 'Revisa la cantidad.');
    expect(avisos.mostrar('error', 'Revisa la cantidad.')).toBe(id);
    avisos.mostrar('exito', 'Compra registrada.');
    avisos.mostrar('aviso', 'Revisa la disponibilidad.');
    expect(avisos.mensajes()).toHaveLength(3);
    vi.advanceTimersByTime(6500);
    expect(avisos.mensajes().map((aviso) => aviso.tipo)).toEqual(['error', 'aviso']);
  });

  it('expone el error a tecnologías de asistencia y permite cerrarlo', () => {
    const vista = TestBed.createComponent(NotificacionesVista);
    TestBed.inject(Notificaciones).mostrar('error', 'Revisa la cantidad.');
    vista.detectChanges();
    expect(vista.nativeElement.querySelector('[role="alert"]').textContent).toContain('Revisa la cantidad.');
    (vista.nativeElement.querySelector('button') as HTMLButtonElement).click();
    vista.detectChanges();
    expect(vista.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('Cantidad de producto', () => {
  it.each([0, 101, 1.5, -1, null])('rechaza %s', (cantidad) => {
    expect(errorCantidadProducto(cantidad)).toContain('entera entre 1 y 100');
  });

  it.each([1, 100])('acepta %s', (cantidad) => {
    expect(errorCantidadProducto(cantidad)).toBe('');
  });
});
