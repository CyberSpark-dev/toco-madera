/**
 * ==================================================
 * TOCO MADERA - SERVICIO DE AUTENTICACIÓN
 * Archivo: frontend/src/app/core/services/auth.ts
 * ==================================================
 *
 * Funciones:
 * - Registrar clientes.
 * - Iniciar sesión.
 * - Consultar el perfil.
 * - Conservar temporalmente el token JWT.
 * - Identificar el rol del usuario.
 * - Cerrar la sesión local.
 */

import { Injectable, inject, signal, computed } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable, tap } from 'rxjs';

// ==========================================
// 1. TIPOS E INTERFACES
// ==========================================

export type RolUsuario = 'ADMIN' | 'CLIENTE';

export interface UsuarioAutenticado {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  rol: RolUsuario;
  activo: boolean;
}

export interface RegistroRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RegistroResponse {
  success: boolean;
  message: string;
  usuario: UsuarioAutenticado;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: string;
  usuario: UsuarioAutenticado;
}

export interface PerfilResponse {
  success: boolean;
  usuario: UsuarioAutenticado;
}

// ==========================================
// 2. SERVICIO DE AUTENTICACIÓN
// ==========================================

@Injectable({
  providedIn: 'root',
})
export class Auth {
  // Cliente HTTP de Angular.
  private readonly http = inject(HttpClient);

  // Dirección del Blueprint de autenticación.
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/auth';

  // Token JWT almacenado en memoria.
  private readonly tokenState = signal<string | null>(null);

  // Datos del usuario almacenados en memoria.
  private readonly usuarioState = signal<UsuarioAutenticado | null>(null);

  // ========================================
  // 3. SEÑALES PÚBLICAS
  // ========================================

  readonly usuario = this.usuarioState.asReadonly();

  // Indica que existe una sesión local.
  readonly autenticado = computed(() => this.tokenState() !== null && this.usuarioState() !== null);

  // Rol administrativo según el perfil local.
  readonly esAdministrador = computed(
    () => this.autenticado() && this.usuarioState()?.rol === 'ADMIN',
  );

  // Rol cliente según el perfil local.
  readonly esCliente = computed(() => this.autenticado() && this.usuarioState()?.rol === 'CLIENTE');

  // ========================================
  // 4. REGISTRO DE CLIENTES
  // ========================================

  registrar(datos: RegistroRequest): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.baseUrl}/registro`, datos);
  }

  // ========================================
  // 5. INICIO DE SESIÓN
  // ========================================

  iniciarSesion(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, datos).pipe(
      tap((respuesta) => {
        if (respuesta.success) {
          // Guardar token para futuras peticiones.
          this.tokenState.set(respuesta.access_token);

          // Guardar el perfil recibido.
          this.usuarioState.set(respuesta.usuario);
        }
      }),
    );
  }

  // ========================================
  // 6. CONSULTAR PERFIL AUTENTICADO
  // ========================================

  consultarPerfil(): Observable<PerfilResponse> {
    const token = this.tokenState();

    // El endpoint /me exige un JWT válido.
    return this.http
      .get<PerfilResponse>(`${this.baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
        },
      })
      .pipe(
        tap((respuesta) => {
          if (respuesta.success) {
            this.usuarioState.set(respuesta.usuario);
          }
        }),
      );
  }

  // ========================================
  // 7. OBTENER TOKEN ACTUAL
  // ========================================

  obtenerToken(): string | null {
    return this.tokenState();
  }

  // ========================================
  // 8. CERRAR SESIÓN LOCAL
  // ========================================

  cerrarSesion(): void {
    this.tokenState.set(null);
    this.usuarioState.set(null);
  }
}
