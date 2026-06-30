import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { crearGestorSesiones } from '../src/servidor/sesiones';
import { iniciarPartida } from '../src/dominio/motorJuego';
import type { Jugador, Semilla } from '../src/dominio/modelos';

// Prueba basada en propiedades de la reconexión de Jugadores (Gestor de Sesiones).
// _Requirements: 1.6, 1.7_
//
// Feature: the-gang-game, Property 4: Para cualquier Partida activa y cualquier
// Jugador, desconectar a ese Jugador y volver a conectarlo con su nombre
// registrado restaura un estado equivalente para ese Jugador (sus mismas Cartas
// de Bolsillo, sus mismas Fichas, y la misma Ronda y Golpe en curso) sin alterar
// el estado autoritativo de la Partida.

/**
 * Genera un nombre de Jugador válido (1..20 chars, no solo espacios). Se usa
 * con uniqueArray para garantizar nombres únicos dentro de la Partida.
 */
const nombreJugador: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

/** Semilla determinista para el barajado reproducible. */
const semillaArb: fc.Arbitrary<Semilla> = fc.oneof(
  fc.integer({ min: 0, max: 1_000_000 }),
  fc.string({ minLength: 1, maxLength: 12 }),
);

/**
 * Captura el estado autoritativo relevante de un Jugador: sus Cartas de Bolsillo,
 * sus Fichas, y la Ronda y el Golpe en curso. Se serializa para obtener una
 * instantánea inmune a mutaciones de referencia.
 */
function instantaneaJugador(estado: ReturnType<typeof iniciarPartida>, id: string) {
  const jugador = estado.jugadores.find((j) => j.id === id);
  const golpe = estado.golpeActual;
  return JSON.stringify({
    bolsillo: jugador?.bolsillo ?? null,
    fichas: golpe?.fichas.porJugador[id] ?? [],
    ronda: golpe?.ronda ?? null,
    numeroGolpe: golpe?.numero ?? null,
  });
}

describe('Property 4: Reconexión preserva y restaura el estado del Jugador (round trip)', () => {
  it('desconectar y reconectar por nombre restaura un estado equivalente sin alterar el estado autoritativo', () => {
    verificarPropiedad(
      fc.property(
        // Entre 3 y 6 nombres únicos de Jugador.
        fc.uniqueArray(nombreJugador, { minLength: 3, maxLength: 6 }),
        semillaArb,
        // Índice del Jugador a desconectar/reconectar (se acota al rango real).
        fc.nat(),
        (nombres, semilla, indiceCrudo) => {
          // Construye los Jugadores de la Partida con ids estables.
          const jugadores: Jugador[] = nombres.map((nombre, i) => ({
            id: `jugador-${i}`,
            nombre,
            bolsillo: null,
          }));

          // Inicia la Partida → fase EN_CURSO con Golpe 1 en PRE_FLOP.
          const estado = iniciarPartida(jugadores, semilla);
          expect(estado.fase).toBe('EN_CURSO');

          // Registra la Partida única en el Gestor de Sesiones. El generador de
          // sessionId es determinista por llamada para hacer la prueba estable.
          let contador = 0;
          const gestor = crearGestorSesiones(() => `sid-${contador++}`);
          const creada = gestor.crearPartida(estado);
          expect(creada.ok).toBe(true);

          // Conecta a cada Jugador por su nombre, capturando su sessionId.
          const sessionIdPorNombre = new Map<string, string>();
          nombres.forEach((nombre, i) => {
            const res = gestor.conectar(nombre, `conexion-${i}`);
            expect(res.ok).toBe(true);
            if (res.ok) {
              expect(res.esReconexion).toBe(false);
              sessionIdPorNombre.set(nombre, res.sesion.sessionId);
            }
          });

          // Selecciona un Jugador arbitrario (dentro del rango real).
          const indice = indiceCrudo % nombres.length;
          const nombreObjetivo = nombres[indice]!;
          const idObjetivo = jugadores[indice]!.id;
          const conexionOriginal = `conexion-${indice}`;
          const sessionIdOriginal = sessionIdPorNombre.get(nombreObjetivo)!;

          // Instantánea del estado autoritativo del Jugador y de la Partida
          // ANTES de desconectar.
          const snapshotJugadorAntes = instantaneaJugador(estado, idObjetivo);
          const snapshotPartidaAntes = JSON.stringify(gestor.obtenerPartida());

          // Desconecta al Jugador objetivo.
          const desconectada = gestor.desconectar(conexionOriginal);
          expect(desconectada).not.toBeNull();
          // La sesión se conserva pero queda marcada como desconectada
          // (criterio 1.6): conectado = false y sin conexión asociada.
          expect(desconectada!.sessionId).toBe(sessionIdOriginal);
          expect(desconectada!.conectado).toBe(false);
          expect(desconectada!.conexionId).toBeNull();

          // La Partida sigue activa y su estado autoritativo no cambió.
          expect(gestor.hayPartidaActiva()).toBe(true);
          expect(JSON.stringify(gestor.obtenerPartida())).toBe(snapshotPartidaAntes);

          // Reconecta al mismo Jugador por su nombre con una NUEVA conexión.
          const reconexion = gestor.conectar(nombreObjetivo, `conexion-nueva-${indice}`);
          expect(reconexion.ok).toBe(true);
          if (!reconexion.ok) return;

          // Es una reconexión que recupera el MISMO sessionId (criterio 1.7).
          expect(reconexion.esReconexion).toBe(true);
          expect(reconexion.sesion.sessionId).toBe(sessionIdOriginal);
          expect(reconexion.sesion.nombre).toBe(nombreObjetivo);
          expect(reconexion.sesion.conectado).toBe(true);

          // El estado autoritativo de la Partida NO cambió tras la reconexión.
          expect(JSON.stringify(gestor.obtenerPartida())).toBe(snapshotPartidaAntes);

          // El estado del Jugador (bolsillo, fichas, ronda y golpe) restaurado es
          // idéntico al capturado antes de la desconexión (round trip).
          const partidaDespues = gestor.obtenerPartida()!;
          const snapshotJugadorDespues = instantaneaJugador(partidaDespues, idObjetivo);
          expect(snapshotJugadorDespues).toBe(snapshotJugadorAntes);
        },
      ),
    );
  });
});
