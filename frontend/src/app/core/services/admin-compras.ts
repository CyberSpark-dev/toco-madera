/**
 * ======================================================
 * TOCO MADERA - SERVICIO ADMINISTRATIVO DE COMPRAS
 * Archivo: core/services/admin-compras.ts
 * ETAPA 3.17
 * ======================================================
 *
 * Operaciones:
 * - Consultar compras.
 * - Consultar una compra.
 * - Registrar borradores.
 * - Confirmar recepciones.
 * - Cancelar borradores.
 *
 * El interceptor JWT existente agrega el token
 * a las solicitudes HTTP.
 * ======================================================
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { MaterialVerificado } from './admin-operaciones';

// ------------------------------------------------------
// 1. MODELOS DE DATOS
// ------------------------------------------------------

export interface DetalleCompra {
  id_detalle_compra: number;
  id_compra: number;
  id_material: number;
  cantidad: string;
  costo_unitario: string;
  subtotal: string;
  id_cotizacion?: number | null;
  cantidad_presentaciones?: number | null;
  presentacion_aplicada?: string | null;
}

export interface CompraAdmin {
  id_orden_produccion?: number | null;
  revision?: number;
  id_compra: number;
  id_proveedor: number;
  id_usuario_registro: number | null;
  fecha: string;
  estado: 'BORRADOR' | 'RECIBIDA' | 'CANCELADA';
  referencia_documento: string | null;
  observaciones: string | null;
  detalles: DetalleCompra[];
  total: string;
}

export interface DetalleCompraFormulario {
  id_material: number;
  cantidad: string;
  costo_unitario: string;
  id_cotizacion?: number;
  cantidad_presentaciones?: number;
  presentacion_aplicada?: string;
}

export interface CompraFormulario {
  id_orden_produccion?: number;
  clave_solicitud?: string;
  id_proveedor: number;
  referencia_documento: string | null;
  observaciones: string | null;
  detalles: DetalleCompraFormulario[];
}

export interface ComprasResponse {
  success: boolean;
  total: number;
  compras: CompraAdmin[];
}

export interface CompraResponse {
  reutilizada?: boolean;
  success: boolean;
  message?: string;
  compra: CompraAdmin;
}

export interface PresentacionCompra {
  id_cotizacion: number;
  presentacion: string;
  unidad: string;
  cantidad_base: string;
  precio_presentacion: string;
  cantidad_presentaciones_sugerida: number;
  cantidad_base_sugerida: string;
  costo_unitario: string;
}

export interface FaltanteCompra extends MaterialVerificado {
  id_material: number;
  id_unidad: number;
  unidad: string;
  cantidad_faltante: string;
  cobertura_borradores: string;
  cantidad_sugerida: string;
  presentaciones: PresentacionCompra[];
}

export interface PreparacionCompra {
  success: boolean;
  id_orden: number;
  estado: string;
  motivo_bloqueo: string | null;
  materiales: FaltanteCompra[];
  borradores: Pick<CompraAdmin, 'id_compra' | 'id_proveedor' | 'revision'>[];
}

export interface OperacionCompraResponse {
  success: boolean;
  message: string;
  compra?: CompraAdmin;
}

// ------------------------------------------------------
// 2. SERVICIO
// ------------------------------------------------------

@Injectable({
  providedIn: 'root',
})
export class AdminCompras {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/compras';

  // Consultar compras con sus detalles y totales.
  listar(): Observable<ComprasResponse> {
    return this.http.get<ComprasResponse>(`${this.baseUrl}/`);
  }

  // Consultar una compra por identificador.
  obtener(idCompra: number): Observable<CompraResponse> {
    return this.http.get<CompraResponse>(`${this.baseUrl}/${idCompra}`);
  }

  // Registrar una compra en BORRADOR.
  registrar(datos: CompraFormulario): Observable<CompraResponse> {
    return this.http.post<CompraResponse>(`${this.baseUrl}/`, datos);
  }

  preparar(orden: number, proveedor?: number): Observable<PreparacionCompra> {
    const params = proveedor ? { id_proveedor: proveedor } : undefined;
    return this.http.get<PreparacionCompra>(`${this.baseUrl}/preparacion/${orden}`, { params });
  }

  editar(idCompra: number, datos: CompraFormulario & { revision: number }): Observable<CompraResponse> {
    return this.http.put<CompraResponse>(`${this.baseUrl}/${idCompra}`, datos);
  }

  // Confirmar recepción y movimientos de inventario.
  recibir(idCompra: number): Observable<OperacionCompraResponse> {
    return this.http.patch<OperacionCompraResponse>(`${this.baseUrl}/${idCompra}/recibir`, {});
  }

  // Cancelar una compra que no fue recibida.
  cancelar(idCompra: number): Observable<OperacionCompraResponse> {
    return this.http.patch<OperacionCompraResponse>(`${this.baseUrl}/${idCompra}/cancelar`, {});
  }
}
