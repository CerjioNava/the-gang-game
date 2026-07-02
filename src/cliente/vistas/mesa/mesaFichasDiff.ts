import type { ColorFicha, EstadoFichas, Ficha } from '../../../dominio/modelos';

export type UbicacionFicha = 'centro' | { jugadorId: string };

export interface MovimientoFicha {
  ficha: Ficha;
  origen: UbicacionFicha;
  destino: UbicacionFicha;
}

/** Clave estable de una ficha (color + estrellas). */
export function claveFicha(ficha: Ficha): string {
  return `${ficha.color}-${ficha.estrellas}`;
}

function parseClaveFicha(clave: string): Ficha | null {
  const partes = clave.split('-');
  if (partes.length < 2) {
    return null;
  }
  const estrellas = Number(partes[partes.length - 1]);
  const color = partes.slice(0, -1).join('-') as ColorFicha;
  if (!Number.isFinite(estrellas)) {
    return null;
  }
  return { color, estrellas };
}

function ubicaciones(fichas: EstadoFichas): Map<string, UbicacionFicha> {
  const map = new Map<string, UbicacionFicha>();
  for (const ficha of fichas.centro) {
    map.set(claveFicha(ficha), 'centro');
  }
  for (const [jugadorId, lista] of Object.entries(fichas.porJugador)) {
    for (const ficha of lista) {
      map.set(claveFicha(ficha), { jugadorId });
    }
  }
  return map;
}

/** Detecta fichas que cambiaron de ubicación entre dos estados. */
export function detectarMovimientosFichas(
  prev: EstadoFichas,
  next: EstadoFichas,
): MovimientoFicha[] {
  const prevUb = ubicaciones(prev);
  const nextUb = ubicaciones(next);
  const movimientos: MovimientoFicha[] = [];

  for (const [clave, destino] of nextUb) {
    const origen = prevUb.get(clave);
    if (origen === undefined || ubicacionIgual(origen, destino)) {
      continue;
    }
    const ficha = parseClaveFicha(clave);
    if (ficha === null) {
      continue;
    }
    movimientos.push({ ficha, origen, destino });
  }

  return movimientos;
}

function ubicacionIgual(a: UbicacionFicha, b: UbicacionFicha): boolean {
  if (a === 'centro' && b === 'centro') {
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return a.jugadorId === b.jugadorId;
  }
  return false;
}
