export function formatearCantidad(valor: string, unidad: string): { texto: string; aviso?: string } {
  const decimal = /^(\d{1,10})(?:\.(\d{1,4}))?$/.exec(valor);
  if (!decimal) return { texto: valor };

  const entero = Number(decimal[1]);
  const fraccion = (decimal[2] ?? '').replace(/0+$/, '');
  if (!fraccion) return { texto: String(entero) };

  const nombreUnidad = unidad.trim().toLowerCase();
  const indivisible = /^(pza\.?|piezas?|hojas? completas?|tornillos?|taquetes?)$/.test(nombreUnidad);
  if (indivisible) {
    return {
      texto: `${entero}.${fraccion}`,
      aviso: 'Cantidad fraccionaria registrada para una unidad indivisible.',
    };
  }

  if (fraccion.length <= 2) return { texto: `${entero}.${fraccion}` };

  // Redondear en centésimas enteras evita aproximar el DECIMAL original en coma flotante.
  const centesimas = entero * 100 + Number(fraccion.slice(0, 2)) + Number(fraccion[2] >= '5');
  return {
    texto: centesimas === 0 ? '< 0.01' : `≈ ${centesimas / 100}`,
    aviso: `Valor registrado: ${valor}. La presentación se limita a dos decimales.`,
  };
}
