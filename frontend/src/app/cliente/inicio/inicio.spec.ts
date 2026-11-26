import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Auth } from '../../core/services/auth';
import { CarritoService, ProductoCatalogo } from '../../core/services/carrito';
import { CatalogoCarritoService } from '../../core/services/catalogo-carrito';
import { Notificaciones } from '../../core/services/notificaciones';
import { Inicio } from './inicio';

const repisa: ProductoCatalogo = {
  id_producto: 7, nombre: 'Repisa', sku: 'REP-7', precio_lista: '250',
  permite_grabado: true, max_caracteres_grabado: 20,
};
const portallaves = { ...repisa, id_producto: 8, nombre: 'Portallaves' };
const sinFoto = { ...repisa, id_producto: 9, nombre: 'Pieza nueva' };

function montar(listar: CatalogoCarritoService['listar'], rol?: 'CLIENTE' | 'ADMIN') {
  TestBed.configureTestingModule({
    imports: [Inicio],
    providers: [
      provideRouter([]),
      { provide: Auth, useValue: {
        autenticado: () => !!rol, esCliente: () => rol === 'CLIENTE',
        esAdministrador: () => rol === 'ADMIN', usuario: () => ({ nombre: 'Prueba' }),
      } },
      { provide: CarritoService, useValue: { cantidadTotal: () => 0 } },
      { provide: CatalogoCarritoService, useValue: { listar } },
    ],
  });
  const vista = TestBed.createComponent(Inicio);
  vista.detectChanges();
  return vista;
}

