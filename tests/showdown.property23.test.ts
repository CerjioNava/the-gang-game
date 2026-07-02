import { describe, it, expect } from "vitest";
import { fc, verificarPropiedad } from "./pbt";
import { resolverShowdown } from "../src/dominio/showdown";
import { comparar, esEmpateVerdadero, evaluar } from "../src/dominio/evaluador";
import {
  PALOS,
  type Carta,
  type EstadoGolpe,
  type Ficha,
  type Jugador,
  type Palo,
} from "../src/dominio/modelos";

// Prueba basada en propiedades de la resolución del Showdown (fast-check + Vitest).
// _Requirements: 8.5_
//
// Feature: the-gang-game, Property 23: Para cualquier orden de Showdown en el que
// dos o más Jugadores consecutivos forman un Empate_Verdadero, el orden relativo de
// sus Fichas rojas entre ellos no afecta el resultado del Golpe; la condición de
// éxito o fracaso depende únicamente de su fuerza respecto a los Jugadores no
// empatados que los preceden y los siguen en el orden.

// ===========================================================================
// Construcción de escenarios con Empates_Verdaderos garantizados
// ===========================================================================
//
// Estrategia: usamos un tablero (Cartas Comunitarias) fijo de TRES Ases más una K
// y una Q (A A A K Q). Cualquier Jugador con dos cartas bajas (2..9) que no formen
// par ni completen una escalera obtiene SIEMPRE la misma mejor mano: trío de Ases
// con kickers K y Q (AAA-K-Q). Por tanto, todos esos Jugadores forman un
// Empate_Verdadero real entre sí (mismas categoría y valores), aunque sus cartas de
// bolsillo sean distintas, porque esas cartas no entran en la mejor combinación.
//
// Para tener Jugadores NO empatados (más fuertes) usamos un "disruptor" cuyas
// cartas de bolsillo elevan su mano por encima del trío de Ases: Full House (par en
// bolsillo), Póker (cuarto As) o Escalera (J-10 → A-K-Q-J-10).

const c = (valor: number, palo: Palo): Carta => ({ valor, palo });

/** Tablero fijo: A A A K Q (palos mezclados, sin riesgo de color). */
const COMUNITARIAS: readonly Carta[] = [
  c(14, "PICAS"),
  c(14, "CORAZONES"),
  c(14, "DIAMANTES"),
  c(13, "TREBOLES"),
  c(12, "DIAMANTES"),
];

/**
 * Pozo de cartas bajas (valores 2..9) en orden palo-mayor. Tomadas de dos en dos,
 * cada par tiene valores distintos (no forma par) y permanece dentro del mismo palo,
 * de modo que las cartas de todos los Jugadores empatados son distintas entre sí.
 */
const POOL_BAJAS: Carta[] = [];
for (const palo of PALOS) {
  for (let v = 2; v <= 9; v++) {
    POOL_BAJAS.push(c(v, palo));
  }
}

/** Cartas de bolsillo de un Jugador empatado (trío de Ases AAA-K-Q). */
function bolsilloEmpatado(indice: number): [Carta, Carta] {
  const a = POOL_BAJAS[indice * 2]!;
  const b = POOL_BAJAS[indice * 2 + 1]!;
  return [a, b];
}

type NivelDisruptor = "FULL_HOUSE" | "POKER" | "ESCALERA";

/** Cartas de bolsillo de un Jugador NO empatado, estrictamente más fuerte que AAA-K-Q. */
function bolsilloDisruptor(nivel: NivelDisruptor): [Carta, Carta] {
  switch (nivel) {
    case "FULL_HOUSE":
      // Par de 10 en bolsillo → AAA + 10·10 = Full House.
      return [c(10, "TREBOLES"), c(10, "PICAS")];
    case "POKER":
      // Cuarto As → AAAA = Póker.
      return [c(14, "TREBOLES"), c(10, "CORAZONES")];
    case "ESCALERA":
      // J y 10 → A-K-Q-J-10 = Escalera (Broadway).
      return [c(11, "TREBOLES"), c(10, "DIAMANTES")];
  }
}

type PosicionDisruptor = "NINGUNO" | "PRIMERO" | "ULTIMO";

interface Escenario {
  /** Jugadores de la Partida (empatados + posible disruptor). */
  jugadores: Jugador[];
  /** Ids de los Jugadores que forman el Empate_Verdadero consecutivo. */
  empatadosIds: string[];
  /** Bloque consecutivo de estrellas rojas asignado a los empatados (orden base). */
  bloque: number[];
  /** Mapa base de estrellas rojas por id de Jugador. */
  mapaEstrellas: Record<string, number>;
}

