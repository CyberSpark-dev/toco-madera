/**
 * Toco Madera | Etapa 3.18.4
 * Carrito persistente local: guarda exclusivamente artículos, sin JWT ni datos bancarios.
 * Los precios del navegador son orientativos; Flask los recalcula en checkout.
 */
import { Injectable, computed, signal } from '@angular/core';

export interface ProductoCatalogo {
  id_producto: number;
  sku: string;
  nombre: string;
  descripcion?: string | null;
  precio_lista: string | number;
  permite_grabado: boolean | number;
  max_caracteres_grabado: number;
  activo?: boolean | number;
}

export interface ItemCarrito {
  id_linea: string;
  id_producto: number;
  sku: string;
  nombre: string;
  precio_estimado: string;
  cantidad: number;
  texto_grabado: string | null;
  notas: string | null;
  permite_grabado: boolean;
  max_caracteres_grabado: number;
}

export interface ItemCheckout {
  id_producto: number;
  cantidad: number;
  texto_grabado: string | null;
  notas: string | null;
}

interface EstadoGuardado {
  version: 1;
  clave_solicitud: string;
  items: ItemCarrito[];
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly storageKey = 'tm_carrito_v1';
  private readonly estado = signal<EstadoGuardado>(this.restaurar());

  readonly items = computed(() => this.estado().items);
  readonly cantidadTotal = computed(() => this.items().reduce((a, i) => a + i.cantidad, 0));
  readonly subtotalEstimado = computed(() => this.items().reduce((a, i) => a + Number(i.precio_estimado) * i.cantidad, 0));
  readonly claveSolicitud = computed(() => this.estado().clave_solicitud);
  readonly vacio = computed(() => this.items().length === 0);

  agregar(producto: ProductoCatalogo, cantidad: number, texto = '', notas = ''): void {
    if (producto.activo !== undefined && !Boolean(producto.activo)) {
      throw new Error('El producto no está disponible.');
    }
    if (!Number.isInteger(producto.id_producto) || producto.id_producto < 1) {
      throw new Error('Producto inválido.');
    }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      throw new Error('La cantidad debe estar entre 1 y 100.');
    }
    const precio = Number(producto.precio_lista);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error('El precio del producto no es válido.');
    }
    const permiteGrabado = Boolean(producto.permite_grabado);
    const grabado = texto.trim();
    const observaciones = notas.trim();
    if (grabado && !permiteGrabado) throw new Error('Este producto no permite grabado.');
    if (grabado.length > Math.min(Number(producto.max_caracteres_grabado) || 0, 120)) {
      throw new Error('El grabado supera el límite de caracteres.');
    }
    if (observaciones.length > 200) throw new Error('Las notas admiten máximo 200 caracteres.');
    const actual = this.estado();
    const items = actual.items.map(i => ({ ...i }));
    const existente = items.find(i => i.id_producto === producto.id_producto &&
      (i.texto_grabado ?? '') === grabado && (i.notas ?? '') === observaciones);
    if (existente) {
      if (existente.cantidad + cantidad > 100) throw new Error('Máximo 100 unidades por renglón.');
      existente.cantidad += cantidad;
      existente.precio_estimado = precio.toFixed(2);
    } else {
      if (items.length >= 50) throw new Error('Máximo 50 renglones en el carrito.');
      items.push({
        id_linea: crypto.randomUUID(), id_producto: producto.id_producto,
        sku: producto.sku ?? '', nombre: producto.nombre,
        precio_estimado: precio.toFixed(2), cantidad,
        texto_grabado: grabado || null, notas: observaciones || null,
        permite_grabado: permiteGrabado,
        max_caracteres_grabado: Number(producto.max_caracteres_grabado) || 0
      });
    }
    this.actualizar(items);
  }

  cambiarCantidad(idLinea: string, cantidad: number): void {
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      throw new Error('La cantidad debe estar entre 1 y 100.');
    }
    const items = this.items().map(i => i.id_linea === idLinea ? { ...i, cantidad } : i);
    this.actualizar(items);
  }

  quitar(idLinea: string): void {
    this.actualizar(this.items().filter(i => i.id_linea !== idLinea));
  }

  vaciar(): void { this.actualizar([]); }

  datosCheckout(): ItemCheckout[] {
    return this.items().map(i => ({
      id_producto: i.id_producto, cantidad: i.cantidad,
      texto_grabado: i.texto_grabado, notas: i.notas
    }));
  }

  private actualizar(items: ItemCarrito[]): void {
    // Cualquier cambio lógico en el carrito inicia un nuevo checkout.
    const nuevo: EstadoGuardado = { version: 1, clave_solicitud: crypto.randomUUID(), items };
    this.estado.set(nuevo);
    this.persistir(nuevo);
  }

  private restaurar(): EstadoGuardado {
    const nuevo = (): EstadoGuardado => ({ version: 1, clave_solicitud: crypto.randomUUID(), items: [] });
    if (typeof localStorage === 'undefined') return nuevo();
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return nuevo();
      const dato: unknown = JSON.parse(raw);
      if (!dato || typeof dato !== 'object') return nuevo();
      const s = dato as Partial<EstadoGuardado>;
      if (s.version !== 1 || !Array.isArray(s.items) || s.items.length > 50 ||
          typeof s.clave_solicitud !== 'string' || !/^[0-9a-f-]{36}$/i.test(s.clave_solicitud)) return nuevo();
      const items = s.items.filter(i =>
        i && typeof i.id_linea === 'string' && Number.isInteger(i.id_producto) &&
        i.id_producto > 0 && typeof i.nombre === 'string' &&
        Number.isInteger(i.cantidad) && i.cantidad >= 1 && i.cantidad <= 100 &&
        Number.isFinite(Number(i.precio_estimado)) && Number(i.precio_estimado) > 0 &&
        typeof i.sku === 'string' &&
        (i.texto_grabado === null || typeof i.texto_grabado === 'string') &&
        (i.notas === null || typeof i.notas === 'string')
      );
      return { version: 1, clave_solicitud: s.clave_solicitud, items };
    } catch { return nuevo(); }
  }

  private persistir(valor: EstadoGuardado): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(this.storageKey, JSON.stringify(valor)); }
    catch { /* Sin espacio: el carrito continúa en memoria. */ }
  }
}
