/**
 * ==========================================================
 * TOCO MADERA - ADMINISTRACIÓN DE PRODUCTOS
 * Archivo: frontend/src/app/admin/productos/productos.ts
 * ==========================================================
 *
 * Funcionalidades:
 * 1. Consultar productos desde Flask y MySQL.
 * 2. Consultar las categorías disponibles.
 * 3. Buscar por nombre o SKU.
 * 4. Filtrar productos por estado.
 * 5. Registrar productos nuevos.
 * 6. Editar los datos comerciales.
 * 7. Activar o desactivar productos.
 * 8. Manejar errores y permisos administrativos.
 * 9. Desplazarse automáticamente al formulario.
 *
 * No se modifican directamente las existencias.
 * ==========================================================
 */

import { Component, OnInit, inject, signal, computed } from '@angular/core';

import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminProductos,
  ProductoAdmin,
  ProductoFormulario,
  CategoriaAdmin,
} from '../../core/services/admin-productos';

import { Auth } from '../../core/services/auth';

// ==========================================================
// CONFIGURACIÓN DEL COMPONENTE
// ==========================================================

@Component({
  selector: 'app-productos-admin',
  standalone: true,

  imports: [FormsModule, RouterLink, CurrencyPipe],

  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class ProductosAdmin implements OnInit {
  // ========================================================
  // 1. SERVICIOS
  // ========================================================

  private readonly api = inject(AdminProductos);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // ========================================================
  // 2. DATOS DEL MÓDULO
  // ========================================================

  productos = signal<ProductoAdmin[]>([]);
  categorias = signal<CategoriaAdmin[]>([]);

  // Estados de carga independientes.
  cargando = signal(true);
  cargandoCategorias = signal(true);
  guardando = signal(false);

  // Mensajes generales.
  error = signal('');
  mensaje = signal('');

  // Error exclusivo del formulario.
  errorFormulario = signal('');

  // Error exclusivo de categorías.
  errorCategorias = signal('');

  // Filtros de la tabla.
  busqueda = signal('');
  filtroEstado = signal('TODOS');

  // Control del formulario.
  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);

  // Control de confirmación de estado.
  productoPendiente = signal<ProductoAdmin | null>(null);

  // ========================================================
  // 3. DATOS INICIALES DEL FORMULARIO
  // ========================================================

  formulario: ProductoFormulario = {
    id_categoria: 0,
    sku: '',
    nombre: '',
    descripcion: '',
    precio_lista: '',
    permite_grabado: true,
    max_caracteres_grabado: 40,
  };

  // ========================================================
  // 4. FILTRADO REACTIVO DE PRODUCTOS
  // ========================================================

  readonly productosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();

    const estado = this.filtroEstado();

    return this.productos().filter((producto) => {
      // Buscar coincidencias en nombre o SKU.
      const coincideTexto =
        producto.nombre.toLocaleLowerCase().includes(texto) ||
        producto.sku.toLocaleLowerCase().includes(texto);

      // Filtrar según el estado seleccionado.
      const coincideEstado =
        estado === 'TODOS' ||
        (estado === 'ACTIVOS' && producto.activo) ||
        (estado === 'INACTIVOS' && !producto.activo);

      return coincideTexto && coincideEstado;
    });
  });

  // ========================================================
  // 5. INICIALIZAR
  // ========================================================

  ngOnInit(): void {
    // Consultas independientes al backend.
    this.cargarProductos();
    this.cargarCategorias();
  }

  // ========================================================
  // 6. CONSULTAR PRODUCTOS
  // ========================================================

  cargarProductos(): void {
    this.cargando.set(true);
    this.error.set('');

    this.api.listarProductos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.productos);
        this.cargando.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);

        this.manejarError(error, 'No fue posible cargar los productos.');
      },
    });
  }

  // ========================================================
  // 7. CONSULTAR CATEGORÍAS
  // ========================================================

  cargarCategorias(): void {
    this.cargandoCategorias.set(true);
    this.errorCategorias.set('');

    this.api.listarCategorias().subscribe({
      next: (respuesta) => {
        this.categorias.set(respuesta.categorias);
        this.cargandoCategorias.set(false);

        // Informar si Flask no devolvió categorías.
        if (respuesta.categorias.length === 0) {
          this.errorCategorias.set(
            'No existen categorías disponibles. ' + 'Verifica la tabla categorias en MySQL.',
          );
        }
      },

      error: (error: HttpErrorResponse) => {
        this.cargandoCategorias.set(false);
        this.categorias.set([]);

        this.errorCategorias.set(
          'No fue posible consultar las categorías. ' + 'Comprueba el endpoint administrativo.',
        );

        // Un problema de permisos requiere redirección.
        if (error.status === 401 || error.status === 403) {
          this.manejarError(error, 'No se pudieron consultar las categorías.');
        } else {
          console.error('Error al consultar categorías:', error);
        }
      },
    });
  }

  // ========================================================
  // 8. OBTENER NOMBRE DE CATEGORÍA
  // ========================================================

  nombreCategoria(idCategoria: number): string {
    const categoria = this.categorias().find((item) => item.id_categoria === idCategoria);

    return categoria?.nombre ?? 'Sin categoría';
  }

  // ========================================================
  // 9. DESPLAZAR LA PÁGINA AL FORMULARIO
  // ========================================================

  private irAlFormulario(): void {
    // Esperar a que Angular renderice la sección
    // controlada por @if (mostrarFormulario()).
    setTimeout(() => {
      const seccion = document.getElementById('formulario-producto');

      if (seccion) {
        seccion.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 0);
  }

  // ========================================================
  // 10. ABRIR FORMULARIO DE NUEVO PRODUCTO
  // ========================================================

  nuevoProducto(): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.errorFormulario.set('');
    this.mensaje.set('');

    // No registrar productos sin categorías válidas.
    if (this.categorias().length === 0) {
      this.errorCategorias.set(
        'No puedes registrar productos porque ' +
          'no hay categorías cargadas. ' +
          'Presiona "Reintentar categorías".',
      );

      return;
    }

    // null significa nuevo producto.
    this.editandoId.set(null);

    // Restablecer valores.
    this.formulario = {
      id_categoria: this.categorias()[0].id_categoria,
      sku: '',
      nombre: '',
      descripcion: '',
      precio_lista: '',
      permite_grabado: true,
      max_caracteres_grabado: 40,
    };

    // Mostrar formulario.
    this.mostrarFormulario.set(true);

    // Llevar al usuario hasta el formulario.
    this.irAlFormulario();
  }

  // ========================================================
  // 11. ABRIR FORMULARIO DE EDICIÓN
  // ========================================================

  editarProducto(producto: ProductoAdmin): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.errorFormulario.set('');
    this.mensaje.set('');

    // Guardar el ID del producto seleccionado.
    this.editandoId.set(producto.id_producto);

    // Copiar sus datos sin alterar la tabla.
    this.formulario = {
      id_categoria: producto.id_categoria,
      sku: producto.sku,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio_lista: producto.precio_lista,
      permite_grabado: producto.permite_grabado,
      max_caracteres_grabado: producto.max_caracteres_grabado,
    };

    // Mostrar el formulario de edición.
    this.mostrarFormulario.set(true);

    // Desplazar la pantalla al formulario.
    this.irAlFormulario();
  }

  // ========================================================
  // 12. CERRAR FORMULARIO
  // ========================================================

  cerrarFormulario(): void {
    if (this.guardando()) {
      return;
    }

    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
    this.errorFormulario.set('');
  }

  // ========================================================
  // 13. GUARDAR PRODUCTO
  // ========================================================

  guardarProducto(): void {
    if (this.guardando()) {
      return;
    }

    this.errorFormulario.set('');
    this.mensaje.set('');

    // ------------------------------------------------------
    // VALIDAR CATEGORÍA
    // ------------------------------------------------------

    const idCategoria = Number(this.formulario.id_categoria);

    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      this.errorFormulario.set('Selecciona una categoría válida.');

      return;
    }

    // ------------------------------------------------------
    // VALIDAR NOMBRE Y SKU
    // ------------------------------------------------------

    const nombre = this.formulario.nombre.trim();
    const sku = this.formulario.sku.trim().toUpperCase();

    if (nombre.length < 2 || !/^[A-Z0-9_-]{2,50}$/.test(sku)) {
      this.errorFormulario.set(
        'Verifica el nombre y el SKU. ' + 'El SKU solo admite letras, números y guiones.',
      );

      return;
    }

    // ------------------------------------------------------
    // VALIDAR PRECIO
    // ------------------------------------------------------

    const precioTexto = this.formulario.precio_lista.trim();

    const precio = Number(precioTexto);

    if (!/^\d+(\.\d{1,2})?$/.test(precioTexto) || !Number.isFinite(precio) || precio <= 0) {
      this.errorFormulario.set(
        'Ingresa un precio positivo con ' + 'máximo dos decimales. Ejemplo: 250.00',
      );

      return;
    }

    // ------------------------------------------------------
    // VALIDAR GRABADO
    // ------------------------------------------------------

    const maxCaracteres = Number(this.formulario.max_caracteres_grabado);

    if (
      this.formulario.permite_grabado &&
      (!Number.isInteger(maxCaracteres) || maxCaracteres < 1 || maxCaracteres > 65535)
    ) {
      this.errorFormulario.set('El límite de grabado debe ser ' + 'un entero positivo válido.');

      return;
    }

    // ------------------------------------------------------
    // CONSTRUIR PETICIÓN PARA FLASK
    // ------------------------------------------------------

    const datos: ProductoFormulario = {
      id_categoria: idCategoria,
      sku: sku,
      nombre: nombre,
      descripcion: this.formulario.descripcion?.trim() || null,
      precio_lista: precioTexto,
      permite_grabado: this.formulario.permite_grabado,
      max_caracteres_grabado: this.formulario.permite_grabado ? maxCaracteres : 0,
    };

    // Activar indicador de guardado.
    this.guardando.set(true);

    const idProducto = this.editandoId();

    // Nuevo producto: POST.
    // Producto existente: PUT.
    const operacion =
      idProducto === null
        ? this.api.registrarProducto(datos)
        : this.api.editarProducto(idProducto, datos);

    operacion.subscribe({
      next: (respuesta) => {
        this.guardando.set(false);

        // Cerrar formulario.
        this.mostrarFormulario.set(false);
        this.editandoId.set(null);
        this.errorFormulario.set('');

        // Mostrar confirmación.
        this.mensaje.set(respuesta.message);

        // Actualizar tabla desde MySQL.
        this.cargarProductos();

        // Volver al encabezado de gestión.
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        // Mantener el formulario abierto
        // para corregir los datos.
        if (error.status === 401 || error.status === 403) {
          this.manejarError(error, 'No tienes autorización.');

          return;
        }

        // Mostrar errores de Flask junto
        // al botón de guardar.
        const mensajeServidor =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible guardar el producto.';

        this.errorFormulario.set(mensajeServidor);
      },
    });
  }

  // ========================================================
  // 14. SOLICITAR CAMBIO DE ESTADO
  // ========================================================

  solicitarCambioEstado(producto: ProductoAdmin): void {
    this.error.set('');
    this.mensaje.set('');

    this.productoPendiente.set(producto);
  }

  // ========================================================
  // 15. CANCELAR CAMBIO DE ESTADO
  // ========================================================

  cancelarCambioEstado(): void {
    if (this.guardando()) {
      return;
    }

    this.productoPendiente.set(null);
  }

  // ========================================================
  // 16. CONFIRMAR CAMBIO DE ESTADO
  // ========================================================

  confirmarCambioEstado(): void {
    const producto = this.productoPendiente();

    if (!producto || this.guardando()) {
      return;
    }

    this.guardando.set(true);

    const nuevoEstado = !producto.activo;

    this.api.cambiarEstado(producto.id_producto, nuevoEstado).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.productoPendiente.set(null);

        this.mensaje.set(respuesta.message);

        this.cargarProductos();
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.productoPendiente.set(null);

        this.manejarError(error, 'No fue posible cambiar el estado.');
      },
    });
  }

  // ========================================================
  // 17. MANEJAR ERRORES HTTP
  // ========================================================

  private manejarError(error: HttpErrorResponse, mensajePredeterminado: string): void {
    console.error('Error administrativo de productos:', error);

    // No existe JWT válido.
    if (error.status === 401) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/login');

      return;
    }

    // Usuario sin permisos ADMIN.
    if (error.status === 403) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/');

      return;
    }

    const mensajeServidor = typeof error.error?.message === 'string' ? error.error.message : null;

    this.error.set(mensajeServidor ?? mensajePredeterminado);
  }

  // ========================================================
  // 18. CERRAR SESIÓN
  // ========================================================

  cerrarSesion(): void {
    this.auth.cerrarSesion();

    this.router.navigateByUrl('/login');
  }
}
