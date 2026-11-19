/**
 * ==========================================================
 * TOCO MADERA - SERVICIO ADMINISTRATIVO DE PRODUCTOS
 *
 * Archivo:
 * frontend/src/app/core/services/admin-productos.ts
 *
 * Responsabilidades:
 * - Consultar productos.
 * - Consultar categorías.
 * - Registrar productos.
 * - Editar productos.
 * - Activar o desactivar productos.
 *
 * El interceptor auth.interceptor.ts
 * adjuntará automáticamente el token JWT.
 * ==========================================================
 */

import { Injectable, inject } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

// ==========================================================
// 1. INTERFAZ DE PRODUCTO
// ==========================================================

export interface ProductoAdmin {
  id_producto: number;

  id_categoria: number;

  sku: string;

  nombre: string;

  descripcion: string | null;

  precio_lista: string;

  permite_grabado: boolean;

  max_caracteres_grabado: number;

  activo: boolean;
}

// ==========================================================
// 2. INTERFAZ DE CATEGORÍA
// ==========================================================

export interface CategoriaAdmin {
  id_categoria: number;

  nombre: string;
}

// ==========================================================
// 3. DATOS PARA CREAR O EDITAR
// ==========================================================

export interface ProductoFormulario {
  id_categoria: number;

  sku: string;

  nombre: string;

  descripcion: string | null;

  precio_lista: string;

  permite_grabado: boolean;

  max_caracteres_grabado: number;
}

// ==========================================================
// 4. RESPUESTAS DE FLASK
// ==========================================================

export interface ProductosAdminResponse {
  success: boolean;

  total: number;

  productos: ProductoAdmin[];
}

export interface CategoriasAdminResponse {
  success: boolean;

  total: number;

  categorias: CategoriaAdmin[];
}

export interface ProductoOperacionResponse {
  success: boolean;

  message: string;

  producto: ProductoAdmin;
}

// ==========================================================
// 5. SERVICIO
// ==========================================================

@Injectable({
  providedIn: 'root',
})
export class AdminProductos {
  // Cliente HTTP registrado en app.config.ts.
  private readonly http = inject(HttpClient);

  // Dirección base del módulo administrativo.
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/admin/productos';

  // ========================================================
  // 6. CONSULTAR TODOS LOS PRODUCTOS
  // ========================================================

  listarProductos(): Observable<ProductosAdminResponse> {
    return this.http.get<ProductosAdminResponse>(`${this.baseUrl}/`);
  }

  // ========================================================
  // 7. CONSULTAR CATEGORÍAS
  // ========================================================

  listarCategorias(): Observable<CategoriasAdminResponse> {
    return this.http.get<CategoriasAdminResponse>(`${this.baseUrl}/categorias`);
  }

  // ========================================================
  // 8. REGISTRAR PRODUCTO
  // ========================================================

  registrarProducto(datos: ProductoFormulario): Observable<ProductoOperacionResponse> {
    return this.http.post<ProductoOperacionResponse>(`${this.baseUrl}/`, datos);
  }

  // ========================================================
  // 9. EDITAR PRODUCTO
  // ========================================================

  editarProducto(
    idProducto: number,
    datos: ProductoFormulario,
  ): Observable<ProductoOperacionResponse> {
    return this.http.put<ProductoOperacionResponse>(`${this.baseUrl}/${idProducto}`, datos);
  }

  // ========================================================
  // 10. ACTIVAR O DESACTIVAR
  // ========================================================

  cambiarEstado(idProducto: number, activo: boolean): Observable<ProductoOperacionResponse> {
    return this.http.patch<ProductoOperacionResponse>(`${this.baseUrl}/${idProducto}/estado`, {
      activo,
    });
  }
}
