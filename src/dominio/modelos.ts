// Modelos de datos del dominio de The Gang (lógica pura, sin I/O).
//
// Estos tipos modelan las Cartas, las Fichas, el estado de la Partida y los
// resultados/errores de las acciones. Se alinean con las secciones "Data Models"
// y "Components and Interfaces" del documento de diseño.
// _Requirements: 4.1, 7.2_

// ===========================================================================
// Cartas y baraja
// ===========================================================================

/** Los cuatro palos de la baraja francesa. */
export type Palo = 'PICAS' | 'CORAZONES' | 'DIAMANTES' | 'TREBOLES';

/**
 * Carta de la baraja.
 *
 * El valor va de 2 a 14 (11 = J, 12 = Q, 13 = K, 14 = A). El As se modela
 * siempre como 14; únicamente en la escalera A-2-3-4-5 (la "rueda") cuenta como
 * 1 a efectos de desempate, lo que resuelve el Evaluador_Manos.
 */
export interface Carta {
  /** Valor de la carta, en el rango 2..14. */
  valor: number;
  /** Palo de la carta. */
  palo: Palo;
}

/** Valor mínimo de una carta (el 2). */
export const VALOR_MINIMO = 2;
/** Valor máximo de una carta (el As). */
export const VALOR_MAXIMO = 14;

/** Lista canónica de los cuatro palos. */
export const PALOS: readonly Palo[] = ['PICAS', 'CORAZONES', 'DIAMANTES', 'TREBOLES'];

// ===========================================================================
// Fichas
// ===========================================================================

/** Color de una Ficha; cada color corresponde a una Ronda del Golpe. */
export type ColorFicha = 'BLANCO' | 'AMARILLO' | 'NARANJA' | 'ROJO';

/** Lista canónica de los colores de Ficha, en orden de Ronda. */
export const COLORES_FICHA: readonly ColorFicha[] = [
  'BLANCO',
  'AMARILLO',
  'NARANJA',
  'ROJO',
];

/**
 * Ficha del juego. Cada Ficha tiene un color (la Ronda a la que pertenece) y un
 * número de estrellas en el rango 1..N, donde N es el número de Jugadores.
 */
export interface Ficha {
  /** Color de la Ficha, corresponde a la Ronda activa. */
  color: ColorFicha;
  /** Número de estrellas, en el rango 1..N. */
  estrellas: number;
}

// ===========================================================================
// Categoría de mano (Ranking_de_Manos de The Gang)
// ===========================================================================

/**
 * Ranking de manos de The Gang, de menor (0) a mayor (9).
 *
 * Nota importante: en The Gang el orden sitúa Full House < Póker < Color, lo
 * que difiere del póker tradicional (donde Color < Full House < Póker). El enum
 * respeta ese orden propio del juego (criterio 7.2 y glosario).
 */
export enum CategoriaMano {
  CARTA_ALTA = 0,
  PAR = 1,
  DOS_PARES = 2,
  TRIO = 3,
  ESCALERA = 4,
  FULL_HOUSE = 5, // Full House
  POKER = 6, // Four of a Kind
  COLOR = 7, // Flush
  ESCALERA_COLOR = 8,
  ESCALERA_REAL = 9,
}

// ===========================================================================
// Estado de fichas
// ===========================================================================

/** Estado de las Fichas de la Partida durante un Golpe. */
export interface EstadoFichas {
  /** Número de Jugadores N, entre 3 y 6. */
  numJugadores: number;
  /** Fichas disponibles en el centro de la mesa. */
  centro: Ficha[];
  /** Fichas en posesión de cada Jugador, indexadas por id de Jugador. */
  porJugador: Record<string, Ficha[]>;
  /** Color de la Ronda activa; solo ese color está disponible para tomar. */
  colorActivo: ColorFicha;
}

// ===========================================================================
// Estado de partida
// ===========================================================================

/** Fase de la Partida. */
export type FasePartida = 'LOBBY' | 'EN_CURSO' | 'FINALIZADA';

/** Rondas de un Golpe, en orden. */
export type Ronda = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

/**
 * Semilla para el barajado determinista y reproducible en pruebas.
 * Admite número o cadena para sembrar el PRNG.
 */
export type Semilla = number | string;

/** Resultado final de la Partida. */
export type ResultadoPartida = 'VICTORIA' | 'DERROTA';

