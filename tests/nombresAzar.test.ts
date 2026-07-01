import { describe, expect, it } from 'vitest';

import { ALIAS_AZAR, elegirAliasAlAzar } from '../src/cliente/datos/nombresAzar';
import catalogoJson from '../src/cliente/datos/nombresAzar.json';

describe('nombres al azar (JSON)', () => {
  it('carga el catálogo desde nombresAzar.json', () => {
    expect(ALIAS_AZAR.length).toBe(catalogoJson.length);
    expect(ALIAS_AZAR.length).toBeGreaterThanOrEqual(45);
    expect(ALIAS_AZAR.every((a) => a.nombre.length <= 20)).toBe(true);
    expect(ALIAS_AZAR.every((a) => a.descripcion.length > 0)).toBe(true);
    expect(ALIAS_AZAR.every((a) => a.categoria.length > 0)).toBe(true);
  });

  it('elige alias evitando nombres ya usados cuando es posible', () => {
    const usados = new Set(ALIAS_AZAR.slice(0, ALIAS_AZAR.length - 1).map((a) => a.nombre));
    const elegido = elegirAliasAlAzar(usados);
    expect(usados.has(elegido.nombre)).toBe(false);
  });
});
