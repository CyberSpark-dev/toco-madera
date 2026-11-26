import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { IdentidadTocoMadera } from './identidad-toco-madera';

describe('Identidad Toco Madera', () => {
  it('enlaza a la tienda y protege la salida desde administración', () => {
    const navegar = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: navegar } }] });
      const vista = TestBed.createComponent(IdentidadTocoMadera);
      vista.detectChanges();
      const ancla = vista.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(ancla.getAttribute('href')).toBe('/');
      expect(ancla.querySelector('img')?.getAttribute('src')).toBe('/logo-icono.png');
      expect(ancla.textContent).toContain('Toco Madera');
      ancla.click();
      expect(navegar).toHaveBeenCalledExactlyOnceWith('/');
      vista.componentRef.setInput('administrativa', true);
      vista.detectChanges();
      ancla.click();
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(navegar).toHaveBeenCalledTimes(1);
      confirmar.mockReturnValue(true);
      ancla.click();
      expect(navegar).toHaveBeenCalledTimes(2);
    } finally {
      confirmar.mockRestore();
    }
  });
});
