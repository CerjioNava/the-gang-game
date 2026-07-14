// Motor_Juego: lógica pura que controla el flujo de la Partida, los Golpes y
// las Rondas, y aplica las reglas de avance del Modo Básico de The Gang.
//
// Esta primera entrega (tarea 9.1) implementa el inicio de la Partida y la
// secuencia de Rondas (Pre-Flop → Flop → Turn → River → Showdown). El avance a
// la siguiente Ronda (o al Showdown desde River) solo se habilita cuando todos
// los Jugadores poseen una Ficha del color de la Ronda activa. La toma e
// intercambio de Fichas se delegan en el Gestor_Fichas.
//
// El encadenamiento de Golpes (tarea 9.2), la resolución del Showdown y el
// conteo de Bóvedas/Alarmas (tarea 10) quedan fuera de este archivo; la
// estructura se deja preparada pero esas reglas no se implementan aquí.
//
// Todas las funciones son puras: nunca mutan el estado recibido, devuelven una
// nueva instancia de estado.
//
// _Requirements: 3.1, 3.2, 3.3, 3.4, 6.8_

import {
  MAX_JUGADORES,
  MIN_JUGADORES,
  AJUSTES_POR_DEFECTO,
  type AjustesPartida,
  type Carta,
  type ColorFicha,
  type EstadoGolpe,
  type EstadoPartida,
  type EventoJuego,
  type Ficha,
  type Jugador,
  type ResultadoAccion,
  type ResultadoPartida,
  type Ronda,
  type Semilla,
} from "./modelos";
import {
  crearBarajaBarajada,
  repartirBolsillos,
  revelarComunitariasPorRonda,
} from "./reparto";
import { resolverShowdown, ordenJugadoresShowdown } from "./showdown";
import {
  intercambiarConCentro,
  intercambiarConJugador,
  prepararFichas,
  todosTienenFichaDelColor,
  tomar,
} from "./gestorFichas";

// ===========================================================================
// Mapeo Ronda → color de Ficha
// ===========================================================================

/**
 * Color de Ficha asociado a cada Ronda con toma de Fichas.
 *
 * Pre-Flop usa Fichas blancas, Flop amarillas, Turn naranjas y River rojas
 * (ver Glosario y Requirement 5). El Showdown no tiene un color de toma propio,
 * por lo que se mapea al rojo del River, que es el que gobierna su orden.
 */
export function colorDeRonda(ronda: Ronda): ColorFicha {
  switch (ronda) {
    case "PRE_FLOP":
      return "BLANCO";
    case "FLOP":
      return "AMARILLO";
    case "TURN":
      return "NARANJA";
    case "RIVER":
    case "SHOWDOWN":
      return "ROJO";
  }
}

/** Ronda que sigue a la indicada en el orden de un Golpe, o null si es Showdown. */
function siguienteRonda(ronda: Ronda): Ronda | null {
  switch (ronda) {
    case "PRE_FLOP":
      return "FLOP";
    case "FLOP":
      return "TURN";
    case "TURN":
      return "RIVER";
    case "RIVER":
      return "SHOWDOWN";
    case "SHOWDOWN":
      return null;
  }
}

// ===========================================================================
// Acciones del Motor_Juego
// ===========================================================================

/**
 * Acción que un Jugador (o el flujo del juego) puede aplicar sobre el estado de
 * la Partida. Unión discriminada por el campo `tipo`; se deja extensible para
 * sumar acciones futuras sin romper a los consumidores.
 *
 * - `CONFIRMAR`: un jugador confirma su ficha de la ronda actual. Cuando TODOS
 *   los jugadores han confirmado, la ronda avanza automáticamente.
 * - `RESOLVER_SHOWDOWN`: resuelve el Showdown del Golpe (solo aplicable cuando
 *   la Ronda activa es SHOWDOWN), actualiza Bóvedas/Alarmas y encadena o finaliza
 *   la Partida.
 * - `TOMAR_FICHA` / `INTERCAMBIAR_CENTRO` / `INTERCAMBIAR_JUGADOR`: delegan en
 *   el Gestor_Fichas la toma e intercambio de Fichas del color activo.
 */
export type Accion =
  | { tipo: "CONFIRMAR"; jugadorId: string }
  | { tipo: "AVANZAR_AUTOMATICO" }
  | { tipo: "REVELAR_SHOWDOWN" }
  | { tipo: "RESOLVER_SHOWDOWN" }
  | { tipo: "TOMAR_FICHA"; jugadorId: string; ficha: Ficha }
  | { tipo: "INTERCAMBIAR_CENTRO"; jugadorId: string; fichaCentro: Ficha }
  | { tipo: "INTERCAMBIAR_JUGADOR"; jugadorA: string; jugadorB: string };

