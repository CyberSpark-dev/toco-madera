import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type TipoNotificacion = 'error' | 'exito' | 'aviso';
interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class Notificaciones {
  private readonly estado = signal<Notificacion[]>([]);
  readonly mensajes = this.estado.asReadonly();
  private readonly tiempos = new Map<number, ReturnType<typeof setTimeout>>();
  private secuencia = 0;

  mostrar(tipo: TipoNotificacion, texto: string): number {
    const existente = this.estado().find((item) => item.tipo === tipo && item.texto === texto);
    if (existente) return existente.id;
    const id = ++this.secuencia;
    this.estado.update((mensajes) => [...mensajes, { id, tipo, texto }]);
    if (tipo === 'exito') this.tiempos.set(id, setTimeout(() => this.cerrar(id), 6500));
    return id;
  }

  cerrar(id: number): void {
    clearTimeout(this.tiempos.get(id));
    this.tiempos.delete(id);
    this.estado.update((mensajes) => mensajes.filter((item) => item.id !== id));
  }
}

/** Conserva el mensaje local y anuncia el resultado en el área común. */
export function mensajeNotificable(tipo: TipoNotificacion) {
  const servicio = inject(Notificaciones);
  const valor = signal('');
  let id: number | undefined;
  const limpiar = () => {
    if (id !== undefined) servicio.cerrar(id);
    id = undefined;
  };
  if (tipo !== 'exito') inject(DestroyRef).onDestroy(limpiar);
  return Object.assign(valor.asReadonly(), {
    set(texto: string) {
      if (valor() !== texto) limpiar();
      valor.set(texto);
      if (texto) id = servicio.mostrar(tipo, texto);
    },
  });
}
