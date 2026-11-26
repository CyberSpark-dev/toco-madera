import { Component, inject } from '@angular/core';
import { InstalacionPwa } from './instalacion-pwa';

@Component({
  selector: 'app-instalacion-pwa',
  template: `
    <section id="instalacion-toco-madera" aria-label="Instalación de Toco Madera" class="mt-4 scroll-mt-4">
      @if (servicio.instalada()) {
        <p class="font-semibold text-[#4d5d43]">Toco Madera está instalada.</p>
      } @else {
        <button id="instalar-toco-madera" type="button" (click)="servicio.instalar()"
          [disabled]="servicio.procesando()" [attr.aria-expanded]="servicio.mostrarInstrucciones()"
          aria-controls="opciones-instalacion"
          class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#77876d] bg-[#e8ecdf] px-4 py-2 text-sm font-bold text-[#344436] hover:bg-[#dbe3d0] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
          </svg>
          Instalar Toco Madera
        </button>
      }
      <p role="status" class="mt-1 text-sm">{{ servicio.mensaje() }}</p>
      <div id="opciones-instalacion" [hidden]="!servicio.mostrarInstrucciones()" class="mt-2 rounded-lg bg-[#e8ecdf] p-3 text-sm">
        <p><strong>Android:</strong> en Chrome, abre ⋮ y elige <em>Instalar aplicación</em> o <em>Añadir a pantalla de inicio</em>.</p>
        <p class="mt-2"><strong>iPhone:</strong> en Safari, toca <em>Compartir</em> y luego <em>Añadir a pantalla de inicio</em>.</p>
        <p class="mt-2"><strong>Escritorio:</strong> busca el icono de instalación en la barra de direcciones o la opción de instalar en el menú de Chrome o Edge.</p>
        <p class="mt-2">Si no aparece la opción, usa un navegador compatible y abre la tienda por HTTPS.</p>
      </div>
    </section>
  `,
})
export class InstalacionPwaVista {
  readonly servicio = inject(InstalacionPwa);
}
