import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ClientePedidosService, PedidoCliente } from '../../core/services/cliente-pedidos';
import { MisPedidosCliente } from './mis-pedidos';

describe('Cancelación de pedidos', () => {
  it('muestra el aviso, solicita confirmación y bloquea envíos repetidos', () => {
    const pedido: PedidoCliente = {
      id_pedido: 17, folio: 'TM-17', fecha: '2026-11-26', estado: 'CONFIRMADO', modalidad_pago: 'ANTICIPO_50',
      puede_cancelar: true, detalles: [], pagos: [], resumen: null,
      autorizacion: { estado: 'POR_REVISAR', fecha_decision: null, motivo: null },
    };
    const respuesta = new Subject<{ estado: string; message: string }>();
    const historial = vi.fn().mockReturnValueOnce(of({ pedidos: [pedido] })).mockReturnValueOnce(of({
      pedidos: [{ ...pedido, estado: 'CANCELADO', puede_cancelar: false }],
    }));
    const cancelar = vi.fn(() => respuesta);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ClientePedidosService, useValue: {
        listar: historial, listarSeguimiento: () => of({ pedidos: [] }), cancelar,
      } },
    ] });
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    try {
      const vista = TestBed.createComponent(MisPedidosCliente);
      vista.detectChanges();
      const pagina: HTMLElement = vista.nativeElement;
      const boton = [...pagina.querySelectorAll('button')].find(b => b.textContent?.includes('Cancelar mi pedido'))!;
      expect(pagina.textContent?.replace(/\s+/g, ' ')).toContain(
        'Puedes cancelar antes de que el taller comprometa producción, inventario o entrega. No habrá devolución de pagos simulados en esta demostración académica.',
      );
      boton.click();
      expect(cancelar).not.toHaveBeenCalled();
      boton.click();
      vista.detectChanges();
      expect(confirmacion).toHaveBeenLastCalledWith(expect.stringContaining('No habrá devolución'));
      expect(boton.disabled).toBe(true);
      vista.componentInstance.cancelarPedido(pedido);
      expect(cancelar).toHaveBeenCalledExactlyOnceWith(17);
      respuesta.next({ estado: 'CANCELADO', message: 'Pedido cancelado.' });
      vista.detectChanges();
      expect(pagina.textContent).toContain('Los pagos simulados permanecen en el historial.');
      expect(pagina.textContent).not.toContain('Cancelar mi pedido');
    } finally {
      confirmacion.mockRestore();
    }
  });
});
