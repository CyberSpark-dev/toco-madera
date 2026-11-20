/**
 * ======================================================
 * TOCO MADERA - SERVICIO DE RECETAS
 * Archivo: core/services/admin-recetas.ts
 * Etapa 3.17.7
 * ======================================================
 *
 * Consultar recetas, crear versiones y
 * activar una versión existente.
 *
 * JWT: se envía mediante el interceptor actual.
 * ======================================================
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductoReceta {
  id_producto: number;
  sku: string;
  nombre: string;
  activo: boolean;
}

export interface MaterialRecetaCatalogo {
  id_material: number;
  sku: string;
  nombre: string;
  id_unidad: number;
  activo: boolean;
}

export interface IngredienteReceta {
  id_material: number;
  cantidad: string;
  nombre_material: string;
  sku_material: string;
  id_unidad: number;
}

export interface RecetaAdmin {
  id_receta: number;
  id_producto: number;
  nombre_producto: string;
  sku_producto: string;
  version: number;
  vigente: boolean;
  minutos_fabricacion: number;
  minutos_grabado: number;
  costo_hora_mano_obra: string;
  costo_indirecto_unitario: string;
  observaciones: string | null;
  materiales: IngredienteReceta[];
}

export interface IngredienteFormulario {
  id_material: number;
  cantidad: string;
}

export interface RecetaFormulario {
  id_producto: number;
  minutos_fabricacion: number;
  minutos_grabado: number;
  costo_hora_mano_obra: string;
  costo_indirecto_unitario: string;
  observaciones: string | null;
  materiales: IngredienteFormulario[];
}

export interface RecetasResponse {
  success: boolean;
  total: number;
  recetas: RecetaAdmin[];
}

export interface CatalogosRecetasResponse {
  success: boolean;
  productos: ProductoReceta[];
  materiales: MaterialRecetaCatalogo[];
}

export interface OperacionRecetaResponse {
  success: boolean;
  message: string;
  id_receta?: number;
  version?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminRecetas {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/recetas';

  listar(): Observable<RecetasResponse> {
    return this.http.get<RecetasResponse>(`${this.baseUrl}/`);
  }

  catalogos(): Observable<CatalogosRecetasResponse> {
    return this.http.get<CatalogosRecetasResponse>(`${this.baseUrl}/catalogos`);
  }

  crearVersion(datos: RecetaFormulario): Observable<OperacionRecetaResponse> {
    return this.http.post<OperacionRecetaResponse>(`${this.baseUrl}/`, datos);
  }

  activar(idReceta: number): Observable<OperacionRecetaResponse> {
    return this.http.patch<OperacionRecetaResponse>(`${this.baseUrl}/${idReceta}/activar`, {});
  }
}
