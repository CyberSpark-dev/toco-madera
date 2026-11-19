/**
 * ======================================================
 * TOCO MADERA - GESTIÓN DE RECETAS
 * Archivo: admin/recetas/recetas.ts
 * Etapa 3.17.7
 * ======================================================
 *
 * - Consultar recetas vigentes e históricas.
 * - Crear una primera receta o una nueva versión.
 * - Copiar datos de una versión existente.
 * - Activar versiones anteriores.
 * - Validar ingredientes y costos.
 *
 * No genera movimientos de inventario.
 * ======================================================
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminRecetas,
  RecetaAdmin,
  RecetaFormulario,
  ProductoReceta,
  MaterialRecetaCatalogo,
} from '../../core/services/admin-recetas';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-recetas-admin',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './recetas.html',
  styleUrl: './recetas.css',
})
export class RecetasAdmin implements OnInit {
  // ====================================================
  // 1. SERVICIOS
  // ====================================================

  private readonly api = inject(AdminRecetas);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // ====================================================
  // 2. REGISTROS
  // ====================================================

  readonly recetas = signal<RecetaAdmin[]>([]);
  readonly productos = signal<ProductoReceta[]>([]);
  readonly materiales = signal<MaterialRecetaCatalogo[]>([]);

  // ====================================================
  // 3. CONTROL DE INTERFAZ
  // ====================================================

  readonly cargando = signal(true);
  readonly cargandoCatalogos = signal(true);
  readonly guardando = signal(false);

  readonly error = signal('');
  readonly mensaje = signal('');

  readonly mostrarFormulario = signal(false);

  readonly filtroProducto = signal<number>(0);
  readonly filtroVigencia = signal('TODAS');

  // Receta cuya activación debe confirmarse.
  readonly recetaPendiente = signal<RecetaAdmin | null>(null);

  // ====================================================
  // 4. FORMULARIO
  // ====================================================

  formulario: RecetaFormulario = this.formularioVacio();

  private formularioVacio(): RecetaFormulario {
    return {
      id_producto: 0,
      minutos_fabricacion: 0,
      minutos_grabado: 0,
      costo_hora_mano_obra: '0.00',
      costo_indirecto_unitario: '0.00',
      observaciones: '',
      materiales: [
        {
          id_material: 0,
          cantidad: '1.0000',
        },
      ],
    };
  }

  // ====================================================
  // 5. FILTROS Y CONTEOS
  // ====================================================

  readonly productosActivos = computed(() => this.productos().filter((p) => p.activo));

  readonly materialesActivos = computed(() => this.materiales().filter((m) => m.activo));

  readonly recetasFiltradas = computed(() => {
    const producto = this.filtroProducto();
    const vigencia = this.filtroVigencia();

    return this.recetas().filter((receta) => {
      const coincideProducto = producto === 0 || receta.id_producto === producto;

      const coincideVigencia =
        vigencia === 'TODAS' ||
        (vigencia === 'VIGENTES' && receta.vigente) ||
        (vigencia === 'HISTORICAS' && !receta.vigente);

      return coincideProducto && coincideVigencia;
    });
  });

  readonly vigentes = computed(() => this.recetas().filter((r) => r.vigente).length);

  // ====================================================
  // 6. INICIALIZAR
  // ====================================================

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarRecetas();
  }

  // ====================================================
  // 7. CONSULTAR RECETAS
  // ====================================================

  cargarRecetas(): void {
    this.cargando.set(true);
    this.error.set('');

    this.api.listar().subscribe({
      next: (respuesta) => {
        this.recetas.set(respuesta.recetas);
        this.cargando.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.manejarError(error, 'No fue posible consultar las recetas.');
      },
    });
  }

  // ====================================================
  // 8. CONSULTAR PRODUCTOS Y MATERIALES
  // ====================================================

  cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);

    this.api.catalogos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.productos);
        this.materiales.set(respuesta.materiales);

        this.cargandoCatalogos.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargandoCatalogos.set(false);

        this.manejarError(error, 'No fue posible consultar productos y materiales.');
      },
    });
  }

  // ====================================================
  // 9. ABRIR FORMULARIO VACÍO
  // ====================================================

  nuevaReceta(): void {
    if (this.guardando()) return;

    this.error.set('');
    this.mensaje.set('');

    if (this.productosActivos().length === 0 || this.materialesActivos().length === 0) {
      this.error.set('Necesitas productos y materiales activos.');
      return;
    }

    this.formulario = this.formularioVacio();

    this.formulario.id_producto = this.productosActivos()[0].id_producto;

    this.formulario.materiales[0].id_material = this.materialesActivos()[0].id_material;

    this.mostrarFormulario.set(true);
    this.irAlFormulario();
  }

  // ====================================================
  // 10. CREAR NUEVA VERSIÓN DESDE UNA RECETA
  // ====================================================

  copiarReceta(receta: RecetaAdmin): void {
    if (this.guardando()) return;

    const productoActivo = this.productosActivos().some(
      (p) => p.id_producto === receta.id_producto,
    );

    if (!productoActivo) {
      this.error.set('No puedes crear recetas nuevas para productos inactivos.');
      return;
    }

    const materialInactivo = receta.materiales.some(
      (ingrediente) =>
        !this.materialesActivos().some((m) => m.id_material === ingrediente.id_material),
    );

    if (materialInactivo) {
      this.error.set(
        'Esta receta utiliza materiales inactivos. ' +
          'Actívalos o crea una versión usando materiales disponibles.',
      );
      return;
    }

    this.error.set('');
    this.mensaje.set('');

    this.formulario = {
      id_producto: receta.id_producto,
      minutos_fabricacion: receta.minutos_fabricacion,
      minutos_grabado: receta.minutos_grabado,
      costo_hora_mano_obra: String(receta.costo_hora_mano_obra),
      costo_indirecto_unitario: String(receta.costo_indirecto_unitario),
      observaciones: receta.observaciones ?? '',
      materiales: receta.materiales.map((item) => ({
        id_material: item.id_material,
        cantidad: String(item.cantidad),
      })),
    };

    this.mostrarFormulario.set(true);
    this.irAlFormulario();
  }

  // ====================================================
  // 11. DESPLAZAR AL FORMULARIO
  // ====================================================

  private irAlFormulario(): void {
    setTimeout(() => {
      document.getElementById('formulario-receta')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  // ====================================================
  // 12. GESTIONAR INGREDIENTES
  // ====================================================

  agregarMaterial(): void {
    if (this.formulario.materiales.length >= 100) {
      return;
    }

    this.formulario.materiales.push({
      id_material: 0,
      cantidad: '1.0000',
    });
  }

  quitarMaterial(indice: number): void {
    if (this.formulario.materiales.length <= 1) {
      return;
    }

    this.formulario.materiales.splice(indice, 1);
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;

    this.mostrarFormulario.set(false);
  }

  // ====================================================
  // 13. VALIDAR FORMULARIO
  // ====================================================

  private validarFormulario(): string | null {
    const f = this.formulario;

    if (!this.productosActivos().some((p) => p.id_producto === f.id_producto)) {
      return 'Selecciona un producto activo.';
    }

    for (const minutos of [f.minutos_fabricacion, f.minutos_grabado]) {
      if (!Number.isInteger(minutos) || minutos < 0 || minutos > 65535) {
        return 'Los tiempos deben ser enteros entre 0 y 65535.';
      }
    }

    const dineroValido = (valor: string) =>
      /^\d{1,10}(\.\d{1,2})?$/.test(valor.trim()) && Number.isFinite(Number(valor));

    if (!dineroValido(f.costo_hora_mano_obra) || !dineroValido(f.costo_indirecto_unitario)) {
      return 'Los costos deben ser no negativos ' + 'y admitir máximo dos decimales.';
    }

    if ((f.observaciones ?? '').length > 300) {
      return 'Las observaciones admiten máximo 300 caracteres.';
    }

    if (f.materiales.length < 1 || f.materiales.length > 100) {
      return 'La receta necesita entre 1 y 100 materiales.';
    }

    const ids = new Set<number>();

    for (const item of f.materiales) {
      const materialActivo = this.materialesActivos().some(
        (m) => m.id_material === item.id_material,
      );

      if (!materialActivo) {
        return 'Selecciona materiales activos.';
      }

      if (ids.has(item.id_material)) {
        return 'No puedes repetir un material en la receta.';
      }

      ids.add(item.id_material);

      const cantidad = item.cantidad.trim();

      if (
        !/^\d{1,10}(\.\d{1,4})?$/.test(cantidad) ||
        !Number.isFinite(Number(cantidad)) ||
        Number(cantidad) <= 0 ||
        Number(cantidad) > 9999999999.9999
      ) {
        return 'Las cantidades deben ser mayores que cero ' + 'y admitir máximo cuatro decimales.';
      }
    }

    return null;
  }

  // ====================================================
  // 14. GUARDAR NUEVA VERSIÓN
  // ====================================================

  guardarReceta(): void {
    if (this.guardando()) return;

    this.error.set('');
    this.mensaje.set('');

    const mensajeValidacion = this.validarFormulario();

    if (mensajeValidacion) {
      this.error.set(mensajeValidacion);
      return;
    }

    // Construir copia de los datos de la receta.
    const datos: RecetaFormulario = {
      id_producto: Number(this.formulario.id_producto),
      minutos_fabricacion: Number(this.formulario.minutos_fabricacion),
      minutos_grabado: Number(this.formulario.minutos_grabado),
      costo_hora_mano_obra: this.formulario.costo_hora_mano_obra.trim(),
      costo_indirecto_unitario: this.formulario.costo_indirecto_unitario.trim(),
      observaciones: this.formulario.observaciones?.trim() || null,
      materiales: this.formulario.materiales.map((item) => ({
        id_material: Number(item.id_material),
        cantidad: item.cantidad.trim(),
      })),
    };

    this.guardando.set(true);

    this.api.crearVersion(datos).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);

        this.mensaje.set(respuesta.message);
        this.cargarRecetas();

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        this.manejarError(error, 'No fue posible guardar la receta.');
      },
    });
  }

  // ====================================================
  // 15. ACTIVACIÓN DE VERSIONES
  // ====================================================

  solicitarActivacion(receta: RecetaAdmin): void {
    if (receta.vigente || this.guardando()) return;

    this.recetaPendiente.set(receta);
  }

  cancelarActivacion(): void {
    if (this.guardando()) return;

    this.recetaPendiente.set(null);
  }

  confirmarActivacion(): void {
    const receta = this.recetaPendiente();

    if (!receta || this.guardando()) return;

    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');

    this.api.activar(receta.id_receta).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.recetaPendiente.set(null);

        this.mensaje.set(respuesta.message);
        this.cargarRecetas();
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.recetaPendiente.set(null);

        this.manejarError(error, 'No fue posible activar esta versión.');
      },
    });
  }

  // ====================================================
  // 16. FUNCIONES DE PRESENTACIÓN
  // ====================================================

  nombreProducto(idProducto: number): string {
    return (
      this.productos().find((p) => p.id_producto === idProducto)?.nombre ?? `Producto ${idProducto}`
    );
  }

  nombreMaterial(idMaterial: number): string {
    return (
      this.materiales().find((m) => m.id_material === idMaterial)?.nombre ??
      `Material ${idMaterial}`
    );
  }

  // Costo por unidad usando los tiempos registrados.
  // No incluye costo de materias primas.
  costoProceso(receta: RecetaAdmin): number {
    const minutos = receta.minutos_fabricacion + receta.minutos_grabado;

    return (
      (minutos / 60) * Number(receta.costo_hora_mano_obra) + Number(receta.costo_indirecto_unitario)
    );
  }

  // ====================================================
  // 17. ERRORES Y SEGURIDAD
  // ====================================================

  private manejarError(error: HttpErrorResponse, predeterminado: string): void {
    console.error('Error en recetas:', error);

    if (error.status === 401) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/login');
      return;
    }

    if (error.status === 403) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/');
      return;
    }

    this.error.set(typeof error.error?.message === 'string' ? error.error.message : predeterminado);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
