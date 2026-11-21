/**
 * Toco Madera | Etapa 3.18.4
 * Página independiente: selección de productos + edición del carrito.
 * Utiliza catálogo público existente y Signals de Angular 22.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarritoService, ProductoCatalogo } from '../../core/services/carrito';
import { CatalogoCarritoService } from '../../core/services/catalogo-carrito';
import { imagenProducto } from '../../core/utils/imagenes-productos';

@Component({
  selector: 'app-carrito-cliente',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class CarritoCliente implements OnInit {
  readonly imagenProducto = imagenProducto;// Función para obtener la imagen de un producto.
  readonly carrito = inject(CarritoService);
  private readonly catalogoApi = inject(CatalogoCarritoService);

  readonly productos = signal<ProductoCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly busqueda = signal('');

  // Campos del artículo que se está configurando.
  readonly elegido = signal<ProductoCatalogo | null>(null);
  cantidad = 1;
  grabado = '';
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
        this.error.set('No pudimos cargar el catálogo. Comprueba que Flask esté encendido.');
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

  agregar(): void {
    const p = this.elegido();
    if (!p) return;
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

  cantidadActualizada(idLinea: string, nuevaCantidad: string | number): void {
    try {
      this.carrito.cambiarCantidad(idLinea, Number(nuevaCantidad));
      this.error.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Cantidad inválida.');
    }
  }

  precio(valor: string | number): string {
    return Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
