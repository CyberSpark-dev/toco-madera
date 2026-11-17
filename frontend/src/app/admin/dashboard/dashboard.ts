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

import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';

// Servicio que permite comunicarnos con Flask
import { Api } from '../../core/services/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  // =========================================
  // 1. CONEXIÓN CON EL BACKEND FLASK
  // =========================================

  // Inyectar el servicio de la API
  private readonly api = inject(Api);

  // Signal para mostrar el estado de conexión
  estadoBackend = signal('Comprobando conexión con Flask...');

  // =========================================
  // 2. REFERENCIA A LA GRÁFICA CHART.JS
  // =========================================

  @ViewChild('ventasChart')
  ventasCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  // =========================================
  // 3. ESTADÍSTICAS INICIALES
  // =========================================

  // Estos valores son temporales.
  // Posteriormente vendrán de MySQL mediante Flask.
  ventasConfirmadas = 0;
  pedidosPendientes = 0;
  clientesRegistrados = 0;
  productosVendidos = 0;

  // =========================================
  // 4. CONSULTAR EL SERVIDOR FLASK
  // =========================================

  // Se ejecuta al inicializar el dashboard.
  ngOnInit(): void {
    this.api.comprobarDashboard().subscribe({
      // Flask respondió correctamente
      next: (respuesta) => {
        console.log('Respuesta recibida desde Flask:', respuesta);

        this.estadoBackend.set(respuesta.message);
      },

      // Flask no respondió o hubo un error HTTP
      error: (error) => {
        console.error('Error al conectar con Flask:', error);

        this.estadoBackend.set('No se pudo conectar con Flask.');
      },
    });
  }

  // =========================================
  // 5. CREAR LA GRÁFICA DE VENTAS
  // =========================================

  // Se ejecuta cuando Angular termina
  // de preparar los elementos del HTML.
  ngAfterViewInit(): void {
    const canvas = this.ventasCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'line',

      data: {
        labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],

        datasets: [
          {
            label: 'Ventas confirmadas (MXN)',
            data: [0, 0, 0, 0, 0, 0, 0],
            borderColor: '#A65A2E',
            backgroundColor: 'rgba(166, 90, 46, 0.12)',
            fill: true,
            tension: 0.35,
          },
        ],
      },

      options: {
        responsive: true,

        maintainAspectRatio: false,

        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  // =========================================
  // 6. LIBERAR RECURSOS AL SALIR
  // =========================================

  // Se ejecuta cuando dejamos el dashboard.
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
