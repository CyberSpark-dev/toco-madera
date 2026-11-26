import { IdentidadTocoMadera } from '../../core/ui/identidad-toco-madera';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-admin-layout',
  imports: [IdentidadTocoMadera, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly contenido = viewChild.required<ElementRef<HTMLElement>>('contenido');
  readonly menuAbierto = signal(false);

  readonly grupos = [
    { titulo: 'General', enlaces: [
      { ruta: 'dashboard', etiqueta: 'Dashboard', icono: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
      { ruta: 'pedidos', etiqueta: 'Pedidos y autorizaciones', icono: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4' },
      { ruta: 'clientes', etiqueta: 'Clientes', icono: 'M4 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2 M16 15a4 4 0 0 1 4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    ] },
    { titulo: 'Catálogo y taller', enlaces: [
      { ruta: 'productos', etiqueta: 'Productos', icono: 'm12 3 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8' },
      { ruta: 'materiales', etiqueta: 'Materias primas', icono: 'm12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5' },
      { ruta: 'inventario', etiqueta: 'Inventario', icono: 'M4 5h16v4H4z M6 9v12h12V9 M10 13h4' },
      { ruta: 'recetas', etiqueta: 'Recetas', icono: 'M5 4h13v16H5z M9 8h5 M9 12h5 M9 16h3' },
      { ruta: 'operaciones', etiqueta: 'Producción y entregas', icono: 'M3 6h11v12H3z M14 10h4l3 4v4h-7 M7 21v-3 M17 21v-3' },
    ] },
    { titulo: 'Abastecimiento', enlaces: [
      { ruta: 'proveedores', etiqueta: 'Proveedores', icono: 'M4 21h16 M6 21V5h12v16 M10 9h4 M10 13h4 M10 17h4' },
      { ruta: 'compras', etiqueta: 'Compras', icono: 'M3 4h2l2 11h12l2-8H6 M9 20h.01 M18 20h.01' },
    ] },
  ];

  constructor() {
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => {
      if (this.menuAbierto()) this.cerrarMenuAlNavegar();
    });
  }

  cerrarMenuAlNavegar(evento?: MouseEvent): void {
    if (evento?.ctrlKey || evento?.metaKey || evento?.shiftKey || evento?.altKey) return;
    this.menuAbierto.set(false);
    this.contenido().nativeElement.focus();
  }

  cerrarConEscape(evento: Event): void {
    if (!this.menuAbierto()) return;
    evento.preventDefault();
    this.menuAbierto.set(false);
    this.menuButton().nativeElement.focus();
  }

  cerrarSesion(): void {
    if (!window.confirm('¿Estás seguro de que quieres cerrar sesión como administrador?')) return;
    this.menuAbierto.set(false);
    this.auth.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }
}
