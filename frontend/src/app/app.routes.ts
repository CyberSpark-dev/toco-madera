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
  {
    path: '',
    pathMatch: 'full',
    title: 'Toco Madera | Inicio',

    loadComponent: () => import('./cliente/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'login',
    title: 'Toco Madera | Iniciar sesión',

    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Toco Madera | Crear cuenta',

    loadComponent: () => import('./auth/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'cliente/carrito',
    title: 'Toco Madera | Carrito',
    loadComponent: () => import('./cliente/carrito/carrito').then((m) => m.CarritoCliente),
  },
  {
    path: 'cliente/checkout',
    title: 'Toco Madera | Confirmación del pedido',
    loadComponent: () => import('./cliente/checkout/checkout').then((m) => m.CheckoutCliente),
  },
  {
    path: 'cliente/mis-pedidos',
    title: 'Toco Madera | Mis pedidos',
    loadComponent: () =>
      import('./cliente/mis-pedidos/mis-pedidos').then((m) => m.MisPedidosCliente),
  },
  { path:'cliente/mi-cuenta', title:'Toco Madera | Mi cuenta',
    loadComponent:()=>import('./cliente/mi-cuenta/mi-cuenta').then(m=>m.MiCuenta) },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: 'dashboard',
        title: 'Toco Madera | Dashboard',

        canActivate: [adminGuard],

        loadComponent: () => import('./admin/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'productos',
        title: 'Toco Madera | Productos',

        // Solo usuarios con sesión ADMIN.
        canActivate: [adminGuard],

        loadComponent: () => import('./admin/productos/productos').then((m) => m.ProductosAdmin),
      },
      {
        path: 'proveedores',

        title: 'Toco Madera | Proveedores',

        // Impedir el acceso sin una sesión ADMIN.
        canActivate: [adminGuard],

        // Carga diferida del componente.
        loadComponent: () => import('./admin/proveedores/proveedores').then((m) => m.ProveedoresAdmin),
      },
      {
        path: 'materiales',

        title: 'Toco Madera | Materias primas',

        canActivate: [adminGuard],

        loadComponent: () => import('./admin/materiales/materiales').then((m) => m.MaterialesAdmin),
      },
      {
        path: 'compras',

        title: 'Toco Madera | Compras',

        canActivate: [adminGuard],

        loadComponent: () => import('./admin/compras/compras').then((m) => m.ComprasAdmin),
      },
      {
        path: 'inventario',

        title: 'Toco Madera | Inventario',

        canActivate: [adminGuard],

        loadComponent: () => import('./admin/inventario/inventario').then((m) => m.InventarioAdmin),
      },
      {
        path: 'recetas',

        title: 'Toco Madera | Recetas',

        canActivate: [adminGuard],

        loadComponent: () => import('./admin/recetas/recetas').then((m) => m.RecetasAdmin),
      },
      {
        path: 'pedidos',
        title: 'Toco Madera | Pedidos y autorizaciones',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/pedidos/pedidos').then((m) => m.PedidosAdmin),
      },
      {
        path: 'operaciones',
        title: 'Toco Madera | Producción y entregas',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/operaciones/operaciones').then((m) => m.OperacionesAdmin),
      },
      { path: 'clientes', title:'Toco Madera | Clientes', canActivate:[adminGuard],
        loadComponent:()=>import('./admin/clientes/clientes').then(m=>m.ClientesAdmin) },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
