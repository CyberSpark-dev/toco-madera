/** Toco Madera | Etapa 3.20.4 — UI completa de producción y entregas.
 * Todas las decisiones comerciales y validaciones definitivas ocurren en Flask.
 * El interceptor JWT del proyecto incorpora Authorization automáticamente.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResultadoOperacion {
  success: boolean;
  message?: string;
  id_orden?: number;
  estado?: string;
  id_lote?: number;
  [clave: string]: unknown;
}
export interface PedidoEntrega {
  id_pedido: number;
  folio: string;
  estado: string;
  cliente_nombre: string;
  cliente_correo: string;
  cliente_telefono: string | null;
  tipo_entrega: string;
  estado_entrega: string | null;
  fecha_entrega_prometida: string | null;
  programada: string | null;
  entregada: string | null;
  punto_recoleccion: string | null;
  saldo_simulado: string;
}
export interface PendienteProduccion {
  id_detalle_pedido: number;
  id_pedido: number;
  folio: string;
  id_producto: number;
  producto: string;
  cantidad: number;
  cantidad_planificada: number;
  cantidad_pendiente: number;
  texto_grabado: string | null;
  recetas_vigentes: number;
}
export interface OrdenProduccion {
  id_orden: number;
  id_detalle_pedido: number | null;
  id_pedido: number | null;
  cantidad: number;
  producto: string;
  estado: string;
  texto_grabado: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}
export interface MaterialVerificado {
  id_material?: number;
  sku?: string;
  id_unidad?: number;
  unidad?: string;
  cantidad_faltante?: string;
  elegible_compra?: boolean;
  motivo_bloqueo?: string | null;
  nombre: string;
  cantidad_requerida: string;
  stock_disponible: string;
  suficiente: boolean;
}
export interface VerificacionMateriales {
  motivo_bloqueo?: string | null;
  success: boolean;
  puede_consumir: boolean;
  ya_consumida: boolean;
  materiales: MaterialVerificado[];
  advertencia?: string;
}
export interface VerificacionFinalizacion {
  success: boolean;
  puede_finalizar: boolean;
  observacion?: string;
  consumos_completos: boolean;
  lotes_existentes: number;
}

@Injectable({ providedIn: 'root' })
export class AdminOperacionesService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://127.0.0.1:5000/api/v1/admin';

  pedidos(): Observable<{ success: boolean; pedidos: PedidoEntrega[] }> {
    return this.http.get<{ success: boolean; pedidos: PedidoEntrega[] }>(`${this.base}/entregas/pedidos`);
  }
  pendientes(): Observable<{ success: boolean; detalles: PendienteProduccion[] }> {
    return this.http.get<{ success: boolean; detalles: PendienteProduccion[] }>(`${this.base}/produccion/pendientes`);
  }
  ordenes(): Observable<{ success: boolean; ordenes: OrdenProduccion[] }> {
    return this.http.get<{ success: boolean; ordenes: OrdenProduccion[] }>(`${this.base}/produccion/`);
  }
  planificar(detalleId: number, cantidad: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/produccion/`, {
      id_detalle_pedido: detalleId, cantidad, observaciones: 'Planificada desde gestión visual ADMIN'
    });
  }
  iniciar(ordenId: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/produccion/${ordenId}/iniciar`, {});
  }
  verificarMateriales(ordenId: number): Observable<VerificacionMateriales> {
    return this.http.get<VerificacionMateriales>(`${this.base}/produccion/${ordenId}/verificar-materiales`);
  }
  consumir(ordenId: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/produccion/${ordenId}/consumir-materiales`, {});
  }
  verificarFinalizacion(ordenId: number): Observable<VerificacionFinalizacion> {
    return this.http.get<VerificacionFinalizacion>(`${this.base}/producto-terminado/orden/${ordenId}/verificar`);
  }
  finalizar(ordenId: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/producto-terminado/orden/${ordenId}/finalizar`, {});
  }
  programar(id: number, fecha: string, punto: string): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/entregas/pedido/${id}/programar`, {
      programada: fecha, punto_recoleccion: punto
    });
  }
  listo(id: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/entregas/pedido/${id}/listo`, {});
  }
  liquidar(id: number): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/entregas/pedido/${id}/liquidar-saldo`, {});
  }
  entregar(id: number, receptor: string): Observable<ResultadoOperacion> {
    return this.http.post<ResultadoOperacion>(`${this.base}/entregas/pedido/${id}/entregar`, { receptor });
  }
}
