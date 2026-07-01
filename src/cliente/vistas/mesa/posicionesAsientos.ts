import type { JugadorVisible } from '../../protocolo';

/** Coordenadas en porcentaje del área de mesa (x, y); asientos en el margen exterior al fieltro. */
export interface PosicionAsiento {
  jugador: JugadorVisible;
  x: number;
  y: number;
  esYo: boolean;
}

/** Slots alrededor de la mesa; el índice 0 es siempre el asiento inferior (local). */
const COORDS: readonly (readonly [number, number])[] = [
  [50, 92],
  [5, 50],
  [18, 9],
  [50, 6],
  [82, 9],
  [95, 50],
];

const LAYOUT_POR_CANTIDAD: Record<number, readonly number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/**
 * Asigna posiciones alrededor de la mesa rotando la lista para que el jugador
 * local quede abajo-centro.
 */
export function calcularPosicionesAsientos(
  jugadores: readonly JugadorVisible[],
  perspectivaId: string | null,
): PosicionAsiento[] {
  if (jugadores.length === 0) {
    return [];
  }

  const layout = LAYOUT_POR_CANTIDAD[jugadores.length];
  if (layout === undefined) {
    return [];
  }

  let orden = [...jugadores];
  if (perspectivaId !== null) {
    const idx = jugadores.findIndex((j) => j.id === perspectivaId);
    if (idx >= 0) {
      orden = [...jugadores.slice(idx), ...jugadores.slice(0, idx)];
    }
  }

  return orden.map((jugador, i) => {
    const slot = layout[i] ?? 0;
    const [x, y] = COORDS[slot] ?? [50, 50];
    return {
      jugador,
      x,
      y,
      esYo: perspectivaId !== null && jugador.id === perspectivaId,
    };
  });
}
