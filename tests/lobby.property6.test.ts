// Prueba basada en propiedades (PBT) del Lobby de The Gang.
//
// Feature: the-gang-game, Property 6: Para cualquier Partida y cualquier nombre
// inválido (vacío, compuesto solo de espacios, de más de 20 caracteres,
// duplicado) o cualquier intento de registro cuando ya hay 6 Jugadores, el
// intento de registro es rechazado y la lista de Jugadores permanece exactamente
// igual.
//
// Validates: Requirements 2.2, 2.3

import { describe, expect, it } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { registrarJugador, NOMBRE_LONGITUD_MAX } from '../src/dominio/lobby';
import { MAX_JUGADORES, type Jugador } from '../src/dominio/modelos';

// ===========================================================================
// Generadores
// ===========================================================================

/** Nombre válido: 1..20 caracteres, no vacío tras recortar espacios. */
function genNombreValido(): fc.Arbitrary<string> {
  return fc
    .string({ minLength: 1, maxLength: NOMBRE_LONGITUD_MAX })
    .filter((s) => s.trim().length > 0 && s.length <= NOMBRE_LONGITUD_MAX);
}

/**
 * Lista de Jugadores con nombres únicos. Se generan nombres válidos distintos
 * y se les asignan ids únicos por índice.
 */
function genJugadores(
  longitudMin: number,
  longitudMax: number,
): fc.Arbitrary<Jugador[]> {
  return fc
    .uniqueArray(genNombreValido(), {
      minLength: longitudMin,
      maxLength: longitudMax,
    })
    .map((nombres) =>
      nombres.map(
        (nombre, i): Jugador => ({ id: `jugador-${i}`, nombre, bolsillo: null }),
      ),
    );
}

/** Nombre inválido por estar vacío o compuesto solo de espacios. */
const genNombreVacioOEspacios: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 12 })
    .map((chars) => chars.join('')),
);

/** Nombre inválido por exceder los 20 caracteres. */
const genNombreLargo: fc.Arbitrary<string> = fc.string({
  minLength: NOMBRE_LONGITUD_MAX + 1,
  maxLength: 60,
});

/**
 * Construye un nombre inválido para una lista dada. Incluye el caso duplicado
 * (igual al de un Jugador existente) cuando la lista no está vacía.
 */
function genNombreInvalidoPara(
  jugadores: readonly Jugador[],
): fc.Arbitrary<string> {
  const opciones: fc.Arbitrary<string>[] = [
    genNombreVacioOEspacios,
    genNombreLargo,
  ];
  if (jugadores.length > 0) {
    opciones.push(fc.constantFrom(...jugadores.map((j) => j.nombre)));
  }
  return fc.oneof(...opciones);
}

type CasoRechazo = {
  jugadores: Jugador[];
  nombre: string;
  codigoEsperado: 'NOMBRE_INVALIDO' | 'PARTIDA_COMPLETA';
};

/**
 * Caso 1: Partida no llena (0..5 Jugadores) con un nombre inválido.
 * Se espera el rechazo con código NOMBRE_INVALIDO (criterio 2.2).
 */
const genCasoNombreInvalido: fc.Arbitrary<CasoRechazo> = genJugadores(
  0,
  MAX_JUGADORES - 1,
).chain((jugadores) =>
  genNombreInvalidoPara(jugadores).map((nombre) => ({
    jugadores,
    nombre,
    codigoEsperado: 'NOMBRE_INVALIDO' as const,
  })),
);

/**
 * Caso 2: Partida ya completa (6 Jugadores) con un nombre válido.
 * Se espera el rechazo con código PARTIDA_COMPLETA (criterio 2.3).
 */
const genCasoPartidaCompleta: fc.Arbitrary<CasoRechazo> = genJugadores(
  MAX_JUGADORES,
  MAX_JUGADORES,
).chain((jugadores) =>
  genNombreValido()
    .filter((nombre) => !jugadores.some((j) => j.nombre === nombre))
    .map((nombre) => ({
      jugadores,
      nombre,
      codigoEsperado: 'PARTIDA_COMPLETA' as const,
    })),
);

const genCasoRechazo: fc.Arbitrary<CasoRechazo> = fc.oneof(
  genCasoNombreInvalido,
  genCasoPartidaCompleta,
);

// ===========================================================================
// Property 6
// ===========================================================================

describe('Lobby - Property 6: rechazo de registro inválido conserva la lista', () => {
  it('rechaza el registro y deja la lista de Jugadores exactamente igual', () => {
    verificarPropiedad(
      fc.property(genCasoRechazo, ({ jugadores, nombre, codigoEsperado }) => {
        // Instantánea profunda de la lista original para detectar mutaciones.
        const original = JSON.parse(JSON.stringify(jugadores)) as Jugador[];

        const resultado = registrarJugador(jugadores, nombre, 'nuevo-id');

        // El registro es rechazado con el ErrorJuego apropiado.
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) {
          expect(resultado.error.codigo).toBe(codigoEsperado);
        }

        // La lista de Jugadores permanece exactamente igual (sin mutación).
        expect(jugadores).toEqual(original);
        expect(jugadores).toHaveLength(original.length);
      }),
    );
  });
});