describe('Tienda Inicio', () => {
  it('avanza cada seis segundos, reinicia con las flechas y limpia el reloj al salir', () => {
    vi.useFakeTimers();
    try {
      const vista = montar(() => of([]));
      const inicio = vista.componentInstance;
      expect(vista.nativeElement.querySelector('.portada-subtitulo').textContent)
        .toBe('Frases que vienen de raíz y se guardan en el corazón');
      vi.advanceTimersByTime(6000);
      expect(inicio.indiceDestacado()).toBe(1);
      vi.advanceTimersByTime(4500);
      inicio.desplazarDestacado(-1);
      inicio.desplazarDestacado(-1);
      expect(inicio.indiceDestacado()).toBe(3);
      vi.advanceTimersByTime(5999);
      expect(inicio.indiceDestacado()).toBe(3);
      vi.advanceTimersByTime(1);
      expect(inicio.indiceDestacado()).toBe(0);
      vista.destroy();
      vi.advanceTimersByTime(12000);
      expect(inicio.indiceDestacado()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pausa por cursor, foco, pestaña oculta y preferencia de movimiento', () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
      const vista = montar(() => of([]));
      const inicio = vista.componentInstance;
      inicio.cursorCarrusel(true);
      vi.advanceTimersByTime(6000);
      inicio.focoCarrusel(true);
      inicio.cursorCarrusel(false);
      vi.advanceTimersByTime(6000);
      expect(inicio.indiceDestacado()).toBe(0);
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      inicio.focoCarrusel(false);
      vi.advanceTimersByTime(6000);
      expect(inicio.indiceDestacado()).toBe(0);
      inicio.movimientoReducido.set(true);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(6000);
      expect(inicio.indiceDestacado()).toBe(0);
      inicio.movimientoReducido.set(false);
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(6000);
      expect(inicio.indiceDestacado()).toBe(1);
      vista.destroy();
    } finally {
      hidden.mockRestore();
      vi.useRealTimers();
    }
  });

  it('retoma el avance tras usar una flecha con el puntero aunque el botón conserve el foco', () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
      const vista = montar(() => of([]));
      const siguiente: HTMLButtonElement = vista.nativeElement.querySelector('[aria-label="Escena siguiente"]');
      vi.spyOn(siguiente, 'matches').mockReturnValue(false);
      siguiente.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      siguiente.click();
      expect(vista.componentInstance.indiceDestacado()).toBe(1);
      vi.advanceTimersByTime(6000);
      expect(vista.componentInstance.indiceDestacado()).toBe(2);
      vista.destroy();
    } finally {
      hidden.mockRestore();
      vi.useRealTimers();
    }
  });

  it('conserva el estado de carga y muestra el estado vacío al completar', () => {
    const respuesta = new Subject<ProductoCatalogo[]>();
    const vista = montar(() => respuesta);
    expect(vista.nativeElement.querySelector('#catalogo [role="status"]').textContent).toContain('Cargando productos');
    respuesta.next([]);
    vista.detectChanges();
    expect(vista.nativeElement.textContent).toContain('No hay productos disponibles');
    expect(vista.nativeElement.querySelector('.muestra-controles')?.textContent).toContain('1/4');
  });

  it('notifica el error una vez y permite recuperar el catálogo', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const listar = vi.fn().mockReturnValueOnce(throwError(() => new Error())).mockReturnValue(of([repisa]));
      const vista = montar(listar);
      const notificaciones = TestBed.inject(Notificaciones);
      expect(vista.nativeElement.textContent).toContain('No pudimos cargar el catálogo');
      expect(notificaciones.mensajes()).toHaveLength(1);
      expect(vista.nativeElement.querySelector('footer').classList.contains('pie-con-aviso')).toBe(true);
      const reintentar = [...vista.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) =>
        b.textContent?.includes('Intentar nuevamente')) as HTMLButtonElement;
      reintentar.click();
      vista.detectChanges();
      expect(notificaciones.mensajes()).toHaveLength(0);
      expect(vista.nativeElement.querySelector('#producto-7')).toBeTruthy();
      expect(vista.nativeElement.querySelector('.muestra-controles')).toBeTruthy();
    } finally {
      error.mockRestore();
    }
  });

  it('recorre cuatro escenas de marca sin duplicar ni sustituir el catálogo', () => {
    const vista = montar(() => of([repisa, portallaves, sinFoto]));
    const doc: HTMLElement = vista.nativeElement;
    const siguiente = doc.querySelector<HTMLButtonElement>('[aria-label="Escena siguiente"]')!;
    const controles = doc.querySelector('.muestra-controles')!;
    expect(controles.querySelectorAll('button')).toHaveLength(2);
    const avanzar = () => { siguiente.click(); vista.detectChanges(); };
    expect(doc.querySelector('.muestra img')?.getAttribute('src')).toBe('/productos/inicio/taller-artesanal.webp');
    avanzar();
    expect(doc.querySelector('.muestra')?.textContent).toContain('Un regalo para recordar');
    expect(doc.querySelector('.muestra img')?.getAttribute('src')).toBe('/productos/inicio/familia-regalo-artesanal.webp');
    expect(controles.textContent).toContain('2/4');
    avanzar();
    expect(doc.querySelector('.muestra img')?.getAttribute('src')).toBe('/productos/placa_escritorio.png');
    expect(controles.textContent).toContain('3/4');
    avanzar();
    expect(doc.querySelector('.muestra img')?.getAttribute('src')).toBe('/productos/marco_fotografias.png');
    expect(controles.textContent).toContain('4/4');
    avanzar();
    expect(doc.querySelector('.muestra-controles')?.textContent).toContain('1/4');
    expect(doc.querySelectorAll('#catalogo article')).toHaveLength(3);
    expect(doc.querySelector('#producto-7')?.textContent).toContain('$250.00');
    expect(doc.querySelector('#producto-7 a')?.getAttribute('href')).toBe('/cliente/carrito');
  });

  it.each([['CLIENTE', true], ['ADMIN', false], [undefined, false]] as const)(
    'adecúa los enlaces del footer a la sesión %s', (rol, visible) => {
      const vista = montar(() => of([]), rol);
      const doc: HTMLElement = vista.nativeElement;
      expect(!!doc.querySelector('footer a[href="/cliente/mi-cuenta"]')).toBe(visible);
      expect(!!doc.querySelector('footer a[href="/cliente/mis-pedidos"]')).toBe(visible);
      expect(doc.querySelector('footer a[href="/cliente/carrito"]')).toBeTruthy();
    },
  );
});
