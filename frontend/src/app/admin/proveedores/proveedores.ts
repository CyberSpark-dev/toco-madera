import { mensajeNotificable } from '../../core/services/notificaciones';
import { mensajeError } from '../../core/utils/mensajes';
/**
 * ======================================================
 * TOCO MADERA - GESTIÓN ADMINISTRATIVA DE PROVEEDORES
 * Archivo: admin/proveedores/proveedores.ts
 * ETAPA 3.16
 * ======================================================
 *
 * Funciones:
 * - Consultar todos los proveedores de MySQL.
 * - Buscar por nombre, contacto y correo.
 * - Filtrar por estado.
 * - Registrar y editar proveedores.
 * - Activar o desactivar proveedores.
 * - Proteger operaciones mediante JWT.
 * - Mostrar mensajes de error y confirmación.
 * ======================================================
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import {
  AdminProveedores,
  ProveedorAdmin,
  ProveedorFormulario,
} from '../../core/services/admin-proveedores';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-proveedores-admin',
  standalone: true,

  imports: [FormsModule],

  templateUrl: './proveedores.html',
  styleUrl: './proveedores.css',
})
export class ProveedoresAdmin implements OnInit {
  // ====================================================
  // 1. SERVICIOS
  // ====================================================

  private readonly api = inject(AdminProveedores);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // ====================================================
  // 2. ESTADOS REACTIVOS
  // ====================================================

  proveedores = signal<ProveedorAdmin[]>([]);

  cargando = signal(true);
  guardando = signal(false);

  error = mensajeNotificable('error');
  mensaje = mensajeNotificable('exito');
  errorFormulario = mensajeNotificable('error');

  busqueda = signal('');
  filtroEstado = signal('TODOS');

  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);

  proveedorPendiente = signal<ProveedorAdmin | null>(null);

  // ====================================================
  // 3. FORMULARIO INICIAL
  // ====================================================

  formulario: ProveedorFormulario = {
    nombre: '',
    contacto: '',
    telefono: '',
    correo: '',
    direccion: '',
    sitio_web: '',
  };

  // ====================================================
  // 4. FILTRADO DE PROVEEDORES
  // ====================================================

  readonly proveedoresFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();

    const estado = this.filtroEstado();

    return this.proveedores().filter((proveedor) => {
      const camposBusqueda = [
        proveedor.nombre,
        proveedor.contacto ?? '',
        proveedor.correo ?? '',
        proveedor.telefono ?? '',
      ];

      const coincideTexto = camposBusqueda.some((campo) =>
        campo.toLocaleLowerCase().includes(texto),
      );

      const coincideEstado =
        estado === 'TODOS' ||
        (estado === 'ACTIVOS' && proveedor.activo) ||
        (estado === 'INACTIVOS' && !proveedor.activo);

      return coincideTexto && coincideEstado;
    });
  });

  // ====================================================
  // 5. INICIALIZACIÓN
  // ====================================================

  ngOnInit(): void {
    this.cargarProveedores();
  }

  // ====================================================
  // 6. CONSULTAR PROVEEDORES
  // ====================================================

  cargarProveedores(): void {
    this.cargando.set(true);
    this.error.set('');

    this.api.listarProveedores().subscribe({
      next: (respuesta) => {
        this.proveedores.set(respuesta.proveedores);
        this.cargando.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);

        this.manejarError(error, 'No fue posible consultar los proveedores.');
      },
    });
  }

  // ====================================================
  // 7. DESPLAZARSE AL FORMULARIO
  // ====================================================

  private irAlFormulario(): void {
    // Esperar a que Angular renderice la sección
    // activada por mostrarFormulario().
    setTimeout(() => {
      document.getElementById('formulario-proveedor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  // ====================================================
  // 8. ABRIR FORMULARIO NUEVO
  // ====================================================

  nuevoProveedor(): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');
    this.errorFormulario.set('');

    // No existe ID porque es un registro nuevo.
    this.editandoId.set(null);

    this.formulario = {
      nombre: '',
      contacto: '',
      telefono: '',
      correo: '',
      direccion: '',
      sitio_web: '',
    };

    this.mostrarFormulario.set(true);
    this.irAlFormulario();
  }

  // ====================================================
  // 9. ABRIR FORMULARIO DE EDICIÓN
  // ====================================================

  editarProveedor(proveedor: ProveedorAdmin): void {
    if (this.guardando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');
    this.errorFormulario.set('');

    // Guardar el identificador original.
    this.editandoId.set(proveedor.id_proveedor);

    // Copiar datos sin alterar la tabla.
    this.formulario = {
      nombre: proveedor.nombre,
      contacto: proveedor.contacto ?? '',
      telefono: proveedor.telefono ?? '',
      correo: proveedor.correo ?? '',
      direccion: proveedor.direccion ?? '',
      sitio_web: proveedor.sitio_web ?? '',
    };

    this.mostrarFormulario.set(true);
    this.irAlFormulario();
  }

  // ====================================================
  // 10. CERRAR FORMULARIO
  // ====================================================

  cerrarFormulario(): void {
    if (this.guardando()) {
      return;
    }

    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
    this.errorFormulario.set('');
  }

  // ====================================================
  // 11. GUARDAR PROVEEDOR
  // ====================================================

  guardarProveedor(): void {
    if (this.guardando()) {
      return;
    }

    this.errorFormulario.set('');
    this.mensaje.set('');

    const nombre = this.formulario.nombre.trim();

    // Validación inicial de nombre.
    if (nombre.length < 2) {
      this.errorFormulario.set('El nombre del proveedor debe tener al menos dos caracteres.');

      return;
    }

    const correo = this.formulario.correo.trim();

    // Validación de correo opcional.
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.errorFormulario.set('Ingresa un correo electrónico válido.');

      return;
    }

    const sitioWeb = this.formulario.sitio_web.trim();

    if (sitioWeb && !/^https?:\/\/.+/i.test(sitioWeb)) {
      this.errorFormulario.set('El sitio web debe comenzar con http:// o https://.');

      return;
    }

    // Preparar datos comerciales.
    const datos: ProveedorFormulario = {
      nombre,
      contacto: this.formulario.contacto.trim(),
      telefono: this.formulario.telefono.trim(),
      correo,
      direccion: this.formulario.direccion.trim(),
      sitio_web: sitioWeb,
    };

    this.guardando.set(true);

    const id = this.editandoId();

    // POST para crear; PUT para editar.
    const operacion =
      id === null ? this.api.registrarProveedor(datos) : this.api.editarProveedor(id, datos);

    operacion.subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);
        this.editandoId.set(null);

        this.mensaje.set(id === null ? 'Proveedor registrado correctamente.' : 'Los cambios se guardaron correctamente.');

        // Recuperar el estado real desde MySQL.
        this.cargarProveedores();

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        if (error.status === 401 || error.status === 403) {
          this.manejarError(error, 'Acceso administrativo denegado.');

          return;
        }

        this.errorFormulario.set(
          mensajeError(error, 'No fue posible guardar el proveedor.'),
        );
      },
    });
  }

  // ====================================================
  // 12. SOLICITAR CAMBIO DE ESTADO
  // ====================================================

  solicitarCambioEstado(proveedor: ProveedorAdmin): void {
    this.error.set('');
    this.mensaje.set('');

    this.proveedorPendiente.set(proveedor);
  }

  // ====================================================
  // 13. CANCELAR CONFIRMACIÓN
  // ====================================================

  cancelarCambioEstado(): void {
    if (!this.guardando()) {
      this.proveedorPendiente.set(null);
    }
  }

  // ====================================================
  // 14. CAMBIAR ESTADO
  // ====================================================

  confirmarCambioEstado(): void {
    const proveedor = this.proveedorPendiente();

    if (!proveedor || this.guardando()) {
      return;
    }

    this.guardando.set(true);

    const nuevoEstado = !proveedor.activo;

    this.api.cambiarEstado(proveedor.id_proveedor, nuevoEstado).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.proveedorPendiente.set(null);

        this.mensaje.set(nuevoEstado ? 'Proveedor activado correctamente.' : 'Proveedor desactivado correctamente.');
        this.cargarProveedores();
      },

      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.proveedorPendiente.set(null);

        this.manejarError(error, 'No fue posible cambiar el estado del proveedor.');
      },
    });
  }

  // ====================================================
  // 15. CONTROL DE ERRORES Y AUTORIZACIÓN
  // ====================================================

  private manejarError(error: HttpErrorResponse, mensajePredeterminado: string): void {
    console.error('Error administrativo de proveedores:', error);

    if (error.status === 401) {
      // Token ausente, inválido o expirado.
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/login');

      return;
    }

    if (error.status === 403) {
      // Rol sin permisos.
      this.auth.cerrarSesion();
      this.router.navigateByUrl('/');

      return;
    }

    this.error.set(mensajeError(error, mensajePredeterminado));
  }

  // ====================================================
  // 16. CERRAR SESIÓN
  // ====================================================

  cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login');
  }
}
