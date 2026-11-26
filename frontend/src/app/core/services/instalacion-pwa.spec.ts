import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstalacionPwa } from './instalacion-pwa';

function aviso(outcome: 'accepted' | 'dismissed') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome }),
  });
  window.dispatchEvent(evento);
  return { evento, prompt };
}

describe('Instalación de Toco Madera', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('abre instrucciones si el navegador carece de solicitud directa', async () => {
    const app = TestBed.inject(InstalacionPwa);
    await app.instalar();
    expect(app.mostrarInstrucciones()).toBe(true);
    expect(app.instalada()).toBe(false);
  });

  it('espera la acción del usuario y consume cada evento solo una vez', async () => {
    const app = TestBed.inject(InstalacionPwa);
    const { evento, prompt } = aviso('dismissed');
    expect(evento.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await Promise.all([app.instalar(), app.instalar()]);
    expect(app.mensaje()).toContain('cancelada');
    await app.instalar();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(app.mostrarInstrucciones()).toBe(true);
  });

  it('solo marca instalada tras confirmación del navegador', async () => {
    const app = TestBed.inject(InstalacionPwa);
    aviso('accepted');
    await app.instalar();
    expect(app.mensaje()).toContain('Esperando');
    expect(app.instalada()).toBe(false);
    window.dispatchEvent(new Event('appinstalled'));
    expect(app.instalada()).toBe(true);
    expect(app.mensaje()).toContain('confirmó');
    expect(app.mostrarInstrucciones()).toBe(false);
  });
});
