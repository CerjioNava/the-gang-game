import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad, parametrosPbt, NUM_RUNS_POR_DEFECTO } from './pbt';

// Pruebas mínimas que validan que el toolchain (Vitest + fast-check) está
// configurado correctamente. La lógica de juego real se prueba en tareas
// posteriores.
describe('Infraestructura de pruebas', () => {
  it('ejecuta una prueba unitaria trivial', () => {
    expect(1 + 1).toBe(2);
  });

  it('fija numRuns >= 100 por defecto en el helper de PBT', () => {
    expect(parametrosPbt().numRuns).toBe(NUM_RUNS_POR_DEFECTO);
    expect(parametrosPbt({ numRuns: 10 }).numRuns).toBe(NUM_RUNS_POR_DEFECTO);
    expect(parametrosPbt({ numRuns: 500 }).numRuns).toBe(500);
  });

  it('ejecuta una propiedad con fast-check usando el helper', () => {
    verificarPropiedad(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
    );
  });
});
