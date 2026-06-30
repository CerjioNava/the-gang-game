import fc from 'fast-check';

/**
 * Número mínimo de iteraciones por prueba basada en propiedades (PBT).
 * El diseño exige al menos 100 iteraciones por cada propiedad de correctitud.
 */
export const NUM_RUNS_POR_DEFECTO = 100;

/**
 * Parámetros por defecto para fast-check, fijando numRuns >= 100.
 * Permite sobrescribir cualquier parámetro manteniendo el mínimo de iteraciones.
 */
export function parametrosPbt(
  overrides: fc.Parameters<unknown> = {},
): fc.Parameters<unknown> {
  const numRuns = Math.max(
    overrides.numRuns ?? NUM_RUNS_POR_DEFECTO,
    NUM_RUNS_POR_DEFECTO,
  );
  return { ...overrides, numRuns };
}

/**
 * Ejecuta una propiedad síncrona con fast-check garantizando numRuns >= 100.
 *
 * Uso:
 *   verificarPropiedad(fc.property(fc.integer(), (n) => n + 0 === n));
 */
export function verificarPropiedad<Ts extends unknown[]>(
  property: fc.IRawProperty<Ts>,
  overrides: fc.Parameters<unknown> = {},
): void {
  fc.assert(property, parametrosPbt(overrides));
}

/**
 * Variante asíncrona de verificarPropiedad para propiedades que devuelven Promesas.
 */
export async function verificarPropiedadAsync<Ts extends unknown[]>(
  property: fc.IAsyncPropertyWithHooks<Ts>,
  overrides: fc.Parameters<unknown> = {},
): Promise<void> {
  await fc.assert(property, parametrosPbt(overrides));
}

export { fc };