// ===========================================================================
// Inicio de la Partida
// ===========================================================================

/**
 * Inicia una Partida con los Jugadores dados y una semilla de barajado.
 *
 * Valida que haya entre {@link MIN_JUGADORES} y {@link MAX_JUGADORES} Jugadores
 * (criterio 3.1). Crea la baraja barajada de forma determinista, reparte 2
 * Cartas de Bolsillo a cada Jugador (asignándolas a su campo `bolsillo`) y
 * prepara las Fichas con el color activo BLANCO (Pre-Flop). Devuelve el
 * `EstadoPartida` en fase EN_CURSO con el Golpe número 1 en la Ronda Pre-Flop.
 *
 * Función pura: no muta la lista de Jugadores de entrada.
 *
 * @param jugadores Jugadores registrados (entre 3 y 6).
 * @param semilla Semilla para el barajado determinista y reproducible.
 * @param ajustes Ajustes opcionales del modo de juego (por defecto sinKickers=true).
 * @returns Estado inicial de la Partida en curso.
 * @throws {RangeError} Si el número de Jugadores está fuera del rango 3..6.
 * _Requirements: 3.1, 3.2, 4.1_
 */
export function iniciarPartida(
  jugadores: readonly Jugador[],
  semilla: Semilla,
  ajustes?: AjustesPartida,
): EstadoPartida {
  const numJugadores = jugadores.length;
  if (numJugadores < MIN_JUGADORES || numJugadores > MAX_JUGADORES) {
    throw new RangeError(
      `Se requieren entre ${MIN_JUGADORES} y ${MAX_JUGADORES} Jugadores para iniciar, se recibieron: ${numJugadores}`,
    );
  }

  const baraja = crearBarajaBarajada(semilla);
  const { bolsillos, resto } = repartirBolsillos(baraja, numJugadores);

  const jugadoresConBolsillo: Jugador[] = jugadores.map((jugador, indice) => ({
    ...jugador,
    bolsillo: bolsillos[indice]!,
  }));

  const golpeActual: EstadoGolpe = {
    numero: 1,
    ronda: "PRE_FLOP",
    baraja: resto,
    comunitarias: [],
    fichas: prepararFichas(numJugadores),
    confirmados: [],
    reveladoShowdown: 0,
  };

  return {
    fase: "EN_CURSO",
    jugadores: jugadoresConBolsillo,
    golpeActual,
    golpesJugados: 0,
    bovedasDoradas: 0,
    alarmasRojas: 0,
    resultado: null,
    semilla,
    ajustes: ajustes ?? AJUSTES_POR_DEFECTO,
    historialGolpes: [],
    historialShowdowns: [],
    ultimoResultadoGolpe: null,
    ultimoShowdownResuelto: null,
    historialChat: [],
  };
}

// ===========================================================================
// Aplicación de acciones
// ===========================================================================

/** Construye un resultado de acción fallido con el código y mensaje dados. */
function errorAccion(
  codigo: "PARTIDA_FINALIZADA" | "ACCION_NO_PERMITIDA",
  mensaje: string,
): ResultadoAccion {
  return { ok: false, error: { codigo, mensaje } };
}

/**
 * Aplica una acción al estado de la Partida y devuelve el nuevo estado junto a
 * los eventos generados, o un error de juego si la acción es inválida.
 *
 * Acciones soportadas:
 * - `AVANZAR`: habilita el paso a la siguiente Ronda (o al Showdown desde
 *   River) solo si todos los Jugadores poseen una Ficha del color activo
 *   (criterios 3.3, 3.4, 6.8). Al entrar en Flop/Turn/River revela las Cartas
 *   Comunitarias correspondientes y cambia el color activo de las Fichas.
 * - `TOMAR_FICHA`, `INTERCAMBIAR_CENTRO`, `INTERCAMBIAR_JUGADOR`: delegan en el
 *   Gestor_Fichas; el estado de Fichas resultante se incorpora al Golpe.
 *
 * Función pura: no muta `estado`.
 *
 * @param estado Estado actual de la Partida.
 * @param accion Acción a aplicar.
 * @returns Resultado con el nuevo estado y eventos, o un error de juego.
 * _Requirements: 3.2, 3.3, 3.4, 6.8_
 */
