import { describe, expect, it } from 'vitest';
import { clasificarFrecuencia } from './frecuencia-compras';

const cliente = (id_usuario: number, pedidos_validos: number, nombre = 'Cliente') =>
  ({ id_usuario, nombre, pedidos_validos });

describe('clasificarFrecuencia', () => {
  it.each([
    [0, [], []],
    [1, [], [1]],
    [2, [2], [1]],
    [6, [6, 5, 4], [1, 2, 3]],
    [8, [8, 7, 6, 5], [1, 2, 3, 4]],
    [10, [10, 9, 8, 7, 6], [1, 2, 3, 4, 5]],
    [11, [11, 10, 9, 8, 7], [1, 2, 3, 4, 5]],
    [20, [20, 19, 18, 17, 16], [1, 2, 3, 4, 5]],
  ] as const)('divide y limita una lista de %i clientes', (total, superiores, inferiores) => {
    const clientes = Array.from({ length: total }, (_, i) => cliente(i + 1, i));
    const { mas, menos } = clasificarFrecuencia(clientes);
    const idsMas = mas.map((c) => c.id_usuario);
    const idsMenos = menos.map((c) => c.id_usuario);

    expect(idsMas).toEqual(superiores);
    expect(idsMenos).toEqual(inferiores);
    expect(idsMas.filter((id) => idsMenos.includes(id))).toEqual([]);
    expect(clientes.map((c) => c.id_usuario)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
  });

  it('asigna el cliente central al grupo inferior cuando hay espacio', () => {
    const { mas, menos } = clasificarFrecuencia([cliente(1, 9), cliente(2, 4), cliente(3, 0)]);
    expect(mas.map((c) => c.id_usuario)).toEqual([1]);
    expect(menos.map((c) => c.id_usuario)).toEqual([3, 2]);
  });

  it('divide incluso cuando todos tienen cero compras y desempata por nombre e ID', () => {
    const resultado = clasificarFrecuencia([
      cliente(5, 0, 'Zoe'), cliente(9, 0, 'Ana'), cliente(2, 0, 'Ana'), cliente(1, 0, 'Bruno'),
    ]);
    expect(resultado.mas.map((c) => c.id_usuario)).toEqual([2, 9]);
    expect(resultado.menos.map((c) => c.id_usuario)).toEqual([1, 5]);
    expect(resultado.empate).toBe(true);
    expect(resultado.maximo).toBe(1);
  });

  it('indica un empate en el corte aunque haya frecuencias diferentes en los extremos', () => {
    const { empate } = clasificarFrecuencia([cliente(1, 5), cliente(2, 3), cliente(3, 3), cliente(4, 0)]);
    expect(empate).toBe(true);
  });

  it('conserva una escala válida con un cliente y no repite IDs duplicados', () => {
    const unico = cliente(1, 7);
    const resultado = clasificarFrecuencia([unico, unico]);
    expect(resultado.mas).toEqual([]);
    expect(resultado.menos).toEqual([unico]);
    expect(resultado.maximo).toBe(7);
    expect(resultado.empate).toBe(false);
  });
});
