const etiquetas: Readonly<Record<string, string>> = {
  PENDIENTE_ANTICIPO: 'Pendiente de anticipo',
  EN_PRODUCCION: 'En producción',
  EN_PROCESO: 'En proceso',
  POR_REVISAR: 'Por revisar',
  HISTORICO_ENTREGADO: 'Entregado (histórico)',
  ANTICIPO_50: 'Anticipo simulado del 50 %',
  TOTAL: 'Pago total simulado',
  APROBADO_SIMULADO: 'Aprobado',
  RECHAZADO_SIMULADO: 'Rechazado',
  TARJETA_SIMULADA: 'Tarjeta simulada',
  TRANSFERENCIA_SIMULADA: 'Transferencia simulada',
  EFECTIVO_SIMULADO: 'Efectivo simulado',
};

export function etiquetaPedido(codigo: string | null | undefined): string {
  if (!codigo) return 'Sin registro';
  if (Object.hasOwn(etiquetas, codigo)) return etiquetas[codigo];
  const texto = codigo.toLocaleLowerCase('es-MX').replaceAll('_', ' ');
  return texto.charAt(0).toLocaleUpperCase('es-MX') + texto.slice(1);
}
