// Resolución del Showdown (lógica pura, sin I/O).
//
// El Showdown ordena a los Jugadores de forma ascendente según el valor en
// estrellas de su Ficha roja (una biyección con los valores 1..N) y comprueba
// que, recorriendo ese orden, la fuerza de las manos sea no decreciente según el
// comparador del Evaluador_Manos. Si para algún par de Jugadores consecutivos la
// mano del posterior es de fuerza menor que la del anterior, el Golpe fracasa y
// se registra la primera violación; en caso contrario, el Golpe es exitoso.
//
// Los Empates_Verdaderos entre Jugadores consecutivos (comparación nula) se
// consideran satisfechos: como la condición de éxito exige fuerza >= y un empate
// cumple la igualdad, el orden relativo de sus Fichas rojas entre ellos no afecta
// el resultado. La condición se evalúa así únicamente respecto a los Jugadores no
// empatados que los preceden y los siguen en el orden.
//
// Este módulo es puro: no muta sus entradas ni realiza I/O. NO implementa el
// conteo de Bóvedas/Alarmas ni el fin de Partida (eso corresponde a la tarea
// 10.2 sobre el Motor_Juego).
//
// _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

import { comparar, evaluar } from './evaluador';
import type {
  EstadoFichas,
  EstadoGolpe,
  Jugador,
  ManoEvaluada,
  PosicionShowdown,
  ResultadoShowdown,
} from './modelos';

/**
 * Obtiene el valor en estrellas de la Ficha roja de un Jugador a partir del
 * estado de Fichas.
 *
 * @param fichas Estado de Fichas del Golpe.
 * @param jugadorId Identificador del Jugador.
 * @returns Valor en estrellas (1..N) de la Ficha roja del Jugador.
 * @throws {Error} Si el Jugador no posee una Ficha roja (precondición del
 *   Showdown: todos los Jugadores tienen su Ficha roja, criterio 8.1).
 */
function estrellasRojasDe(fichas: EstadoFichas, jugadorId: string): number {
  const propias = fichas.porJugador[jugadorId] ?? [];
  const roja = propias.find((f) => f.color === 'ROJO');
  if (roja === undefined) {
    throw new Error(
      `El jugador ${jugadorId} no posee una ficha roja; no puede iniciarse el Showdown.`,
    );
  }
  return roja.estrellas;
}

/**
 * Evalúa la mejor mano de un Jugador a partir de sus dos Cartas de Bolsillo y
 * las cinco Cartas Comunitarias.
 *
 * @param jugador Jugador cuya mano se evalúa.
 * @param comunitarias Las cinco Cartas Comunitarias reveladas.
 * @returns La mano evaluada del Jugador.
 * @throws {Error} Si faltan cartas para evaluar (precondición del Showdown:
 *   bolsillos repartidos y cinco comunitarias reveladas).
 */
function evaluarManoDe(
  jugador: Jugador,
  comunitarias: ManoEntrada,
): ManoEvaluada {
  const resultado = evaluar(jugador.bolsillo, comunitarias);
  if (!resultado.ok) {
    throw new Error(
      `No se puede evaluar la mano del jugador ${jugador.id} en el Showdown: faltan cartas.`,
    );
  }
  return resultado.mano;
}

/** Las cinco Cartas Comunitarias necesarias para evaluar en el Showdown. */
type ManoEntrada = EstadoGolpe['comunitarias'];

/**
 * Resuelve el Showdown de un Golpe.
 *
 * Para cada Jugador determina el valor de estrellas de su Ficha roja y evalúa su
 * mejor mano sobre sus 2 Cartas de Bolsillo más las 5 Cartas Comunitarias del
 * Golpe. Construye el orden ascendente por estrellas de la Ficha roja (biyección
 * con 1..N, comenzando por la de 1 estrella) y declara el Golpe exitoso si y solo
 * si, para cada par de Jugadores consecutivos, la mano del posterior tiene fuerza
 * mayor o igual que la del anterior según {@link comparar}. En caso de fracaso
 * registra la primera violación `{ anterior, posterior }`.
 *
 * Los Empates_Verdaderos consecutivos (comparación nula) quedan satisfechos por
 * el propio bicondicional `comparar >= 0`, de modo que el orden relativo de sus
 * Fichas rojas entre ellos no provoca fracaso.
 *
 * Función pura: no muta `jugadores` ni `golpe`.
 *
 * @param jugadores Jugadores de la Partida (cada uno con sus Cartas de Bolsillo).
 * @param golpe Estado del Golpe en curso (Comunitarias y estado de Fichas).
 * @returns El {@link ResultadoShowdown} con el orden, el éxito y la violación.
 * @throws {Error} Si algún Jugador carece de Ficha roja o de cartas suficientes.
 * _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
 */
export function resolverShowdown(
  jugadores: readonly Jugador[],
  golpe: EstadoGolpe,
): ResultadoShowdown {
  // 1. Para cada Jugador: estrellas de su Ficha roja y su mejor mano evaluada.
  const posiciones: PosicionShowdown[] = jugadores.map((jugador) => ({
    jugadorId: jugador.id,
    estrellasRojas: estrellasRojasDe(golpe.fichas, jugador.id),
    mano: evaluarManoDe(jugador, golpe.comunitarias),
  }));

  // 2. Orden ascendente por estrellas de la Ficha roja (biyección 1..N).
  const orden = [...posiciones].sort(
    (a, b) => a.estrellasRojas - b.estrellasRojas,
  );

  // 3. Recorrer pares consecutivos: el posterior debe tener fuerza >= que el
  //    anterior. La primera violación (posterior más débil) declara el fracaso.
  //    Un Empate_Verdadero (comparar === 0) satisface la condición, por lo que
  //    no causa fracaso (criterio 8.5).
  let exito = true;
  let violacion: ResultadoShowdown['violacion'] = null;
  for (let i = 0; i + 1 < orden.length; i++) {
    const anterior = orden[i]!;
    const posterior = orden[i + 1]!;
    if (comparar(posterior.mano, anterior.mano) < 0) {
      exito = false;
      violacion = { anterior: anterior.jugadorId, posterior: posterior.jugadorId };
      break;
    }
  }

  return { orden, exito, violacion };
}
