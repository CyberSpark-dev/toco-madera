/**
 * ==========================================
 * TOCO MADERA - CONFIGURACIÓN ANGULAR
 * ==========================================
 */

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

import { provideRouter } from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';

import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Registrar el manejo global de errores.
    provideBrowserGlobalErrorListeners(),

    // Registrar las rutas de Angular.
    provideRouter(routes),

    // Habilitar HTTP y el envío automático del JWT.
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
