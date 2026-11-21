/** Etapa 3.20.2 — UI ADMIN. No guarda secretos ni decide permisos en el navegador. */
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPedidosService, PedidoRevision, DetalleRevision } from '../../core/services/admin-pedidos';

@Component({
  selector: 'app-pedidos-admin',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './pedidos.html',
})
export class PedidosAdmin implements OnInit {
  private readonly api = inject(AdminPedidosService);
  readonly pedidos = signal<PedidoRevision[]>([]);
  readonly detalle = signal<DetalleRevision | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly filtro = signal('TODOS');
  readonly motivo = signal('');

  ngOnInit(): void { this.cargar(); }
  cargar(): void {
    this.cargando.set(true); this.error.set(''); this.mensaje.set('');
    this.api.listar().subscribe({
      next: r => { this.pedidos.set(r.pedidos ?? []); this.cargando.set(false); },
      error: (e: HttpErrorResponse) => { this.error.set(this.errorHttp(e)); this.cargando.set(false); }
    });
  }
  seleccionar(id: number): void {
    this.error.set(''); this.mensaje.set(''); this.detalle.set(null); this.motivo.set('');
    this.api.detalle(id).subscribe({
      next: r => this.detalle.set(r),
      error: (e: HttpErrorResponse) => this.error.set(this.errorHttp(e))
    });
  }
  verPedidos(): PedidoRevision[] {
    const filtro = this.filtro();
    return filtro === 'TODOS' ? this.pedidos() : this.pedidos().filter(x => x.autorizacion === filtro);
  }
  cambiarFiltro(value: string): void { this.filtro.set(value); }
  cambiarMotivo(value: string): void { this.motivo.set(value); }
  puedeDecidir(p: PedidoRevision): boolean { return p.autorizacion === 'POR_REVISAR' && p.estado === 'CONFIRMADO'; }
  decidir(decision: 'APROBADO' | 'RECHAZADO'): void {
    const d = this.detalle(); if (!d || this.guardando() || !this.puedeDecidir(d.pedido)) return;
    if (decision === 'RECHAZADO' && this.motivo().trim().length < 5) {
      this.error.set('Para rechazar escribe un motivo de al menos 5 caracteres.'); return;
    }
    // No marcar éxito antes de que Flask confirme su transacción.
    const texto = decision === 'APROBADO' ? 'AUTORIZAR' : 'RECHAZAR';
    if (!window.confirm(`${texto} el pedido ${d.pedido.folio}? Esta decisión queda registrada en MySQL.`)) return;
    this.guardando.set(true); this.error.set(''); this.mensaje.set('');
    const id = d.pedido.id_pedido;
    this.api.decidir(id, decision, this.motivo().trim()).subscribe({
      next: r => {
        this.guardando.set(false); this.mensaje.set(r.message);
        this.detalle.set(null); this.cargar();
        this.api.detalle(id).subscribe({ next: x => this.detalle.set(x) });
      },
      error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(this.errorHttp(e)); }
    });
  }
  dinero(v: string | number): string { return Number(v).toLocaleString('es-MX', {style:'currency',currency:'MXN'}); }
  private errorHttp(e: HttpErrorResponse): string {
    if (e.status === 401) return 'La sesión ha expirado. Vuelve a iniciar sesión como ADMIN.';
    if (e.status === 403) return 'La cuenta no tiene permisos administrativos.';
    return typeof e.error?.message === 'string' ? e.error.message : 'Error al consultar el servidor.';
  }
}
