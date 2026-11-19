/**
 * ==================================================
 * TOCO MADERA - INTERCEPTOR DE AUTENTICACIÓN
 * Archivo: frontend/src/app/core/interceptors/
 *          auth.interceptor.ts
 * ==================================================
 *
 * Responsabilidad:
 * Adjuntar automáticamente el JWT a las peticiones
 * dirigidas a nuestra API Flask.
 *
 * El registro y login siguen siendo públicos.
 */

import { inject } from '@angular/core';

import { HttpInterceptorFn } from '@angular/common/http';

import { Auth } from '../services/auth';

// ==========================================
// INTERCEPTOR FUNCIONAL
// ==========================================

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Obtener el servicio de autenticación.
  const auth = inject(Auth);

  // Leer el token actualmente disponible.
  const token = auth.obtenerToken();

  // Dirección base de nuestra API Flask.
  const apiBase = 'http://127.0.0.1:5000/api/v1/';

  // No modificar peticiones hacia otros servidores.
  if (!req.url.startsWith(apiBase)) {
    return next(req);
  }

  // Si no existe token, continuar normalmente.
  // Esto permite utilizar el catálogo público,
  // el registro y el login.
  if (!token) {
    return next(req);
  }

  // Clonar la solicitud y agregar Authorization.
  const solicitudAutenticada = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Enviar la solicitud con su JWT.
  return next(solicitudAutenticada);
};
