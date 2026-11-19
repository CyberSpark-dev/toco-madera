/**
 * ======================================================
 * TOCO MADERA - SERVICIO DE MATERIAS PRIMAS
 * Archivo: core/services/admin-materiales.ts
 * Etapa 3.16
 * ======================================================
 *
 * RESPONSABILIDADES:
 *
 * 1. Consultar materiales de MySQL.
 * 2. Consultar unidades de medida existentes.
 * 3. Registrar nuevas materias primas.
 * 4. Editar materias primas.
 * 5. Activar y desactivar materiales.
 *
 * El interceptor HTTP agrega el JWT del usuario.
 * Todas estas rutas requieren rol ADMIN en Flask.
 * ======================================================
 */

import { Injectable, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

// ======================================================
// 1. MODELO DE MATERIAL
// ======================================================

// Los campos corresponden a la tabla materiales
// que verificamos en MySQL Workbench.

export interface MaterialAdmin {
  id_material: number;

  sku: string;

  nombre: string;

  descripcion: string | null;

  id_unidad: number;

  // DECIMAL(14,4) se devuelve como texto
  // para no perder precisión.
  stock_minimo: string;

  activo: boolean;
}

// ======================================================
// 2. DATOS DEL FORMULARIO
// ======================================================

// No se incluye id_material porque MySQL lo genera.
//
// Tampoco se incluye activo porque el estado
// se cambia mediante un endpoint independiente.

export interface MaterialFormulario {
  sku: string;

  nombre: string;

  descripcion: string | null;

  id_unidad: number;

  stock_minimo: string;
}

// ======================================================
// 3. MODELO DE UNIDAD DE MEDIDA
// ======================================================

export interface UnidadMedida {
  id_unidad: number;

  nombre: string;
}

// ======================================================
// 4. RESPUESTAS DE LA API
// ======================================================

export interface ColumnaMaterial {
  nombre: string;

  tipo: string;

  permite_null: boolean;

  clave_primaria: boolean;
}

export interface MaterialesResponse {
  success: boolean;

  total: number;

  columnas: ColumnaMaterial[];

  materiales: MaterialAdmin[];
}

export interface UnidadesResponse {
  success: boolean;

  total: number;

  unidades: UnidadMedida[];
}

export interface MaterialOperacionResponse {
  success: boolean;

  message: string;

  material: MaterialAdmin;
}

// ======================================================
// 5. SERVICIO ANGULAR
// ======================================================

@Injectable({
  providedIn: 'root',
})
export class AdminMateriales {
  // Cliente HTTP configurado en app.config.ts.
  private readonly http = inject(HttpClient);

  // Dirección del Blueprint Flask.
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/materiales';

  // ====================================================
  // 6. GET - CONSULTAR MATERIALES
  // ====================================================

  listarMateriales(): Observable<MaterialesResponse> {
    return this.http.get<MaterialesResponse>(`${this.baseUrl}/`);
  }

  // ====================================================
  // 7. GET - CONSULTAR UNIDADES DE MEDIDA
  // ====================================================

  listarUnidades(): Observable<UnidadesResponse> {
    return this.http.get<UnidadesResponse>(`${this.baseUrl}/unidades`);
  }

  // ====================================================
  // 8. POST - REGISTRAR MATERIA PRIMA
  // ====================================================

  registrarMaterial(datos: MaterialFormulario): Observable<MaterialOperacionResponse> {
    return this.http.post<MaterialOperacionResponse>(`${this.baseUrl}/`, datos);
  }

  // ====================================================
  // 9. PUT - EDITAR MATERIA PRIMA
  // ====================================================

  editarMaterial(
    idMaterial: number,
    datos: MaterialFormulario,
  ): Observable<MaterialOperacionResponse> {
    return this.http.put<MaterialOperacionResponse>(`${this.baseUrl}/${idMaterial}`, datos);
  }

  // ====================================================
  // 10. PATCH - ACTIVAR O DESACTIVAR
  // ====================================================

  cambiarEstado(idMaterial: number, activo: boolean): Observable<MaterialOperacionResponse> {
    return this.http.patch<MaterialOperacionResponse>(`${this.baseUrl}/${idMaterial}/estado`, {
      activo,
    });
  }
}
