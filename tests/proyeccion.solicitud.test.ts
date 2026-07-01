import { describe, it, expect } from 'vitest';
import { iniciarPartida, aplicarAccion } from '../src/dominio/motorJuego';
import { solicitarCartasDe } from '../src/dominio/proyeccion';
import type { EstadoPartida, Jugador, Semilla } from '../src/dominio/modelos';

// Prueba por ejemplo de la privacidad de las Cartas de Bolsillo ante una
// solicitud explícita de cartas ajenas.
// _Requirements: 4.7, 10.4_
//
// Antes del Showdown, solicitar las Cartas de Bolsillo de OTRO Jugador debe
// rechazarse con `ACCION_NO_PERMITIDA` y SIN revelar valor alguno. El propio
// bolsillo siempre se puede consultar y, en el Showdown, se permite ver el de
// cualquiera.

const SEMILLA: Semilla = 'the-gang-solicitud';

/** Crea N Jugadores con bolsillo vacío (lo reparte iniciarPartida). */
function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `jugador-${i}`,
    nombre: `Ladron ${i}`,
    bolsillo: null,
  }));
}

/**
 * Lleva una Partida desde Pre-Flop hasta el Showdown haciendo que cada Jugador
 * tome su Ficha del color activo (estrellas 1..N) en cada Ronda y avanzando.
 */
function llevarAShowdown(estadoInicial: EstadoPartida): EstadoPartida {
  let estado = estadoInicial;
  // Pre-Flop → Flop → Turn → River → Showdown: cuatro avances.
  for (let paso = 0; paso < 4; paso++) {
    const colorActivo = estado.golpeActual!.fichas.colorActivo;
    estado.jugadores.forEach((jugador, indice) => {
      const resultado = aplicarAccion(estado, {
        tipo: 'TOMAR_FICHA',
        jugadorId: jugador.id,
        ficha: { color: colorActivo, estrellas: indice + 1 },
      });
      expect(resultado.ok).toBe(true);
      if (resultado.ok) estado = resultado.estado;
    });
    // Todos confirman para avanzar de ronda.
    for (const jugador of estado.jugadores) {
      const confirmacion = aplicarAccion(estado, { tipo: 'CONFIRMAR', jugadorId: jugador.id });
      expect(confirmacion.ok).toBe(true);
      if (confirmacion.ok) estado = confirmacion.estado;
    }
  }
  expect(estado.golpeActual!.ronda).toBe('SHOWDOWN');
  return estado;
}

/** Revela todas las manos del Showdown en curso. */
function revelarTodasLasManos(estadoInicial: EstadoPartida): EstadoPartida {
  let estado = estadoInicial;
  const n = estado.jugadores.length;
  while (estado.golpeActual !== null && estado.golpeActual.reveladoShowdown < n) {
    const resultado = aplicarAccion(estado, { tipo: 'REVELAR_SHOWDOWN' });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) break;
    estado = resultado.estado;
  }
  return estado;
}

describe('solicitarCartasDe: rechazo de solicitud de cartas ajenas sin revelar valor', () => {
  it('antes del Showdown (Pre-Flop), A solicita las cartas de B → rechazo ACCION_NO_PERMITIDA sin revelar valor', () => {
    const estado = iniciarPartida(crearJugadores(3), SEMILLA);
    expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');

    const a = estado.jugadores[0]!;
    const b = estado.jugadores[1]!;

    const resultado = solicitarCartasDe(estado, a.id, b.id);

    // Se rechaza con el código de acción no permitida.
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe('ACCION_NO_PERMITIDA');
    expect(typeof resultado.error.mensaje).toBe('string');
    expect(resultado.error.mensaje.length).toBeGreaterThan(0);

    // El objeto resultado NO contiene las cartas de B ni un campo `bolsillo`.
    expect('bolsillo' in resultado).toBe(false);

    // Ningún valor de las cartas de B se filtra en la respuesta serializada.
    const serializado = JSON.stringify(resultado);
    const cartasB = b.bolsillo!;
    for (const carta of cartasB) {
      expect(serializado).not.toContain(`"valor":${carta.valor}`);
      expect(serializado).not.toContain(carta.palo);
    }
  });

  it('A puede solicitar siempre su propio bolsillo → ok=true con sus cartas', () => {
    const estado = iniciarPartida(crearJugadores(3), SEMILLA);
    const a = estado.jugadores[0]!;

    const resultado = solicitarCartasDe(estado, a.id, a.id);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.bolsillo).toEqual(a.bolsillo);
  });

  it('en SHOWDOWN, A puede solicitar las cartas de B → ok=true con el bolsillo de B', () => {
    const estado = revelarTodasLasManos(
      llevarAShowdown(iniciarPartida(crearJugadores(3), SEMILLA)),
    );

    const a = estado.jugadores[0]!;
    const b = estado.jugadores[1]!;

    const resultado = solicitarCartasDe(estado, a.id, b.id);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.bolsillo).toEqual(b.bolsillo);
  });
});
