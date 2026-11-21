import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../core/services/auth';
import { Cuentas, CambiosCuenta } from '../../core/services/cuentas';
@Component({selector:'app-mi-cuenta',standalone:true,imports:[FormsModule,RouterLink],templateUrl:'./mi-cuenta.html'})
export class MiCuenta implements OnInit {
  private readonly cuentas=inject(Cuentas);
  private readonly router=inject(Router);
  readonly auth=inject(Auth);
  readonly guardando=signal(false);
  readonly error=signal('');
  readonly aviso=signal('');
  datos:CambiosCuenta={nombre:'',correo:'',telefono:''};
  actual=''; nueva=''; confirmarNueva='';
  ngOnInit(){ if(!this.auth.autenticado()){this.router.navigateByUrl('/login');return;} this.consultar(); }
  consultar(){this.cuentas.perfil().subscribe({next:r=>{this.datos={nombre:r.usuario.nombre,correo:r.usuario.correo,telefono:r.usuario.telefono??''};},error:e=>this.error.set(this.mensaje(e))});}
  guardarDatos(){if(this.guardando())return;this.guardando.set(true);this.error.set('');this.aviso.set('');this.cuentas.guardarPerfil(this.datos).subscribe({
    next:()=>{this.guardando.set(false);this.aviso.set('Datos actualizados correctamente.');this.auth.consultarPerfil().subscribe({error:()=>{}});},
    error:e=>{this.guardando.set(false);this.error.set(this.mensaje(e));}
  });}
  guardarPassword(){if(this.guardando())return;if(this.nueva!==this.confirmarNueva){this.error.set('Las nuevas contraseñas no coinciden.');return;}
    this.guardando.set(true);this.error.set('');this.aviso.set('');this.cuentas.cambiarPassword(this.actual,this.nueva).subscribe({
      next:()=>{this.actual='';this.nueva='';this.confirmarNueva='';this.guardando.set(false);this.auth.cerrarSesion();this.router.navigateByUrl('/login');},
      error:e=>{this.guardando.set(false);this.error.set(this.mensaje(e));}
    });
  }
  private mensaje(e:HttpErrorResponse){return e.error?.message??`Error HTTP ${e.status}.`;}
}
