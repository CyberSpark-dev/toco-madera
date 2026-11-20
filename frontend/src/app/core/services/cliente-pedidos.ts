/** Toco Madera 3.18 - Contrato con Flask confirmado en la Etapa 3.18.3. */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ItemCheckout } from './carrito';

export type ModalidadPago = 'ANTICIPO_50' | 'TOTAL';
export type MetodoPago = 'TARJETA_SIMULADA' | 'TRANSFERENCIA_SIMULADA';

export interface ConfirmacionCheckout {
  clave_solicitud: string;
  modalidad_pago: ModalidadPago;
  metodo_pago: MetodoPago;
  notas: string | null;
  detalles: ItemCheckout[];
}

export interface PedidoCliente {
  id_pedido: number;
  folio: string;
  fecha: string;
  estado: string;
  modalidad_pago: ModalidadPago;
  detalles: Array<{
    id_detalle_pedido: number;
    id_producto: number;
    cantidad: number;
    precio_unitario_acordado: string;
    texto_grabado: string | null;
    tipo_surtido: string;
    notas: string | null;
  }>;
  pagos: Array<{ id_pago: number; monto: string; metodo: string; estado: string; referencia: string }>;
  resumen: null | { subtotal: string; total: string; pagado: string; saldo: string };
}

export interface PedidoRespuesta {
  success: boolean;
  message: string;
  pedido: PedidoCliente;
  repetido?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientePedidosService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://127.0.0.1:5000/api/v1/cliente/pedidos/';

  confirmar(datos: ConfirmacionCheckout): Observable<PedidoRespuesta> {
    return this.http.post<PedidoRespuesta>(this.url, datos);
  }

  listar(): Observable<{ success: boolean; total: number; pedidos: PedidoCliente[] }> {
    return this.http.get<{ success: boolean; total: number; pedidos: PedidoCliente[] }>(this.url);
  }

  obtener(id: number): Observable<{ success: boolean; pedido: PedidoCliente }> {
    return this.http.get<{ success: boolean; pedido: PedidoCliente }>(`${this.url}${id}`);
  }
}