/** Resumen de un Golpe ya resuelto (historial). */
export interface EntradaHistorialGolpe {
  /** Número del Golpe (1..5). */
  numero: number;
  /** True si el Golpe abrió una bóveda; false si activó una alarma. */
  exito: boolean;
  /** Bóvedas doradas acumuladas tras resolver este Golpe. */
  bovedasTras: number;
  /** Alarmas rojas acumuladas tras resolver este Golpe. */
  alarmasTras: number;
}

/** Resultado del último Golpe resuelto, visible hasta el siguiente movimiento de fichas. */
export interface ResultadoGolpeReciente {
  numero: number;
  exito: boolean;
}

/** Snapshot del Showdown recién resuelto (cartas reveladas + resultado). */
export interface SnapshotShowdownResuelto {
  numero: number;
  exito: boolean;
  comunitarias: Carta[];
  bolsillosRevelados: Record<string, [Carta, Carta]>;
  fichas: EstadoFichas;
}

/** Duración del temporizador de avance automático de ronda (ms). */
export const TEMPORIZADOR_RONDA_MS = 10_000;

// ===========================================================================
// Ajustes de la Partida
// ===========================================================================

/**
 * Ajustes configurables del modo de juego. El Anfitrión puede modificarlos
 * desde el Lobby antes de dar el Golpe.
 */
export interface AjustesPartida {
  /**
   * Cuando es true, el desempate entre manos de igual categoría y valor de
   * categoría se resuelve comparando las cartas de bolsillo en orden descendente
   * en vez de los kickers de la mejor mano de 5.
   */
  sinKickers: boolean;
}

/** Ajustes por defecto: comportamiento clásico (con kickers). */
export const AJUSTES_POR_DEFECTO: AjustesPartida = { sinKickers: false };

/** Número mínimo de Jugadores admitido por las reglas del Modo Básico. */
export const MIN_JUGADORES = 3;
/** Número máximo de Jugadores admitido por las reglas del Modo Básico. */
export const MAX_JUGADORES = 6;

/** Un Jugador de la Partida. */
export interface Jugador {
  /** Identificador único del Jugador. */
  id: string;
  /** Nombre registrado, entre 1 y 20 caracteres, único en la Partida. */
  nombre: string;
  /** Leyenda opcional del alias (tooltip en la UI). */
  descripcion?: string;
  /** Cartas de Bolsillo del Jugador, o null mientras no se reparten. */
  bolsillo: [Carta, Carta] | null;
}

/** Estado de un Golpe (una mano completa de cuatro Rondas). */
export interface EstadoGolpe {
  /** Número de Golpe, en el rango 1..5. */
  numero: number;
  /** Ronda activa del Golpe. */
  ronda: Ronda;
  /** Cartas restantes en el mazo tras barajar y repartir. */
  baraja: Carta[];
  /** Cartas Comunitarias reveladas (0..5). */
  comunitarias: Carta[];
  /** Estado de las Fichas del Golpe. */
  fichas: EstadoFichas;
  /** Ids de los jugadores que han confirmado su ficha en la ronda actual. Arranca vacío en cada ronda. */
  confirmados: string[];
}

/** Estado autoritativo completo de la Partida. */
/** Observador de la Partida que no participa en el juego. */
export interface Espectador {
  /** Identificador único del espectador (sessionId del servidor). */
  id: string;
  /** Nombre registrado del espectador. */
  nombre: string;
  /** Leyenda opcional del alias (tooltip en la UI). */
  descripcion?: string;
}

export interface EstadoPartida {
  /** Fase actual de la Partida. */
  fase: FasePartida;
  /** Jugadores de la Partida (3..6). */
  jugadores: Jugador[];
  /** Observadores conectados que no juegan (opcional; por defecto ninguno). */
  espectadores?: Espectador[];
  /** Golpe en curso, o null en LOBBY/FINALIZADA. */
  golpeActual: EstadoGolpe | null;
  /** Número de Golpes ya jugados (0..5). */
  golpesJugados: number;
  /** Bóvedas doradas acumuladas (0..3). */
  bovedasDoradas: number;
  /** Alarmas rojas acumuladas (0..3). */
  alarmasRojas: number;
  /** Resultado final de la Partida, o null si no ha finalizado. */
  resultado: ResultadoPartida | null;
  /** Semilla para el barajado determinista. */
  semilla: Semilla;
  /** Ajustes del modo de juego (opciones configuradas en el Lobby). */
  ajustes?: AjustesPartida;
  /** Golpes ya resueltos con su resultado (historial). */
  historialGolpes?: EntradaHistorialGolpe[];
  /** Resultado del último Golpe resuelto (banner en la UI). */
  ultimoResultadoGolpe?: ResultadoGolpeReciente | null;
  /** Showdown recién resuelto, visible hasta el siguiente movimiento de fichas. */
  ultimoShowdownResuelto?: SnapshotShowdownResuelto | null;
}

