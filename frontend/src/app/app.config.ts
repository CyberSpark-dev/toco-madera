/**
 * ==========================================
 * TOCO MADERA - CONFIGURACIÓN ANGULAR
 * ETAPA 3.21 - PWA INSTALABLE
 * ==========================================
 */

import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';

import { provideRouter } from '@angular/router';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

// Service Worker de Angular para habilitar la PWA.
import { provideServiceWorker } from '@angular/service-worker';

// Rutas de navegación del proyecto.
import { routes } from './app.routes';

// Interceptor que agrega el JWT a las peticiones protegidas.
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Registrar el manejo global de errores.
    provideBrowserGlobalErrorListeners(),

    // Registrar las rutas de Angular.
    provideRouter(routes),

    // Habilitar HTTP y el envío automático del JWT.
    provideHttpClient(withInterceptors([authInterceptor])),

    // ==========================================
    // ETAPA 3.21 - SERVICE WORKER
    // ==========================================
    // Solo se habilita en producción.
    // No afecta al desarrollo con npm start.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