export function aplicarAccion(
  estado: EstadoPartida,
  accion: Accion,
): ResultadoAccion {
  if (estado.fase === "FINALIZADA") {
    return errorAccion(
      "PARTIDA_FINALIZADA",
      "La Partida ya ha terminado; no se admiten más acciones.",
    );
  }
  if (estado.fase !== "EN_CURSO" || estado.golpeActual === null) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "No hay un Golpe en curso sobre el que actuar.",
    );
  }

  const golpe = estado.golpeActual;
  switch (accion.tipo) {
    case "CONFIRMAR":
      return confirmar(estado, golpe, accion.jugadorId);
    case "AVANZAR_AUTOMATICO":
      return avanzarAutomatico(estado, golpe);
    case "REVELAR_SHOWDOWN":
      return revelarShowdown(estado, golpe);
    case "RESOLVER_SHOWDOWN":
      return resolver(estado, golpe);
    case "TOMAR_FICHA":
      return aplicarFichasConCancelacion(
        estado,
        golpe,
        tomar(golpe.fichas, accion.jugadorId, accion.ficha),
        [
          {
            tipo: "FICHA_TOMADA",
            jugadorId: accion.jugadorId,
            ficha: accion.ficha,
          },
        ],
        [accion.jugadorId],
      );
    case "INTERCAMBIAR_CENTRO":
      return aplicarFichasConCancelacion(
        estado,
        golpe,
        intercambiarConCentro(
          golpe.fichas,
          accion.jugadorId,
          accion.fichaCentro,
        ),
        [{ tipo: "FICHA_INTERCAMBIADA", jugadorId: accion.jugadorId }],
        [accion.jugadorId],
      );
    case "INTERCAMBIAR_JUGADOR":
      return aplicarFichasConCancelacion(
        estado,
        golpe,
        intercambiarConJugador(
          golpe.fichas,
          accion.jugadorA,
          accion.jugadorB,
          golpe.fichas.colorActivo,
        ),
        [{ tipo: "FICHA_INTERCAMBIADA", jugadorId: accion.jugadorA }],
        [accion.jugadorA, accion.jugadorB],
      );
  }
}

/**
 * Incorpora al Golpe en curso el resultado de una operación del Gestor_Fichas.
 * Si la operación fue rechazada, propaga el error sin modificar el estado; si
 * tuvo éxito, devuelve el nuevo estado con las Fichas actualizadas, cancela las
 * confirmaciones de los jugadores indicados y emite los eventos.
 */
function aplicarFichasConCancelacion(
  estado: EstadoPartida,
  golpe: EstadoGolpe,
  resultado: ReturnType<typeof tomar>,
  eventos: EventoJuego[],
  jugadoresACancelar: string[],
): ResultadoAccion {
  if (!resultado.ok) {
    return { ok: false, error: resultado.error };
  }
  const confirmados = golpe.confirmados.filter(
    (id) => !jugadoresACancelar.includes(id),
  );
  const nuevoGolpe: EstadoGolpe = {
    ...golpe,
    fichas: resultado.estado,
    confirmados,
  };
  return {
    ok: true,
    estado: {
      ...estado,
      golpeActual: nuevoGolpe,
      ultimoResultadoGolpe: null,
      ultimoShowdownResuelto: null,
    },
    eventos,
  };
}

/**
 * Un jugador confirma su ficha de la ronda actual.
 *
 * Verifica que el jugador tiene una ficha del color activo y que no ha confirmado
 * ya (idempotente: si ya confirmó no hace nada extra). Cuando TODOS los jugadores
 * han confirmado, ejecuta la lógica de avance de ronda automáticamente.
 */
function confirmar(
  estado: EstadoPartida,
  golpe: EstadoGolpe,
  jugadorId: string,
): ResultadoAccion {
  const colorActivo = colorDeRonda(golpe.ronda);
  const fichasJugador = golpe.fichas.porJugador[jugadorId] ?? [];
  const tieneFichaActiva = fichasJugador.some((f) => f.color === colorActivo);

  if (!tieneFichaActiva) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "No tienes una ficha del color de esta fase; no puedes confirmar.",
    );
  }

  // Idempotente: si ya confirmó, no hacer nada extra.
  if (golpe.confirmados.includes(jugadorId)) {
    return {
      ok: true,
      estado,
      eventos: [],
    };
  }

  const confirmados = [...golpe.confirmados, jugadorId];
  const todosConfirmados = estado.jugadores.every((j) =>
    confirmados.includes(j.id),
  );

  if (!todosConfirmados) {
    // Aún faltan jugadores por confirmar: solo actualizar el set de confirmados.
    const nuevoGolpe: EstadoGolpe = { ...golpe, confirmados };
    return {
      ok: true,
      estado: { ...estado, golpeActual: nuevoGolpe },
      eventos: [],
    };
  }

  // Todos confirmaron → avanzar de ronda automáticamente.
  const golpeConConfirmados: EstadoGolpe = { ...golpe, confirmados };
  return avanzar(estado, golpeConConfirmados);
}

