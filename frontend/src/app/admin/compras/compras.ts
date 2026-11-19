/**
 * ======================================================
 * TOCO MADERA - COMPONENTE DE COMPRAS
 * Archivo: admin/compras/compras.ts
 * ETAPA 3.17
 * ======================================================
 *
 * Integra:
 * - Proveedores existentes.
 * - Materias primas existentes.
 * - Registro de compras.
 * - Detalles y total.
 * - Recepción de materiales.
 * - Cancelación de borradores.
 *
 * IMPORTANTE:
 * Registrar una compra NO aumenta inventario.
 * Solamente recibirla genera movimientos.
 * ======================================================
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminCompras,
  CompraAdmin,
  CompraFormulario,
  DetalleCompraFormulario,
} from '../../core/services/admin-compras';

import { AdminMateriales, MaterialAdmin } from '../../core/services/admin-materiales';

import { AdminProveedores, ProveedorAdmin } from '../../core/services/admin-proveedores';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-compras-admin',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './compras.html',
  styleUrl: './compras.css',
})
export class ComprasAdmin implements OnInit {
  // ====================================================
  // 1. SERVICIOS
  // ====================================================

  private readonly comprasApi = inject(AdminCompras);
  private readonly materialesApi = inject(AdminMateriales);
  private readonly proveedoresApi = inject(AdminProveedores);

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // ====================================================
  // 2. REGISTROS
  // ====================================================

  readonly compras = signal<CompraAdmin[]>([]);
  readonly materiales = signal<MaterialAdmin[]>([]);
  readonly proveedores = signal<ProveedorAdmin[]>([]);

  // ====================================================
  // 3. ESTADO DE LA INTERFAZ
  // ====================================================

  readonly cargando = signal(true);
  readonly guardando = signal(false);

  readonly cargandoCatalogos = signal(true);
  readonly errorCatalogos = signal('');

  readonly mensaje = signal('');
  readonly error = signal('');

  readonly mostrarFormulario = signal(false);

  readonly filtroEstado = signal('TODOS');
  readonly busqueda = signal('');

  // Acción pendiente de confirmación.
  readonly compraPendiente = signal<{
    compra: CompraAdmin;
    accion: 'RECIBIR' | 'CANCELAR';
  } | null>(null);

  // ====================================================
  // 4. FORMULARIO
  // ====================================================

  formulario: CompraFormulario = this.formularioVacio();

  private formularioVacio(): CompraFormulario {
    return {
      id_proveedor: 0,
      referencia_documento: '',
      observaciones: '',
      detalles: [
        {
          id_material: 0,
          cantidad: '1.0000',
          costo_unitario: '1.0000',
        },
      ],
    };
  }

  // ====================================================
  // 5. DATOS CALCULADOS
  // ====================================================

  readonly proveedoresActivos = computed(() => this.proveedores().filter((p) => Boolean(p.activo)));

  readonly materialesActivos = computed(() => this.materiales().filter((m) => Boolean(m.activo)));

  readonly comprasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();

    const estado = this.filtroEstado();

    return this.compras().filter((compra) => {
      const proveedor = this.nombreProveedor(compra.id_proveedor);

      const coincideTexto =
        String(compra.id_compra).includes(texto) ||
        proveedor.toLocaleLowerCase().includes(texto) ||
        (compra.referencia_documento ?? '').toLocaleLowerCase().includes(texto);

      const coincideEstado = estado === 'TODOS' || compra.estado === estado;

      return coincideTexto && coincideEstado;
    });
  });

  // ====================================================
  // 6. INICIALIZAR
  // ====================================================

  ngOnInit(): void {
    this.cargarCompras();
    this.cargarCatalogos();
  }

  // ====================================================
  // 7. CONSULTAR COMPRAS
  // ====================================================

  cargarCompras(): void {
    this.cargando.set(true);
    this.error.set('');

    this.comprasApi.listar().subscribe({
      next: (respuesta) => {
        this.compras.set(respuesta.compras);
        this.cargando.set(false);
      },

      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.manejarError(e, 'No fue posible consultar las compras.');
      },
    });
  }

  // ====================================================
  // 8. CONSULTAR MATERIALES Y PROVEEDORES
  // ====================================================

  cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set('');

    let solicitudesPendientes = 2;
    let ocurrioError = false;

    const terminar = () => {
      solicitudesPendientes--;

      if (solicitudesPendientes === 0) {
        this.cargandoCatalogos.set(false);

        if (ocurrioError) {
          this.errorCatalogos.set(
            'No se pudieron cargar todos los catálogos. ' + 'Presiona Reintentar catálogos.',
          );
        }
      }
    };

    // Materiales
    this.materialesApi.listarMateriales().subscribe({
      next: (respuesta) => {
        this.materiales.set(respuesta.materiales);
        terminar();
      },

      error: (e: HttpErrorResponse) => {
        ocurrioError = true;
        this.materiales.set([]);
        this.manejarAutenticacion(e);
        terminar();
      },
    });

    // Proveedores
    this.proveedoresApi.listarProveedores().subscribe({
      next: (respuesta) => {
        this.proveedores.set(respuesta.proveedores);
        terminar();
      },

      error: (e: HttpErrorResponse) => {
        ocurrioError = true;
        this.proveedores.set([]);
        this.manejarAutenticacion(e);
        terminar();
      },
    });
  }

  // ====================================================
  // 9. CONSULTAR NOMBRES DE LOS CATÁLOGOS
  // ====================================================

  nombreProveedor(id: number): string {
    return this.proveedores().find((p) => p.id_proveedor === id)?.nombre ?? `Proveedor ${id}`;
  }

  nombreMaterial(id: number): string {
    return this.materiales().find((m) => m.id_material === id)?.nombre ?? `Material ${id}`;
  }

  // ====================================================
  // 10. CREAR FORMULARIO
  // ====================================================

  nuevaCompra(): void {
    this.mensaje.set('');
    this.error.set('');

    if (this.proveedoresActivos().length === 0 || this.materialesActivos().length === 0) {
      this.error.set(
        'Necesitas un proveedor activo y al menos ' +
          'un material activo para registrar una compra.',
      );

      return;
    }

    this.formulario = this.formularioVacio();

    this.formulario.id_proveedor = this.proveedoresActivos()[0].id_proveedor;

    this.formulario.detalles[0].id_material = this.materialesActivos()[0].id_material;

    this.mostrarFormulario.set(true);

    setTimeout(() => {
      document.getElementById('formulario-compra')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  cerrarFormulario(): void {
    if (!this.guardando()) {
      this.mostrarFormulario.set(false);
    }
  }

  // ====================================================
  // 11. AGREGAR Y ELIMINAR RENGLONES
  // ====================================================

  agregarDetalle(): void {
    this.formulario.detalles.push({
      id_material: 0,
      cantidad: '1.0000',
      costo_unitario: '1.0000',
    });
  }

  quitarDetalle(indice: number): void {
    if (this.formulario.detalles.length <= 1) {
      return;
    }

    this.formulario.detalles.splice(indice, 1);
  }

  // ====================================================
  // 12. CÁLCULOS DE IMPORTES
  // ====================================================

  subtotalDetalle(detalle: DetalleCompraFormulario): number {
    const cantidad = Number(detalle.cantidad);
    const costo = Number(detalle.costo_unitario);

    if (!Number.isFinite(cantidad) || !Number.isFinite(costo)) {
      return 0;
    }

    return cantidad * costo;
  }

  totalFormulario(): number {
    return this.formulario.detalles.reduce(
      (suma, detalle) => suma + this.subtotalDetalle(detalle),
      0,
    );
  }

  // ====================================================
  // 13. VALIDAR FORMULARIO
  // ====================================================

  private validarFormulario(): string | null {
    if (this.formulario.id_proveedor <= 0) {
      return 'Selecciona un proveedor.';
    }

    if (!this.proveedoresActivos().some((p) => p.id_proveedor === this.formulario.id_proveedor)) {
      return 'El proveedor seleccionado no está activo.';
    }

    if (this.formulario.detalles.length === 0) {
      return 'Agrega al menos un material.';
    }

    if ((this.formulario.referencia_documento ?? '').length > 90) {
      return 'La referencia admite máximo 90 caracteres.';
    }

    if ((this.formulario.observaciones ?? '').length > 300) {
      return 'Las observaciones admiten máximo 300 caracteres.';
    }

    const ids = new Set<number>();

    // Validar DECIMAL(14,4) antes de enviar a Flask.
    const decimalValido = (valor: string) =>
      /^\d{1,10}(\.\d{1,4})?$/.test(valor.trim()) &&
      Number(valor) > 0 &&
      Number(valor) <= 9999999999.9999;

    for (const detalle of this.formulario.detalles) {
      if (!this.materialesActivos().some((m) => m.id_material === detalle.id_material)) {
        return 'Selecciona un material activo válido.';
      }

      if (ids.has(detalle.id_material)) {
        return 'No repitas un mismo material en la compra.';
      }

      ids.add(detalle.id_material);

      if (!decimalValido(detalle.cantidad)) {
        return 'La cantidad debe ser mayor que cero ' + 'y admitir máximo cuatro decimales.';
      }

      if (!decimalValido(detalle.costo_unitario)) {
        return 'El costo unitario debe ser mayor que cero ' + 'y admitir máximo cuatro decimales.';
      }
    }

    return null;
  }

  // ====================================================
  // 14. REGISTRAR COMPRA
  // ====================================================

  guardarCompra(): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');

    const errorValidacion = this.validarFormulario();

    if (errorValidacion) {
      this.error.set(errorValidacion);
      return;
    }

    this.guardando.set(true);

    // Enviar copia de los valores del formulario.
    const datos: CompraFormulario = {
      id_proveedor: Number(this.formulario.id_proveedor),
      referencia_documento: this.formulario.referencia_documento?.trim() || null,
      observaciones: this.formulario.observaciones?.trim() || null,
      detalles: this.formulario.detalles.map((d) => ({
        id_material: Number(d.id_material),
        cantidad: d.cantidad.trim(),
        costo_unitario: d.costo_unitario.trim(),
      })),
    };

    this.comprasApi.registrar(datos).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);

        this.mensaje.set(`Compra #${respuesta.compra.id_compra} ` + 'registrada en BORRADOR.');

        this.cargarCompras();

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      },

      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.manejarError(e, 'No fue posible registrar la compra.');
      },
    });
  }

  // ====================================================
  // 15. CONFIRMAR RECEPCIÓN O CANCELACIÓN
  // ====================================================

  solicitarAccion(compra: CompraAdmin, accion: 'RECIBIR' | 'CANCELAR'): void {
    if (compra.estado !== 'BORRADOR') {
      return;
    }

    this.compraPendiente.set({ compra, accion });
  }

  cancelarAccion(): void {
    if (!this.guardando()) {
      this.compraPendiente.set(null);
    }
  }

  confirmarAccion(): void {
    const pendiente = this.compraPendiente();

    if (!pendiente || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');

    const operacion =
      pendiente.accion === 'RECIBIR'
        ? this.comprasApi.recibir(pendiente.compra.id_compra)
        : this.comprasApi.cancelar(pendiente.compra.id_compra);

    operacion.subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.compraPendiente.set(null);
        this.mensaje.set(respuesta.message);
        this.cargarCompras();
      },

      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.compraPendiente.set(null);
        this.manejarError(e, 'No fue posible completar la operación.');
      },
    });
  }

  // ====================================================
  // 16. AUTENTICACIÓN Y ERRORES
  // ====================================================

  private manejarAutenticacion(e: HttpErrorResponse): boolean {
    if (e.status === 401) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/login');
      return true;
    }

    if (e.status === 403) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/');
      return true;
    }

    return false;
  }

  private manejarError(e: HttpErrorResponse, predeterminado: string): void {
    console.error('Error en compras:', e);

    if (this.manejarAutenticacion(e)) {
      return;
    }

    this.error.set(typeof e.error?.message === 'string' ? e.error.message : predeterminado);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
