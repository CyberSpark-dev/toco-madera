import type { HttpErrorResponse } from '@angular/common/http';

// La interfaz solo reconoce textos públicos revisados. Las respuestas desconocidas
// se sustituyen por el mensaje local de la operación.
const mensajesPermitidos = new Set([
  'El SKU ya está registrado.',
  'Selecciona una categoría válida.',
  'La categoría no existe.',
  'Selecciona una unidad válida.',
  'La unidad de medida no existe.',
  'El precio debe ser mayor que cero.',
  'El precio admite máximo dos decimales.',
  'El correo ya está en uso.',
  'El nombre debe contener entre 2 y 120 caracteres.',
  'El teléfono debe tener 10 dígitos.',
  'La contraseña actual es incorrecta.',
  'La contraseña nueva requiere 10 a 128 caracteres, letras y números.',
  'La contraseña nueva debe ser diferente.',
  'El carrito debe tener entre 1 y 50 artículos.',
  'Cantidad debe estar entre 1 y 100 unidades.',
  'El pedido ya está cancelado.',
  'Este pedido ya no admite cancelación automática. Comunícate con el taller.',
  'El pedido ya tiene producción, entrega o inventario reservado. Solicita atención al taller.',
  'Escribe el motivo de rechazo (mínimo 5 caracteres).',
  'El producto no tiene receta vigente.',
  'Esta orden ya tiene consumos registrados; no se permite repetir el descuento.',
  'La receta no contiene materiales; no se realizó ningún descuento.',
  'Debes autorizar el pedido antes de programar la entrega.',
  'Primero confirma fecha y punto de recolección.',
  'Programa una fecha futura razonable, hora local de León.',
  'No existe saldo pendiente.',
  'El saldo ya fue liquidado.',
]);

export function mensajeError(error: HttpErrorResponse, alternativa: string): string {
  if (error.status === 0) return 'En este momento no hay conexión. Inténtalo nuevamente.';
  if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (error.status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';

  const texto: unknown = error.error?.message;
  if (error.status >= 400 && error.status < 500 && typeof texto === 'string') {
    if (mensajesPermitidos.has(texto)) return texto;
    if (texto.startsWith('Stock insuficiente de ')) {
      return 'No hay suficientes materiales. Consulta las existencias antes de continuar.';
    }
    if (texto.startsWith('Saldo simulado pendiente:')) {
      return 'Registra la liquidación del saldo simulado antes de confirmar la entrega.';
    }
  }

  return alternativa;
}