/**
 * Avance automático de ronda cuando expira el temporizador: exige que todos
 * tengan ficha del color activo y avanza sin confirmaciones manuales.
 */
function avanzarAutomatico(
  estado: EstadoPartida,
  golpe: EstadoGolpe,
): ResultadoAccion {
  if (golpe.ronda === "SHOWDOWN") {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "En el Showdown no hay rondas que avanzar automáticamente.",
    );
  }

  const confirmados = estado.jugadores.map((j) => j.id);
  return avanzar(estado, { ...golpe, confirmados });
}

/**
 * Avanza el Golpe a la siguiente Ronda, o inicia el Showdown desde River.
 *
 * Solo se habilita si todos los Jugadores poseen una Ficha del color de la
 * Ronda activa (criterios 3.3, 3.4, 6.8). Al entrar en Flop/Turn/River revela
 * las Cartas Comunitarias correspondientes y cambia el color activo de las
 * Fichas al de la nueva Ronda. Resetea las confirmaciones al empezar la nueva ronda.
 */
function avanzar(estado: EstadoPartida, golpe: EstadoGolpe): ResultadoAccion {
  const colorActivo = colorDeRonda(golpe.ronda);
  const jugadorIds = estado.jugadores.map((j) => j.id);

  if (!todosTienenFichaDelColor(golpe.fichas, colorActivo, jugadorIds)) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "Aún no todos los miembros han tomado su ficha de esta fase.",
    );
  }

  const proxima = siguienteRonda(golpe.ronda);
  if (proxima === null) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "El Golpe ya está en su Showdown; no hay más Rondas que avanzar.",
    );
  }

  if (proxima === "SHOWDOWN") {
    const nuevoGolpe: EstadoGolpe = {
      ...golpe,
      ronda: "SHOWDOWN",
      confirmados: [],
      reveladoShowdown: 0,
    };
    return {
      ok: true,
      estado: { ...estado, golpeActual: nuevoGolpe },
      eventos: [{ tipo: "RONDA_AVANZADA", ronda: "SHOWDOWN" }],
    };
  }

  // Entrada a Flop/Turn/River: revelar Comunitarias y cambiar color activo.
  const revelado = revelarComunitariasPorRonda(
    proxima,
    golpe.comunitarias,
    golpe.baraja,
  );
  const nuevoColor = colorDeRonda(proxima);
  const nuevoGolpe: EstadoGolpe = {
    ...golpe,
    ronda: proxima,
    comunitarias: revelado.comunitarias,
    baraja: revelado.resto,
    fichas: { ...golpe.fichas, colorActivo: nuevoColor },
    confirmados: [],
    reveladoShowdown: 0,
  };

  return {
    ok: true,
    estado: { ...estado, golpeActual: nuevoGolpe },
    eventos: [{ tipo: "RONDA_AVANZADA", ronda: proxima }],
  };
}

/**
 * Revela la siguiente mano del Showdown en orden ascendente de Ficha roja.
 */
function revelarShowdown(
  estado: EstadoPartida,
  golpe: EstadoGolpe,
): ResultadoAccion {
  if (golpe.ronda !== "SHOWDOWN") {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "Solo se pueden revelar manos durante el Showdown.",
    );
  }

  const total = estado.jugadores.length;
  if (golpe.reveladoShowdown >= total) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "Todas las manos ya fueron reveladas.",
    );
  }

  const orden = ordenJugadoresShowdown(estado.jugadores, golpe.fichas);
  const jugadorId = orden[golpe.reveladoShowdown]!;
  const nuevoGolpe: EstadoGolpe = {
    ...golpe,
    reveladoShowdown: golpe.reveladoShowdown + 1,
  };

  return {
    ok: true,
    estado: { ...estado, golpeActual: nuevoGolpe },
    eventos: [{ tipo: "SHOWDOWN_REVELADO", jugadorId }],
  };
}

