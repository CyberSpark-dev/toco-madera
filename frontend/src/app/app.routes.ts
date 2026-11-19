/**
 * ======================================================
 * TOCO MADERA - RUTAS PRINCIPALES
 * Archivo: frontend/src/app/app.routes.ts
 * ======================================================
 */

import { Routes } from '@angular/router';

// Guard que exige sesión administrativa.
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // ====================================================
  // 1. PÁGINA PRINCIPAL
  // ====================================================

  {
    path: '',
    pathMatch: 'full',
    title: 'Toco Madera | Inicio',

    loadComponent: () => import('./cliente/inicio/inicio').then((m) => m.Inicio),
  },

  // ====================================================
  // 2. INICIO DE SESIÓN
  // ====================================================

  {
    path: 'login',
    title: 'Toco Madera | Iniciar sesión',

    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },

  // ====================================================
  // 3. REGISTRO DE CLIENTES
  // ====================================================

  {
    path: 'registro',
    title: 'Toco Madera | Crear cuenta',

    loadComponent: () => import('./auth/registro/registro').then((m) => m.Registro),
  },

  // ====================================================
  // 4. DASHBOARD ADMINISTRATIVO
  // ====================================================

  {
    path: 'admin/dashboard',
    title: 'Toco Madera | Dashboard',

    canActivate: [adminGuard],

    loadComponent: () => import('./admin/dashboard/dashboard').then((m) => m.Dashboard),
  },

  // ====================================================
  // 5. ADMINISTRACIÓN DE PRODUCTOS
  // ====================================================

  {
    path: 'admin/productos',
    title: 'Toco Madera | Gestión de productos',

    // Solo usuarios con sesión ADMIN.
    canActivate: [adminGuard],

    loadComponent: () => import('./admin/productos/productos').then((m) => m.ProductosAdmin),
  },

  // ====================================================
  // 6. RUTA DESCONOCIDA
  // ====================================================

  {
    path: '**',
    redirectTo: '',
  },
];
