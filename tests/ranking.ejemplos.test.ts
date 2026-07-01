import { describe, expect, it } from 'vitest';

import { clasificarCinco } from '../src/dominio/evaluador';
import { CategoriaMano } from '../src/dominio/modelos';
import { EJEMPLOS_CATEGORIA } from '../src/cliente/vistas/ranking';

describe('Ejemplos visuales del Ranking de manos', () => {
  it('cada ejemplo de cinco cartas coincide con su categoría', () => {
    for (const categoria of Object.values(CategoriaMano).filter((v) => typeof v === 'number')) {
      const cartas = EJEMPLOS_CATEGORIA[categoria as CategoriaMano];
      expect(cartas).toHaveLength(5);
      expect(clasificarCinco([...cartas]).categoria).toBe(categoria);
    }
  });
});
