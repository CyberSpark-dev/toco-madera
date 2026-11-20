/**
 * TOCO MADERA - Autenticación Angular (Etapa 3.18, corrección)
 * - Guarda JWT y perfil durante la sesión de la pestaña (sessionStorage).
 * - No guarda contraseñas ni tokens en localStorage.
 * - El rol local solo controla la UI; Flask valida JWT y rol en cada operación.
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

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

  // Obligatorio para nuevos registros.
  telefono: string;
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

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:5000/api/v1/auth';
  private readonly tokenKey = 'tm_access_token';
  private readonly userKey = 'tm_usuario';

  private storage(): Storage | null {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  }
  private readToken(): string | null {
    try {
      return this.storage()?.getItem(this.tokenKey) ?? null;
    } catch {
      return null;
    }
  }
  private readUser(): UsuarioAutenticado | null {
    try {
      const raw = this.storage()?.getItem(this.userKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const u = value as Partial<UsuarioAutenticado>;
      return typeof u.id_usuario === 'number' &&
        typeof u.correo === 'string' &&
        (u.rol === 'CLIENTE' || u.rol === 'ADMIN')
        ? (u as UsuarioAutenticado)
        : null;
    } catch {
      return null;
    }
  }
  private readonly tokenState = signal<string | null>(this.readToken());
  private readonly usuarioState = signal<UsuarioAutenticado | null>(this.readUser());

  readonly usuario = this.usuarioState.asReadonly();
  readonly autenticado = computed(() => !!this.tokenState() && !!this.usuarioState());
  readonly esAdministrador = computed(
    () => this.autenticado() && this.usuarioState()?.rol === 'ADMIN',
  );
  readonly esCliente = computed(() => this.autenticado() && this.usuarioState()?.rol === 'CLIENTE');

  registrar(datos: RegistroRequest): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.baseUrl}/registro`, datos);
  }
  iniciarSesion(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, datos).pipe(
      tap((respuesta) => {
        if (respuesta.success && respuesta.access_token && respuesta.usuario) {
          this.tokenState.set(respuesta.access_token);
          this.usuarioState.set(respuesta.usuario);
          try {
            this.storage()?.setItem(this.tokenKey, respuesta.access_token);
            this.storage()?.setItem(this.userKey, JSON.stringify(respuesta.usuario));
          } catch {
            /* Si storage está bloqueado, el JWT sigue en memoria. */
          }
        }
      }),
    );
  }
  consultarPerfil(): Observable<PerfilResponse> {
    return this.http.get<PerfilResponse>(`${this.baseUrl}/me`).pipe(
      tap((respuesta) => {
        if (respuesta.success) {
          this.usuarioState.set(respuesta.usuario);
          try {
            this.storage()?.setItem(this.userKey, JSON.stringify(respuesta.usuario));
          } catch {
            /* no interrumpir la sesión */
          }
        }
      }),
    );
  }
  obtenerToken(): string | null {
    return this.tokenState();
  }
  cerrarSesion(): void {
    this.tokenState.set(null);
    this.usuarioState.set(null);
    try {
      this.storage()?.removeItem(this.tokenKey);
      this.storage()?.removeItem(this.userKey);
    } catch {
      /* navegador restringido */
    }
  }
}
