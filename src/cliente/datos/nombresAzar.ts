// Catálogo de alias temáticos (fuente: docs/random_names.md → nombresAzar.json).

import catalogoJson from './nombresAzar.json';

/** Alias disponible para sorteo con su categoría y descripción. */
export interface AliasAzar {
  nombre: string;
  descripcion: string;
  categoria: string;
}

/** Lista precargada desde JSON (sin parseo en runtime). */
export const ALIAS_AZAR: readonly AliasAzar[] = catalogoJson as AliasAzar[];

/**
 * Elige un alias al azar. Opcionalmente excluye nombres ya usados en la mesa.
 */
export function elegirAliasAlAzar(excluir: ReadonlySet<string> = new Set()): AliasAzar {
  const disponibles = ALIAS_AZAR.filter((alias) => !excluir.has(alias.nombre));
  const pool = disponibles.length > 0 ? disponibles : ALIAS_AZAR;
  const indice = Math.floor(Math.random() * pool.length);
  return pool[indice]!;
}
