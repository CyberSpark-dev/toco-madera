import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';

interface SolicitudInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class InstalacionPwa {
  private readonly ventana = inject(DOCUMENT).defaultView;
  private readonly modo = this.ventana?.matchMedia?.('(display-mode: standalone)');
  private solicitud?: SolicitudInstalacion;

  readonly instalada = signal(this.enModoAplicacion());
  readonly procesando = signal(false);
  readonly mostrarInstrucciones = signal(false);
  readonly mensaje = signal('');

  constructor() {
    const ventana = this.ventana;
    if (!ventana) return;
    const recibir = (evento: Event) => {
      evento.preventDefault();
      if (!this.instalada() && !this.procesando()) this.solicitud = evento as SolicitudInstalacion;
    };
    const instalada = () => {
      this.solicitud = undefined;
      this.instalada.set(true);
      this.mostrarInstrucciones.set(false);
      this.mensaje.set('El navegador confirmó la instalación de Toco Madera.');
    };
    const cambiarModo = () => { if (this.enModoAplicacion()) instalada(); };
    ventana.addEventListener('beforeinstallprompt', recibir);
    ventana.addEventListener('appinstalled', instalada);
    this.modo?.addEventListener?.('change', cambiarModo);
    inject(DestroyRef).onDestroy(() => {
      ventana.removeEventListener('beforeinstallprompt', recibir);
      ventana.removeEventListener('appinstalled', instalada);
      this.modo?.removeEventListener?.('change', cambiarModo);
    });
  }

  async instalar(): Promise<void> {
    if (this.instalada() || this.procesando()) return;
    const solicitud = this.solicitud;
    if (!solicitud) {
      this.mostrarInstrucciones.update((visible) => !visible);
      return;
    }

    this.solicitud = undefined;
    this.procesando.set(true);
    this.mostrarInstrucciones.set(false);
    this.mensaje.set('');
    try {
      await solicitud.prompt();
      const eleccion = await solicitud.userChoice;
      if (!this.instalada()) this.mensaje.set(eleccion.outcome === 'accepted'
        ? 'Solicitud aceptada. Esperando la confirmación del navegador.'
        : 'Instalación cancelada. Puedes consultar las instrucciones cuando quieras.');
    } catch {
      if (!this.instalada()) {
        this.mensaje.set('El navegador no pudo abrir la instalación.');
        this.mostrarInstrucciones.set(true);
      }
    } finally {
      this.procesando.set(false);
    }
  }

  private enModoAplicacion(): boolean {
    const navegador = this.ventana?.navigator as (Navigator & { standalone?: boolean }) | undefined;
    return !!(this.modo?.matches || navegador?.standalone);
  }
}
