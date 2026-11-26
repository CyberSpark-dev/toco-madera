import { etiquetaPedido } from '../../core/utils/etiquetas-pedido';
import { mensajeNotificable } from '../../core/services/notificaciones';
import { mensajeError } from '../../core/utils/mensajes';
import { formatearDinero } from '../../core/utils/dinero';
import { formatearCantidad } from '../../core/utils/cantidades';
/** Toco Madera | Etapa 3.20.4 — Operaciones de taller en una pantalla.
 * No se escriben estados directamente. Los endpoints Flask mantienen las reglas de negocio.
 */
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { EMPTY, forkJoin, of, catchError, finalize, switchMap, tap } from 'rxjs';
import {
  AdminOperacionesService, PedidoEntrega, OrdenProduccion, PendienteProduccion,
  MaterialVerificado, VerificacionMateriales, VerificacionFinalizacion, ResultadoOperacion
} from '../../core/services/admin-operaciones';
import { AdminPedidosService, PedidoRevision } from '../../core/services/admin-pedidos';
import { AdminMateriales } from '../../core/services/admin-materiales';

@Component({
  selector: 'app-operaciones-admin',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './operaciones.html',
  styleUrl: './operaciones.css',
})
export class OperacionesAdmin implements OnInit {
  readonly etiquetaPedido = etiquetaPedido;

