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
import { CurrencyPipe } from '@angular/common';

// Navegación del proyecto.
import { Router, RouterLink } from '@angular/router';

// Tipado de errores HTTP.
import { HttpErrorResponse } from '@angular/common/http';

// Biblioteca utilizada para generar gráficas.
import Chart from 'chart.js/auto';

// Servicio de comunicación con Flask.
import { Api } from '../../core/services/api';

// Servicio de autenticación JWT.
import { Auth } from '../../core/services/auth';

// ======================================================
// 2. CONFIGURACIÓN DEL COMPONENTE
// ======================================================

@Component({
  selector: 'app-dashboard',

  // Componente independiente de Angular.
  standalone: true,

  // Herramientas utilizadas por dashboard.html.
  imports: [RouterLink, CurrencyPipe],

  // Archivos de presentación.
  templateUrl: './dashboard.html',

  styleUrl: './dashboard.css',
})

// ======================================================
// 3. CLASE PRINCIPAL
// ======================================================
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  // ====================================================
  // 4. SERVICIOS
  // ====================================================

  // Servicio para consultar la API Flask.
  private readonly api = inject(Api);

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

  estadoBackend = signal('Comprobando conexión con Flask...');

  // ====================================================
  // 6. REFERENCIA A LA GRÁFICA CHART.JS
  // ====================================================

  // Localizar el elemento:
  // <canvas #ventasChart>
  @ViewChild('ventasChart')
  ventasCanvas?: ElementRef<HTMLCanvasElement>;

  // Guardar la instancia de Chart.js.
  private chart?: Chart;

  // ====================================================
  // 7. INDICADORES COMERCIALES
  // ====================================================

  // Estos valores son temporales.
  //
  // Más adelante consultaremos estadísticas
  // reales desde MySQL mediante Flask.

  ventasConfirmadas = 0;

  pedidosPendientes = 0;

  clientesRegistrados = 0;

  productosVendidos = 0;

  // ====================================================
  // 8. INICIALIZAR DASHBOARD
  // ====================================================

  ngOnInit(): void {
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
        this.estadoBackend.set(respuesta.message);
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
          this.estadoBackend.set('No se pudo conectar con el servidor Flask.');

          return;
        }

        // ----------------------------------------------
        // OTROS ERRORES
        // ----------------------------------------------

        this.estadoBackend.set('Ocurrió un error al consultar el backend.');
      },
    });
  }

  // ====================================================
  // 9. CERRAR SESIÓN
  // ====================================================

  // ====================================================
  // 9. CERRAR SESIÓN CON CONFIRMACIÓN
  // ====================================================

  /**
   * TOCO MADERA - DASHBOARD ADMINISTRATIVO
   *
   * Solicita confirmación antes de cerrar sesión.
   *
   * FUNCIONAMIENTO:
   * 1. Muestra una ventana de confirmación.
   * 2. Si selecciona Cancelar, conserva la sesión.
   * 3. Si selecciona Aceptar, elimina el JWT.
   * 4. Limpia los datos del administrador.
   * 5. Redirige a la pantalla de login.
   *
   * No modifica los indicadores, las gráficas
   * ni las conexiones existentes con Flask.
   */
  cerrarSesion(): void {
    // Solicitar confirmación al administrador.
    const confirmado = window.confirm(
      '¿Estás seguro de que quieres cerrar sesión como administrador?',
    );

    // Si selecciona Cancelar, permanecer conectado.
    if (!confirmado) {
      return;
    }

    // Cerrar sesión mediante el servicio Auth.
    // Elimina el token JWT y los datos del usuario.
    this.auth.cerrarSesion();

    // Regresar al formulario de inicio de sesión.
    this.router.navigateByUrl('/login');
  }

  // ====================================================
  // 10. CREAR GRÁFICA DE VENTAS
  // ====================================================

  ngAfterViewInit(): void {
    // Obtener el canvas definido en dashboard.html.
    const canvas = this.ventasCanvas?.nativeElement;

    // Si el canvas no existe, evitar errores.
    if (!canvas) {
      return;
    }

    // ==================================================
    // CONFIGURACIÓN DE CHART.JS
    // ==================================================

    this.chart = new Chart(canvas, {
      // Gráfica de líneas.
      type: 'line',

      // ================================================
      // DATOS DE LA GRÁFICA
      // ================================================

      data: {
        // Días de la semana.
        labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],

        datasets: [
          {
            // Nombre de la serie.
            label: 'Ventas confirmadas (MXN)',

            // Datos temporales.
            data: [0, 0, 0, 0, 0, 0, 0],

            // Terracota de la marca.
            borderColor: '#A65A2E',

            // Terracota transparente.
            backgroundColor: 'rgba(166, 90, 46, 0.12)',

            // Relleno bajo la línea.
            fill: true,

            // Suavizar la línea.
            tension: 0.35,
          },
        ],
      },

      // ================================================
      // OPCIONES DE LA GRÁFICA
      // ================================================

      options: {
        // Adaptar el gráfico al contenedor.
        responsive: true,

        // Permitir usar la altura del CSS.
        maintainAspectRatio: false,

        // Configuración del eje vertical.
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  // ====================================================
  // 11. LIBERAR RECURSOS
  // ====================================================

  ngOnDestroy(): void {
    // Destruir la instancia de Chart.js
    // cuando abandonamos el dashboard.
    //
    // Evita gráficas duplicadas y fugas de memoria.

    this.chart?.destroy();
  }
}
