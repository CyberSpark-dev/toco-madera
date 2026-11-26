import { IdentidadTocoMadera } from '../../core/ui/identidad-toco-madera';
import { formatearDinero } from '../../core/utils/dinero';
/**
 * ============================================================
 * TOCO MADERA - PÁGINA DE INICIO DEL CLIENTE
 *
 * Archivo:
 * frontend/src/app/cliente/inicio/inicio.ts
 *
 * ETAPA 3.18 - CORRECCIÓN DE NAVEGACIÓN Y SESIÓN
 * ============================================================
 *
 * FUNCIONALIDADES:
 *
 * 1. Mostrar información de la empresa.
 * 2. Consultar catálogo desde Flask y MySQL.
 * 3. Mostrar productos, precios y personalización.
 * 4. Controlar estados de carga y errores.
 * 5. Desplazarse correctamente al catálogo.
 * 6. Identificar si existe una sesión activa.
 * 7. Diferenciar CLIENTE y ADMIN.
 * 8. Permitir cerrar sesión.
 * 9. Conservar el carrito al cerrar sesión.
 *
 * IMPORTANTE:
 *
 * - El backend valida los permisos reales.
 * - El frontend solo adapta la navegación.
 * - No se modifican productos ni inventario.
 * ============================================================
 */

import { Component, DOCUMENT, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { mensajeNotificable, Notificaciones } from '../../core/services/notificaciones';


import { Router, RouterLink } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

// ============================================================
// SERVICIOS EXISTENTES DEL PROYECTO
// ============================================================

import { Auth } from '../../core/services/auth';

import { CatalogoCarritoService } from '../../core/services/catalogo-carrito';

import { ProductoCatalogo } from '../../core/services/carrito';

import { CarritoService } from '../../core/services/carrito';

// ============================================================
// COMPONENTE ANGULAR
// ============================================================

import { imagenProducto } from '../../core/utils/imagenes-productos';
import { InstalacionPwaVista } from '../../core/services/instalacion-pwa-vista';

@Component({
  selector: 'app-inicio',
  standalone: true,

  imports: [IdentidadTocoMadera, RouterLink, InstalacionPwaVista],

  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  // ==========================================================
  // 1. SERVICIOS
  // ==========================================================
  readonly imagenProducto = imagenProducto; // Función para obtener la imagen de un producto.
  // Autenticación existente del proyecto.
  readonly auth = inject(Auth);

  // Carrito existente: conserva artículos en localStorage.
  readonly carrito = inject(CarritoService);
  readonly notificaciones = inject(Notificaciones);

  // Servicio público de productos.
  private readonly catalogoApi = inject(CatalogoCarritoService);

  // Navegación programática de Angular.
  private readonly router = inject(Router);

  // ==========================================================
  // 2. IDENTIDAD DE LA EMPRESA
  // ==========================================================

  readonly nombreEmpresa = 'Toco Madera';

  readonly eslogan = 'Frases que vienen de raíz y se guardan en el corazón';

  // ==========================================================
  // 3. SIGNALS DEL CATÁLOGO
  // ==========================================================

  // Lista de productos recibidos desde Flask.
  readonly productos = signal<ProductoCatalogo[]>([]);

  // Indica que estamos consultando la API.
  readonly cargandoProductos = signal(true);

  // Mensaje visible si ocurre una falla.
  readonly errorProductos = mensajeNotificable('error');
  readonly indiceDestacado = signal(0);
  readonly escenas: readonly {
    titulo: string; alt: string; foto: string; posicion: string;
    destino: 'nosotros' | 'catalogo'; sku?: string;
  }[] = [
    { titulo: 'El trabajo detrás de cada pieza', alt: 'Artesano tallando un portallaves de madera en el taller',
      foto: '/productos/inicio/taller-artesanal.webp', posicion: '78% 50%', destino: 'nosotros' },
    { titulo: 'Un regalo para recordar', alt: 'Familia mostrando un marco de madera que acaba de abrir como regalo',
      foto: '/productos/inicio/familia-regalo-artesanal.webp', posicion: '43% 50%', destino: 'catalogo' },
    {
      titulo: 'Detalles que distinguen cada pieza', alt: 'Placa de madera con grabado y acabado visibles sobre un escritorio',
      foto: '/productos/placa_escritorio.png', posicion: '50% 48%', destino: 'catalogo', sku: 'TM-PE-01',
    },
    {
      titulo: 'Recuerdos hechos para quedarse', alt: 'Marco de madera grabado con un retrato familiar',
      foto: '/productos/marco_fotografias.png', posicion: '50% 38%', destino: 'catalogo', sku: 'TM-MF-01',
    },
  ];
  readonly escena = computed(() => this.escenas[this.indiceDestacado()]);
  private readonly documento = inject(DOCUMENT);
  private readonly destruir = inject(DestroyRef);
  private readonly movimiento = this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  private temporizador?: ReturnType<typeof setTimeout>;
  private cursor = false;
  private foco = false;
  readonly movimientoReducido = signal(!!this.movimiento?.matches);
  readonly rotando = signal(false);

  desplazarDestacado(paso: -1 | 1): void {
    this.cambiarEscena(paso);
    this.programarCarrusel();
  }

  private cambiarEscena(paso: -1 | 1): void {
    const total = this.escenas.length;
    this.indiceDestacado.update((indice) => (indice + paso + total) % total);
  }

  cursorCarrusel(dentro: boolean): void {
    this.cursor = dentro;
    this.programarCarrusel();
  }

  focoCarrusel(dentro: boolean, evento?: FocusEvent): void {
    if (!dentro && evento?.relatedTarget instanceof Node &&
        (evento.currentTarget as HTMLElement).contains(evento.relatedTarget)) return;
    this.foco = dentro && (!evento || (evento.target as HTMLElement).matches(':focus-visible'));
    this.programarCarrusel();
  }

  private programarCarrusel(): void {
    clearTimeout(this.temporizador);
    const activo = !this.cursor && !this.foco && !this.documento.hidden &&
      !this.movimientoReducido();
    this.rotando.set(activo);
    if (!activo) return;
    this.temporizador = setTimeout(() => {
      this.cambiarEscena(1);
      this.programarCarrusel();
    }, 6000);
  }

  irAEscena(): void {
    const escena = this.escena();
    if (escena.destino === 'nosotros') {
      this.enfocarDestino(document.getElementById('titulo-nosotros'));
      return;
    }
    const producto = this.productos().find((p) => p.sku === escena.sku);
    const tarjeta = producto && document.querySelector<HTMLElement>(`#producto-${producto.id_producto} h3`);
    if (tarjeta) this.enfocarDestino(tarjeta);
    else this.irAlCatalogo();
  }

  // ==========================================================
  // 4. INICIALIZACIÓN
  // ==========================================================

  ngOnInit(): void {
    const visibilidad = () => this.programarCarrusel();
    const preferencia = (evento: MediaQueryListEvent) => {
      this.movimientoReducido.set(evento.matches);
      this.programarCarrusel();
    };
    this.documento.addEventListener('visibilitychange', visibilidad);
    this.movimiento?.addEventListener?.('change', preferencia);
    this.destruir.onDestroy(() => {
      clearTimeout(this.temporizador);
      this.documento.removeEventListener('visibilitychange', visibilidad);
      this.movimiento?.removeEventListener?.('change', preferencia);
    });
    this.programarCarrusel();
    // Consultar los productos al abrir la tienda.
    this.cargarProductos();
  }

  // ==========================================================
  // 5. CARGAR PRODUCTOS DESDE FLASK
  // ==========================================================

  cargarProductos(): void {
    this.cargandoProductos.set(true);
    this.errorProductos.set('');

    // El servicio reutiliza:
    // GET http://127.0.0.1:5000/api/v1/productos/
    this.catalogoApi.listar().subscribe({
      // ------------------------------------------------------
      // CONSULTA EXITOSA
      // ------------------------------------------------------

      next: (productos: ProductoCatalogo[]) => {
        // Guardar productos en el Signal.
        this.productos.set(productos);

        // Finalizar estado de carga.
        this.cargandoProductos.set(false);
      },

      // ------------------------------------------------------
      // ERROR DE CONEXIÓN O RESPUESTA
      // ------------------------------------------------------

      error: (error: unknown) => {
        console.error('Error al cargar el catálogo:', error);

        // Identificar errores HTTP.
        if (error instanceof HttpErrorResponse) {
          if (error.status === 0) {
            this.errorProductos.set(
              'No pudimos cargar el catálogo. Inténtalo nuevamente.',
            );
          } else {
            this.errorProductos.set('El servidor no pudo consultar ' + 'el catálogo de productos.');
          }
        } else {
          this.errorProductos.set('No fue posible interpretar la respuesta ' + 'del catálogo.');
        }

        this.cargandoProductos.set(false);
      },
    });
  }

  // ==========================================================
  // 6. DESPLAZARSE A LA SECCIÓN DE PRODUCTOS
  // ==========================================================

  /**
   * Este método resuelve el problema anterior:
   *
   * routerLink="/" fragment="catalogo"
   *
   * En lugar de depender de la configuración
   * del Router, nos desplazamos directamente
   * hasta la sección del catálogo.
   */
  irAlCatalogo(): void {
    this.enfocarDestino(document.getElementById('titulo-catalogo'));
  }

  private enfocarDestino(destino: HTMLElement | null): void {
    if (!destino) return;
    destino.focus({ preventScroll: true });
    destino.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }

  // ==========================================================
  // 7. CERRAR SESIÓN
  // ==========================================================

  /**
   * El servicio Auth elimina:
   *
   * - JWT almacenado en memoria.
   * - JWT guardado en sessionStorage.
   * - Datos del usuario autenticado.
   *
   * No borra el carrito de compras.
   */

  /**
   * ==========================================================
   * TOCO MADERA - CONFIRMACIÓN DE CIERRE DE SESIÓN
   * ETAPA 3.18
   * ==========================================================
   *
   * Antes de cerrar la sesión:
   * - Solicita confirmación al usuario.
   * - Si cancela, conserva su sesión.
   * - Si acepta, elimina el JWT mediante Auth.
   * - Conserva los productos del carrito.
   * - Regresa al inicio.
   */
  cerrarSesionCliente(): void {
    // Mostrar ventana de confirmación de Chrome.
    const confirmar = window.confirm('¿Estás seguro de que quieres cerrar sesión?');

    // Si el usuario selecciona Cancelar,
    // no se modifica su sesión.
    if (!confirmar) {
      return;
    }

    // Eliminar el JWT y el perfil autenticado.
    this.auth.cerrarSesion();

    // Regresar a la tienda.
    this.router.navigateByUrl('/');
  }

  readonly formatearPrecio = formatearDinero;
}
