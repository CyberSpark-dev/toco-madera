/**
 * ==========================================
 * TOCO MADERA - INICIO DE SESIÓN
 * Archivo: auth/login/login.ts
 * ==========================================
 *
 * Responsabilidades:
 * - Capturar correo y contraseña.
 * - Enviar las credenciales a Flask.
 * - Mostrar los errores de autenticación.
 * - Redirigir según el rol del usuario.
 */

import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,

  imports: [FormsModule, RouterLink],

  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // ========================================
  // 1. SERVICIOS
  // ========================================

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);

  // ========================================
  // 2. CAMPOS DEL FORMULARIO
  // ========================================

  correo = '';
  password = '';

  // ========================================
  // 3. ESTADO DE LA INTERFAZ
  // ========================================

  cargando = signal(false);
  error = signal('');
  mostrarPassword = signal(false);

  // Confirmación enviada por /registro.
  registroExitoso = this.route.snapshot.queryParamMap.get('registrado') === '1';

  // ========================================
  // 4. MOSTRAR U OCULTAR CONTRASEÑA
  // ========================================

  cambiarVisibilidad(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  // ========================================
  // 5. INICIAR SESIÓN
  // ========================================

  iniciarSesion(): void {
    // Evitar solicitudes duplicadas.
    if (this.cargando()) {
      return;
    }

    // Limpiar mensajes anteriores.
    this.error.set('');

    // Validación básica.
    if (!this.correo.trim() || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }

    this.cargando.set(true);

    // Enviar las credenciales al backend.
    this.auth
      .iniciarSesion({
        correo: this.correo.trim(),
        password: this.password,
      })
      .subscribe({
        // ====================================
        // AUTENTICACIÓN EXITOSA
        // ====================================

        next: (respuesta) => {
          this.cargando.set(false);

          // Limpiar la contraseña del formulario.
          this.password = '';

          // El backend ya verificó las credenciales.
          if (respuesta.usuario.rol === 'ADMIN') {
            // Administrador: dirigir al dashboard.
            this.router.navigateByUrl('/admin/dashboard');
            return;
          }

          // Cliente: dirigir al catálogo.
          this.router.navigateByUrl('/');
        },

        // ====================================
        // ERROR DE AUTENTICACIÓN
        // ====================================

        error: (error: HttpErrorResponse) => {
          this.cargando.set(false);

          if (error.status === 0) {
            this.error.set('No se pudo conectar con Flask. Verifica que esté encendido.');
          } else if (error.status === 401) {
            this.error.set('Correo o contraseña incorrectos.');
          } else if (error.status === 403) {
            this.error.set('Esta cuenta está desactivada.');
          } else {
            this.error.set('No fue posible iniciar sesión. Intenta nuevamente.');
          }
        },
      });
  }
}
