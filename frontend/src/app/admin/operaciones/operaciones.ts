/** Toco Madera | Etapa 3.20.4 — Operaciones de taller en una pantalla.
 * No se escriben estados directamente. Los endpoints Flask mantienen las reglas de negocio.
 */
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, catchError, finalize } from 'rxjs';
import {
  AdminOperacionesService, PedidoEntrega, OrdenProduccion, PendienteProduccion,
  VerificacionMateriales, VerificacionFinalizacion, ResultadoOperacion
} from '../../core/services/admin-operaciones';
import { AdminPedidosService, PedidoRevision } from '../../core/services/admin-pedidos';

@Component({
  selector: 'app-operaciones-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operaciones.html',
})
export class OperacionesAdmin implements OnInit {
  private readonly api = inject(AdminOperacionesService);
  private readonly revision = inject(AdminPedidosService);

  readonly pedidos = signal<PedidoEntrega[]>([]);
  readonly revisiones = signal<PedidoRevision[]>([]);
  readonly pendientes = signal<PendienteProduccion[]>([]);
  readonly ordenes = signal<OrdenProduccion[]>([]);
  readonly idSeleccionado = signal<number | null>(null);
  readonly cargando = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly fechaLocal = signal('');
  readonly punto = signal('');
  readonly receptor = signal('');
  readonly cantidad = signal<Record<number, number>>({});
  readonly materiales = signal<Record<number, VerificacionMateriales>>({});
  readonly finalizaciones = signal<Record<number, VerificacionFinalizacion>>({});
  readonly filtro = signal('ACTIVOS');