// ===========================================================================
// Resolución del Showdown y condiciones de fin de Partida (tarea 10.2)
// ===========================================================================

/**
 * Resuelve el Showdown del Golpe en curso, actualiza el marcador de
 * Bóvedas/Alarmas y encadena el siguiente Golpe o finaliza la Partida.
 *
 * Solo es aplicable cuando la Ronda activa es SHOWDOWN; en otra Ronda devuelve
 * un error de juego sin modificar el estado.
 *
 * Flujo:
 * - Invoca {@link resolverShowdown} para determinar si el Golpe fue exitoso.
 * - Si fue exitoso incrementa `bovedasDoradas` en exactamente uno; si fracasó
 *   incrementa `alarmasRojas` en exactamente uno. La otra cuenta no cambia
 *   (criterios 8.6, 8.7).
 * - Evalúa las condiciones de fin: tres Bóvedas doradas fija el `resultado` en
 *   VICTORIA (criterio 9.1) y tres Alarmas rojas lo fija en DERROTA
 *   (criterio 9.2).
 * - Delega en {@link iniciarSiguienteGolpe} el encadenamiento del siguiente
 *   Golpe o la finalización de la Partida. Esa función incrementa
 *   `golpesJugados` exactamente una vez (contabilizando el Golpe recién
 *   resuelto) y, si procede, también finaliza tras el quinto Golpe; por eso el
 *   conteo no se duplica aquí. El `resultado` fijado en este paso se conserva.
 * - Emite el evento SHOWDOWN_RESUELTO y, cuando la Partida queda finalizada con
 *   un resultado de victoria o derrota, también PARTIDA_FINALIZADA.
 *
 * Función pura: no muta `estado` ni `golpe`.
 *
 * _Requirements: 8.6, 8.7, 9.1, 9.2, 9.4, 12.5_
 */
function resolver(estado: EstadoPartida, golpe: EstadoGolpe): ResultadoAccion {
  if (golpe.ronda !== "SHOWDOWN") {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "El Golpe aún no ha llegado a su Showdown; no puede resolverse.",
    );
  }

  const total = estado.jugadores.length;
  if (golpe.reveladoShowdown < total) {
    return errorAccion(
      "ACCION_NO_PERMITIDA",
      "Aún faltan manos por revelar antes de resolver el Showdown.",
    );
  }

  const showdown = resolverShowdown(estado.jugadores, golpe, estado.ajustes);

  // Modo Básico (criterio 12.5): éxito → +1 Bóveda; fracaso → +1 Alarma. La otra
  // cuenta permanece sin cambios (criterios 8.6, 8.7).
  const bovedasDoradas = estado.bovedasDoradas + (showdown.exito ? 1 : 0);
  const alarmasRojas = estado.alarmasRojas + (showdown.exito ? 0 : 1);

  // Condiciones de fin por contadores (criterios 9.1, 9.2). El resultado se fija
  // aquí y lo conserva iniciarSiguienteGolpe.
  let resultado: ResultadoPartida | null = estado.resultado;
  if (bovedasDoradas >= 3) {
    resultado = "VICTORIA";
  } else if (alarmasRojas >= 3) {
    resultado = "DERROTA";
  }

  const bolsillosRevelados: Record<string, [Carta, Carta]> = {};
  for (const jugador of estado.jugadores) {
    if (jugador.bolsillo !== null) {
      bolsillosRevelados[jugador.id] = jugador.bolsillo;
    }
  }

  const ultimoShowdownResuelto = {
    numero: golpe.numero,
    exito: showdown.exito,
    comunitarias: [...golpe.comunitarias],
    bolsillosRevelados,
    fichas: golpe.fichas,
  };

  const estadoTrasConteo: EstadoPartida = {
    ...estado,
    bovedasDoradas,
    alarmasRojas,
    resultado,
    historialGolpes: [
      ...(estado.historialGolpes ?? []),
      {
        numero: golpe.numero,
        exito: showdown.exito,
        bovedasTras: bovedasDoradas,
        alarmasTras: alarmasRojas,
      },
    ],
    historialShowdowns: [
      ...(estado.historialShowdowns ?? []),
      ultimoShowdownResuelto,
    ],
    ultimoResultadoGolpe: { numero: golpe.numero, exito: showdown.exito },
    ultimoShowdownResuelto,
  };

  // Encadena el siguiente Golpe o finaliza la Partida. iniciarSiguienteGolpe
  // incrementa golpesJugados una sola vez y finaliza por contadores o tras el
  // quinto Golpe; no se duplica el conteo.
  const siguiente = iniciarSiguienteGolpe(estadoTrasConteo);

  const eventos: EventoJuego[] = [
    { tipo: "SHOWDOWN_RESUELTO", exito: showdown.exito },
  ];
  if (siguiente.fase === "FINALIZADA" && siguiente.resultado !== null) {
    eventos.push({
      tipo: "PARTIDA_FINALIZADA",
      resultado: siguiente.resultado,
    });
  }

  return { ok: true, estado: siguiente, eventos };
}

