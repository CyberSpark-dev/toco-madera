import { Component, inject } from '@angular/core';
import { Notificaciones } from './notificaciones';

@Component({
  selector: 'app-notificaciones',
  styles: `
    aside {
      position: fixed;
      z-index: 70;
      inset-block-start: max(1rem, env(safe-area-inset-top));
      inset-inline-end: max(1rem, env(safe-area-inset-right));
      inset-inline-start: max(1rem, env(safe-area-inset-left));
      max-block-size: 40dvh;
      overflow-y: auto;
      pointer-events: none;
    }
    article { pointer-events: auto; overflow-wrap: anywhere; }
    @media (min-width: 48rem) { aside { inset-inline-start: auto; inline-size: min(24rem, 45vw); } }
    @media (max-width: 47.99rem) {
      aside { inset-block-start: auto; inset-block-end: max(1rem, env(safe-area-inset-bottom)); }
    }
  `,
  template: `
    <aside aria-label="Notificaciones">
      <div aria-live="assertive" aria-relevant="additions">
        @for (item of servicio.mensajes(); track item.id) {
          @if (item.tipo === 'error') {
            <article class="mb-2 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-red-950 shadow-lg">
              <p role="alert" class="flex-1 text-sm font-semibold">{{ item.texto }}</p>
              <button type="button" class="rounded px-2 text-sm underline focus-visible:ring-2"
                (click)="servicio.cerrar(item.id)">Cerrar</button>
            </article>
          }
        }
      </div>
      <div aria-live="polite" aria-relevant="additions">
        @for (item of servicio.mensajes(); track item.id) {
          @if (item.tipo !== 'error') {
            <article class="mb-2 flex items-start gap-3 rounded-xl border border-[#E8D6BF] bg-[#FFF9F2] p-3 text-nogal shadow-lg">
              <p role="status" class="flex-1 text-sm font-semibold">{{ item.texto }}</p>
              <button type="button" class="rounded px-2 text-sm underline focus-visible:ring-2"
                (click)="servicio.cerrar(item.id)">Cerrar</button>
            </article>
          }
        }
      </div>
    </aside>
  `,
})
export class NotificacionesVista {
  readonly servicio = inject(Notificaciones);
}
