import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import {
  prepararFichas,
  tomar,
  intercambiarConCentro,
  intercambiarConJugador,
} from '../src/dominio/gestorFichas';
import {
  COLORES_FICHA,
  type ColorFicha,
  type EstadoFichas,
  type ResultadoFichas,
} from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 5.5, 6.2, 6.5_
//
// Feature: the-gang-game, Property 12: Para cualquier estado de Fichas y
// cualquier acción inválida (tomar una Ficha de estrellas superior a N, tomar
// una Ficha de color no activo, tomar una Ficha de un color del que ya se posee
// otra, o intercambiar con una Ficha que no está disponible o que el otro
// Jugador ya no posee), la acción es rechazada y el estado de Fichas permanece
// exactamente igual.

/** Categorías de acción inválida cubiertas por la propiedad. */
type CategoriaInvalida =
  | 'TOMAR_ESTRELLAS_SUPERIOR_A_N'
  | 'TOMAR_ESTRELLAS_MENOR_A_1'
  | 'TOMAR_COLOR_NO_ACTIVO'
  | 'TOMAR_COLOR_DUPLICADO'
  | 'INTERCAMBIO_CENTRO_NO_DISPONIBLE'
  | 'INTERCAMBIO_JUGADOR_NO_POSEE';

const CATEGORIAS: CategoriaInvalida[] = [
  'TOMAR_ESTRELLAS_SUPERIOR_A_N',
  'TOMAR_ESTRELLAS_MENOR_A_1',
  'TOMAR_COLOR_NO_ACTIVO',
  'TOMAR_COLOR_DUPLICADO',
  'INTERCAMBIO_CENTRO_NO_DISPONIBLE',
  'INTERCAMBIO_JUGADOR_NO_POSEE',
];

/**
 * Construye un estado de Fichas alcanzable para N Jugadores con el color activo
 * indicado: los Jugadores j0..j(k-1) toman, cada uno, la Ficha del color activo
 * con estrellas 1..k respectivamente (todas tomas válidas). Con k >= 1 se
 * garantiza que el Jugador `j0` posee la Ficha (color activo, 1 estrella).
 */
function construirEstado(
  numJugadores: number,
  colorActivo: ColorFicha,
  k: number,
): EstadoFichas {
  let estado: EstadoFichas = { ...prepararFichas(numJugadores), colorActivo };
  for (let estrellas = 1; estrellas <= k; estrellas++) {
    const resultado = tomar(estado, `j${estrellas - 1}`, {
      color: colorActivo,
      estrellas,
    });
    // Por construcción todas estas tomas son válidas; reforzamos la suposición.
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      estado = resultado.estado;
    }
  }
  return estado;
}

/**
 * Aplica una acción que, por construcción, es siempre inválida sobre el estado
 * dado y devuelve el resultado del Gestor_Fichas.
 */
function aplicarAccionInvalida(
  estado: EstadoFichas,
  categoria: CategoriaInvalida,
  numJugadores: number,
  colorActivo: ColorFicha,
  k: number,
): ResultadoFichas {
  const colorNoActivo = COLORES_FICHA.find((c) => c !== colorActivo)!;
  switch (categoria) {
    case 'TOMAR_ESTRELLAS_SUPERIOR_A_N':
      // Estrellas por encima de N: fuera del botín de la operación.
      return tomar(estado, 'jX', {
        color: colorActivo,
        estrellas: numJugadores + 1,
      });
    case 'TOMAR_ESTRELLAS_MENOR_A_1':
      // Estrellas inferiores a 1: valor inexistente.
      return tomar(estado, 'jX', { color: colorActivo, estrellas: 0 });
    case 'TOMAR_COLOR_NO_ACTIVO':
      // Color que no corresponde a la Ronda activa.
      return tomar(estado, 'jX', { color: colorNoActivo, estrellas: 1 });
    case 'TOMAR_COLOR_DUPLICADO': {
      // j0 ya posee la Ficha del color activo (1 estrella); intenta tomar otra
      // del mismo color. El valor está en rango 1..N para activar la regla de
      // color duplicado (no la de rango).
      const estrellas = k < numJugadores ? k + 1 : 2;
      return tomar(estado, 'j0', { color: colorActivo, estrellas });
    }
    case 'INTERCAMBIO_CENTRO_NO_DISPONIBLE':
      // j0 posee Ficha del color activo, pero la Ficha (color activo, 1) ya no
      // está en el centro: la tomó él mismo, por lo que no está disponible.
      return intercambiarConCentro(estado, 'j0', {
        color: colorActivo,
        estrellas: 1,
      });
    case 'INTERCAMBIO_JUGADOR_NO_POSEE':
      // El otro Jugador (fantasma) no posee ninguna Ficha del color.
      return intercambiarConJugador(
        estado,
        'j0',
        'jugador_fantasma',
        colorActivo,
      );
  }
}

describe('Property 12: Acciones de Fichas inválidas conservan el estado', () => {
  it('toda acción inválida es rechazada (ok=false) y el estado de Fichas permanece exactamente igual', () => {
    const genParams = fc.integer({ min: 3, max: 6 }).chain((numJugadores) =>
      fc.record({
        numJugadores: fc.constant(numJugadores),
        // k >= 1 garantiza que j0 posee la Ficha del color activo, lo que
        // habilita los casos de color duplicado e intercambio.
        k: fc.integer({ min: 1, max: numJugadores }),
        colorActivo: fc.constantFrom<ColorFicha>(...COLORES_FICHA),
        categoria: fc.constantFrom<CategoriaInvalida>(...CATEGORIAS),
      }),
    );

    verificarPropiedad(
      fc.property(genParams, (p) => {
        const estado = construirEstado(p.numJugadores, p.colorActivo, p.k);
        // Instantánea profunda del estado antes de la acción inválida.
        const instantanea = structuredClone(estado);

        const resultado = aplicarAccionInvalida(
          estado,
          p.categoria,
          p.numJugadores,
          p.colorActivo,
          p.k,
        );

        // La acción es rechazada.
        expect(resultado.ok).toBe(false);
        // El estado de Fichas permanece exactamente igual (función pura: no
        // muta la entrada ni produce un nuevo estado al fallar).
        expect(estado).toEqual(instantanea);
      }),
    );
  });
});
