/**
 * TOCO MADERA - Carrito independiente por cliente (corrección multiusuario).
 *
 * - Cada cliente autenticado utiliza tm_carrito_usuario_<id>_v1.
 * - Sin sesión CLIENTE, el carrito visible está vacío y no se permite agregar.
 * - Los artículos se mantienen en este navegador entre sesiones del MISMO cliente.
 * - No se copian los artículos del antiguo carrito global porque se desconoce su dueño.
 * - JWT y contraseñas nunca se guardan aquí. Flask valida productos, precios y stock.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';

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
  private readonly auth = inject(Auth);
  private readonly estados = new Map<number, EstadoGuardado>();
  private readonly revision = signal(0);
  private readonly vacioInterno = this.nuevoEstado();

  /** Reactivo: al cambiar Auth.usuario / Auth.esCliente cambia el carrito visible. */
  readonly idClienteActual = computed<number | null>(() => {
    if (!this.auth.esCliente()) return null;
    const id = this.auth.usuario()?.id_usuario;
    return Number.isSafeInteger(id) && id! > 0 ? id! : null;
  });

  private readonly estadoActivo = computed(() => {
    this.revision();
    const id = this.idClienteActual();
    return id === null ? this.vacioInterno : this.cargarUsuario(id);
  });

  readonly items = computed(() => this.estadoActivo().items);
  readonly cantidadTotal = computed(() => this.items().reduce((a, i) => a + i.cantidad, 0));
  readonly subtotalEstimado = computed(() => this.items().reduce((a, i) => a + Number(i.precio_estimado) * i.cantidad, 0));
  readonly claveSolicitud = computed(() => this.estadoActivo().clave_solicitud);
  readonly vacio = computed(() => this.items().length === 0);

  constructor() {
    // El formato anterior era común a todos los usuarios. No se puede atribuir con seguridad.
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('tm_carrito_v1');
    } catch { /* El carrito aislado sigue disponible en memoria. */ }
  }

  agregar(producto: ProductoCatalogo, cantidad: number, texto = '', notas = ''): void {
    this.exigirCliente();
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

    const actual = this.estadoActivo();
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
    this.exigirCliente();
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      throw new Error('La cantidad debe estar entre 1 y 100.');
    }
    const items = this.items().map(i => i.id_linea === idLinea ? { ...i, cantidad } : i);
    this.actualizar(items);
  }

  quitar(idLinea: string): void {
    this.exigirCliente();
    this.actualizar(this.items().filter(i => i.id_linea !== idLinea));
  }

  vaciar(): void {
    this.exigirCliente();
    this.actualizar([]);
  }

  /** Checkout asíncrono: borra SOLO el carrito del cliente que realizó la compra. */
  vaciarDeUsuario(idUsuario: number): void {
    if (!Number.isSafeInteger(idUsuario) || idUsuario < 1) return;
    this.guardarUsuario(idUsuario, this.nuevoEstado());
  }

  datosCheckout(): ItemCheckout[] {
    this.exigirCliente();
    return this.items().map(i => ({
      id_producto: i.id_producto, cantidad: i.cantidad,
      texto_grabado: i.texto_grabado, notas: i.notas
    }));
  }

  private exigirCliente(): number {
    const id = this.idClienteActual();
    if (id === null) throw new Error('Inicia sesión con una cuenta CLIENTE para utilizar tu carrito personal.');
    return id;
  }

  private actualizar(items: ItemCarrito[]): void {
    const id = this.exigirCliente();
    // Cada modificación genera nueva clave de solicitud para el checkout.
    this.guardarUsuario(id, { version: 1, clave_solicitud: crypto.randomUUID(), items });
  }

  private guardarUsuario(id: number, valor: EstadoGuardado): void {
    this.estados.set(id, valor);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.claveUsuario(id), JSON.stringify(valor));
      }
    } catch { /* Si está restringido, continúa en memoria. */ }
    this.revision.update(n => n + 1);
  }

  private cargarUsuario(id: number): EstadoGuardado {
    const enMemoria = this.estados.get(id);
    if (enMemoria) return enMemoria;
    let valor = this.nuevoEstado();
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(this.claveUsuario(id));
      if (raw) {
        const dato: unknown = JSON.parse(raw);
        if (dato && typeof dato === 'object') {
          const s = dato as Partial<EstadoGuardado>;
          if (s.version === 1 && Array.isArray(s.items) && s.items.length <= 50 &&
              typeof s.clave_solicitud === 'string' && /^[0-9a-f-]{36}$/i.test(s.clave_solicitud)) {
            const items = s.items.filter(i =>
              i && typeof i.id_linea === 'string' && Number.isInteger(i.id_producto) &&
              i.id_producto > 0 && typeof i.nombre === 'string' &&
              Number.isInteger(i.cantidad) && i.cantidad >= 1 && i.cantidad <= 100 &&
              Number.isFinite(Number(i.precio_estimado)) && Number(i.precio_estimado) > 0 &&
              typeof i.sku === 'string' &&
              (i.texto_grabado === null || typeof i.texto_grabado === 'string') &&
              (i.notas === null || typeof i.notas === 'string')
            );
            valor = { version: 1, clave_solicitud: s.clave_solicitud, items };
          }
        }
      }
    } catch { /* Datos locales corruptos: empezar carrito limpio. */ }
    this.estados.set(id, valor);
    return valor;
  }

  private claveUsuario(id: number): string {
    return `tm_carrito_usuario_${id}_v1`;
  }

  private nuevoEstado(): EstadoGuardado {
    return { version: 1, clave_solicitud: crypto.randomUUID(), items: [] };
  }
}
