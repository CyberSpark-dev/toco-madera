/** Catálogo público reutilizado sin alterar el CRUD administrativo. */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ProductoCatalogo } from './carrito';

@Injectable({ providedIn: 'root' })
export class CatalogoCarritoService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://127.0.0.1:5000/api/v1/productos/';

  listar(): Observable<ProductoCatalogo[]> {
    return this.http.get<ProductoCatalogo[] | { productos: ProductoCatalogo[] }>(this.url)
      .pipe(map(respuesta => {
        const productos = Array.isArray(respuesta) ? respuesta : respuesta.productos;
        if (!Array.isArray(productos)) throw new Error('Formato de catálogo inesperado.');
        return productos.filter(p => p.activo === undefined || Boolean(p.activo));
      }));
  }
}
