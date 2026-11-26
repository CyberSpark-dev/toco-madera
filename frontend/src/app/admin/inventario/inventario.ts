import { mensajeError } from '../../core/utils/mensajes';
/**
 * ======================================================
 * TOCO MADERA - ADMINISTRACIÓN DE INVENTARIO
 * Archivo: admin/inventario/inventario.ts
 * ETAPA 3.17.6
 * ======================================================
 *
 * - Consulta existencias por materia prima.
 * - Señala materiales por debajo del stock mínimo.
 * - Permite buscar y filtrar materiales.
 * - Consulta historial de movimientos.
 * - Filtra movimientos por material seleccionado.
 *
 * No modifica cantidades ni crea ajustes.
 * ======================================================
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminInventario,
  ExistenciaMaterial,
  MovimientoMaterial,
} from '../../core/services/admin-inventario';

import { AdminMateriales, UnidadMedida } from '../../core/services/admin-materiales';
import { Auth } from '../../core/services/auth';
import { formatearCantidad } from '../../core/utils/cantidades';

@Component({
  selector: 'app-inventario-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './inventario.html',
  styleUrl: './inventario.css',
})
export class InventarioAdmin implements OnInit {
  // ====================================================
  // 1. SERVICIOS
  // ====================================================

  private readonly inventarioApi = inject(AdminInventario);
  private readonly materialesApi = inject(AdminMateriales);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // ====================================================
  // 2. DATOS
  // ====================================================

  readonly inventario = signal<ExistenciaMaterial[]>([]);
  readonly movimientos = signal<MovimientoMaterial[]>([]);
  readonly unidades = signal<UnidadMedida[]>([]);
  readonly unidadesPorMaterial = computed(
    () => new Map(this.inventario().map((material) => [material.id_material, material.id_unidad])),
  );

  // ====================================================
  // 3. ESTADO DE CARGA Y ERRORES
  // ====================================================

  readonly cargandoInventario = signal(true);
  readonly cargandoMovimientos = signal(true);
  readonly errorInventario = signal('');
  readonly errorMovimientos = signal('');
  readonly errorUnidades = signal('');

  // ====================================================
  // 4. FILTROS
  // ====================================================

  readonly busqueda = signal('');
  readonly filtroStock = signal('TODOS');
  readonly materialSeleccionado = signal<number | null>(null);

  // ====================================================
  // 5. ESTADÍSTICAS
  // ====================================================

  readonly totalMateriales = computed(() => this.inventario().length);

  readonly totalAlertas = computed(() => this.inventario().filter((m) => m.bajo_minimo).length);

  readonly sinExistencia = computed(
    () => this.inventario().filter((m) => Number(m.existencia) <= 0).length,
  );

  // ====================================================
  // 6. INVENTARIO FILTRADO
  // ====================================================

  readonly inventarioFiltrado = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();

    const filtro = this.filtroStock();

    return this.inventario().filter((material) => {
      const coincideTexto =
        material.sku.toLocaleLowerCase().includes(texto) ||
        material.nombre.toLocaleLowerCase().includes(texto);

      const coincideEstado =
        filtro === 'TODOS' ||
        (filtro === 'BAJO_MINIMO' && material.bajo_minimo) ||
        (filtro === 'SIN_EXISTENCIA' && Number(material.existencia) <= 0) ||
        (filtro === 'ACTIVOS' && material.activo);

      return coincideTexto && coincideEstado;
    });
  });

  // ====================================================
  // 7. INICIALIZAR
  // ====================================================

  ngOnInit(): void {
    this.cargarInventario();
    this.cargarMovimientos();
    this.cargarUnidades();
  }

  // ====================================================
  // 8. CONSULTAR EXISTENCIAS
  // ====================================================

  cargarInventario(): void {
    this.cargandoInventario.set(true);
    this.errorInventario.set('');

    this.inventarioApi.listarInventario().subscribe({
      next: (respuesta) => {
        this.inventario.set(respuesta.inventario);
        this.cargandoInventario.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargandoInventario.set(false);

        if (!this.manejarAutenticacion(error)) {
          this.errorInventario.set(
            this.obtenerMensaje(error, 'No fue posible consultar el inventario.'),
          );
        }
      },
    });
  }

  // ====================================================
  // 9. CONSULTAR MOVIMIENTOS
  // ====================================================

  cargarMovimientos(): void {
    this.cargandoMovimientos.set(true);
    this.errorMovimientos.set('');

    this.inventarioApi.listarMovimientos(this.materialSeleccionado(), 100).subscribe({
      next: (respuesta) => {
        this.movimientos.set(respuesta.movimientos);
        this.cargandoMovimientos.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargandoMovimientos.set(false);

        if (!this.manejarAutenticacion(error)) {
          this.errorMovimientos.set(
            this.obtenerMensaje(error, 'No fue posible consultar movimientos.'),
          );
        }
      },
    });
  }

  // ====================================================
  // 10. CONSULTAR UNIDADES DE MEDIDA
  // ====================================================

  cargarUnidades(): void {
    this.errorUnidades.set('');

    this.materialesApi.listarUnidades().subscribe({
      next: (respuesta) => {
        this.unidades.set(respuesta.unidades);
      },

      error: (error: HttpErrorResponse) => {
        if (!this.manejarAutenticacion(error)) {
          this.errorUnidades.set('No se pudieron consultar las unidades de medida.');
        }
      },
    });
  }

  // ====================================================
  // 11. FILTRAR MOVIMIENTOS POR MATERIAL
  // ====================================================

  seleccionarMaterial(idMaterial: number): void {
    this.materialSeleccionado.set(idMaterial);
    this.cargarMovimientos();

    setTimeout(() => {
      document.getElementById('historial-movimientos')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  // ====================================================
  // 12. QUITAR FILTRO DE MOVIMIENTOS
  // ====================================================

  mostrarTodosMovimientos(): void {
    this.materialSeleccionado.set(null);
    this.cargarMovimientos();
  }

  // ====================================================
  // 13. CONSULTAR NOMBRE DE LA UNIDAD
  // ====================================================

  nombreUnidad(idUnidad: number): string {
    const unidad = this.unidades().find((item) => item.id_unidad === idUnidad);

    return unidad?.nombre ?? `Unidad ${idUnidad}`;
  }

  // ====================================================
  // 14. FORMATEO DE CANTIDADES
  // ====================================================

  cantidadTexto(valor: string, idUnidad?: number, mostrarSignoPositivo = false) {
    const negativo = valor.startsWith('-');
    const magnitud = negativo ? valor.slice(1) : valor;
    const unidad = idUnidad === undefined ? '' : this.nombreUnidad(idUnidad);
    const cantidad = formatearCantidad(magnitud, unidad);
    const signo = negativo ? '-' : mostrarSignoPositivo && Number(valor) > 0 ? '+' : '';
    const aviso = cantidad.aviso?.replace(`Valor registrado: ${magnitud}.`, `Valor registrado: ${valor}.`);

    if (cantidad.texto === '< 0.01') {
      return { texto: negativo ? '> -0.01' : cantidad.texto, aviso };
    }

    const texto = cantidad.texto.replace(/^(≈ )?/, (_, aproximacion = '') => aproximacion + signo);
    return { texto, aviso };
  }

  // ====================================================
  // 15. CONTROL DE ERRORES
  // ====================================================

  private obtenerMensaje(error: HttpErrorResponse, predeterminado: string): string {
    return mensajeError(error, predeterminado);
  }

  private manejarAutenticacion(error: HttpErrorResponse): boolean {
    if (error.status === 401) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/login');
      return true;
    }

    if (error.status === 403) {
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/');
      return true;
    }

    return false;
  }

  // ====================================================
  // 16. CERRAR SESIÓN
  // ====================================================

  cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
