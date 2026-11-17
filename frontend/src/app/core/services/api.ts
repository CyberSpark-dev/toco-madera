import { Injectable, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

// Estructura de datos recibida desde Flask
export interface DashboardStatus {
  success: boolean;
  module: string;
  message: string;
  database_connected: boolean;
  statistics_ready: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class Api {
  // Cliente HTTP de Angular
  private readonly http = inject(HttpClient);

  // URL de Flask durante el desarrollo
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1';

  // Consultar el estado del dashboard
  comprobarDashboard(): Observable<DashboardStatus> {
    return this.http.get<DashboardStatus>(`${this.baseUrl}/dashboard/status`);
  }
}
