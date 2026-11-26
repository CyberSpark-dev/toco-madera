import { IdentidadTocoMadera } from '../../core/ui/identidad-toco-madera';
import { mensajeNotificable } from '../../core/services/notificaciones';
import { formatearDinero } from '../../core/utils/dinero';
/**
 * Toco Madera | Etapa 3.18.4
 * Página independiente: selección de productos + edición del carrito.
 * Utiliza catálogo público existente y Signals de Angular 22.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarritoService, ItemCarrito, ProductoCatalogo, errorCantidadProducto } from '../../core/services/carrito';
import { CatalogoCarritoService } from '../../core/services/catalogo-carrito';
import { imagenProducto } from '../../core/utils/imagenes-productos';
import { errorGrabado, maximoGrabado, textoGrabadoNormalizado } from '../../core/utils/texto-grabado';
import { VistaGrabado } from '../grabado/vista-grabado';

@Component({
  selector: 'app-carrito-cliente',
  standalone: true,
  imports: [IdentidadTocoMadera, FormsModule, RouterLink, VistaGrabado],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class CarritoCliente implements OnInit {
  readonly imagenProducto = imagenProducto;// Función para obtener la imagen de un producto.
  readonly carrito = inject(CarritoService);
  private readonly catalogoApi = inject(CatalogoCarritoService);

  readonly productos = signal<ProductoCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = mensajeNotificable('error');
  readonly mensaje = mensajeNotificable('exito');
  readonly busqueda = signal('');

  // Campos del artículo que se está configurando.
  readonly elegido = signal<ProductoCatalogo | null>(null);
  cantidad: number | null = 1;
  readonly errorCantidad = signal('');
  readonly cantidadesInvalidas = signal<Record<string, string>>({});
  grabado = '';
  readonly maximoGrabado = maximoGrabado;
  readonly errorGrabado = errorGrabado;
  readonly normalizarGrabado = textoGrabadoNormalizado;
  edicionGrabado: { idLinea: string; texto: string } | null = null;
  notas = '';

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
    this.cargando.set(true);
    this.error.set('');
    this.catalogoApi.listar().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error('Error del catálogo:', error);
        this.error.set('No pudimos cargar el catálogo. Inténtalo nuevamente.');
        this.cargando.set(false);
      },
    });
  }

  productosFiltrados(): ProductoCatalogo[] {
    const texto = this.busqueda().trim().toLocaleLowerCase();
    return this.productos().filter(
      (p) =>
        p.nombre.toLocaleLowerCase().includes(texto) ||
        (p.sku ?? '').toLocaleLowerCase().includes(texto),
    );
  }

  seleccionar(producto: ProductoCatalogo): void {
    this.elegido.set(producto);
    this.cantidad = 1;
    this.errorCantidad.set('');
    this.grabado = '';
    this.notas = '';
    this.error.set('');
    this.mensaje.set('');
    setTimeout(
      () =>
        document
          .getElementById('configurar-producto')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }

  cancelarSeleccion(): void {
    this.elegido.set(null);
  }

  guardarGrabado(evento: Event): void {
    evento.preventDefault();
    if (!this.edicionGrabado) return;
    try {
      this.carrito.cambiarGrabado(this.edicionGrabado.idLinea, this.edicionGrabado.texto);
      this.edicionGrabado = null;
      this.error.set('');
      this.mensaje.set('Grabado actualizado.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar el grabado.');
    }
  }

  editarGrabado(item: ItemCarrito): void {
    this.edicionGrabado = { idLinea: item.id_linea, texto: item.texto_grabado ?? '' };
    setTimeout(() => document.getElementById('grabado-' + item.id_linea)?.focus(), 0);
  }

  quitarArticulo(idLinea: string): void {
    this.carrito.quitar(idLinea);
    if (this.edicionGrabado?.idLinea === idLinea) this.edicionGrabado = null;
  }

  cambiarCantidad(cantidad: number | null): void {
    this.cantidad = cantidad;
    this.errorCantidad.set(errorCantidadProducto(cantidad));
    this.error.set('');
  }

  editarErrorLinea(id: string, texto = ''): void {
    this.cantidadesInvalidas.update((errores) => {
      const actual = { ...errores };
      if (texto) actual[id] = texto;
      else delete actual[id];
      return actual;
    });
  }

  hayCantidadesInvalidas(): boolean {
    return this.carrito.items().some((item) => Boolean(this.cantidadesInvalidas()[item.id_linea]));
  }

  agregar(): void {
    const p = this.elegido();
    if (!p) return;
    const validacion = errorCantidadProducto(this.cantidad);
    this.errorCantidad.set(validacion);
    if (validacion) {
      this.error.set(validacion);
      return;
    }
    if (errorGrabado(p, this.grabado)) return;
    try {
      this.carrito.agregar(p, Number(this.cantidad), this.grabado, this.notas);
      this.mensaje.set(`Se agregó ${p.nombre} al carrito.`);
      this.error.set('');
      this.elegido.set(null);
      setTimeout(
        () =>
          document
            .getElementById('mi-carrito')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        0,
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No fue posible agregar el producto.');
    }
  }

  cantidadActualizada(idLinea: string, nuevaCantidad: number | null): void {
    const validacion = errorCantidadProducto(nuevaCantidad);
    this.editarErrorLinea(idLinea, validacion);
    if (validacion) return;
    try {
      this.carrito.cambiarCantidad(idLinea, Number(nuevaCantidad));
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Cantidad inválida.');
    }
  }

  readonly precio = formatearDinero;
}
