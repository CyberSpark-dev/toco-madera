/**
 * TOCO MADERA - Métodos de pago exclusivamente DEMOSTRATIVOS.
 * Este servicio almacena únicamente IDs de ejemplos públicos y conocidos.
 * NUNCA guarda PAN reales, CLABE reales, CVV, vencimientos o contraseñas.
 * La lista se separa por id_usuario autenticado.
 */
import { Injectable, signal } from '@angular/core';

export type IdMedioDemo = 'VISA_DEMO' | 'MASTERCARD_DEMO' | 'CLABE_DEMO';
export type TipoMedioDemo = 'TARJETA_SIMULADA' | 'TRANSFERENCIA_SIMULADA';

export interface MedioDemo {
  id: IdMedioDemo;
  tipo: TipoMedioDemo;
  etiqueta: string;
  ultimos4: string;
}

const EJEMPLOS: Record<IdMedioDemo, { numero: string; tipo: TipoMedioDemo; etiqueta: string }> = {
  VISA_DEMO: {
    numero: '4242424242424242',
    tipo: 'TARJETA_SIMULADA',
    etiqueta: 'Visa de prueba'
  },
  MASTERCARD_DEMO: {
    numero: '5555555555554444',
    tipo: 'TARJETA_SIMULADA',
    etiqueta: 'Mastercard de prueba'
  },
  CLABE_DEMO: {
    numero: '000000000000000000',
    tipo: 'TRANSFERENCIA_SIMULADA',
    etiqueta: 'CLABE ficticia (banco 000)'
  }
};

const IDS: IdMedioDemo[] = ['VISA_DEMO', 'MASTERCARD_DEMO', 'CLABE_DEMO'];

@Injectable({ providedIn: 'root' })
export class MetodosPagoDemoService {
  readonly guardados = signal<MedioDemo[]>([]);
  private usuarioActual: number | null = null;

  private clave(idUsuario: number): string {
    return `tm_demo_medios_v1_usuario_${idUsuario}`;
  }

  /** Debe ejecutarse al entrar al checkout con una cuenta cliente. */
  cargar(idUsuario: number | null): void {
    this.usuarioActual = Number.isInteger(idUsuario) && (idUsuario ?? 0) > 0
      ? idUsuario
      : null;
    if (this.usuarioActual === null) {
      this.guardados.set([]);
      return;
    }
    try {
      const valor = JSON.parse(localStorage.getItem(this.clave(this.usuarioActual)) || '[]');
      const lista = Array.isArray(valor)
        ? IDS.filter(id => valor.includes(id)).map(id => this.describir(id))
        : [];
      this.guardados.set(lista);
    } catch {
      this.guardados.set([]);
    }
  }

  identificar(numero: string, tipo: TipoMedioDemo): IdMedioDemo | null {
    const digitos = numero.replace(/\D/g, '');
    return IDS.find(id => EJEMPLOS[id].numero === digitos && EJEMPLOS[id].tipo === tipo) ?? null;
  }

  describir(id: IdMedioDemo): MedioDemo {
    const ejemplo = EJEMPLOS[id];
    return {
      id,
      tipo: ejemplo.tipo,
      etiqueta: ejemplo.etiqueta,
      ultimos4: ejemplo.numero.slice(-4)
    };
  }

  /** Autocompletado SOLO de números públicos y ficticios de prueba. */
  numeroDemo(id: IdMedioDemo): string {
    return EJEMPLOS[id].numero;
  }

  guardar(id: IdMedioDemo): void {
    if (this.usuarioActual === null) return;
    const actuales = this.guardados().map(x => x.id);
    const nuevos = IDS.filter(x => x === id || actuales.includes(x));
    try {
      localStorage.setItem(this.clave(this.usuarioActual), JSON.stringify(nuevos));
      this.guardados.set(nuevos.map(x => this.describir(x)));
    } catch {
      // El navegador puede bloquear el almacenamiento privado.
    }
  }

  eliminar(id: IdMedioDemo): void {
    if (this.usuarioActual === null) return;
    const nuevos = this.guardados().map(x => x.id).filter(x => x !== id);
    try {
      localStorage.setItem(this.clave(this.usuarioActual), JSON.stringify(nuevos));
    } catch {
      // En modo privado puede no permitirse escribir.
    }
    this.guardados.set(nuevos.map(x => this.describir(x)));
  }
}
