/** Toco Madera | Etapa 3.19.6 - Mis pedidos, pago simulado y seguimiento. */
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { imagenProducto } from '../../core/utils/imagenes-productos';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import {
  ClientePedidosService,
  PedidoClienteConSeguimiento,
  SeguimientoPedidoCliente
} from '../../core/services/cliente-pedidos';

@Component({
  selector: 'app-mis-pedidos-cliente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css'
})
export class MisPedidosCliente implements OnInit {
  private readonly api = inject(ClientePedidosService);
  readonly imagenProducto = imagenProducto;

  readonly pedidos = signal<PedidoClienteConSeguimiento[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly avisoSeguimiento = signal('');
  readonly cancelando = signal<number | null>(null);
  readonly avisoCancelacion = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * El historial es la fuente de verdad financiera. El seguimiento agrega
   * información logística por id_pedido sin modificar los pagos del servidor.
   * Si falla seguimiento, el cliente aún puede consultar sus importes.
   */
  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.avisoSeguimiento.set('');

    forkJoin({
      historial: this.api.listar(),
      seguimiento: this.api.listarSeguimiento().pipe(
        catchError((_error: HttpErrorResponse) => {
          this.avisoSeguimiento.set('No se pudo actualizar el seguimiento de entregas. Tus importes y pagos siguen disponibles.');
          return of({ success: false, pedidos: [] as SeguimientoPedidoCliente[] });
        })
      )
    }).subscribe({
      next: ({ historial, seguimiento }) => {
        const seguimientoPorId = new Map<number, SeguimientoPedidoCliente>(
          (seguimiento.pedidos ?? []).map(s => [s.id_pedido, s])
        );
        this.pedidos.set((historial.pedidos ?? []).map(p => ({
          ...p,
          seguimiento: seguimientoPorId.get(p.id_pedido)
        })));
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(e.status === 401
          ? 'Inicia sesión con una cuenta cliente para consultar tus pedidos.'
          : e.status === 403
            ? 'Esta pantalla requiere una cuenta cliente.'
            : typeof e.error?.message === 'string'
              ? e.error.message
              : 'No pudimos consultar tus pedidos.');
      }
    });
  }

  /**
   * El servidor verifica de nuevo: propiedad del pedido, estado y ausencia
   * de producción, entregas o reservas. No confiar únicamente en el botón.
   */
  cancelarPedido(pedido: PedidoClienteConSeguimiento): void {
    if (!pedido.puede_cancelar || this.cancelando() !== null) return;
    const aceptado = window.confirm(
      `¿Cancelar el pedido ${pedido.folio}?\n\n` +
      'AVISO: no habrá devolución de pagos simulados en esta demostración académica. ' +
      'Los derechos que correspondan conforme a la ley no se ven afectados.\n\n' +
      'Esta acción no se puede deshacer desde la aplicación.'
    );
    if (!aceptado) return;
    this.cancelando.set(pedido.id_pedido);
    this.error.set('');
    this.avisoCancelacion.set('');
    this.api.cancelar(pedido.id_pedido).subscribe({
      next: respuesta => {
        this.cancelando.set(null);
        this.avisoCancelacion.set(respuesta.message);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.cancelando.set(null);
        this.error.set(typeof e.error?.message === 'string'
          ? e.error.message : 'No se pudo cancelar. Actualiza tus pedidos e inténtalo nuevamente.');
      }
    });
  }

  /** Texto de autorización independiente del estado comercial o del pago. */
  estadoAutorizacionVisible(pedido: PedidoClienteConSeguimiento): string {
    switch (pedido.autorizacion?.estado) {
      case 'APROBADO': return 'APROBADO';
      case 'RECHAZADO': return 'RECHAZADO';
      case 'POR_REVISAR': return 'POR REVISAR';
      case 'HISTORICO_ENTREGADO': return 'HISTÓRICO ENTREGADO';
      default: return 'NO DISPONIBLE';
    }
  }

  dinero(valor: string | number | null | undefined): string {
    const numero = Number(valor);
    return Number.isFinite(numero)
      ? numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      : 'Importe no disponible';
  }

  /** Nunca inferimos que un pedido está pagado si falta su resumen. */
  saldoPendiente(pedido: PedidoClienteConSeguimiento): boolean {
    if (!pedido.resumen) return false;
    const saldo = Number(pedido.resumen.saldo);
    return Number.isFinite(saldo) && saldo > 0.009;
  }

  /** Fechas SQL con zona local no explícita: mostrar el texto local sin aplicar UTC. */
  fechaVisible(valor: string | null | undefined): string {
    if (!valor) return 'Pendiente de confirmación';
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(valor);
    if (!m) return valor;
    const [, ano, mes, dia, hora, minuto] = m;
    return `${dia}/${mes}/${ano} a las ${hora}:${minuto}`;
  }
}
