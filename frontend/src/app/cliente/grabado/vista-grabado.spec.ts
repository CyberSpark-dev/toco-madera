import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '../../core/services/auth';
import { CarritoService, ProductoCatalogo } from '../../core/services/carrito';
import { ClientePedidosService } from '../../core/services/cliente-pedidos';
import { errorGrabado, textoGrabadoNormalizado } from '../../core/utils/texto-grabado';
import { CheckoutCliente } from '../checkout/checkout';
import { VistaGrabado } from './vista-grabado';

const producto: ProductoCatalogo = {
  id_producto: 1, nombre: 'Portateléfonos', sku: 'TM-PT-01', precio_lista: '190.00',
  permite_grabado: true, max_caracteres_grabado: 40,
};
const texto = 'Lucía & José\nGracias, mamá 🌿';

function montarVista(nombre = producto.nombre, sku = producto.sku) {
  const fixture = TestBed.createComponent(VistaGrabado);
  fixture.componentRef.setInput('nombre', nombre);
  fixture.componentRef.setInput('sku', sku);
  fixture.componentRef.setInput('permite', true);
  fixture.detectChanges();
  return fixture;
}

describe('Vista ilustrativa', () => {

  it('espera la foto y conserva el texto con saltos de línea al actualizar', () => {
    const vista = montarVista('Portallaves', 'TM-PL-01');
    const pagina: HTMLElement = vista.nativeElement;
    expect(pagina.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(pagina.querySelector('img')?.getAttribute('src')).toBe('/productos/solo/portallaves-base-grabado.webp');
    expect(pagina.querySelector('.capa-grabado')).toBeNull();
    pagina.querySelector('img')?.dispatchEvent(new Event('load'));
    vista.detectChanges();
    expect(pagina.querySelector('.capa-grabado')).toBeNull();
    vista.componentRef.setInput('texto', 'Hola Mundo');
    vista.detectChanges();
    const tamanoCorto = vista.componentInstance.tamano();
    expect(pagina.querySelector('.capa-grabado span')?.textContent).toBe('Hola Mundo');
    expect(pagina.querySelector('.adorno-grabado')?.getAttribute('aria-hidden')).toBe('true');
    vista.componentRef.setInput('texto', texto);
    vista.detectChanges();
    expect(pagina.querySelector('.capa-grabado span')?.textContent).toBe(texto);
    expect(vista.componentInstance.tamano()).toBeLessThan(tamanoCorto);
    expect(pagina.textContent).toContain('Vista previa ilustrativa. El grabado final puede variar.');
  });

  it.each([
    ['Portateléfonos', 'TM-PT-01', 'portatelefonos', 52, 70],
    ['Marco para fotografías', 'TM-MF-01', 'marco_fotografias', 50, 80.5],
    ['Repisa', 'TM-RP-01', 'repisa', 50, 50.4],
    ['Placa de escritorio', 'TM-PE-01', 'placa_escritorio', 50, 50.5],
    ['Rodillo de cocina', 'TM-RC-01', 'rodillo_cocina', 50, 51],
  ])('usa base limpia y zona propia para %s', (nombre, sku, archivo, x, y) => {
    const vista = montarVista(nombre, sku);
    const pagina: HTMLElement = vista.nativeElement;
    vista.componentRef.setInput('texto', 'Ña');
    pagina.querySelector('img')?.dispatchEvent(new Event('load'));
    vista.detectChanges();
    expect(pagina.querySelector('img')?.getAttribute('src')).toBe(`/productos/solo/${archivo}-base-grabado.webp`);
    const capa = pagina.querySelector<HTMLElement>('.capa-grabado');
    expect(capa?.textContent).toContain('Ña');
    expect(capa?.style.left).toBe(`${x}%`);
    expect(capa?.style.top).toBe(`${y}%`);
  });

  it('adapta el grabado del rodillo a su zona central hasta el límite del producto', () => {
    const vista = montarVista('Rodillo de cocina', 'TM-RC-01');
    const pagina: HTMLElement = vista.nativeElement;
    pagina.querySelector('img')?.dispatchEvent(new Event('load'));
    const tamanos = ['HO', 'Hola', 'Hola Mundo', 'Recetas hechas con amor'].map((frase) => {
      vista.componentRef.setInput('texto', frase);
      vista.detectChanges();
      const capa = pagina.querySelector<HTMLElement>('.capa-grabado')!;
      expect(capa.textContent).toBe(frase);
      expect(capa.style.width).toBe('54%');
      expect(capa.style.height).toBe('13%');
      return vista.componentInstance.tamano();
    });
    expect(tamanos[3]).toBeLessThan(tamanos[0]);
  });

  it('muestra el texto aparte si no hay zona confirmable o falla la foto', () => {
    const vista = montarVista('Rodillo de cocina', 'TM-RC-01');
    const pagina: HTMLElement = vista.nativeElement;
    vista.componentRef.setInput('texto', 'Te quiero'.repeat(12));
    vista.detectChanges();
    expect(pagina.querySelector('.muestra-generica')?.textContent).toContain('Te quiero');
    expect(pagina.querySelector('.capa-grabado')).toBeNull();
    pagina.querySelector('img')?.dispatchEvent(new Event('error'));
    vista.detectChanges();
    expect(pagina.querySelector('img')).toBeNull();
    expect(pagina.textContent).toContain('Fotografía no disponible');
    vista.componentRef.setInput('permite', false);
    vista.detectChanges();
    expect(pagina.querySelector('.muestra-generica')).toBeNull();
  });

  it('no toma una zona ajena aunque el nombre coincida con una foto comercial', () => {
    const vista = montarVista('Portallaves personalizado', 'OTRO-SKU');
    const pagina: HTMLElement = vista.nativeElement;
    vista.componentRef.setInput('texto', 'Peña');
    pagina.querySelector('img')?.dispatchEvent(new Event('load'));
    vista.detectChanges();
    expect(pagina.querySelector('img')?.getAttribute('src')).toBe('/productos/solo/portallaves.webp');
    expect(pagina.querySelector('.capa-grabado')).toBeNull();
    expect(pagina.querySelector('.muestra-generica')?.textContent).toContain('Peña');
  });
});

describe('Grabado en el carrito y checkout', () => {
  const sesion = signal<number | null>(18);
  const confirmar = vi.fn(() => NEVER);

  beforeEach(() => {
    sesion.set(18);
    confirmar.mockClear();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: Auth, useValue: {
        usuario: () => sesion() ? { id_usuario: sesion() } : null,
        esCliente: () => !!sesion(), autenticado: () => !!sesion(),
      } },
      { provide: ClientePedidosService, useValue: { confirmar } },
    ] });
  });

  afterEach(() => localStorage.removeItem('tm_carrito_usuario_18_v1'));


  it('valida el máximo del producto y el global por caracteres, como el servidor', () => {
    expect(errorGrabado(producto, '🌿'.repeat(40))).toBe('');
    expect(errorGrabado(producto, 'a'.repeat(41))).toContain('máximo 40');
    expect(errorGrabado({ ...producto, max_caracteres_grabado: 999 }, 'a'.repeat(121))).toContain('máximo 120');
    expect(errorGrabado({ ...producto, permite_grabado: false }, 'ABC')).toContain('no permite');
    expect(textoGrabadoNormalizado('  ' + texto + '\n')).toBe(texto);
  });

  it('separa las variantes, conserva cantidad y recupera el grabado tras recarga y sesión', () => {
    const carrito = TestBed.inject(CarritoService);
    carrito.agregar(producto, 1, 'Sol');
    carrito.agregar(producto, 1, 'Luna');
    const [sol] = carrito.items();
    carrito.cambiarCantidad(sol.id_linea, 2);
    expect(() => carrito.cambiarGrabado(sol.id_linea, 'x'.repeat(41))).toThrow('máximo 40');
    carrito.cambiarGrabado(sol.id_linea, '  ' + texto + ' ');
    const recuperado = TestBed.runInInjectionContext(() => new CarritoService());
    sesion.set(null);
    expect(recuperado.items()).toHaveLength(0);
    sesion.set(18);
    expect(recuperado.items().map(({ cantidad, texto_grabado }) => [cantidad, texto_grabado]))
      .toEqual([[2, texto], [1, 'Luna']]);
  });

  it('muestra la personalización guardada y envía el mismo texto exacto al confirmar', () => {
    const carrito = TestBed.inject(CarritoService);
    carrito.agregar(producto, 2, texto);
    const vista = TestBed.createComponent(CheckoutCliente);
    vista.detectChanges();
    expect(vista.nativeElement.querySelector('app-vista-grabado')).toBeTruthy();
    expect(vista.nativeElement.textContent).toContain(texto);
    vista.componentInstance.actualizarNumero('000000000000000000');
    vista.componentInstance.aceptaSimulacion = true;
    vista.componentInstance.confirmar();
    expect(confirmar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      detalles: [{ id_producto: 1, cantidad: 2, texto_grabado: texto, notas: null }],
    }));
  });
});
