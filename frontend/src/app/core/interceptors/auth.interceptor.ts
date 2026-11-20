/** Adjunta JWT solo a solicitudes destinadas a la API local de Toco Madera. */
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Auth } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Auth).obtenerToken();
  const apiBase = 'http://127.0.0.1:5000/api/v1/';
  if (!req.url.startsWith(apiBase) || !token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