  readonly pedido = computed(() => this.pedidos().find(p => p.id_pedido === this.idSeleccionado()) ?? null);
  readonly revisionSeleccionada = computed(() => this.revisiones().find(p => p.id_pedido === this.idSeleccionado()) ?? null);
  readonly pendientesPedido = computed(() => this.pendientes().filter(p => p.id_pedido === this.idSeleccionado()));
  readonly ordenesPedido = computed(() => this.ordenes().filter(o => o.id_pedido === this.idSeleccionado()));
  readonly autorizacion = computed(() => {
    const p = this.pedido();
    if (!p) return 'POR_REVISAR';
    if (p.estado === 'ENTREGADO') return 'HISTORICO';
    return this.revisionSeleccionada()?.autorizacion ?? 'POR_REVISAR';
  });
  readonly saldo = computed(() => Number(this.pedido()?.saldo_simulado ?? 0));
  readonly pedidosFiltrados = computed(() => this.filtro() === 'TODOS' ? this.pedidos() : this.pedidos().filter(p => p.estado !== 'ENTREGADO'));

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    if (this.ocupado()) return;
    this.cargando.set(true); this.error.set('');
    // Las listas de producción y revisión no deben ocultar el listado de entregas si fallan.
    forkJoin({
      entregas: this.api.pedidos(),
      revision: this.revision.listar().pipe(catchError(() => of({ success: false, pedidos: [] as PedidoRevision[] }))),
      pendientes: this.api.pendientes().pipe(catchError(() => of({ success: false, detalles: [] as PendienteProduccion[] }))),
      ordenes: this.api.ordenes().pipe(catchError(() => of({ success: false, ordenes: [] as OrdenProduccion[] })))
    }).subscribe({
      next: r => {
        this.pedidos.set(r.entregas.pedidos ?? []);
        this.revisiones.set(r.revision.pedidos ?? []);
        this.pendientes.set(r.pendientes.detalles ?? []);
        this.ordenes.set(r.ordenes.ordenes ?? []);
        if (this.idSeleccionado() === null && this.pedidos().length) this.seleccionar(this.pedidos()[0].id_pedido);
        this.cargando.set(false);
        if (!r.revision.success || !r.pendientes.success || !r.ordenes.success) {
          this.error.set('Algunos datos auxiliares no se pudieron cargar. Revisa Flask antes de operar.');
        }
      },
      error: (e: HttpErrorResponse) => { this.error.set(this.errorHttp(e)); this.cargando.set(false); }
    });
  }

  seleccionar(id: number): void {
    this.idSeleccionado.set(id);
    this.materiales.set({}); this.finalizaciones.set({}); this.error.set(''); this.mensaje.set('');
    const pedido = this.pedidos().find(x => x.id_pedido === id);
    this.fechaLocal.set(pedido?.programada ? pedido.programada.substring(0,16).replace(' ', 'T') : '');
    this.punto.set(pedido?.punto_recoleccion ?? '');
    this.receptor.set('');
  }

  cambiarFecha(value: string): void { this.fechaLocal.set(value); }
  cambiarPunto(value: string): void { this.punto.set(value); }
  cambiarReceptor(value: string): void { this.receptor.set(value); }
  cambiarCantidad(detalleId: number, value: string): void {
    this.cantidad.update(actual => ({ ...actual, [detalleId]: Number(value) }));
  }
  cambiarFiltro(value: string): void { this.filtro.set(value); }
  cantidadPlanificar(p: PendienteProduccion): number {
    return this.cantidad()[p.id_detalle_pedido] ?? p.cantidad_pendiente;
  }
  dinero(value: string | number | null | undefined): string {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : 'No disponible';
  }
  puedeProgramar(): boolean {
    const p=this.pedido();
    return !!p && this.autorizacion()==='APROBADO' && p.tipo_entrega==='RECOLECCION'
      && !['ENTREGADO','CANCELADO','PENDIENTE_ANTICIPO'].includes(p.estado);
  }
  puedeListo(): boolean {
    const p=this.pedido();
    return !!p && this.autorizacion()==='APROBADO' && ['CONFIRMADO','EN_PRODUCCION'].includes(p.estado);
  }
  puedeLiquidar(): boolean {
    const p=this.pedido();
    return !!p && this.autorizacion()==='APROBADO' && this.saldo()>0.009 &&
      !['ENTREGADO','CANCELADO','PENDIENTE_ANTICIPO'].includes(p.estado);
  }
  puedeEntregar(): boolean {
    const p=this.pedido();
    return !!p && this.autorizacion()==='APROBADO' && p.estado==='LISTO'
      && p.estado_entrega==='PROGRAMADA' && !!p.programada && !!p.punto_recoleccion
      && this.saldo()<0.01 && this.receptor().trim().length>=2;
  }

  planificar(p: PendienteProduccion): void {
    const cantidad=this.cantidadPlanificar(p);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > p.cantidad_pendiente) {
      this.error.set('Indica una cantidad entera y no mayor al pendiente.'); return;
    }
    this.ejecutar(`¿Planificar ${cantidad} unidad(es) de ${p.producto}?`,
      () => this.api.planificar(p.id_detalle_pedido, cantidad));
  }
  iniciar(o: OrdenProduccion): void {
    this.ejecutar(`¿Iniciar orden #${o.id_orden}?`, () => this.api.iniciar(o.id_orden));
  }
  verificarMateriales(o: OrdenProduccion): void {
    if (this.ocupado()) return;
    this.error.set(''); this.mensaje.set(''); this.ocupado.set(true);
    this.api.verificarMateriales(o.id_orden).pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: r => this.materiales.update(actual => ({ ...actual, [o.id_orden]: r })),
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }
  consumir(o: OrdenProduccion): void {
    if (!this.materiales()[o.id_orden]?.puede_consumir) { this.error.set('Verifica materiales suficientes antes de consumir.'); return; }
    this.ejecutar(`¿CONSUMIR materias primas de la orden #${o.id_orden}? Se descontarán de MySQL.`,
      () => this.api.consumir(o.id_orden));
  }
  verificarFinalizacion(o: OrdenProduccion): void {
    if (this.ocupado()) return;
    this.error.set(''); this.mensaje.set(''); this.ocupado.set(true);
    this.api.verificarFinalizacion(o.id_orden).pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: r => this.finalizaciones.update(actual => ({ ...actual, [o.id_orden]: r })),
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }
  finalizar(o: OrdenProduccion): void {
    if (!this.finalizaciones()[o.id_orden]?.puede_finalizar) { this.error.set('Verifica los consumos antes de finalizar fabricación.'); return; }
    this.ejecutar(`¿FINALIZAR orden #${o.id_orden} y crear lote terminado?`,
      () => this.api.finalizar(o.id_orden));
  }
  programar(): void {
    const p=this.pedido(); if (!p || !this.puedeProgramar()) return;
    const fecha=this.fechaLocal().replace('T',' ') + (this.fechaLocal().length===16 ? ':00' : '');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fecha) || this.punto().trim().length < 5) {
      this.error.set('Indica fecha, hora y lugar de recolección (mínimo 5 caracteres).'); return;
    }
    this.ejecutar(`¿Confirmar la recolección del pedido #${p.id_pedido} para ${fecha}?`,
      () => this.api.programar(p.id_pedido, fecha, this.punto().trim()));
  }
  listo(): void {
    const p=this.pedido(); if (!p || !this.puedeListo()) return;
    this.ejecutar(`¿Marcar LISTO el pedido #${p.id_pedido}? Flask comprobará los lotes terminados.`,
      () => this.api.listo(p.id_pedido));
  }
  liquidar(): void {
    const p=this.pedido(); if (!p || !this.puedeLiquidar()) return;
    this.ejecutar(`¿Registrar PAGO SIMULADO de ${this.dinero(this.saldo())} para pedido #${p.id_pedido}? No hay cobro real.`,
      () => this.api.liquidar(p.id_pedido));
  }
  entregar(): void {
    const p=this.pedido(); if (!p || !this.puedeEntregar()) return;
    this.ejecutar(`¿CONFIRMAR ENTREGA del pedido #${p.id_pedido} a ${this.receptor().trim()}? Se descontará inventario terminado.`,
      () => this.api.entregar(p.id_pedido, this.receptor().trim()));
  }
  private ejecutar(confirmacion: string, accion: () => import('rxjs').Observable<ResultadoOperacion>): void {
    if (this.ocupado() || !window.confirm(confirmacion)) return;
    this.ocupado.set(true); this.error.set(''); this.mensaje.set('');
    accion().pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: r => {
        if (!r.success) { this.error.set(r.message ?? 'El servidor no confirmó la operación.'); return; }
        this.mensaje.set(r.message ?? 'Operación confirmada por Flask.');
        this.materiales.set({}); this.finalizaciones.set({});
        this.recargarDespuesDeOperacion();
      },
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }
  private recargarDespuesDeOperacion(): void {
    forkJoin({
      entregas: this.api.pedidos(),
      revision: this.revision.listar().pipe(catchError(() => of({ success: false, pedidos: [] as PedidoRevision[] }))),
      pendientes: this.api.pendientes().pipe(catchError(() => of({ success: false, detalles: [] as PendienteProduccion[] }))),
      ordenes: this.api.ordenes().pipe(catchError(() => of({ success: false, ordenes: [] as OrdenProduccion[] })))
    }).subscribe({
      next: r => {
        this.pedidos.set(r.entregas.pedidos ?? []);
        this.revisiones.set(r.revision.pedidos ?? []);
        this.pendientes.set(r.pendientes.detalles ?? []);
        this.ordenes.set(r.ordenes.ordenes ?? []);
        const p=this.pedido();
        if (p?.programada && !this.fechaLocal()) this.fechaLocal.set(p.programada.substring(0,16).replace(' ','T'));
      },
      error: () => this.error.set('La operación se realizó, pero no fue posible refrescar los datos. Pulsa Actualizar.')
    });
  }
  private errorHttp(e: HttpErrorResponse): string {
    if (e.status===401) return 'Sesión expirada: inicia sesión como administrador.';
    if (e.status===403) return 'Permiso administrativo denegado.';
    if (e.status===409) return typeof e.error?.message==='string' ? e.error.message : 'La operación no cumple los requisitos del pedido.';
    if (e.status===0) return 'No se pudo conectar con Flask en 127.0.0.1:5000.';
    return typeof e.error?.message==='string' ? e.error.message : `Error HTTP ${e.status}. Revisa la consola de Flask.`;
  }
}
