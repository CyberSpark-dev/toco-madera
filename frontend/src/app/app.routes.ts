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

  /**
   * ==================================================
   * ETAPA 3.16 - ADMINISTRACIÓN DE PROVEEDORES
   * ==================================================
   *
   * Ruta protegida mediante adminGuard.
   * El componente se carga únicamente al navegar
   * a la sección administrativa correspondiente.
   */

  {
    path: 'admin/proveedores',

    title: 'Toco Madera | Gestión de proveedores',

    // Impedir el acceso sin una sesión ADMIN.
    canActivate: [adminGuard],

    // Carga diferida del componente.
    loadComponent: () => import('./admin/proveedores/proveedores').then((m) => m.ProveedoresAdmin),
  },

  /**
   * ==================================================
   * ETAPA 3.16 - MATERIAS PRIMAS
   * ==================================================
   *
   * La ruta se encuentra protegida mediante
   * el guard administrativo existente.
   */

  {
    path: 'admin/materiales',

    title: 'Toco Madera | Materias primas',

    canActivate: [adminGuard],

    loadComponent: () => import('./admin/materiales/materiales').then((m) => m.MaterialesAdmin),
  },

  /**
   * ==================================================
   * ETAPA 3.17 - GESTIÓN ADMINISTRATIVA DE COMPRAS
   * ==================================================
   */

  {
    path: 'admin/compras',

    title: 'Toco Madera | Compras',

    canActivate: [adminGuard],

    loadComponent: () => import('./admin/compras/compras').then((m) => m.ComprasAdmin),
  },

  /**
   * ==================================================
   * ETAPA 3.17.6 - INVENTARIO ADMINISTRATIVO
   * ==================================================
   */

  {
    path: 'admin/inventario',

    title: 'Toco Madera | Inventario',

    canActivate: [adminGuard],

    loadComponent: () => import('./admin/inventario/inventario').then((m) => m.InventarioAdmin),
  },

  /**
   * ==================================================
   * ETAPA 3.17.7 - RECETAS DE FABRICACIÓN
   * ==================================================
   */

  {
    path: 'admin/recetas',

    title: 'Toco Madera | Recetas',

    canActivate: [adminGuard],

    loadComponent: () => import('./admin/recetas/recetas').then((m) => m.RecetasAdmin),
  },

  /**
   * ==================================================
   * TOCO MADERA - ETAPA 3.18
   * RUTAS DEL CLIENTE
   * ==================================================
   */

  {
    path: 'cliente/carrito',
    title: 'Toco Madera | Carrito',
    loadComponent: () => import('./cliente/carrito/carrito').then((m) => m.CarritoCliente),
  },

  {
    path: 'cliente/checkout',
    title: 'Toco Madera | Checkout',
    loadComponent: () => import('./cliente/checkout/checkout').then((m) => m.CheckoutCliente),
  },

  {
    path: 'cliente/mis-pedidos',
    title: 'Toco Madera | Mis pedidos',
    loadComponent: () =>
      import('./cliente/mis-pedidos/mis-pedidos').then((m) => m.MisPedidosCliente),
  },

  // ====================================================
  // 6. RUTA DESCONOCIDA
  // ====================================================

  {
    path: '**',
    redirectTo: '',
  },
];
