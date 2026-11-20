// ==========================================
// TOCO MADERA - SERVICIO GENERAL DE API
// ==========================================

import { Injectable, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

// ==========================================
// 1. RESPUESTA DEL DASHBOARD
// ==========================================

// Define la estructura esperada desde Flask.
export interface DashboardStatus {
  success: boolean;
  module: string;
  message: string;
  database_connected: boolean;
  statistics_ready: boolean;
}

// ==========================================
// 2. ESTRUCTURA DE UN PRODUCTO
// ==========================================

// Representa los datos que recibiremos
// de la tabla productos de MySQL.
export interface Producto {
  id_producto: number;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio_lista: string;
  permite_grabado: boolean;
  max_caracteres_grabado: number;
}

// ==========================================
// 3. RESPUESTA DEL CATÁLOGO
// ==========================================

// El backend devuelve una lista de productos.
export interface ProductosResponse {
  success: boolean;
  total: number;
  productos: Producto[];
}

// ==========================================
// 4. SERVICIO DE COMUNICACIÓN HTTP
// ==========================================

@Injectable({
  providedIn: 'root',
})
export class Api {
  // Servicio que realiza peticiones HTTP.
  private readonly http = inject(HttpClient);

  // Dirección local del backend Flask.
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1';

  // ========================================
  // CONSULTAR ESTADO DEL DASHBOARD
  // ========================================

  comprobarDashboard(): Observable<DashboardStatus> {
    return this.http.get<DashboardStatus>(`${this.baseUrl}/dashboard/status`);
  }

  // ========================================
  // CONSULTAR PRODUCTOS ACTIVOS
  // ========================================

  obtenerProductos(): Observable<ProductosResponse> {
    // Realiza una petición GET a Flask.
    // Flask consulta MySQL y devuelve JSON.
    return this.http.get<ProductosResponse>(`${this.baseUrl}/productos/`);
  }
}
