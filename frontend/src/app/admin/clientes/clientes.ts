import { mensajeNotificable } from '../../core/services/notificaciones';
import { mensajeError } from '../../core/utils/mensajes';
import { formatearDinero } from '../../core/utils/dinero';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Cuentas, ClienteAdmin } from '../../core/services/cuentas';
import { clasificarFrecuencia } from './frecuencia-compras';

@Component({ selector:'app-admin-clientes', standalone:true, imports:[FormsModule,DatePipe], templateUrl:'./clientes.html' })
export class ClientesAdmin implements OnInit {
  readonly dinero = formatearDinero;
  private readonly cuentas=inject(Cuentas);
  readonly clientes=signal<ClienteAdmin[]>([]);
  readonly cargando=signal(false);
  readonly errorCarga = signal(false);
  readonly guardando=signal(false);
  readonly error = mensajeNotificable('error');
  readonly exito = mensajeNotificable('exito');
  readonly filtro=signal('');
  readonly visibles=computed(()=>this.clientes().filter(c=>`${c.nombre} ${c.correo} ${c.telefono??''}`.toLowerCase().includes(this.filtro().toLowerCase())));
  readonly frecuenciaCompras = computed(() => {
    const { mas, menos, maximo, empate } = clasificarFrecuencia(this.clientes());
    return {
      maximo,
      empate,
      grupos: [
        { titulo: 'Clientes que más compran', clientes: mas, vacio: 'No hay clientes asignados a este grupo.' },
        { titulo: 'Clientes que menos compran', clientes: menos, vacio: 'Aún no hay clientes registrados.' },
      ],
    };
  });
  ngOnInit(){this.cargar();}
  cargar(){this.cargando.set(true);this.errorCarga.set(false);this.error.set('');this.cuentas.clientes().subscribe({
    next:r=>{this.clientes.set(r.clientes);this.cargando.set(false);},
    error:(e: HttpErrorResponse)=>{this.error.set(mensajeError(e, 'No pudimos consultar los clientes. Inténtalo nuevamente.'));this.errorCarga.set(true);this.cargando.set(false);}
  });}
  cambiarEstado(c:ClienteAdmin){
    const accion=c.activo?'desactivar':'reactivar';
    if(!window.confirm(`¿Deseas ${accion} la cuenta de ${c.nombre}? Sus compras permanecerán registradas.`))return;
    this.guardando.set(true);this.error.set('');this.cuentas.estadoCliente(c.id_usuario,!c.activo).subscribe({
      next:()=>{this.guardando.set(false);this.exito.set(c.activo ? 'La cuenta del cliente se desactivó correctamente.' : 'La cuenta del cliente se reactivó correctamente.');this.cargar();},
      error:(e: HttpErrorResponse)=>{this.error.set(mensajeError(e, 'No pudimos cambiar el estado de la cuenta. Inténtalo nuevamente.'));this.guardando.set(false);}
    });
  }
}
