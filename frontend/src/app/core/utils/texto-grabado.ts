interface ProductoGrabable {
  permite_grabado: boolean | number;
  max_caracteres_grabado: number;
}

export function maximoGrabado(producto: ProductoGrabable): number {
  return Math.max(0, Math.min(Number(producto.max_caracteres_grabado) || 0, 120));
}

export function textoGrabadoNormalizado(texto: string): string {
  // Espacios de borde reconocidos por str.strip() en Flask. El interior se conserva.
  return texto.replace(/^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu, '');
}

export function errorGrabado(producto: ProductoGrabable, texto: string): string {
  const normalizado = textoGrabadoNormalizado(texto);
  if (!normalizado) return '';
  if (!producto.permite_grabado) return 'Este producto no permite grabado.';
  const maximo = maximoGrabado(producto);
  return [...normalizado].length > maximo ? `Grabado: máximo ${maximo} caracteres.` : '';
}
