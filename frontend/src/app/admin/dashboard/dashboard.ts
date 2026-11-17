import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from "@angular/core";

import { CurrencyPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import Chart from "chart.js/auto";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard implements AfterViewInit, OnDestroy {
  @ViewChild("ventasChart")
  ventasCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  // Estadísticas iniciales del proyecto
  // Se conectarán a MySQL mediante Flask posteriormente.
  ventasConfirmadas = 0;
  pedidosPendientes = 0;
  clientesRegistrados = 0;
  productosVendidos = 0;

  ngAfterViewInit(): void {
    const canvas = this.ventasCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: [
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
          "Domingo",
        ],
        datasets: [
          {
            label: "Ventas confirmadas (MXN)",
            data: [0, 0, 0, 0, 0, 0, 0],
            borderColor: "#A65A2E",
            backgroundColor: "rgba(166, 90, 46, 0.12)",
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

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
