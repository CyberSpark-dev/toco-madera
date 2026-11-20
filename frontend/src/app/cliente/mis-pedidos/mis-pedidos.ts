/** Toco Madera | Etapa 3.18.6 - Historial privado de pedidos del cliente. */
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ClientePedidosService, PedidoCliente } from '../../core/services/cliente-pedidos';

@Component({
  selector: 'app-mis-pedidos-cliente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css'
})
export class MisPedidosCliente implements OnInit {
  private readonly api = inject(ClientePedidosService);
  readonly pedidos = signal<PedidoCliente[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.api.listar().subscribe({
      next: r => { this.pedidos.set(r.pedidos); this.cargando.set(false); },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(e.status === 401
          ? 'Inicia sesión con una cuenta cliente para consultar tus pedidos.'
          : e.status === 403
            ? 'Esta pantalla requiere una cuenta cliente.'
            : typeof e.error?.message === 'string' ? e.error.message : 'No pudimos consultar tus pedidos.');
      }
    });
  }

  dinero(valor: string | number): string {
    return Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
