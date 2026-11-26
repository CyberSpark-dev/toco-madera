/// <reference lib="es2023.intl" />

const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  roundingMode: 'halfExpand',
});

/** Formatea para pantalla y conserva la precisión de las cadenas DECIMAL de la API. */
export function formatearDinero(valor: string | number | null | undefined): string {
  if (typeof valor === 'number' && Number.isFinite(valor)) return moneda.format(valor);

  if (typeof valor === 'string') {
    const decimal = valor.trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(decimal) && Number.isFinite(Number(decimal))) {
      return moneda.format(decimal as `${number}`);
    }
  }

  return 'Importe no disponible';
}
