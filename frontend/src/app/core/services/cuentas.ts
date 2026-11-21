/** Etapa 3.20.8 — Operaciones de clientes y perfil autenticado. */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsuarioAutenticado } from './auth';

export interface ProductoFavorito { id_producto: number; nombre: string; unidades: number; }
export interface CancelacionCliente { id_pedido:number; folio:string; fecha:string|null; }
export interface RechazoCliente { id_pedido:number; folio:string; fecha:string|null; motivo:string|null; }
export interface ClienteAdmin extends UsuarioAutenticado {
  creado_en: string | null;
  pedidos_validos: number;
  total_compras: number;
  productos_mas_comprados: ProductoFavorito[];
  productos_menos_comprados: ProductoFavorito[];
  total_cancelaciones: number;
  cancelaciones: CancelacionCliente[];
  total_rechazos: number;
  pedidos_rechazados: RechazoCliente[];
}
export interface CambiosCuenta { nombre: string; correo: string; telefono: string; }
export interface RespuestaCuenta { success: boolean; message: string; cliente?: ClienteAdmin; usuario?: UsuarioAutenticado; }
@Injectable({providedIn:'root'})
export class Cuentas {
  private readonly http=inject(HttpClient);
  private readonly base='http://127.0.0.1:5000/api/v1';
  clientes():Observable<{success:boolean; clientes:ClienteAdmin[]}> {
    return this.http.get<{success:boolean; clientes:ClienteAdmin[]}>(`${this.base}/admin/clientes/`);
  }
  estadoCliente(id:number,activo:boolean):Observable<RespuestaCuenta> {
    return this.http.patch<RespuestaCuenta>(`${this.base}/admin/clientes/${id}/estado`,{activo});
  }
  perfil():Observable<{success:boolean;usuario:UsuarioAutenticado}> {
    return this.http.get<{success:boolean;usuario:UsuarioAutenticado}>(`${this.base}/perfil/`);
  }
  guardarPerfil(datos:CambiosCuenta):Observable<RespuestaCuenta> {
    return this.http.patch<RespuestaCuenta>(`${this.base}/perfil/`,datos);
  }
  cambiarPassword(password_actual:string,password_nueva:string):Observable<RespuestaCuenta> {
    return this.http.post<RespuestaCuenta>(`${this.base}/perfil/password`,{password_actual,password_nueva});
  }
}
