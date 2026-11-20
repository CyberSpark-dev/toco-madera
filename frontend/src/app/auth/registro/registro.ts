/**
 * ==========================================
 * TOCO MADERA - REGISTRO DE CLIENTES
 * Archivo: auth/registro/registro.ts
 * ==========================================
 *
 * Responsabilidades:
 * - Capturar los datos del cliente.
 * - Validar el formulario.
 * - Registrar la cuenta mediante Flask.
 * - Redirigir al login después del registro.
 */

import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-registro',
  standalone: true,

  imports: [FormsModule, RouterLink],

  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  // ========================================
  // 1. SERVICIOS
  // ========================================

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  // ========================================
  // 2. CAMPOS DEL FORMULARIO
  // ========================================

  nombre = '';
  correo = '';
  telefono = '';
  password = '';
  confirmarPassword = '';

  // ========================================
  // 3. ESTADO DE LA INTERFAZ
  // ========================================

  cargando = signal(false);
  error = signal('');
  mostrarPassword = signal(false);

  // ========================================
  // 4. MOSTRAR U OCULTAR CONTRASEÑAS
  // ========================================

  cambiarVisibilidad(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  // ========================================
  // 5. REGISTRAR CLIENTE
  // ========================================

  registrarCliente(): void {
    // Evitar solicitudes duplicadas.
    if (this.cargando()) {
      return;
    }

    // Limpiar el error anterior.
    this.error.set('');

    // Validar nombre.
    if (this.nombre.trim().length < 2) {
      this.error.set('Ingresa un nombre de al menos 2 caracteres.');
      return;
    }

    // Validar longitud de contraseña.
    if (this.password.length < 8 || this.password.length > 128) {
      this.error.set('La contraseña debe tener entre 8 y 128 caracteres.');
      return;
    }

    // Confirmar que ambas contraseñas coincidan.
    if (this.password !== this.confirmarPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    // Activar indicador de carga.
    this.cargando.set(true);

    // Enviar el registro al backend Flask.
    this.auth
      .registrar({
        nombre: this.nombre.trim(),

        correo: this.correo.trim().toLowerCase(),

        telefono: this.telefono.trim(),

        password: this.password,
      })
      .subscribe({
        // ====================================
        // REGISTRO EXITOSO
        // ====================================

        next: () => {
          this.cargando.set(false);

          // Limpiar datos sensibles.
          this.password = '';
          this.confirmarPassword = '';

          // El registro no inicia sesión
          // automáticamente.
          this.router.navigate(['/login'], {
            queryParams: {
              registrado: '1',
            },
          });
        },

        // ====================================
        // ERROR DE REGISTRO
        // ====================================

        error: (error: HttpErrorResponse) => {
          this.cargando.set(false);

          if (error.status === 409) {
            this.error.set('Este correo ya está registrado.');
          } else if (error.status === 400) {
            this.error.set(error.error?.message || 'Revisa los datos del formulario.');
          } else if (error.status === 0) {
            this.error.set('No se pudo conectar con Flask.');
          } else {
            this.error.set('Ocurrió un error al crear la cuenta.');
          }
        },
      });
  }
}