/** Rango entero inclusivo [a, b]. */
function rango(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

/**
 * Construye un escenario con un bloque consecutivo de Empates_Verdaderos y,
 * opcionalmente, un Jugador no empatado (más fuerte) al inicio o al final del orden.
 *
 * - NINGUNO: los N Jugadores empatan (estrellas 1..N).
 * - ULTIMO: empatados en estrellas 1..N-1, disruptor (más fuerte) en estrella N.
 * - PRIMERO: disruptor (más fuerte) en estrella 1, empatados en estrellas 2..N.
 */
function construirEscenario(
  n: number,
  pos: PosicionDisruptor,
  nivel: NivelDisruptor,
): Escenario {
  const tamEmpate = pos === "NINGUNO" ? n : n - 1;

  let bloque: number[];
  let estrellaDisruptor: number | null = null;
  if (pos === "NINGUNO") {
    bloque = rango(1, n);
  } else if (pos === "ULTIMO") {
    bloque = rango(1, n - 1);
    estrellaDisruptor = n;
  } else {
    bloque = rango(2, n);
    estrellaDisruptor = 1;
  }

  const jugadores: Jugador[] = [];
  const empatadosIds: string[] = [];
  const mapaEstrellas: Record<string, number> = {};

  for (let i = 0; i < tamEmpate; i++) {
    const id = `E${i}`;
    jugadores.push({ id, nombre: id, bolsillo: bolsilloEmpatado(i) });
    empatadosIds.push(id);
    mapaEstrellas[id] = bloque[i]!;
  }

  if (estrellaDisruptor !== null) {
    const id = "D";
    jugadores.push({ id, nombre: id, bolsillo: bolsilloDisruptor(nivel) });
    mapaEstrellas[id] = estrellaDisruptor;
  }

  return { jugadores, empatadosIds, bloque, mapaEstrellas };
}

/** Construye el EstadoGolpe del Showdown a partir de un mapa de estrellas rojas. */
function construirGolpe(
  n: number,
  mapaEstrellas: Record<string, number>,
): EstadoGolpe {
  const porJugador: Record<string, Ficha[]> = {};
  for (const [id, estrellas] of Object.entries(mapaEstrellas)) {
    porJugador[id] = [{ color: "ROJO", estrellas }];
  }
  return {
    numero: 1,
    ronda: "SHOWDOWN",
    baraja: [],
    comunitarias: [...COMUNITARIAS],
    fichas: { numJugadores: n, centro: [], porJugador, colorActivo: "ROJO" },
    confirmados: [],
    reveladoShowdown: n,
  };
}

/**
 * Aplica una permutación a las estrellas rojas DENTRO del bloque empatado,
 * conservando intactas las estrellas de los Jugadores no empatados.
 */
function permutarEstrellasEmpatados(
  mapaEstrellas: Record<string, number>,
  empatadosIds: string[],
  bloque: number[],
  perm: number[],
): Record<string, number> {
  const nuevo = { ...mapaEstrellas };
  empatadosIds.forEach((id, i) => {
    nuevo[id] = bloque[perm[i]!]!;
  });
  return nuevo;
}

/** Arbitrario que produce una permutación de [0..k-1]. */
function permutacionDe(k: number): fc.Arbitrary<number[]> {
  return fc.array(fc.integer(), { minLength: k, maxLength: k }).map((pesos) =>
    pesos
      .map((w, i) => [w, i] as const)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([, i]) => i),
  );
}

/** Verifica (sanity) que todos los Jugadores empatados forman un Empate_Verdadero real. */
function verificarEmpateReal(escenario: Escenario): void {
  const manos = escenario.empatadosIds.map((id) => {
    const jugador = escenario.jugadores.find((j) => j.id === id)!;
    const res = evaluar(jugador.bolsillo, COMUNITARIAS);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("Evaluación inesperadamente fallida");
    return res.mano;
  });
  const referencia = manos[0]!;
  for (const mano of manos) {
    expect(comparar(referencia, mano)).toBe(0);
    expect(esEmpateVerdadero(referencia, mano)).toBe(true);
  }
}

// ===========================================================================
// Property 23 (PBT)
// ===========================================================================

