// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  cargarCredencial,
  claveStorageParaPruebas,
  limpiarCredencial,
  mensajeUnirseDesdeCredencial,
  persistirDesdeVista,
} from '../src/cliente/persistenciaSesion';
import { mensajes } from '../src/cliente/protocolo';
import { PERSPECTIVA_INVITADO } from '../src/dominio/proyeccion';
import type { VistaPartida } from '../src/cliente/protocolo';
import { BOLSILLO_OCULTO } from '../src/dominio/proyeccion';

function vistaJugadorRegistrado(): VistaPartida {
  return {
    fase: 'EN_CURSO',
    perspectivaJugadorId: 'j1',
    jugadores: [{ id: 'j1', nombre: 'El Cerebro', bolsillo: BOLSILLO_OCULTO, conectado: true }],
    espectadores: [],
    esEspectador: false,
    golpeActual: null,
    golpesJugados: 0,
    bovedasDoradas: 0,
    alarmasRojas: 0,
    resultado: null,
    historialGolpes: [],
    ultimoResultadoGolpe: null,
    ultimoShowdownResuelto: null,
    terminacionPorDesconexion: null,
  };
}

describe('persistenciaSesion', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('guarda y carga la credencial de un jugador', () => {
    persistirDesdeVista(vistaJugadorRegistrado());

    expect(cargarCredencial()).toEqual({
      nombre: 'El Cerebro',
      rol: 'JUGADOR',
    });
  });

  it('no persiste la vista invitado', () => {
    persistirDesdeVista({
      ...vistaJugadorRegistrado(),
      perspectivaJugadorId: PERSPECTIVA_INVITADO,
    });

    expect(cargarCredencial()).toBeNull();
  });

  it('limpia la credencial almacenada', () => {
    persistirDesdeVista(vistaJugadorRegistrado());
    limpiarCredencial();

    expect(sessionStorage.getItem(claveStorageParaPruebas())).toBeNull();
    expect(cargarCredencial()).toBeNull();
  });

  it('construye UNIRSE de jugador desde credencial', () => {
    const mensaje = mensajeUnirseDesdeCredencial({
      nombre: 'La Sombra',
      rol: 'JUGADOR',
      descripcion: 'Perfil',
    });

    expect(mensaje).toEqual(mensajes.unirse('La Sombra', 'JUGADOR', 'Perfil'));
  });

  it('construye UNIRSE de espectador desde credencial', () => {
    const mensaje = mensajeUnirseDesdeCredencial({
      nombre: 'Espectador 1',
      rol: 'ESPECTADOR',
    });

    expect(mensaje).toEqual(mensajes.unirseEspectador());
  });
});