  private readonly api = inject(AdminOperacionesService);
  private readonly revision = inject(AdminPedidosService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly ordenRegreso = Number(this.route?.snapshot.queryParamMap.get('orden'));
  private readonly catalogoMateriales = inject(AdminMateriales);
  private readonly unidadesPorMaterial = signal(new Map<number, string>());

  readonly pedidos = signal<PedidoEntrega[]>([]);
  readonly revisiones = signal<PedidoRevision[]>([]);
  readonly pendientes = signal<PendienteProduccion[]>([]);
  readonly ordenes = signal<OrdenProduccion[]>([]);
  readonly idSeleccionado = signal<number | null>(null);
  readonly cargando = signal(false);
  readonly ocupado = signal(false);
  readonly error = mensajeNotificable('error');
  readonly mensaje = mensajeNotificable('exito');
  readonly fechaLocal = signal('');
  readonly punto = signal('');
  readonly receptor = signal('');
  private readonly cantidad = signal<Record<number, number | null>>({});
  private readonly pendientesActualizados = signal(false);
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

  ngOnInit(): void {
    this.cargar();
    forkJoin({
      materiales: this.catalogoMateriales.listarMateriales(),
      unidades: this.catalogoMateriales.listarUnidades(),
    }).subscribe({
      next: ({ materiales, unidades }) => {
        const nombres = new Map(unidades.unidades.map((unidad) => [unidad.id_unidad, unidad.nombre]));
        this.unidadesPorMaterial.set(new Map(
          materiales.materiales.map((material) => [
            material.id_material,
            nombres.get(material.id_unidad) ?? `Unidad #${material.id_unidad}`,
          ]),
        ));
      },
      error: () => this.unidadesPorMaterial.set(new Map()),
    });
  }

  unidadMaterial(material: MaterialVerificado): string {
    const id = 'id_material' in material ? material.id_material : undefined;
    return (typeof id === 'number' ? this.unidadesPorMaterial().get(id) : undefined)
      ?? 'Unidad no disponible';
  }

  cantidadMaterial(valor: string, unidad: string): { texto: string; aviso?: string } {
    const negativo = valor.startsWith('-');
    const magnitud = negativo ? valor.slice(1) : valor;
    const cantidad = formatearCantidad(magnitud, unidad);
    // Una fracción histórica en piezas conserva el aviso, aunque su vista se limite a centésimas.
    const vista = /\.\d{3,}$/.test(cantidad.texto)
      ? formatearCantidad(magnitud, '')
      : cantidad;
    const avisoExacto = vista.aviso?.replace(`Valor registrado: ${magnitud}.`, `Valor registrado: ${valor}.`);
    const aviso = vista === cantidad ? avisoExacto : [cantidad.aviso, avisoExacto].filter(Boolean).join(' ');
    const texto = !negativo ? vista.texto
      : vista.texto === '< 0.01' ? '> -0.01'
      : vista.texto.replace(/^(≈ )?/, (_, prefijo = '') => prefijo + '-');
    return { texto, aviso };
  }

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
        this.actualizarPendientes(r.pendientes);
        this.ordenes.set(r.ordenes.ordenes ?? []);
        if (this.idSeleccionado() === null && this.pedidos().length) {
          const orden = this.ordenes().find((o) => o.id_orden === this.ordenRegreso);
          this.seleccionar(orden?.id_pedido ?? this.pedidos()[0].id_pedido);
          if (orden) setTimeout(() => document.getElementById('orden-' + orden.id_orden)?.scrollIntoView(), 0);
        }
        this.cargando.set(false);
        if (!r.revision.success || !r.pendientes.success || !r.ordenes.success) {
          this.error.set('Algunos datos auxiliares no se pudieron cargar. Pulsa Actualizar antes de continuar.');
        }
      },
      error: (e: HttpErrorResponse) => { this.error.set(this.errorHttp(e)); this.cargando.set(false); }
    });
  }

  seleccionar(id: number): void {
    if (this.ocupado()) return;
    this.idSeleccionado.set(id);
    this.inicializarCantidades();
    this.materiales.set({}); this.finalizaciones.set({}); this.error.set(''); this.mensaje.set('');
    const pedido = this.pedidos().find(x => x.id_pedido === id);
    this.fechaLocal.set(pedido?.programada ? pedido.programada.substring(0,16).replace(' ', 'T') : '');
    this.punto.set(pedido?.punto_recoleccion ?? '');
    this.receptor.set('');
  }

  cambiarFecha(value: string): void { this.fechaLocal.set(value); }
  cambiarPunto(value: string): void { this.punto.set(value); }
  cambiarReceptor(value: string): void { this.receptor.set(value); }
  private actualizarPendientes(respuesta: { success: boolean; detalles: PendienteProduccion[] }): void {
    this.pendientesActualizados.set(respuesta.success);
    if (!respuesta.success) return;
    // La suma en MySQL puede llegar serializada como cadena decimal.
    this.pendientes.set((respuesta.detalles ?? []).map((detalle) => ({
      ...detalle,
      cantidad_pendiente: Number(detalle.cantidad_pendiente),
    })));
    this.inicializarCantidades();
  }

  private inicializarCantidades(): void {
    this.cantidad.set(Object.fromEntries(this.pendientesPedido().map((detalle) => [
      detalle.id_detalle_pedido, this.maximoPlanificable(detalle) || null,
    ])));
  }

  cambiarCantidad(detalleId: number, value: number | null): void {
    this.cantidad.update(actual => ({ ...actual, [detalleId]: value }));
  }

  cambiarFiltro(value: string): void { this.filtro.set(value); }
  maximoPlanificable(p: PendienteProduccion): number {
    return Number.isInteger(p.cantidad_pendiente) && p.cantidad_pendiente > 0
      ? Math.min(100000, p.cantidad_pendiente) : 0;
  }

  cantidadPlanificar(p: PendienteProduccion): number | null {
    return this.cantidad()[p.id_detalle_pedido] ?? null;
  }

  bloqueoPlanificacion(p: PendienteProduccion): string {
    if (this.cargando()) return 'Estamos actualizando las unidades pendientes.';
    if (!this.pendientesActualizados()) return 'Pulsa Actualizar para consultar las unidades pendientes.';
    const estado = this.pedido()?.estado;
    if (p.id_pedido !== this.idSeleccionado() || (estado !== 'CONFIRMADO' && estado !== 'EN_PRODUCCION')) {
      return 'El estado del pedido no permite planificar una orden.';
    }
    if (this.autorizacion() !== 'APROBADO') return 'Autoriza el pedido antes de planificar.';
    if (p.recetas_vigentes < 1) return 'El producto necesita una receta vigente.';
    if (this.maximoPlanificable(p) === 0) return 'No quedan unidades por planificar.';
    return '';
  }

  errorCantidadPlanificar(p: PendienteProduccion): string {
    const cantidad = this.cantidadPlanificar(p);
    const maximo = this.maximoPlanificable(p);
    return cantidad === null || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > maximo
      ? `Ingresa un número entero entre 1 y ${maximo}.` : '';
  }
  readonly dinero = formatearDinero;
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
    const cantidad = this.cantidadPlanificar(p);
    if (this.ocupado() || this.bloqueoPlanificacion(p) || this.errorCantidadPlanificar(p) || cantidad === null) return;
    this.ejecutar(`¿Planificar ${cantidad} unidad(es) de ${p.producto}?`,
      'Orden planificada correctamente.', () => this.api.planificar(p.id_detalle_pedido, cantidad));
  }
  iniciar(o: OrdenProduccion): void {
    this.ejecutar(`¿Iniciar orden #${o.id_orden}?`, 'Orden iniciada. Puedes verificar los materiales.', () => this.api.iniciar(o.id_orden));
  }
  verificarMateriales(o: OrdenProduccion): void {
    if (this.ocupado()) return;
    this.error.set(''); this.mensaje.set(''); this.ocupado.set(true);
    this.api.verificarMateriales(o.id_orden).pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: r => this.materiales.update(actual => ({ ...actual, [o.id_orden]: r })),
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }

  tieneFaltantesComprables(verificacion: VerificacionMateriales): boolean {
    return verificacion.materiales.some((material) =>
      material.elegible_compra === true && Number(material.cantidad_faltante) > 0,
    );
  }
  consumir(o: OrdenProduccion): void {
    if (!this.materiales()[o.id_orden]?.puede_consumir) { this.error.set('Verifica materiales suficientes antes de consumir.'); return; }
    this.ejecutar(`¿CONSUMIR materias primas de la orden #${o.id_orden}? Se descontarán de las existencias.`,
      'Consumo registrado. Las existencias se han actualizado.', () => this.api.consumir(o.id_orden));
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
      'Fabricación finalizada. Se registró el lote terminado.', () => this.api.finalizar(o.id_orden));
  }
  programar(): void {
    const p=this.pedido(); if (!p || !this.puedeProgramar()) return;
    const fecha=this.fechaLocal().replace('T',' ') + (this.fechaLocal().length===16 ? ':00' : '');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fecha) || this.punto().trim().length < 5) {
      this.error.set('Indica fecha, hora y lugar de recolección (mínimo 5 caracteres).'); return;
    }
    this.ejecutar(`¿Confirmar la recolección del pedido #${p.id_pedido} para ${fecha}?`,
      'Recolección programada correctamente.', () => this.api.programar(p.id_pedido, fecha, this.punto().trim()));
  }
  listo(): void {
    const p=this.pedido(); if (!p || !this.puedeListo()) return;
    this.ejecutar(`¿Marcar LISTO el pedido #${p.id_pedido}? Se comprobará que haya lotes terminados suficientes.`,
      'Pedido marcado como listo. El cliente puede consultarlo en Mis pedidos.', () => this.api.listo(p.id_pedido));
  }
  liquidar(): void {
    const p=this.pedido(); if (!p || !this.puedeLiquidar()) return;
    this.ejecutar(`¿Registrar PAGO SIMULADO de ${this.dinero(this.saldo())} para pedido #${p.id_pedido}? No hay cobro real.`,
      'Saldo liquidado mediante un pago simulado.', () => this.api.liquidar(p.id_pedido));
  }
  entregar(): void {
    const p=this.pedido(); if (!p || !this.puedeEntregar()) return;
    this.ejecutar(`¿CONFIRMAR ENTREGA del pedido #${p.id_pedido} a ${this.receptor().trim()}? Se descontará inventario terminado.`,
      'Entrega confirmada. Se actualizaron las existencias de producto terminado.', () => this.api.entregar(p.id_pedido, this.receptor().trim()));
  }
  private ejecutar(confirmacion: string, exito: string, accion: () => import('rxjs').Observable<ResultadoOperacion>): void {
    if (this.ocupado() || !window.confirm(confirmacion)) return;
    this.ocupado.set(true); this.error.set(''); this.mensaje.set('');
    accion().pipe(
      switchMap(r => {
        if (!r.success) {
          this.error.set('No pudimos completar la operación. Inténtalo nuevamente.');
          return EMPTY;
        }
        this.mensaje.set(exito);
        this.materiales.set({}); this.finalizaciones.set({});
        this.pendientesActualizados.set(false);
        return this.recargarDespuesDeOperacion();
      }),
      finalize(() => this.ocupado.set(false)),
    ).subscribe({
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }
  private recargarDespuesDeOperacion() {
    return forkJoin({
      entregas: this.api.pedidos(),
      revision: this.revision.listar().pipe(catchError(() => of({ success: false, pedidos: [] as PedidoRevision[] }))),
      pendientes: this.api.pendientes().pipe(catchError(() => of({ success: false, detalles: [] as PendienteProduccion[] }))),
      ordenes: this.api.ordenes().pipe(catchError(() => of({ success: false, ordenes: [] as OrdenProduccion[] })))
    }).pipe(
      tap(r => {
        this.pedidos.set(r.entregas.pedidos ?? []);
        this.revisiones.set(r.revision.pedidos ?? []);
        this.actualizarPendientes(r.pendientes);
        this.ordenes.set(r.ordenes.ordenes ?? []);
        const p=this.pedido();
        if (p?.programada && !this.fechaLocal()) this.fechaLocal.set(p.programada.substring(0,16).replace(' ','T'));
        if (!r.pendientes.success || !r.ordenes.success) {
          this.error.set('La operación se realizó, pero no pudimos actualizar todos los datos. Pulsa Actualizar.');
        }
      }),
      catchError(() => {
        this.error.set('La operación se realizó, pero no pudimos actualizar los datos. Pulsa Actualizar.');
        return EMPTY;
      }),
    );
  }
  private errorHttp(e: HttpErrorResponse): string {
    if (e.status===401) return 'Sesión expirada: inicia sesión como administrador.';
    if (e.status===403) return 'Permiso administrativo denegado.';
    return mensajeError(e, e.status === 409
      ? 'Revisa el estado y los requisitos del pedido antes de continuar.'
      : 'No pudimos completar la operación. Inténtalo nuevamente.');
  }
}
