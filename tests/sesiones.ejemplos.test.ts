import { describe, it, expect } from 'vitest';
import { crearGestorSesiones } from '../src/servidor/sesiones';
import { iniciarPartida } from '../src/dominio/motorJuego';
import type { EstadoPartida, Jugador } from '../src/dominio/modelos';

// Pruebas por ejemplo del Gestor de Sesiones de The Gang (no PBT).
// _Requirements: 1.4, 1.5, 1.8_
//
// Cubren los criterios clasificados como EXAMPLE/EDGE_CASE en el prework:
// - Una sola Partida activa y rechazo de la segunda, conservando la existente
//   (criterios 1.4, 1.5).
// - hayPartidaActiva() refleja true con EN_CURSO y false sin Partida o con
//   FINALIZADA.
// - Rechazo de reincorporación a una Partida finalizada con PARTIDA_FINALIZADA
//   (criterio 1.8).

/** Construye una lista de N Jugadores con nombres temáticos únicos. */
function crearJugadores(n: number): Jugador[] {
  const alias = ['Lobo', 'Zorro', 'Tejón', 'Halcón', 'Pantera', 'Cuervo'];
  return Array.from({ length: n }, (_, i) => ({
    id: `j-${i}`,
    nombre: alias[i] ?? `Miembro ${i}`,
    bolsillo: null,
  }));
}

/** Crea un EstadoPartida EN_CURSO con N Jugadores y una semilla fija. */
function estadoEnCurso(n = 3, semilla = 'semilla-fija'): EstadoPartida {
  return iniciarPartida(crearJugadores(n), semilla);
}

/** Deriva un EstadoPartida FINALIZADA fijando la fase sobre un estado iniciado. */
function estadoFinalizado(n = 3): EstadoPartida {
  return { ...estadoEnCurso(n), fase: 'FINALIZADA', resultado: 'VICTORIA' };
}

describe('Sesiones: una sola Partida activa y rechazo de la segunda (criterios 1.4, 1.5)', () => {
  it('crearPartida con un estado EN_CURSO devuelve ok=true', () => {
    const gestor = crearGestorSesiones();
    const resultado = gestor.crearPartida(estadoEnCurso());

    expect(resultado.ok).toBe(true);
  });

  it('una segunda crearPartida mientras hay una activa es rechazada con PARTIDA_EN_CURSO', () => {
    const gestor = crearGestorSesiones();
    const primera = estadoEnCurso(3, 'primera');
    const segunda = estadoEnCurso(4, 'segunda');

    expect(gestor.crearPartida(primera).ok).toBe(true);

    const rechazo = gestor.crearPartida(segunda);
    expect(rechazo.ok).toBe(false);
    if (!rechazo.ok) {
      expect(rechazo.error.codigo).toBe('PARTIDA_EN_CURSO');
    }
  });

  it('tras rechazar la segunda, obtenerPartida sigue siendo la primera (conservada)', () => {
    const gestor = crearGestorSesiones();
    const primera = estadoEnCurso(3, 'primera');
    const segunda = estadoEnCurso(4, 'segunda');

    gestor.crearPartida(primera);
    gestor.crearPartida(segunda);

    // La Partida activa existente se conserva intacta (criterio 1.5).
    expect(gestor.obtenerPartida()).toBe(primera);
    expect(gestor.obtenerPartida()).not.toBe(segunda);
  });
});

describe('Sesiones: hayPartidaActiva() refleja el estado de la Partida', () => {
  it('es false cuando no hay Partida registrada', () => {
    const gestor = crearGestorSesiones();
    expect(gestor.hayPartidaActiva()).toBe(false);
  });

  it('es true con una Partida EN_CURSO', () => {
    const gestor = crearGestorSesiones();
    gestor.crearPartida(estadoEnCurso());
    expect(gestor.hayPartidaActiva()).toBe(true);
  });

  it('es false con una Partida FINALIZADA', () => {
    const gestor = crearGestorSesiones();
    gestor.crearPartida(estadoEnCurso());
    gestor.actualizarPartida(estadoFinalizado());
    expect(gestor.hayPartidaActiva()).toBe(false);
  });
});

describe('Sesiones: rechazo de reincorporación a Partida finalizada (criterio 1.8)', () => {
  it('conectar a una Partida FINALIZADA es rechazado con PARTIDA_FINALIZADA', () => {
    const gestor = crearGestorSesiones();
    gestor.crearPartida(estadoEnCurso());
    gestor.actualizarPartida(estadoFinalizado());

    const resultado = gestor.conectar('Lobo', 'conexion-1');
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe('PARTIDA_FINALIZADA');
    }
  });

  it('una Partida que finaliza tras conectar también rechaza la reincorporación', () => {
    const gestor = crearGestorSesiones();
    gestor.crearPartida(estadoEnCurso());

    // Conexión válida mientras la Partida sigue activa.
    expect(gestor.conectar('Lobo', 'conexion-1').ok).toBe(true);

    // La Partida finaliza; un intento de reincorporación posterior se rechaza.
    gestor.actualizarPartida(estadoFinalizado());
    const reincorporacion = gestor.conectar('Lobo', 'conexion-2');
    expect(reincorporacion.ok).toBe(false);
    if (!reincorporacion.ok) {
      expect(reincorporacion.error.codigo).toBe('PARTIDA_FINALIZADA');
    }
  });
});
