/**
 * ==========================================
 * TOCO MADERA - PÁGINA DE INICIO DEL CLIENTE
 * Archivo: src/app/cliente/inicio/inicio.ts
 * ==========================================
 *
 * Responsabilidades:
 * 1. Mostrar la identidad de Toco Madera.
 * 2. Consultar los productos desde Flask.
 * 3. Actualizar el catálogo con datos de MySQL.
 * 4. Manejar estados de carga y errores.
 */

// ==========================================
// 1. IMPORTACIONES
// ==========================================

// Component: permite crear componentes Angular.
// OnInit: ejecuta acciones al iniciar el componente.
// inject: obtiene servicios mediante inyección.
// signal: almacena información reactiva.
import { Component, OnInit, inject, signal } from '@angular/core';

// RouterLink: permite navegar entre páginas.
// CurrencyPipe: permite mostrar precios en MXN.
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';

// Servicio de comunicación con Flask.
// Producto: interfaz que describe los datos recibidos.
import { Api, Producto } from '../../core/services/api';

// ==========================================
// 2. CONFIGURACIÓN DEL COMPONENTE
// ==========================================

@Component({
  selector: 'app-inicio',

  // Utilizamos componentes independientes.
  standalone: true,

  // Herramientas utilizadas en inicio.html.
  imports: [RouterLink, CurrencyPipe],

  // Archivos visuales del componente.
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})

// ==========================================
// 3. CLASE PRINCIPAL DEL COMPONENTE
// ==========================================
export class Inicio implements OnInit {
  // ========================================
  // IDENTIDAD DE LA EMPRESA
  // ========================================

  // Nombre comercial.
  nombreEmpresa = 'Toco Madera';

  // Eslogan oficial de la marca.
  eslogan = 'Frases que vienen de raíz y se graban en el corazón.';

  // ========================================
  // SERVICIO HTTP
  // ========================================

  // Inyectamos nuestro servicio Api.
  // Este servicio envía peticiones a Flask.
  private readonly api = inject(Api);

  // ========================================
  // ESTADOS DEL CATÁLOGO
  // ========================================

  // Lista inicial vacía.
  // Después se llenará con los productos
  // consultados desde la base de datos.
  productos = signal<Producto[]>([]);

  // Indica si estamos consultando la API.
  cargandoProductos = signal(true);

  // Almacena mensajes de error.
  errorProductos = signal('');

  // ========================================
  // INICIALIZACIÓN DEL COMPONENTE
  // ========================================

  // Angular ejecuta este método automáticamente
  // cuando se inicializa la página de inicio.
  ngOnInit(): void {
    // Solicitar productos a Flask.
    this.cargarProductos();
  }

  // ========================================
  // CONSULTAR PRODUCTOS EN MYSQL
  // ========================================

  cargarProductos(): void {
    // Activar el indicador de carga.
    this.cargandoProductos.set(true);

    // Limpiar cualquier error anterior.
    this.errorProductos.set('');

    // Realizar la petición HTTP GET.
    this.api.obtenerProductos().subscribe({
      // ====================================
      // RESPUESTA EXITOSA
      // ====================================
      next: (respuesta) => {
        // Guardar productos recibidos.
        this.productos.set(respuesta.productos);

        // Desactivar el estado de carga.
        this.cargandoProductos.set(false);

        // Mostrar información para depuración.
        console.log('Productos recibidos desde Flask:', respuesta.productos);
      },

      // ====================================
      // ERROR DE CONEXIÓN
      // ====================================
      error: (error) => {
        // Mostrar detalles técnicos en consola.
        console.error('Error al consultar productos:', error);

        // Mensaje para el usuario.
        this.errorProductos.set('No fue posible cargar los productos. Intenta nuevamente.');

        // Finalizar el estado de carga.
        this.cargandoProductos.set(false);
      },
    });
  }
}
