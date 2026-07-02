import type { JugadorVisible } from '../../protocolo';

/** Zona del asiento en la mesa. */
export type ZonaAsiento = 'local' | 'rival';

/** Coordenadas en porcentaje del área de mesa (x, y). */
export interface PosicionAsiento {
  jugador: JugadorVisible;
  x: number;
  y: number;
  esYo: boolean;
  zona: ZonaAsiento;
}

/** Reparte rivales en un arco superior (referencia para orden y metadatos). */
function distribuirRivalesEnArco(cantidad: number): readonly { x: number; y: number }[] {
  if (cantidad === 0) {
    return [];
  }

  const margenX = 22;
  const anchoUtil = 100 - margenX * 2;

  return Array.from({ length: cantidad }, (_, indice) => {
    const t = cantidad === 1 ? 0.5 : indice / (cantidad - 1);
    const x = margenX + t * anchoUtil;
    const distanciaAlCentro = Math.abs(t - 0.5) * 2;
    const y = 8 + distanciaAlCentro * 3;
    return { x, y };
  });
}

/**
 * Asigna posiciones: el jugador local abajo-centro; el resto en fila superior
 * con espaciado dinámico sobre el arco de la mesa. En modo espectador, todos
 * van en la fila superior.
 */
export function calcularPosicionesAsientos(
  jugadores: readonly JugadorVisible[],
  perspectivaId: string | null,
): PosicionAsiento[] {
  if (jugadores.length === 0) {
    return [];
  }

  let orden = [...jugadores];
  if (perspectivaId !== null) {
    const idx = jugadores.findIndex((j) => j.id === perspectivaId);
    if (idx >= 0) {
      orden = [...jugadores.slice(idx), ...jugadores.slice(0, idx)];
    }
  }

  const posiciones: PosicionAsiento[] = [];

  if (perspectivaId !== null && orden.length > 0) {
    const local = orden[0]!;
    posiciones.push({
      jugador: local,
      x: 50,
      y: 90,
      esYo: true,
      zona: 'local',
    });

    const rivales = orden.slice(1);
    const coords = distribuirRivalesEnArco(rivales.length);
    rivales.forEach((jugador, indice) => {
      const coord = coords[indice] ?? { x: 50, y: 8 };
      posiciones.push({
        jugador,
        x: coord.x,
        y: coord.y,
        esYo: false,
        zona: 'rival',
      });
    });
    return posiciones;
  }

  const coords = distribuirRivalesEnArco(orden.length);
  orden.forEach((jugador, indice) => {
    const coord = coords[indice] ?? { x: 50, y: 8 };
    posiciones.push({
      jugador,
      x: coord.x,
      y: coord.y,
      esYo: false,
      zona: 'rival',
    });
  });

  return posiciones;
}

/** Cuenta rivales (asientos superiores) para espaciado dinámico en CSS. */
export function contarRivales(
  jugadores: readonly JugadorVisible[],
  perspectivaId: string | null,
): number {
  if (perspectivaId === null) {
    return jugadores.length;
  }
  return Math.max(0, jugadores.length - 1);
}
