/** Etapa 3.20.2. Consulta protegida con el interceptor JWT existente. */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
export type DecisionPedido = 'POR_REVISAR' | 'APROBADO' | 'RECHAZADO';
export interface PedidoRevision {
  id_pedido: number;
  folio: string;
  fecha: string;
  estado: string;
  cliente_nombre: string;
  cliente_correo: string;
  cliente_telefono: string | null;
  modalidad_pago: string;
  tipo_entrega: string;
  fecha_entrega_prometida: string | null;
  autorizacion: DecisionPedido;
  motivo: string | null;
  fecha_decision: string | null;
  articulos: number;
  unidades: number;
  total: string;
  pagado: string;
  saldo: string;
}
export interface ArticuloRevision {
  id_detalle_pedido: number; id_producto: number; producto: string; cantidad: number;
  precio_unitario_acordado: string; texto_grabado: string | null;
  tipo_surtido: string; notas: string | null;
}
export interface PagoRevision {
  id_pago: number; monto: string; metodo: string; estado: string; referencia: string;
}
export interface DetalleRevision {
  success: boolean;
  pedido: PedidoRevision & { notas?: string | null };
  detalles: ArticuloRevision[];
  pagos: PagoRevision[];
  entrega: { estado: string; programada: string | null; entregada: string | null; punto_recoleccion: string | null } | null;
}
@Injectable({ providedIn: 'root' })
export class AdminPedidosService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://127.0.0.1:5000/api/v1/admin/revision-pedidos';
  listar(): Observable<{success: boolean; pedidos: PedidoRevision[]}> {
    return this.http.get<{success: boolean; pedidos: PedidoRevision[]}>(`${this.url}/`);
  }
  detalle(id: number): Observable<DetalleRevision> {
    return this.http.get<DetalleRevision>(`${this.url}/${id}`);
  }
  decidir(id: number, decision: 'APROBADO' | 'RECHAZADO', motivo: string): Observable<{success: boolean; message: string; autorizacion: string}> {
    return this.http.post<{success: boolean; message: string; autorizacion: string}>(
      `${this.url}/${id}/decision`, { decision, motivo }
    );
  }
}
