import { describe, expect, it } from 'vitest';

import { iniciarPartida } from '../src/dominio/motorJuego';
import {
  aplicarTerminacionPorDesconexionExpirada,
  cancelarTerminacionPorDesconexion,
  iniciarTerminacionPorDesconexion,
  volverAlLobby,
} from '../src/dominio/lobby';
import { TERMINACION_DESCONEXION_MS } from '../src/dominio/modelos';

function crearJugadores(cantidad: number) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    id: `j${indice + 1}`,
    nombre: `Ladrón ${indice + 1}`,
    bolsillo: null,
  }));
}

const AHORA_MS = 1_700_000_000_000;

describe('terminación por desconexión (dominio)', () => {
  it('inicia la cuenta atrás en EN_CURSO con nombre y plazo correctos', () => {
    const enCurso = iniciarPartida(crearJugadores(3), 42);
    const siguiente = iniciarTerminacionPorDesconexion(enCurso, 'j2', AHORA_MS);

    expect(siguiente.terminacionPorDesconexion).toEqual({
      jugadorId: 'j2',
      jugadorNombre: 'Ladrón 2',
      terminaEn: AHORA_MS + TERMINACION_DESCONEXION_MS,
    });
  });

  it('no inicia la cuenta atrás fuera de EN_CURSO', () => {
    const enCurso = iniciarPartida(crearJugadores(3), 42);
    const lobby = volverAlLobby(enCurso);
    const siguiente = iniciarTerminacionPorDesconexion(lobby, 'j1', AHORA_MS);

    expect(siguiente.terminacionPorDesconexion).toBeNull();
  });

  it('cancela la terminación pendiente', () => {
    const enCurso = iniciarTerminacionPorDesconexion(
      iniciarPartida(crearJugadores(3), 42),
      'j1',
      AHORA_MS,
    );
    const cancelado = cancelarTerminacionPorDesconexion(enCurso);

    expect(cancelado.terminacionPorDesconexion).toBeNull();
  });

  it('vuelve al lobby cuando expira la cuenta atrás', () => {
    const enCurso = iniciarTerminacionPorDesconexion(
      iniciarPartida(crearJugadores(3), 42),
      'j3',
      AHORA_MS,
    );
    const expirado = aplicarTerminacionPorDesconexionExpirada(
      enCurso,
      AHORA_MS + TERMINACION_DESCONEXION_MS,
    );

    expect(expirado.fase).toBe('LOBBY');
    expect(expirado.golpeActual).toBeNull();
    expect(expirado.terminacionPorDesconexion).toBeNull();
  });

  it('no cambia el estado si la cuenta atrás aún no expiró', () => {
    const enCurso = iniciarTerminacionPorDesconexion(
      iniciarPartida(crearJugadores(3), 42),
      'j2',
      AHORA_MS,
    );
    const sinCambios = aplicarTerminacionPorDesconexionExpirada(
      enCurso,
      AHORA_MS + TERMINACION_DESCONEXION_MS - 1,
    );

    expect(sinCambios).toBe(enCurso);
    expect(sinCambios.fase).toBe('EN_CURSO');
  });
});