// ===========================================================================
// Encadenamiento de Golpes (tarea 9.2)
// ===========================================================================

/**
 * Número máximo de Golpes que admite una Partida del Modo Básico (criterio 3.6).
 */
export const MAX_GOLPES = 5;

/**
 * Inicia el siguiente Golpe tras la resolución del Golpe en curso, o finaliza la
 * Partida si ya no procede iniciar más Golpes.
 *
 * Esta función está pensada para invocarse después de resolver el Showdown (la
 * resolución y el conteo de Bóvedas/Alarmas se realizan en la tarea 10.2). Aquí
 * solo se decide el encadenamiento frente a la finalización:
 *
 * - Contabiliza el Golpe recién resuelto incrementando `golpesJugados`.
 * - Si no se cumple ninguna condición de fin de Partida (menos de 3 Bóvedas
 *   doradas y menos de 3 Alarmas rojas) y se han jugado menos de cinco Golpes,
 *   inicia el siguiente Golpe en la Ronda Pre-Flop con el número incrementado en
 *   uno (criterio 3.5). La baraja se baraja de forma determinista a partir de
 *   una semilla derivada por Golpe (`${semilla}#golpe${n}`), se reparten 2
 *   Cartas de Bolsillo nuevas a cada Jugador y se preparan las Fichas con el
 *   color activo BLANCO.
 * - Si ya se han jugado cinco Golpes (criterio 3.6) sin que se cumpla una
 *   condición de fin, finaliza la Partida sin iniciar Golpes adicionales
 *   (criterio 3.7).
 * - Si se cumple una condición de fin por contadores (3 Bóvedas o 3 Alarmas),
 *   tampoco inicia un nuevo Golpe y deja la Partida finalizada; el `resultado`
 *   concreto (VICTORIA/DERROTA) lo establece la tarea 10.2 y aquí se conserva
 *   sin modificarlo.
 *
 * Función pura: no muta `estado` ni la lista de Jugadores; devuelve una nueva
 * instancia de `EstadoPartida`.
 *
 * @param estado Estado de la Partida tras resolver el Golpe en curso.
 * @returns Nuevo estado con el siguiente Golpe iniciado, o la Partida finalizada.
 * _Requirements: 3.5, 3.6, 3.7_
 */
export function iniciarSiguienteGolpe(estado: EstadoPartida): EstadoPartida {
  // Contabiliza el Golpe que se acaba de resolver.
  const golpesJugados = estado.golpesJugados + 1;

  const finPorContadores =
    estado.bovedasDoradas >= 3 || estado.alarmasRojas >= 3;
  const alcanzadoMaximo = golpesJugados >= MAX_GOLPES;

  // No procede iniciar un nuevo Golpe: la Partida finaliza. El `resultado` se
  // conserva tal cual (lo fija la tarea 10.2 según las condiciones de fin).
  if (finPorContadores || alcanzadoMaximo) {
    return {
      ...estado,
      fase: "FINALIZADA",
      golpeActual: null,
      golpesJugados,
    };
  }

  // Encadena el siguiente Golpe en Pre-Flop con número incrementado.
  const numero = golpesJugados + 1;
  const numJugadores = estado.jugadores.length;

  const baraja = crearBarajaBarajada(`${estado.semilla}#golpe${numero}`);
  const { bolsillos, resto } = repartirBolsillos(baraja, numJugadores);

  const jugadores: Jugador[] = estado.jugadores.map((jugador, indice) => ({
    ...jugador,
    bolsillo: bolsillos[indice]!,
  }));

  const golpeActual: EstadoGolpe = {
    numero,
    ronda: "PRE_FLOP",
    baraja: resto,
    comunitarias: [],
    fichas: prepararFichas(numJugadores),
    confirmados: [],
    reveladoShowdown: 0,
  };

  return {
    ...estado,
    fase: "EN_CURSO",
    jugadores,
    golpeActual,
    golpesJugados,
  };
}