describe("Showdown (PBT) - Property 23: los Empates Verdaderos consecutivos no causan fracaso", () => {
  it("permutar las Fichas rojas dentro del bloque empatado no cambia el éxito del Golpe", () => {
    const arbEscenario = fc
      .record({
        n: fc.integer({ min: 3, max: 6 }),
        pos: fc.constantFrom<PosicionDisruptor>("NINGUNO", "PRIMERO", "ULTIMO"),
        nivel: fc.constantFrom<NivelDisruptor>(
          "FULL_HOUSE",
          "POKER",
          "ESCALERA",
        ),
      })
      .chain(({ n, pos, nivel }) => {
        const tamEmpate = pos === "NINGUNO" ? n : n - 1;
        return fc.record({
          n: fc.constant(n),
          pos: fc.constant(pos),
          nivel: fc.constant(nivel),
          perm: permutacionDe(tamEmpate),
        });
      });

    verificarPropiedad(
      fc.property(arbEscenario, ({ n, pos, nivel, perm }) => {
        const escenario = construirEscenario(n, pos, nivel);

        // El bloque debe contener al menos dos Jugadores empatados ("dos o más").
        expect(escenario.empatadosIds.length).toBeGreaterThanOrEqual(2);

        // Sanity: los Jugadores del bloque forman un Empate_Verdadero real.
        verificarEmpateReal(escenario);

        // Resultado con la asignación base de Fichas rojas.
        const golpeBase = construirGolpe(n, escenario.mapaEstrellas);
        const resBase = resolverShowdown(escenario.jugadores, golpeBase);

        // Resultado tras permutar las Fichas rojas DENTRO del bloque empatado.
        const mapaPermutado = permutarEstrellasEmpatados(
          escenario.mapaEstrellas,
          escenario.empatadosIds,
          escenario.bloque,
          perm,
        );
        const golpePermutado = construirGolpe(n, mapaPermutado);
        const resPerm = resolverShowdown(escenario.jugadores, golpePermutado);

        // PROPIEDAD: el orden relativo de las Fichas rojas entre empatados no
        // afecta el resultado del Golpe.
        expect(resPerm.exito).toBe(resBase.exito);

        // El resultado depende únicamente de los Jugadores no empatados que rodean
        // al bloque: un disruptor más fuerte ANTES del bloque (PRIMERO) provoca
        // fracaso; en cualquier otro caso el Golpe es exitoso.
        const esperado = pos !== "PRIMERO";
        expect(resBase.exito).toBe(esperado);
        expect(resPerm.exito).toBe(esperado);
      }),
    );
  });
});

// ===========================================================================
// Casos deterministas construidos a mano
// ===========================================================================

describe("Showdown - Property 23: casos deterministas", () => {
  function exitoConPermutacion(
    n: number,
    pos: PosicionDisruptor,
    nivel: NivelDisruptor,
    perm: number[],
  ): { base: boolean; permutado: boolean } {
    const escenario = construirEscenario(n, pos, nivel);
    verificarEmpateReal(escenario);
    const base = resolverShowdown(
      escenario.jugadores,
      construirGolpe(n, escenario.mapaEstrellas),
    ).exito;
    const mapaPermutado = permutarEstrellasEmpatados(
      escenario.mapaEstrellas,
      escenario.empatadosIds,
      escenario.bloque,
      perm,
    );
    const permutado = resolverShowdown(
      escenario.jugadores,
      construirGolpe(n, mapaPermutado),
    ).exito;
    return { base, permutado };
  }

  it("N=4, todos empatados: el Golpe es exitoso y permutar las rojas no lo cambia", () => {
    // Bloque empatado {1,2,3,4}, permutación invertida.
    const { base, permutado } = exitoConPermutacion(
      4,
      "NINGUNO",
      "FULL_HOUSE",
      [3, 2, 1, 0],
    );
    expect(base).toBe(true);
    expect(permutado).toBe(true);
  });

  it("N=5, empatados seguidos de un Full House más fuerte: éxito invariante a la permutación", () => {
    // Empatados en estrellas 1..4, disruptor (Full House) en estrella 5.
    const { base, permutado } = exitoConPermutacion(
      5,
      "ULTIMO",
      "FULL_HOUSE",
      [3, 0, 2, 1],
    );
    expect(base).toBe(true);
    expect(permutado).toBe(true);
  });

  it("N=4, empatados seguidos de un Póker más fuerte: éxito invariante a la permutación", () => {
    const { base, permutado } = exitoConPermutacion(
      4,
      "ULTIMO",
      "POKER",
      [2, 1, 0],
    );
    expect(base).toBe(true);
    expect(permutado).toBe(true);
  });

  it("N=4, un Póker más fuerte ANTES del bloque empatado: fracaso invariante a la permutación", () => {
    // Disruptor (Póker) en estrella 1, empatados en estrellas 2..4.
    const { base, permutado } = exitoConPermutacion(
      4,
      "PRIMERO",
      "POKER",
      [2, 1, 0],
    );
    expect(base).toBe(false);
    expect(permutado).toBe(false);
  });

  it("N=6, una Escalera más fuerte ANTES del bloque empatado: fracaso invariante a la permutación", () => {
    const { base, permutado } = exitoConPermutacion(
      6,
      "PRIMERO",
      "ESCALERA",
      [4, 3, 2, 1, 0],
    );
    expect(base).toBe(false);
    expect(permutado).toBe(false);
  });
});
