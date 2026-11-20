/**
 * ==========================================
 * TOCO MADERA - GUARD ADMINISTRATIVO
 * Archivo: core/guards/admin.guard.ts
 * ==========================================
 *
 * Impide mostrar rutas administrativas
 * cuando Angular no reconoce una sesión
 * con rol ADMIN.
 *
 * La seguridad definitiva está en Flask.
 */

import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { Auth } from '../services/auth';

export const adminGuard: CanActivateFn = (_route, state) => {
  // Servicio que conserva el estado de sesión.
  const auth = inject(Auth);

  // Servicio de navegación.
  const router = inject(Router);

  // Permitir acceso a un administrador.
  if (auth.esAdministrador()) {
    return true;
  }

  // Si hay un cliente autenticado, volver a inicio.
  if (auth.autenticado()) {
    return router.createUrlTree(['/']);
  }

  // Si no existe sesión, enviar al login.
  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
};
