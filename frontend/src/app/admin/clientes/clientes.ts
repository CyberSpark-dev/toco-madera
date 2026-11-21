import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Cuentas, ClienteAdmin } from '../../core/services/cuentas';

@Component({ selector:'app-admin-clientes', standalone:true, imports:[FormsModule,RouterLink,CurrencyPipe,DatePipe], templateUrl:'./clientes.html' })
export class ClientesAdmin implements OnInit {
  private readonly cuentas=inject(Cuentas);
  readonly clientes=signal<ClienteAdmin[]>([]);
  readonly cargando=signal(false);
  readonly guardando=signal(false);
  readonly error=signal('');
  readonly exito=signal('');
  readonly filtro=signal('');
  readonly visibles=computed(()=>this.clientes().filter(c=>`${c.nombre} ${c.correo} ${c.telefono??''}`.toLowerCase().includes(this.filtro().toLowerCase())));
  ngOnInit(){this.cargar();}
  cargar(){this.cargando.set(true);this.error.set('');this.cuentas.clientes().subscribe({
    next:r=>{this.clientes.set(r.clientes);this.cargando.set(false);},
    error:e=>{this.error.set(this.mensaje(e));this.cargando.set(false);}
  });}
  cambiarEstado(c:ClienteAdmin){
    const accion=c.activo?'desactivar':'reactivar';
    if(!window.confirm(`¿Deseas ${accion} la cuenta de ${c.nombre}? Sus compras permanecerán registradas.`))return;
    this.guardando.set(true);this.error.set('');this.cuentas.estadoCliente(c.id_usuario,!c.activo).subscribe({
      next:()=>{this.guardando.set(false);this.exito.set('Estado de cuenta actualizado.');this.cargar();},
      error:e=>{this.error.set(this.mensaje(e));this.guardando.set(false);}
    });
  }
  private mensaje(e:HttpErrorResponse){return e.error?.message??`Error HTTP ${e.status}.`;}
}
