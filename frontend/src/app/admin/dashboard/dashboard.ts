import { etiquetaPedido } from '../../core/utils/etiquetas-pedido';
import { formatearDinero } from '../../core/utils/dinero';
/**
 * ======================================================
 * TOCO MADERA - DASHBOARD ADMINISTRATIVO
 * Archivo: frontend/src/app/admin/dashboard/dashboard.ts
 * ======================================================
 *
 * FUNCIONES:
 *
 * 1. Consultar el estado del backend Flask.
 * 2. Obtener información del administrador.
 * 3. Mantener los indicadores comerciales.
 * 4. Mostrar la gráfica de ventas con Chart.js.
 * 5. Detectar sesiones inválidas o expiradas.
 * 6. Permitir cerrar sesión.
 * 7. Liberar los recursos de Chart.js.
 *
 * IMPORTANTE:
 * Conservamos los KPIs y la gráfica originales.
 * Los datos de ventas siguen siendo provisionales.
 * ======================================================
 */

// ======================================================
// 1. IMPORTACIONES DE ANGULAR
// ======================================================

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

// Herramienta para mostrar cantidades monetarias.

// Navegación del proyecto.
import { Router } from '@angular/router';

// Tipado de errores HTTP.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

// Biblioteca utilizada para generar gráficas.
import Chart from 'chart.js/auto';

// Servicio de comunicación con Flask.
import { Api } from '../../core/services/api';

// Servicio de autenticación JWT.
import { Auth } from '../../core/services/auth';

// Estructura del JSON publicado por Flask (/api/v1/dashboard/estadisticas).
interface EstadisticasDashboard {
  success: boolean;
  nota: string;
  kpis: {
    ventas_confirmadas: number;
    pedidos_pendientes: number;
    clientes_compradores: number;
    unidades_vendidas: number;
    pagos_simulados_aprobados: number;
  };
  ventas_por_dia: { fecha: string; monto: number }[];
  pedidos_por_estado: { estado: string; cantidad: number }[];
  productos_mas_vendidos: { id_producto: number; nombre: string; unidades: number }[];
}

// ======================================================
// 2. CONFIGURACIÓN DEL COMPONENTE
// ======================================================

@Component({
  selector: 'app-dashboard',

  // Componente independiente de Angular.
  standalone: true,

  // Archivos de presentación.
  templateUrl: './dashboard.html',

  styleUrl: './dashboard.css',
})

