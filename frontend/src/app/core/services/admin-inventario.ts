/**
 * ======================================================
 * TOCO MADERA - SERVICIO DE INVENTARIO
 * Archivo: core/services/admin-inventario.ts
 * ETAPA 3.17.6
 * ======================================================
 *
 * Permite consultar:
 * - Existencias por materia prima.
 * - Alertas por stock mínimo.
 * - Historial de movimientos.
 *
 * JWT: agregado mediante el interceptor existente.
 * ======================================================
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ======================================================
// 1. MODELOS
// ======================================================

export interface ExistenciaMaterial {
  id_material: number;
  sku: string;
  nombre: string;
  id_unidad: number;
  stock_minimo: string;
  existencia: string;
  activo: boolean;
  bajo_minimo: boolean;
}

export interface MovimientoMaterial {
  id_movimiento: number;
  id_material: number;
  nombre_material: string;
  sku_material: string;
  fecha: string;
  tipo: 'COMPRA' | 'CONSUMO' | 'AJUSTE' | 'DEVOLUCION';
  cantidad_firmada: string;
  costo_unitario_aplicado: string | null;
  id_detalle_compra: number | null;
  id_orden_produccion: number | null;
  observaciones: string | null;
}

export interface InventarioResponse {
  success: boolean;
  total: number;
  bajo_minimo: number;
  sin_existencia: number;
  inventario: ExistenciaMaterial[];
}

export interface MovimientosResponse {
  success: boolean;
  total: number;
  movimientos: MovimientoMaterial[];
}

// ======================================================
// 2. SERVICIO
// ======================================================

@Injectable({
  providedIn: 'root',
})
export class AdminInventario {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/inventario';

  // Consultar existencias y alertas.
  listarInventario(): Observable<InventarioResponse> {
    return this.http.get<InventarioResponse>(`${this.baseUrl}/`);
  }

  // Consultar movimientos recientes.
  // El material es opcional.
  listarMovimientos(
    idMaterial: number | null = null,
    limite = 100,
  ): Observable<MovimientosResponse> {
    let params = new HttpParams().set('limite', String(limite));

    if (idMaterial !== null) {
      params = params.set('id_material', String(idMaterial));
    }

    return this.http.get<MovimientosResponse>(`${this.baseUrl}/movimientos`, { params });
  }
}