// ===========================================================================
// Mano evaluada y showdown
// ===========================================================================

/** Una mano de 5 cartas ya evaluada y clasificada. */
export interface ManoEvaluada {
  /** Categoría del Ranking_de_Manos (enum 0..9). */
  categoria: CategoriaMano;
  /** Las 5 cartas que forman la mano, ordenadas para comparación. */
  cartasOrdenadas: Carta[];
  /** Vector de desempate descendente (categoría + kickers). */
  ranks: number[];
}

/** Posición de un Jugador en el orden del Showdown. */
export interface PosicionShowdown {
  /** Identificador del Jugador. */
  jugadorId: string;
  /** Valor de estrellas de la Ficha roja (1..N), orden ascendente. */
  estrellasRojas: number;
  /** Mano evaluada del Jugador. */
  mano: ManoEvaluada;
}

/** Resultado de la resolución del Showdown. */
export interface ResultadoShowdown {
  /** Posiciones ordenadas ascendentemente por valor de Ficha roja. */
  orden: PosicionShowdown[];
  /** True si el Golpe fue exitoso (fuerza no decreciente en el orden). */
  exito: boolean;
  /** Detalle de la primera violación de orden si hubo fracaso, o null. */
  violacion: { anterior: string; posterior: string } | null;
}

// ===========================================================================
// Resultados y errores
// ===========================================================================

/** Códigos de error de juego (acciones inválidas). */
export type CodigoError =
  | 'NOMBRE_INVALIDO' // 2.2
  | 'PARTIDA_COMPLETA' // 2.3
  | 'JUGADORES_INSUFICIENTES' // 2.4
  | 'JUGADOR_DESCONECTADO' // lobby: inicio con miembros offline
  | 'PARTIDA_EN_CURSO' // 1.5
  | 'PARTIDA_FINALIZADA' // 1.8
  | 'FICHA_NO_DISPONIBLE' // 5.5, 6.5
  | 'FICHA_COLOR_DUPLICADO' // 6.2
  | 'FICHA_FUERA_DE_RANGO' // 5.5
  | 'ACCION_NO_PERMITIDA' // 4.7, 10.4 (solicitar cartas ajenas)
  | 'CARTAS_INSUFICIENTES'; // 7.5

/** Error de juego devuelto por la lógica pura ante una acción inválida. */
export interface ErrorJuego {
  /** Código del error. */
  codigo: CodigoError;
  /** Texto en español, temático, sin revelar datos privados. */
  mensaje: string;
}

/** Evento de juego emitido al aplicar una acción válida. */
export type EventoJuego =
  | { tipo: 'PARTIDA_INICIADA' }
  | { tipo: 'GOLPE_INICIADO'; numero: number }
  | { tipo: 'RONDA_AVANZADA'; ronda: Ronda }
  | { tipo: 'FICHA_TOMADA'; jugadorId: string; ficha: Ficha }
  | { tipo: 'FICHA_INTERCAMBIADA'; jugadorId: string }
  | { tipo: 'SHOWDOWN_RESUELTO'; exito: boolean }
  | { tipo: 'PARTIDA_FINALIZADA'; resultado: ResultadoPartida };

/** Resultado de aplicar una acción al estado de la Partida. */
export type ResultadoAccion =
  | { ok: true; estado: EstadoPartida; eventos: EventoJuego[] }
  | { ok: false; error: ErrorJuego };

/** Resultado de una operación sobre el estado de Fichas. */
export type ResultadoFichas =
  | { ok: true; estado: EstadoFichas }
  | { ok: false; error: ErrorJuego };

/** Resultado de la evaluación de una mano. */
export type ResultadoEvaluacion =
  | { ok: true; mano: ManoEvaluada }
  | { ok: false; motivo: 'CARTAS_INSUFICIENTES' };
