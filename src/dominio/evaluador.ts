// Evaluador_Manos: lógica pura que evalúa la mejor mano de 5 cartas entre las 7
// disponibles (2 de bolsillo + 5 comunitarias) y la clasifica en una de las diez
// categorías del Ranking_de_Manos según el orden propio de The Gang.
//
// Orden de The Gang (de menor a mayor): Carta Alta < Par < Dos Pares < Trío <
// Escalera < Full House < Póker < Color < Escalera de Color < Escalera Real.
//
// El As se trata como valor alto (14) salvo en la escalera A-2-3-4-5 (la "rueda"),
// donde cuenta como 1 a efectos de desempate.
//
// _Requirements: 7.1, 7.2, 7.5_

import {
  CategoriaMano,
  type Carta,
  type ManoEvaluada,
  type ResultadoEvaluacion,
} from './modelos';

// ===========================================================================
// Comparación del vector de desempate
// ===========================================================================

/**
 * Compara dos vectores de desempate (`ranks`) de forma lexicográfica.
 *
 * El primer elemento de cada vector es la categoría (0..9) y los siguientes son
 * los valores de las cartas que la forman seguidos de los kickers en orden
 * descendente. Devuelve un número negativo si `a` es más débil que `b`, positivo
 * si es más fuerte, y 0 si son exactamente iguales.
 */
