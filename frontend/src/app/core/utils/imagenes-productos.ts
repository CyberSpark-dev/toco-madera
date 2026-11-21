/**
 * Toco Madera — imágenes de catálogo, sin cambios a la API o base de datos.
 * 'ambiente': escena del producto, para la portada.
 * 'solo': vista limpia del objeto, para carrito / checkout / pedidos.
 */
export type VistaProducto = 'ambiente' | 'solo';

const NOMBRES_ARCHIVO = [
  ['portatelefonos', ['telefono', 'celular', 'smartphone', 'movil', 'porta telefono', 'soporte']],
  ['marco_fotografias', ['marco', 'fotografia', 'retrato']],
  ['rodillo_cocina', ['rodillo']],
  ['repisa', ['repisa', 'estante']],
  ['portallaves', ['portallaves', 'porta llaves', 'llavero', 'llaves']],
  ['placa_escritorio', ['placa', 'escritorio', 'nombre de escritorio', 'letrero']],
] as const;

export function imagenProducto(nombre: string | null | undefined, vista: VistaProducto): string | null {
  const nombreNormalizado = (nombre ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[-_]+/g, ' ').trim();

  for (const [archivo, palabras] of NOMBRES_ARCHIVO) {
    if (palabras.some(palabra => nombreNormalizado.includes(palabra))) {
      return vista === 'solo'
        ? `/productos/solo/${archivo}.webp`
        : `/productos/${archivo}.png`;
    }
  }
  // Si el nombre no coincide, no inventamos una imagen de otro producto.
  return null;
}
