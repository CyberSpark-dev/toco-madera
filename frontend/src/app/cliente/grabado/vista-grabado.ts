import { Component, computed, input, signal } from '@angular/core';
import { imagenProducto } from '../../core/utils/imagenes-productos';

// Solo se superpone texto sobre bases limpias. La posición pertenece al encuadre, no al nombre.
const zonas: Record<string, {
  original: string; base: string; x: number; y: number; ancho: number; alto: number;
  maximo: number; minimo: number; color: string; adorno: boolean;
}> = {
  'TM-PT-01': {
    original: '/productos/solo/portatelefonos.webp',
    base: '/productos/solo/portatelefonos-base-grabado.webp',
    x: 52, y: 70, ancho: 57, alto: 13,
    maximo: 11, minimo: 2.8, color: '#3b180d', adorno: false,
  },
  'TM-MF-01': {
    original: '/productos/solo/marco_fotografias.webp',
    base: '/productos/solo/marco_fotografias-base-grabado.webp',
    x: 50, y: 80.5, ancho: 46, alto: 12,
    maximo: 10, minimo: 2.8, color: '#3b180d', adorno: false,
  },
  'TM-RC-01': {
    original: '/productos/solo/rodillo_cocina.webp',
    base: '/productos/solo/rodillo_cocina-base-grabado.webp',
    x: 50, y: 51, ancho: 54, alto: 13,
    maximo: 10, minimo: 2.8, color: '#39180b', adorno: false,
  },
  'TM-RP-01': {
    original: '/productos/solo/repisa.webp',
    base: '/productos/solo/repisa-base-grabado.webp',
    x: 50, y: 50.4, ancho: 55, alto: 8.5,
    maximo: 7.4, minimo: 2.8, color: '#3b180d', adorno: false,
  },
  'TM-PL-01': {
    original: '/productos/solo/portallaves.webp',
    base: '/productos/solo/portallaves-base-grabado.webp',
    x: 50, y: 41.3, ancho: 68, alto: 15.4,
    maximo: 14, minimo: 2.8, color: '#3b180d', adorno: true,
  },
  'TM-PE-01': {
    original: '/productos/solo/placa_escritorio.webp',
    base: '/productos/solo/placa_escritorio-base-grabado.webp',
    x: 50, y: 50.5, ancho: 62, alto: 14.5,
    maximo: 12, minimo: 2.8, color: '#3b180d', adorno: false,
  },
};

@Component({
  selector: 'app-vista-grabado',
  templateUrl: './vista-grabado.html',
  styleUrl: './vista-grabado.css',
})
export class VistaGrabado {
  readonly nombre = input.required<string>();
  readonly sku = input.required<string>();
  readonly texto = input('');
  readonly permite = input(false);
  readonly fotoOriginal = computed(() => imagenProducto(this.nombre(), 'solo'));
  readonly foto = computed(() => this.zona()?.base ?? this.fotoOriginal());
  readonly estado = signal<{ foto: string; disponible: boolean } | null>(null);

  readonly zona = computed(() => {
    const configurada = zonas[this.sku().trim().toUpperCase()];
    return this.permite() && configurada?.original === this.fotoOriginal() ? configurada : null;
  });

  readonly grabado = computed(() => this.permite() ? this.texto() : '');
  readonly tamano = computed(() => {
    const zona = this.zona();
    if (!zona) return 0;
    const lineas = this.grabado().split(/\r\n|[\r\n\u2028\u2029]/u);
    const amplitud = Math.max(1, ...lineas.map((linea) => [...linea].reduce(
      (ancho, letra) => ancho + (/[MWÁÉÍÓÚÑA-Z\p{Extended_Pictographic}]/u.test(letra) ? .84 : .58), 0,
    )));
    const unaLineaPorRenglon = Math.min(zona.ancho / (amplitud + 1), zona.alto / (1.12 * lineas.length));
    if (lineas.length > 1 || amplitud < 15) return Math.min(zona.maximo, unaLineaPorRenglon);
    const dosRenglones = Math.min(zona.ancho / (amplitud / 2 + 2), zona.alto / 2.24);
    return Math.min(zona.maximo, Math.max(unaLineaPorRenglon, dosRenglones));
  });
  readonly zonaVisible = computed(() => {
    const zona = this.zona();
    return zona && this.tamano() >= zona.minimo ? zona : null;
  });

  actualizarFoto(foto: string, disponible: boolean): void {
    if (this.foto() === foto) this.estado.set({ foto, disponible });
  }
}
