/**
 * TOCO MADERA - ETAPA 3.18: CHECKOUT DE PAGO SIMULADO.
 * - El usuario CAPTURA un número de prueba como en un formulario real.
 * - Tarjeta: 16 dígitos de tarjetas públicas de prueba; CLABE: 18 dígitos ficticios.
 * - La validación solo acepta los ejemplos ficticios documentados.
 * - No se solicita CVV, fecha de expiración, nombre bancario ni datos reales.
 * - Guardar para después: almacena únicamente un identificador público,
 *   separado por cuenta; nunca números financieros reales.
 * - El backend solo recibe método de pago, carrito y datos del pedido.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CarritoService } from '../../core/services/carrito';
import {
  ClientePedidosService,
  ModalidadPago,
  MetodoPago,
  PedidoCliente,
} from '../../core/services/cliente-pedidos';
import { Auth } from '../../core/services/auth';
import { IdMedioDemo, MetodosPagoDemoService } from '../../core/services/metodos-pago-demo';

import { imagenProducto } from '../../core/utils/imagenes-productos';

@Component({
  selector: 'app-checkout-cliente',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class CheckoutCliente implements OnInit {
  readonly imagenProducto = imagenProducto;

  readonly carrito = inject(CarritoService);
  readonly auth = inject(Auth);
  readonly medios = inject(MetodosPagoDemoService);
  private readonly api = inject(ClientePedidosService);
  private readonly router = inject(Router);

  readonly procesando = signal(false);
  readonly error = signal('');
  readonly codigoError = signal<number | null>(null);
  readonly confirmado = signal<PedidoCliente | null>(null);
  readonly numeroCapturado = signal('');
  readonly avisoGuardado = signal('');

  modalidad: ModalidadPago = 'ANTICIPO_50';
  metodo: MetodoPago = 'TRANSFERENCIA_SIMULADA';
  notas = '';
  aceptaSimulacion = false;
  guardarParaDespues = false;

  // Valores inventados: no corresponden a instrumentos habilitados para pago.
  readonly ejemploTarjeta = '4242 4242 4242 4242';
  readonly ejemploTransferencia = '000000000000000000';

  ngOnInit(): void {
    this.medios.cargar(this.auth.esCliente() ? (this.auth.usuario()?.id_usuario ?? null) : null);
  }

  dinero(v: number | string): string {
    return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  montoInicialEstimado(): number {
    const total = this.carrito.subtotalEstimado();
    return this.modalidad === 'ANTICIPO_50' ? Math.round(total * 50) / 100 : total;
  }

  /** Actualiza únicamente memoria del componente: el valor no se persiste. */
  actualizarNumero(valor: string): void {
    const maximo = this.metodo === 'TARJETA_SIMULADA' ? 16 : 18;
    this.numeroCapturado.set(
      String(valor ?? '')
        .replace(/\D/g, '')
        .slice(0, maximo),
    );
    this.error.set('');
    this.codigoError.set(null);
  }

  cambiarMetodo(tipo: MetodoPago): void {
    this.metodo = tipo;
    this.numeroCapturado.set('');
    this.guardarParaDespues = false;
    this.avisoGuardado.set('');
    this.error.set('');
  }

  /** Para tarjeta mostramos grupos de cuatro; transferencia conserva 18 dígitos. */
  numeroVisible(): string {
    const digitos = this.numeroCapturado();
    return this.metodo === 'TARJETA_SIMULADA' ? digitos.replace(/(\d{4})(?=\d)/g, '$1 ') : digitos;
  }

  cargarGuardado(id: IdMedioDemo): void {
    const medio = this.medios.describir(id);
    this.metodo = medio.tipo;
    this.numeroCapturado.set(this.medios.numeroDemo(id));
    this.error.set('');
    this.avisoGuardado.set(`Se cargó ${medio.etiqueta}. Solo funciona para pruebas.`);
  }

  eliminarGuardado(id: IdMedioDemo): void {
    this.medios.eliminar(id);
    this.avisoGuardado.set('Método de demostración eliminado de este navegador.');
  }

  irAlLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/cliente/checkout' } });
  }

  /** Requiere longitud oficial del ejemplo y coincidencia con datos de prueba. */
  private validarInstrumento(): IdMedioDemo | null {
    const digitos = this.numeroCapturado();
    const longitud = this.metodo === 'TARJETA_SIMULADA' ? 16 : 18;
    if (!new RegExp(`^\\d{${longitud}}$`).test(digitos)) {
      this.error.set(`Ingresa ${longitud} dígitos para el método simulado seleccionado.`);
      return null;
    }
    const id = this.medios.identificar(digitos, this.metodo);
    if (!id) {
      this.error.set(
        'Este simulador solo acepta los números ficticios de prueba indicados. No introduzcas datos bancarios reales.',
      );
      return null;
    }
    return id;
  }

  confirmar(): void {
    if (this.procesando() || this.confirmado()) return;
    this.error.set('');
    this.codigoError.set(null);
    if (this.carrito.vacio()) {
      this.error.set('El carrito está vacío.');
      return;
    }
    if (!this.auth.autenticado()) {
      this.codigoError.set(401);
      this.error.set('Inicia sesión con tu cuenta cliente para continuar. El carrito se conserva.');
      return;
    }
    if (!this.auth.esCliente()) {
      this.codigoError.set(403);
      this.error.set('La cuenta actual no tiene rol CLIENTE.');
      return;
    }
    if (this.metodo !== 'TRANSFERENCIA_SIMULADA' && this.metodo !== 'TARJETA_SIMULADA') {
      this.error.set('Selecciona transferencia o tarjeta simulada.');
      return;
    }
    const idDemo = this.validarInstrumento();
    if (!idDemo) return;
    if (!this.aceptaSimulacion) {
      this.error.set('Debes aceptar que se trata de una simulación académica.');
      return;
    }
    if (this.notas.length > 500) {
      this.error.set('Las observaciones admiten máximo 500 caracteres.');
      return;
    }

    // Capturar el propietario ANTES de enviar la solicitud asíncrona.
    // Si otra cuenta inicia sesión mientras Flask responde, no se vacía su carrito.
    const idClienteCheckout = this.carrito.idClienteActual();
    if (idClienteCheckout === null) {
      this.error.set('Inicia sesión con una cuenta cliente para confirmar el pedido.');
      return;
    }

    this.procesando.set(true);
    // No se envía ningún número de tarjeta o CLABE a Flask.
    this.api
      .confirmar({
        clave_solicitud: this.carrito.claveSolicitud(),
        modalidad_pago: this.modalidad,
        metodo_pago: this.metodo,
        notas: this.notas.trim() || null,
        detalles: this.carrito.datosCheckout(),
      })
      .subscribe({
        next: (respuesta) => {
          if (this.guardarParaDespues) {
            this.medios.guardar(idDemo);
          }
          this.numeroCapturado.set('');
          this.confirmado.set(respuesta.pedido);
          this.carrito.vaciarDeUsuario(idClienteCheckout);
          this.procesando.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.procesando.set(false);
          this.codigoError.set(e.status);
          console.error('Checkout HTTP:', e.status, e);
          if (e.status === 401) {
            this.error.set('La sesión no está disponible. Inicia sesión nuevamente.');
          } else if (e.status === 403) {
            this.error.set('Flask rechazó el rol: usa una cuenta CLIENTE.');
          } else if (e.status === 409) {
            this.error.set(
              'El pedido podría estar registrado. Comprueba Mis pedidos antes de reintentar.',
            );
          } else if (e.status >= 500) {
            this.error.set(
              'Error de Flask/MySQL. Revisa Mis pedidos y el registro del servidor antes de reintentar.',
            );
          } else if (e.status === 0) {
            this.error.set(
              'No fue posible conectar con Flask. Comprueba Mis pedidos antes de reintentar.',
            );
          } else {
            this.error.set(
              typeof e.error?.message === 'string'
                ? e.error.message
                : 'No fue posible confirmar el pedido.',
            );
          }
        },
      });
  }
}
