/**
 * =====================================================
 * TOCO MADERA - SERVICIO ADMINISTRATIVO DE PROVEEDORES
 *
 * Archivo:
 * frontend/src/app/core/services/admin-proveedores.ts
 *
 * ETAPA 3.16
 *
 * Responsabilidades:
 * 1. Consultar proveedores.
 * 2. Registrar nuevos proveedores.
 * 3. Editar información de proveedores.
 * 4. Activar y desactivar proveedores.
 *
 * Las peticiones utilizan HttpClient.
 * El interceptor de autenticación agregará el JWT.
 * =====================================================
 */

import { Injectable, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

// =====================================================
// 1. MODELO DE PROVEEDOR
// =====================================================

export interface ProveedorAdmin {
  id_proveedor: number;

  nombre: string;

  contacto: string | null;

  telefono: string | null;

  correo: string | null;

  direccion: string | null;

  sitio_web: string | null;

  activo: boolean;
}

// =====================================================
// 2. DATOS DEL FORMULARIO
// =====================================================

// Separamos los datos editables del ID y del estado,
// porque estos últimos los controla el backend.

export interface ProveedorFormulario {
  nombre: string;

  contacto: string;

  telefono: string;

  correo: string;

  direccion: string;

  sitio_web: string;
}

// =====================================================
// 3. RESPUESTA AL CONSULTAR PROVEEDORES
// =====================================================

export interface ProveedoresResponse {
  success: boolean;

  total: number;

  proveedores: ProveedorAdmin[];
}

// =====================================================
// 4. RESPUESTA DE UNA OPERACIÓN
// =====================================================

export interface ProveedorOperacionResponse {
  success: boolean;

  message: string;

  proveedor: ProveedorAdmin;
}

// =====================================================
// 5. SERVICIO DE PROVEEDORES
// =====================================================

@Injectable({
  providedIn: 'root',
})
export class AdminProveedores {
  // Servicio HTTP proporcionado por Angular.
  private readonly http = inject(HttpClient);

  // URL del Blueprint administrativo en Flask.
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/proveedores';

  // ===================================================
  // 6. CONSULTAR TODOS LOS PROVEEDORES
  // GET /api/v1/admin/proveedores/
  // ===================================================

  listarProveedores(): Observable<ProveedoresResponse> {
    return this.http.get<ProveedoresResponse>(`${this.baseUrl}/`);
  }

  // ===================================================
  // 7. REGISTRAR NUEVO PROVEEDOR
  // POST /api/v1/admin/proveedores/
  // ===================================================

  registrarProveedor(datos: ProveedorFormulario): Observable<ProveedorOperacionResponse> {
    return this.http.post<ProveedorOperacionResponse>(`${this.baseUrl}/`, datos);
  }

  // ===================================================
  // 8. EDITAR PROVEEDOR EXISTENTE
  // PUT /api/v1/admin/proveedores/<id>
  // ===================================================

  editarProveedor(
    idProveedor: number,
    datos: ProveedorFormulario,
  ): Observable<ProveedorOperacionResponse> {
    return this.http.put<ProveedorOperacionResponse>(`${this.baseUrl}/${idProveedor}`, datos);
  }

  // ===================================================
  // 9. CAMBIAR ESTADO DEL PROVEEDOR
  // PATCH /api/v1/admin/proveedores/<id>/estado
  // ===================================================

  cambiarEstado(idProveedor: number, activo: boolean): Observable<ProveedorOperacionResponse> {
    return this.http.patch<ProveedorOperacionResponse>(`${this.baseUrl}/${idProveedor}/estado`, {
      activo,
    });
  }
}
