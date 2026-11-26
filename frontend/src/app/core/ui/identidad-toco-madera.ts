import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-identidad-toco-madera',
  template: `
    <a href="/" (click)="irInicio($event)" [attr.aria-label]="administrativa() ? 'Toco Madera · Ir a la tienda' : null"
      class="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md font-brand text-lg font-bold leading-tight text-inherit focus-visible:outline-2 focus-visible:outline-offset-2">
      <img src="/logo-icono.png" alt="" width="44" height="44" class="size-9 shrink-0 rounded-lg bg-crema object-contain p-0.5 sm:size-11" />
      <span>Toco Madera</span>
    </a>
  `,
})
export class IdentidadTocoMadera {
  readonly administrativa = input(false);
  private readonly router = inject(Router);

  irInicio(evento: MouseEvent): void {
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;
    evento.preventDefault();
    if (this.administrativa() && !window.confirm('¿Ir a la tienda? Si tienes cambios sin guardar, guarda antes de salir.')) return;
    void this.router.navigateByUrl('/');
  }
}