export function compararRanks(a: readonly number[], b: readonly number[]): number {
  const longitud = Math.max(a.length, b.length);
  for (let i = 0; i < longitud; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
}

// ===========================================================================
// Detección de patrones sobre 5 cartas
// ===========================================================================

/** Indica si las 5 cartas son del mismo palo (Color). */
function esColor(cartas: readonly Carta[]): boolean {
  const palo = cartas[0]?.palo;
  return palo !== undefined && cartas.every((c) => c.palo === palo);
}

/**
 * Detecta una escalera entre 5 cartas. Devuelve la carta más alta de la
 * escalera, tratando la rueda A-2-3-4-5 como una escalera de carta alta 5
 * (el As cuenta como 1 únicamente en ese caso).
 */
function detectarEscalera(valores: readonly number[]): {
  esEscalera: boolean;
  cartaAlta: number;
} {
  const unicos = [...new Set(valores)].sort((x, y) => x - y);
  if (unicos.length !== 5) {
    return { esEscalera: false, cartaAlta: 0 };
  }
  const [u0, u1, u2, u3, u4] = unicos as [number, number, number, number, number];
  // Escalera normal: cinco valores consecutivos.
  if (u4 - u0 === 4) {
    return { esEscalera: true, cartaAlta: u4 };
  }
  // Rueda A-2-3-4-5: el As (14) cuenta como 1, la carta alta es el 5.
  if (u0 === 2 && u1 === 3 && u2 === 4 && u3 === 5 && u4 === 14) {
    return { esEscalera: true, cartaAlta: 5 };
  }
  return { esEscalera: false, cartaAlta: 0 };
}

/**
 * Agrupa los valores de las cartas y devuelve los valores distintos ordenados
 * primero por frecuencia (descendente) y luego por valor (descendente).
 *
 * Este orden produce directamente el vector de desempate de las categorías que
 * no son escaleras: el trío/póker antes que los kicker, el par alto antes que el
 * par bajo, etc.
 */
function valoresPorFrecuencia(valores: readonly number[]): number[] {
  const conteo = new Map<number, number>();
  for (const v of valores) {
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([valor]) => valor);
}

/** Devuelve las frecuencias de los valores, ordenadas de mayor a menor. */
function frecuenciasOrdenadas(valores: readonly number[]): number[] {
  const conteo = new Map<number, number>();
  for (const v of valores) {
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  return [...conteo.values()].sort((a, b) => b - a);
}

// ===========================================================================
// Ordenamiento de las cartas de la mano
// ===========================================================================

/**
 * Ordena las 5 cartas de una mano que NO es escalera, según la prioridad de
 * desempate: primero las cartas más frecuentes y, a igual frecuencia, las de
 * mayor valor.
 */
function ordenarPorFrecuencia(cartas: readonly Carta[]): Carta[] {
  const conteo = new Map<number, number>();
  for (const c of cartas) {
    conteo.set(c.valor, (conteo.get(c.valor) ?? 0) + 1);
  }
  return [...cartas].sort((a, b) => {
    const fa = conteo.get(a.valor) ?? 0;
    const fb = conteo.get(b.valor) ?? 0;
    return fb - fa || b.valor - a.valor;
  });
}

/**
 * Ordena las 5 cartas de una escalera de mayor a menor. En la rueda
 * A-2-3-4-5 el As se considera la carta más baja, quedando el orden 5-4-3-2-A.
 */
function ordenarEscalera(cartas: readonly Carta[], esRueda: boolean): Carta[] {
  const efectivo = (c: Carta): number => (esRueda && c.valor === 14 ? 1 : c.valor);
  return [...cartas].sort((a, b) => efectivo(b) - efectivo(a));
}

// ===========================================================================
// Clasificación de una combinación de 5 cartas
// ===========================================================================

/**
 * Clasifica una combinación exacta de 5 cartas en una categoría del
 * Ranking_de_Manos de The Gang y construye su `ManoEvaluada` (categoría, cartas
 * ordenadas y vector de desempate `ranks`).
 */
export function clasificarCinco(cartas: readonly Carta[]): ManoEvaluada {
  const valores = cartas.map((c) => c.valor);
  const color = esColor(cartas);
  const { esEscalera, cartaAlta } = detectarEscalera(valores);
  const frecuencias = frecuenciasOrdenadas(valores);

  let categoria: CategoriaMano;
  let desempate: number[];
  let cartasOrdenadas: Carta[];

  if (esEscalera && color) {
    // Escalera Real si la carta alta es el As (10-J-Q-K-A); si no, Escalera de Color.
    categoria = cartaAlta === 14 ? CategoriaMano.ESCALERA_REAL : CategoriaMano.ESCALERA_COLOR;
    desempate = [cartaAlta];
    cartasOrdenadas = ordenarEscalera(cartas, cartaAlta === 5);
  } else if (frecuencias[0] === 4) {
    categoria = CategoriaMano.POKER;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else if (frecuencias[0] === 3 && frecuencias[1] === 2) {
    categoria = CategoriaMano.FULL_HOUSE;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else if (color) {
    categoria = CategoriaMano.COLOR;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else if (esEscalera) {
    categoria = CategoriaMano.ESCALERA;
    desempate = [cartaAlta];
    cartasOrdenadas = ordenarEscalera(cartas, cartaAlta === 5);
  } else if (frecuencias[0] === 3) {
    categoria = CategoriaMano.TRIO;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else if (frecuencias[0] === 2 && frecuencias[1] === 2) {
    categoria = CategoriaMano.DOS_PARES;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else if (frecuencias[0] === 2) {
    categoria = CategoriaMano.PAR;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  } else {
    categoria = CategoriaMano.CARTA_ALTA;
    desempate = valoresPorFrecuencia(valores);
    cartasOrdenadas = ordenarPorFrecuencia(cartas);
  }

  return {
    categoria,
    cartasOrdenadas,
    ranks: [categoria, ...desempate],
  };
}

// ===========================================================================
// Generación de combinaciones y evaluación de las 7 cartas
// ===========================================================================

/** Genera todas las combinaciones de tamaño `k` de los elementos de `items`. */
function combinaciones<T>(items: readonly T[], k: number): T[][] {
  const resultado: T[][] = [];
  const actual: T[] = [];
  const recurrir = (inicio: number): void => {
    if (actual.length === k) {
      resultado.push([...actual]);
      return;
    }
    for (let i = inicio; i < items.length; i++) {
      actual.push(items[i] as T);
      recurrir(i + 1);
      actual.pop();
    }
  };
  recurrir(0);
  return resultado;
}

/** Verifica que un valor sea una Carta válida (valor 2..14 y palo presente). */
function esCartaValida(c: unknown): c is Carta {
  if (typeof c !== 'object' || c === null) {
    return false;
  }
  const carta = c as Partial<Carta>;
  return (
    typeof carta.valor === 'number' &&
    carta.valor >= 2 &&
    carta.valor <= 14 &&
    typeof carta.palo === 'string'
  );
}

/**
 * Evalúa la mejor mano de cinco cartas entre las dos Cartas de Bolsillo y las
 * cinco Cartas Comunitarias.
 *
 * Genera las C(7,5)=21 combinaciones posibles, clasifica cada una y selecciona
 * la de mayor fuerza según el vector de desempate. Devuelve
 * `{ ok: false, motivo: 'CARTAS_INSUFICIENTES' }` cuando no están disponibles
 * exactamente 2 cartas de bolsillo y 5 comunitarias válidas.
 *
 * _Requirements: 7.1, 7.2, 7.5_
 */
export function evaluar(
  bolsillo: readonly Carta[] | null | undefined,
  comunitarias: readonly Carta[] | null | undefined,
): ResultadoEvaluacion {
  // Verificación de cartas suficientes y válidas (criterio 7.5).
  if (
    !bolsillo ||
    !comunitarias ||
    bolsillo.length !== 2 ||
    comunitarias.length !== 5 ||
    !bolsillo.every(esCartaValida) ||
    !comunitarias.every(esCartaValida)
  ) {
    return { ok: false, motivo: 'CARTAS_INSUFICIENTES' };
  }

  const siete: Carta[] = [...bolsillo, ...comunitarias];

  let mejor: ManoEvaluada | null = null;
  for (const combo of combinaciones(siete, 5)) {
    const mano = clasificarCinco(combo);
    if (mejor === null || compararRanks(mano.ranks, mejor.ranks) > 0) {
      mejor = mano;
    }
  }

  // `mejor` nunca es null: siempre hay 21 combinaciones para 7 cartas.
  return { ok: true, mano: mejor as ManoEvaluada };
}

// ===========================================================================
// Comparación de manos evaluadas y detección de Empate_Verdadero
// ===========================================================================

/**
 * Compara dos manos ya evaluadas según el Ranking_de_Manos.
 *
 * Ordena primero por categoría y, dentro de la misma categoría, por los valores
 * de las cartas que la forman seguidos de los kickers en orden descendente. Toda
 * esta información ya está codificada en el vector de desempate `ranks` de cada
 * `ManoEvaluada`, por lo que la comparación se delega en `compararRanks`.
 *
 * La escalera A-2-3-4-5 (la "rueda") se trata como la escalera de menor valor:
 * `clasificarCinco` le asigna carta alta 5 (el As cuenta como 1 únicamente en
 * ese caso), de modo que su `ranks` queda por debajo del de cualquier otra
 * escalera.
 *
 * Devuelve un número negativo si `a` es más débil que `b`, positivo si es más
 * fuerte, y 0 cuando son exactamente iguales (Empate_Verdadero).
 *
 * _Requirements: 7.3_
 */
export function comparar(a: ManoEvaluada, b: ManoEvaluada): number {
  return compararRanks(a.ranks, b.ranks);
}

/**
 * Indica si dos manos evaluadas forman un Empate_Verdadero, es decir, si
 * coinciden exactamente en categoría y en los valores de las cartas que las
 * forman. Es consistente por construcción con `comparar`: un Empate_Verdadero
 * equivale a que la comparación sea de igualdad.
 *
 * _Requirements: 7.4_
 */
export function esEmpateVerdadero(a: ManoEvaluada, b: ManoEvaluada): boolean {
  return comparar(a, b) === 0;
}

// ===========================================================================
// Comparación "Sin Kickers" (desempate por cartas de bolsillo)
// ===========================================================================

/**
 * Compara dos manos evaluadas usando la regla "Sin Kickers".
 *
 * Cuando esta regla está activa y dos manos empatan en categoría Y en el valor
 * de la categoría (el primer diferenciador tras la categoría en ranks), en vez
 * de comparar los kickers de la mejor mano de 5, se comparan las cartas de
 * bolsillo de cada jugador en orden descendente de valor:
 *
 * 1. Se compara la categoría (ranks[0]). Si difieren, devuelve la diferencia.
 * 2. Se compara el valor de la categoría (ranks[1]). Si difieren, lo usa.
 * 3. Si empatan en ambos, se ordenan los bolsillos por valor descendente y se
 *    comparan: primero la carta más alta de cada bolsillo, luego la más baja.
 * 4. Si todo empata → 0 (Empate Verdadero).
 *
 * El palo NO cuenta para el desempate.
 *
 * @param a Mano evaluada del jugador A.
 * @param b Mano evaluada del jugador B.
 * @param bolsilloA Las dos cartas de bolsillo del jugador A.
 * @param bolsilloB Las dos cartas de bolsillo del jugador B.
 * @returns Negativo si A es más débil, positivo si A es más fuerte, 0 si empate.
 */
export function compararSinKickers(
  a: ManoEvaluada,
  b: ManoEvaluada,
  bolsilloA: [Carta, Carta],
  bolsilloB: [Carta, Carta],
): number {
  // 1. Comparar categoría.
  if (a.ranks[0] !== b.ranks[0]) {
    return a.ranks[0]! - b.ranks[0]!;
  }

  // 2. Comparar valor de la categoría (primer valor tras la categoría en ranks).
  const valorCatA = a.ranks[1] ?? 0;
  const valorCatB = b.ranks[1] ?? 0;
  if (valorCatA !== valorCatB) {
    return valorCatA - valorCatB;
  }

  // 3. Empatan en categoría y valor de categoría → comparar bolsillos.
  const [altaA, bajaA] = ordenarBolsillo(bolsilloA);
  const [altaB, bajaB] = ordenarBolsillo(bolsilloB);

  if (altaA !== altaB) {
    return altaA - altaB;
  }
  if (bajaA !== bajaB) {
    return bajaA - bajaB;
  }

  // 4. Empate Verdadero.
  return 0;
}

/**
 * Ordena un par de cartas de bolsillo por valor descendente y devuelve los
 * valores como tupla [alta, baja].
 */
function ordenarBolsillo(bolsillo: [Carta, Carta]): [number, number] {
  const v0 = bolsillo[0].valor;
  const v1 = bolsillo[1].valor;
  return v0 >= v1 ? [v0, v1] : [v1, v0];
}

/** Componente Evaluador_Manos expuesto como agrupación de funciones puras. */
export const EvaluadorManos = {
  evaluar,
  clasificarCinco,
  compararRanks,
  comparar,
  compararSinKickers,
  esEmpateVerdadero,
} as const;
