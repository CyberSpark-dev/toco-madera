import type { ClienteAdmin } from '../../core/services/cuentas';

type FrecuenciaCliente = Pick<ClienteAdmin, 'id_usuario' | 'nombre' | 'pedidos_validos'>;

const nombres = new Intl.Collator('es-MX');

export function clasificarFrecuencia<T extends FrecuenciaCliente>(clientes: readonly T[]) {
  const unicos = new Map(clientes.map((cliente) => [cliente.id_usuario, cliente]));
  const desempatar = (a: T, b: T) =>
    nombres.compare(a.nombre, b.nombre) || a.id_usuario - b.id_usuario;
  const ordenados = [...unicos.values()].sort(
    (a, b) => b.pedidos_validos - a.pedidos_validos || desempatar(a, b),
  );
  const mitad = Math.floor(ordenados.length / 2);
  const superior = ordenados.slice(0, mitad);
  const inferior = ordenados.slice(mitad);

  return {
    mas: superior.slice(0, 5),
    menos: inferior.sort((a, b) => a.pedidos_validos - b.pedidos_validos || desempatar(a, b)).slice(0, 5),
    maximo: ordenados[0]?.pedidos_validos || 1,
    empate: mitad > 0 && ordenados[mitad - 1].pedidos_validos === ordenados[mitad].pedidos_validos,
  };
}