// ======================================================
// 3. CLASE PRINCIPAL
// ======================================================
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  readonly dinero = formatearDinero;
  // ====================================================
  // 4. SERVICIOS
  // ====================================================

  // Servicio para consultar la API Flask.
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);

  // Servicio de autenticación.
  //
  // Es público porque dashboard.html necesita
  // acceder al nombre del usuario autenticado.
  readonly auth = inject(Auth);

  // Servicio de navegación Angular.
  private readonly router = inject(Router);

  // ====================================================
  // 5. ESTADO DE CONEXIÓN CON FLASK
  // ====================================================

  estadoBackend = signal('Comprobando disponibilidad…');

  // ====================================================
  // 6. REFERENCIA A LA GRÁFICA CHART.JS
  // ====================================================

  // Localizar el elemento:
  // <canvas #ventasChart>
  @ViewChild('ventasChart')
  ventasCanvas?: ElementRef<HTMLCanvasElement>;

  // Guardar la instancia de Chart.js.
  private chart?: Chart;
  private estadosChart?: Chart;
  private productosChart?: Chart;
  @ViewChild('estadosChart') estadosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('productosChart') productosCanvas?: ElementRef<HTMLCanvasElement>;
  readonly cargandoEstadisticas = signal(true);
  readonly errorEstadisticas = signal('');
  readonly fechaEstadisticas = signal('');
  pagosSimulados = 0;

  // ====================================================
  // 7. INDICADORES COMERCIALES
  // ====================================================

  // Estos valores son temporales.
  //
  // Más adelante consultaremos estadísticas
  // reales desde MySQL mediante Flask.

  ventasConfirmadas = 0;

  pedidosPendientes = 0;

  clientesRegistrados = 0; // KPI visual: compradores distintos, no usuarios registrados

  productosVendidos = 0;

  // ====================================================
  // 8. INICIALIZAR DASHBOARD
  // ====================================================

  ngOnInit(): void {
    this.cargarEstadisticas();
    // Consultar el endpoint protegido:
    //
    // GET /api/v1/dashboard/status
    //
    // El interceptor Angular agregará
    // automáticamente el token JWT.

    this.api.comprobarDashboard().subscribe({
      // ================================================
      // RESPUESTA EXITOSA
      // ================================================

      next: (respuesta) => {
        console.log('Respuesta recibida desde Flask:', respuesta);

        // Mostrar el mensaje devuelto por Flask.
        this.estadoBackend.set('El servicio está disponible.');
      },

      // ================================================
      // ERROR DE COMUNICACIÓN O AUTENTICACIÓN
      // ================================================

      error: (error: HttpErrorResponse) => {
        console.error('Error al consultar dashboard:', error);

        // ----------------------------------------------
        // ERROR 401: TOKEN INVALIDO O EXPIRADO
        // ----------------------------------------------

        if (error.status === 401) {
          // Eliminar la sesión local.
          this.auth.cerrarSesion();

          // Regresar al inicio de sesión.
          this.router.navigate(['/login'], {
            queryParams: {
              returnUrl: '/admin/dashboard',
            },
          });

          return;
        }

        // ----------------------------------------------
        // ERROR 403: PERMISOS INSUFICIENTES
        // ----------------------------------------------

        if (error.status === 403) {
          // Evitar conservar un estado local
          // que ya no tiene autorización.
          this.auth.cerrarSesion();

          this.estadoBackend.set('No tienes permisos de administrador.');

          // Regresar a la página principal.
          this.router.navigateByUrl('/');

          return;
        }

        // ----------------------------------------------
        // ERROR DE CONEXIÓN CON FLASK
        // ----------------------------------------------

        if (error.status === 0) {
          this.estadoBackend.set('No hay conexión en este momento. Inténtalo nuevamente.');

          return;
        }

        // ----------------------------------------------
        // OTROS ERRORES
        // ----------------------------------------------

        this.estadoBackend.set('No pudimos comprobar la disponibilidad.');
      },
    });
  }

  // ====================================================
  // 9. CERRAR SESIÓN CON CONFIRMACIÓN
  // ====================================================

  /** Consulta protegida. Las gráficas se muestran vacías si falla Flask. */
  cargarEstadisticas(): void {
    this.cargandoEstadisticas.set(true);
    this.errorEstadisticas.set('');
    this.http
      .get<EstadisticasDashboard>('http://127.0.0.1:5000/api/v1/dashboard/estadisticas')
      .subscribe({
        next: (datos) => {
          this.ventasConfirmadas = datos.kpis.ventas_confirmadas;
          this.pedidosPendientes = datos.kpis.pedidos_pendientes;
          this.clientesRegistrados = datos.kpis.clientes_compradores;
          this.productosVendidos = datos.kpis.unidades_vendidas;
          this.pagosSimulados = datos.kpis.pagos_simulados_aprobados;
          this.fechaEstadisticas.set(new Date().toLocaleString('es-MX'));
          this.pintarEstadisticas(datos);
          this.cargandoEstadisticas.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.cargandoEstadisticas.set(false);
          this.errorEstadisticas.set(
            e.status === 401 || e.status === 403
              ? 'Tu sesión administrativa expiró o no tiene permisos.'
              : 'No pudimos cargar las estadísticas. Inténtalo nuevamente.',
          );
          this.chart?.destroy();
          this.chart = undefined;
          this.estadosChart?.destroy();
          this.estadosChart = undefined;
          this.productosChart?.destroy();
          this.productosChart = undefined;
        },
      });
  }

  /** Renderiza los datos de Flask únicamente cuando hay canvas en pantalla. */
  private pintarEstadisticas(datos: EstadisticasDashboard): void {
    if (!this.ventasCanvas || !this.estadosCanvas || !this.productosCanvas) {
      this.datosPendientes = datos;
      return;
    }
    this.chart?.destroy();
    this.estadosChart?.destroy();
    this.productosChart?.destroy();

    this.chart = new Chart(this.ventasCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: datos.ventas_por_dia.map((d) => d.fecha),
        datasets: [
          {
            label: 'Importe de pedidos (MXN)',
            data: datos.ventas_por_dia.map((d) => d.monto),
            borderColor: '#A65A2E',
            backgroundColor: 'rgba(166,90,46,0.12)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: (valor) => formatearDinero(valor) } } },
        plugins: {
          tooltip: {
            callbacks: { label: ({ parsed }) => formatearDinero(parsed.y) },
          },
        },
      },
    });

    this.estadosChart = new Chart(this.estadosCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: datos.pedidos_por_estado.map((d) => etiquetaPedido(d.estado)),
        datasets: [
          {
            label: 'Pedidos',
            data: datos.pedidos_por_estado.map((d) => d.cantidad),
            backgroundColor: ['#A65A2E', '#718063', '#4B2E1F', '#D9A77E', '#9B8B7B', '#E8C8AB'],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    this.productosChart = new Chart(this.productosCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: datos.productos_mas_vendidos.map((d) => d.nombre),
        datasets: [
          {
            label: 'Unidades vendidas',
            data: datos.productos_mas_vendidos.map((d) => d.unidades),
            backgroundColor: '#718063',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  // Chart.js se crea cuando llega la respuesta de Flask.
  // Si la respuesta llega antes que la vista, conservarla para renderizarla.
  private datosPendientes?: EstadisticasDashboard;

  ngAfterViewInit(): void {
    if (this.datosPendientes) {
      this.pintarEstadisticas(this.datosPendientes);
      this.datosPendientes = undefined;
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.estadosChart?.destroy();
    this.productosChart?.destroy();
  }
}
