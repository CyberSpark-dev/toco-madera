import { mensajeNotificable } from '../../core/services/notificaciones';
import { mensajeError } from '../../core/utils/mensajes';
/**
 * ==========================================================
 * TOCO MADERA - ADMINISTRACIÓN DE MATERIAS PRIMAS
 * Archivo: admin/materiales/materiales.ts
 * ETAPA 3.16
 * ==========================================================
 *
 * FUNCIONES:
 * 1. Listar materiales.
 * 2. Consultar unidades de medida.
 * 3. Buscar y filtrar materiales.
 * 4. Registrar materiales nuevos.
 * 5. Editar materiales existentes.
 * 6. Activar o desactivar materiales.
 * 7. Controlar formularios con Signals.
 * 8. Manejar errores de Flask y JWT.
 *
 * IMPORTANTE:
 * stock_minimo es un umbral de reabastecimiento.
 * No representa las existencias físicas actuales.
 * ==========================================================
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminMateriales,
  MaterialAdmin,
  MaterialFormulario,
  UnidadMedida,
} from '../../core/services/admin-materiales';

import { Auth } from '../../core/services/auth';
import { formatearCantidad } from '../../core/utils/cantidades';

@Component({
  selector: 'app-materiales-admin',
  standalone: true,

  imports: [FormsModule],

  templateUrl: './materiales.html',
  styleUrl: './materiales.css',
})
export class MaterialesAdmin implements OnInit {
  // ========================================================
  // 1. SERVICIOS
  // ========================================================

  private readonly api = inject(AdminMateriales);

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  // ========================================================
  // 2. DATOS DEL BACKEND
  // ========================================================

  readonly materiales = signal<MaterialAdmin[]>([]);

  readonly unidades = signal<UnidadMedida[]>([]);

  // ========================================================
  // 3. ESTADOS DE LA INTERFAZ
  // ========================================================

  readonly cargando = signal(true);

  readonly cargandoUnidades = signal(true);

  readonly guardando = signal(false);

  readonly error = mensajeNotificable('error');

  readonly errorUnidades = signal('');

  readonly errorFormulario = mensajeNotificable('error');

  readonly mensaje = mensajeNotificable('exito');

  // ========================================================
  // 4. BÚSQUEDA Y FILTROS
  // ========================================================

  readonly busqueda = signal('');

  readonly filtroEstado = signal('TODOS');

  // ========================================================
  // 5. CONTROL DEL FORMULARIO
  // ========================================================

  readonly mostrarFormulario = signal(false);

  // null = registrar; número = editar.
  readonly editandoId = signal<number | null>(null);

  // Material seleccionado para cambiar su estado.
  readonly materialPendiente = signal<MaterialAdmin | null>(null);

  // ========================================================
  // 6. FORMULARIO INICIAL
  // ========================================================

  formulario: MaterialFormulario = {
    sku: '',
    nombre: '',
    descripcion: '',
    id_unidad: 0,
    stock_minimo: '0.0000',
  };

  // ========================================================
  // 7. PRODUCTOS FILTRADOS
  // ========================================================

  readonly materialesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();

    const estado = this.filtroEstado();

    return this.materiales().filter((material) => {
      // Buscar por nombre, SKU y descripción.
      const coincideTexto = [material.nombre, material.sku, material.descripcion ?? ''].some(
        (campo) => campo.toLocaleLowerCase().includes(texto),
      );

      // Verificar el filtro de estado.
      const coincideEstado =
        estado === 'TODOS' ||
        (estado === 'ACTIVOS' && material.activo) ||
        (estado === 'INACTIVOS' && !material.activo);

      return coincideTexto && coincideEstado;
    });
  });

  // ========================================================
  // 8. INICIALIZAR COMPONENTE
  // ========================================================

  ngOnInit(): void {
    this.cargarMateriales();

    this.cargarUnidades();
  }

  // ========================================================
  // 9. CONSULTAR MATERIALES
  // ========================================================

  cargarMateriales(): void {
    this.cargando.set(true);

    this.error.set('');

    this.api.listarMateriales().subscribe({
      next: (respuesta) => {
        this.materiales.set(respuesta.materiales);

        this.cargando.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);

        this.manejarError(error, 'No fue posible cargar los materiales.');
      },
    });
  }

  // ========================================================
  // 10. CONSULTAR UNIDADES DE MEDIDA
  // ========================================================

  cargarUnidades(): void {
    this.cargandoUnidades.set(true);

    this.errorUnidades.set('');

    this.api.listarUnidades().subscribe({
      next: (respuesta) => {
        this.unidades.set(respuesta.unidades);

        this.cargandoUnidades.set(false);

        if (respuesta.unidades.length === 0) {
          this.errorUnidades.set('No existen unidades de medida disponibles.');
        }
      },

      error: (error: HttpErrorResponse) => {
        this.cargandoUnidades.set(false);

        this.unidades.set([]);

        if (error.status === 401 || error.status === 403) {
          this.manejarError(error, 'No tienes permisos para consultar unidades.');

          return;
        }

        const detalle =
          mensajeError(error, 'Inténtalo nuevamente.');

        this.errorUnidades.set('No se pudieron consultar las unidades. ' + detalle);
      },
    });
  }

  // ========================================================
  // 11. OBTENER EL NOMBRE DE UNA UNIDAD
  // ========================================================

  nombreUnidad(idUnidad: number): string {
    const unidad = this.unidades().find((item) => item.id_unidad === idUnidad);

    return unidad?.nombre ?? `Unidad ${idUnidad}`;
  }

  cantidadTexto(valor: string, idUnidad: number) {
    return formatearCantidad(valor, this.nombreUnidad(idUnidad));
  }

  // ========================================================
  // 12. DESPLAZARSE AL FORMULARIO
  // ========================================================

  private irAlFormulario(): void {
    // Esperar a que Angular inserte la sección
    // dentro del DOM mediante @if.
    setTimeout(() => {
      document.getElementById('formulario-material')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  // ========================================================
  // 13. ABRIR FORMULARIO NUEVO
  // ========================================================

  nuevoMaterial(): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');
    this.errorFormulario.set('');

    // Impedir registrar sin unidades disponibles.
    if (this.unidades().length === 0) {
      this.errorUnidades.set(
        'No hay unidades disponibles. ' + 'Utiliza el botón Reintentar unidades.',
      );

      return;
    }

    // Indicar que es un registro nuevo.
    this.editandoId.set(null);

    // Restaurar los campos del formulario.
    this.formulario = {
      sku: '',
      nombre: '',
      descripcion: '',
      id_unidad: this.unidades()[0].id_unidad,
      stock_minimo: '0.0000',
    };

    this.mostrarFormulario.set(true);

    this.irAlFormulario();
  }

  // ========================================================
  // 14. ABRIR FORMULARIO DE EDICIÓN
  // ========================================================

  editarMaterial(material: MaterialAdmin): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');
    this.errorFormulario.set('');

    // Guardar el ID que recibimos de MySQL.
    this.editandoId.set(material.id_material);

    // Crear una copia de los datos editables.
    this.formulario = {
      sku: material.sku,
      nombre: material.nombre,
      descripcion: material.descripcion ?? '',
      id_unidad: Number(material.id_unidad),
      stock_minimo: String(material.stock_minimo),
    };

    this.mostrarFormulario.set(true);

    this.irAlFormulario();
  }

  // ========================================================
  // 15. CERRAR FORMULARIO
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
  // 16. REGISTRAR O EDITAR MATERIAL
  // ========================================================

  guardarMaterial(): void {
    if (this.guardando()) {
      return;
    }

    this.errorFormulario.set('');
    this.mensaje.set('');

    // ----------------------------------------------------
    // VALIDAR SKU
    // ----------------------------------------------------

    const sku = this.formulario.sku.trim().toUpperCase();

    if (!/^[A-Z0-9_-]{2,40}$/.test(sku)) {
      this.errorFormulario.set(
        'El SKU debe tener entre 2 y 40 caracteres. ' + 'Solo admite letras, números y guiones.',
      );

      return;
    }

    // ----------------------------------------------------
    // VALIDAR NOMBRE
    // ----------------------------------------------------

    const nombre = this.formulario.nombre.trim();

    if (nombre.length < 2 || nombre.length > 150) {
      this.errorFormulario.set('El nombre debe tener entre 2 y 150 caracteres.');

      return;
    }

    // ----------------------------------------------------
    // VALIDAR DESCRIPCIÓN
    // ----------------------------------------------------

    const descripcion = this.formulario.descripcion?.trim() || null;

    if (descripcion !== null && descripcion.length > 250) {
      this.errorFormulario.set('La descripción no puede superar 250 caracteres.');

      return;
    }

    // ----------------------------------------------------
    // VALIDAR UNIDAD DE MEDIDA
    // ----------------------------------------------------

    const idUnidad = Number(this.formulario.id_unidad);

    const existeUnidad = this.unidades().some((unidad) => unidad.id_unidad === idUnidad);

    if (!existeUnidad) {
      this.errorFormulario.set('Selecciona una unidad de medida válida.');

      return;
    }

    // ----------------------------------------------------
    // VALIDAR STOCK MÍNIMO
    // ----------------------------------------------------

    const stockTexto = this.formulario.stock_minimo.trim();

    const stockNumero = Number(stockTexto);

    // DECIMAL(14,4): hasta 10 dígitos enteros
    // y máximo cuatro decimales.
    if (
      !/^\d{1,10}(\.\d{1,4})?$/.test(stockTexto) ||
      !Number.isFinite(stockNumero) ||
      stockNumero < 0 ||
      stockNumero > 9999999999.9999
    ) {
      this.errorFormulario.set(
        'El stock mínimo debe ser no negativo, ' + 'con máximo cuatro decimales.',
      );

      return;
    }

    // ----------------------------------------------------
    // PREPARAR DATOS PARA FLASK
    // ----------------------------------------------------

    const datos: MaterialFormulario = {
      sku: sku,

      nombre: nombre,

      descripcion: descripcion,

      id_unidad: idUnidad,

      stock_minimo: stockTexto,
    };

    // ----------------------------------------------------
    // DECIDIR ENTRE POST Y PUT
    // ----------------------------------------------------

    this.guardando.set(true);

    const idMaterial = this.editandoId();

    const operacion =
      idMaterial === null
        ? this.api.registrarMaterial(datos)
        : this.api.editarMaterial(idMaterial, datos);

    // ----------------------------------------------------
    // EJECUTAR PETICIÓN HTTP
    // ----------------------------------------------------

    operacion.subscribe({
      next: (respuesta) => {
        this.guardando.set(false);

        this.mostrarFormulario.set(false);

        this.editandoId.set(null);

        this.errorFormulario.set('');

        this.mensaje.set(idMaterial === null ? 'Material registrado correctamente.' : 'Los cambios se guardaron correctamente.');

        // Obtener nuevamente los datos desde MySQL.
        this.cargarMateriales();

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        // Manejar autenticación.
        if (error.status === 401 || error.status === 403) {
          this.manejarError(error, 'Acceso administrativo denegado.');

          return;
        }

        // Mantener el formulario abierto.
        const mensajeServidor =
          mensajeError(error, 'No fue posible guardar el material.');

        this.errorFormulario.set(mensajeServidor);
      },
    });
  }

  // ========================================================
  // 17. SOLICITAR CAMBIO DE ESTADO
  // ========================================================

  solicitarCambioEstado(material: MaterialAdmin): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');

    this.materialPendiente.set(material);
  }

  // ========================================================
  // 18. CANCELAR CAMBIO DE ESTADO
  // ========================================================

  cancelarCambioEstado(): void {
    if (this.guardando()) {
      return;
    }

    this.materialPendiente.set(null);
  }

  // ========================================================
  // 19. CONFIRMAR CAMBIO DE ESTADO
  // ========================================================

  confirmarCambioEstado(): void {
    const material = this.materialPendiente();

    if (!material || this.guardando()) {
      return;
    }

    this.guardando.set(true);

    // Invertir estado.
    const nuevoEstado = !material.activo;

    this.api.cambiarEstado(material.id_material, nuevoEstado).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);

        this.materialPendiente.set(null);

        this.mensaje.set(nuevoEstado ? 'Material activado correctamente.' : 'Material desactivado correctamente.');

        this.cargarMateriales();
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        this.materialPendiente.set(null);

        this.manejarError(error, 'No fue posible cambiar el estado del material.');
      },
    });
  }

  // ========================================================
  // 20. CONTROL CENTRALIZADO DE ERRORES
  // ========================================================

  private manejarError(error: HttpErrorResponse, mensajePredeterminado: string): void {
    console.error('Error en administración de materiales:', error);

    if (error.status === 401) {
      // Token inválido o expirado.
      this.auth.cerrarSesion();

      this.router.navigateByUrl('/login');

      return;
    }

    if (error.status === 403) {
      // Usuario sin permisos administrativos.
      this.auth.cerrarSesion();

      this.router.navigateByUrl('/');

      return;
    }

    this.error.set(mensajeError(error, mensajePredeterminado));
  }

  // ========================================================
  // 21. CERRAR SESIÓN
  // ========================================================

  cerrarSesion(): void {
    this.auth.cerrarSesion();

    this.router.navigateByUrl('/login');
  }
}
