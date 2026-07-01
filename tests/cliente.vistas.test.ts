// @vitest-environment jsdom
//
// Pruebas por ejemplo del Cliente_Jugador (capa de presentación).
//
// Verifican, sobre el HTML realmente renderizado por las vistas en el DOM:
//   - Ausencia de acciones para comunicar cartas y de chat de texto libre
//     (criterios 10.1, 10.5).
//   - Recordatorio permanente de no revelar/insinuar cartas ni hacer bluff,
//     visible en la pantalla de juego (criterio 10.2).
//   - Idioma español y uso de los términos del glosario (criterios 11.1, 11.2).
//   - Ranking_de_Manos con las diez categorías en orden de mayor a menor
//     (criterio 11.3).
//
// Estas vistas usan el DOM (document), por lo que esta suite se ejecuta con el
// entorno jsdom mediante el comentario `@vitest-environment jsdom` de arriba.
// El resto de la suite (dominio) sigue corriendo en el entorno 'node' por
// defecto definido en vitest.config.ts.
//
// _Requirements: 10.1, 10.2, 10.5, 11.1, 11.2, 11.3_

import { beforeEach, describe, expect, it } from 'vitest';

import type { EstadoCliente } from '../src/cliente/estado';
import type { Carta, Ficha, VistaPartida } from '../src/cliente/protocolo';
import { BOLSILLO_OCULTO } from '../src/dominio/proyeccion';
import { CategoriaMano } from '../src/dominio/modelos';
import { renderizarMesa, type AccionesMesa } from '../src/cliente/vistas/mesa';
import {
  CATEGORIAS_RANKING,
  NOMBRE_CATEGORIA,
  montarRanking,
} from '../src/cliente/vistas/ranking';

// ===========================================================================
// Constructores de datos de ejemplo
// ===========================================================================

/** Acciones inertes: las pruebas verifican el render, no los callbacks. */
const ACCIONES_INERTES: AccionesMesa = {
  tomarFicha() {},
  intercambiarCentro() {},
  intercambiarJugador() {},
  avanzar() {},
  resolverShowdown() {},
};

function carta(valor: number, palo: Carta['palo']): Carta {
  return { valor, palo };
}

function ficha(color: Ficha['color'], estrellas: number): Ficha {
  return { color, estrellas };
}

/**
 * Construye una `VistaPartida` de ejemplo en fase EN_CURSO, con el Golpe en la
 * Ronda Flop (color activo AMARILLO): el Jugador local ('j1') ve sus dos Cartas
 * de Bolsillo y las del resto de la banda están OCULTAS.
 */
function vistaEnCurso(): VistaPartida {
  const centro: Ficha[] = [
    ficha('AMARILLO', 1),
    ficha('AMARILLO', 2),
    ficha('AMARILLO', 3),
    ficha('AMARILLO', 4),
  ];
  const porJugador: Record<string, Ficha[]> = {
    j1: [ficha('BLANCO', 2)],
    j2: [ficha('BLANCO', 1)],
    j3: [ficha('BLANCO', 3)],
    j4: [ficha('BLANCO', 4)],
  };

  return {
    fase: 'EN_CURSO',
    perspectivaJugadorId: 'j1',
    jugadores: [
      { id: 'j1', nombre: 'El Cerebro', bolsillo: [carta(14, 'PICAS'), carta(13, 'PICAS')], conectado: true },
      { id: 'j2', nombre: 'La Sombra', bolsillo: BOLSILLO_OCULTO, conectado: true },
      { id: 'j3', nombre: 'El Manos', bolsillo: BOLSILLO_OCULTO, conectado: false },
      { id: 'j4', nombre: 'El Topo', bolsillo: BOLSILLO_OCULTO, conectado: true },
    ],
    golpeActual: {
      numero: 1,
      ronda: 'FLOP',
      comunitarias: [carta(2, 'TREBOLES'), carta(7, 'CORAZONES'), carta(10, 'DIAMANTES')],
      fichas: {
        numJugadores: 4,
        centro,
        porJugador,
        colorActivo: 'AMARILLO',
      },
      confirmados: [],
    },
    golpesJugados: 0,
    bovedasDoradas: 1,
    alarmasRojas: 0,
    resultado: null,
    espectadores: [],
    esEspectador: false,
  };
}

function estadoCliente(vista: VistaPartida): EstadoCliente {
  return {
    conexion: 'CONECTADO',
    vista,
    error: null,
    nombreBorrador: '',
    descripcionBorrador: '',
    aliasElegido: null,
    modoUnirse: 'JUGADOR',
  };
}

/** Crea un contenedor adjunto al documento y lo devuelve. */
function nuevoContenedor(): HTMLDivElement {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  return contenedor;
}

beforeEach(() => {
  // Aísla el DOM entre pruebas (el botón global del Ranking se monta en body).
  document.body.innerHTML = '';
});

// ===========================================================================
// Mesa de juego: comunicación, recordatorio, idioma y glosario
// ===========================================================================

describe('Vista de la mesa: restricciones de comunicación (10.1, 10.5)', () => {
  it('no ofrece ningún campo de chat ni mensajería de texto libre', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    // No hay áreas de texto ni campos de entrada de texto (chat libre).
    expect(contenedor.querySelectorAll('textarea')).toHaveLength(0);
    const camposTexto = contenedor.querySelectorAll<HTMLInputElement>('input');
    expect(camposTexto).toHaveLength(0);

    // Ninguna pista textual de un canal de mensajería en el HTML.
    expect(contenedor.innerHTML).not.toMatch(/\bchat\b/i);
    expect(contenedor.innerHTML).not.toMatch(/\bmensaje[s]?\b/i);
  });

  it('no ofrece ningún botón para mostrar, revelar o comunicar las Cartas de Bolsillo', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    const textosBotones = Array.from(
      contenedor.querySelectorAll<HTMLButtonElement>('button'),
    ).map((b) => (b.textContent ?? '').trim());

    // Existen botones (tomar/intercambiar fichas, avanzar) pero NINGUNO es para
    // comunicar/revelar/mostrar/enviar cartas.
    expect(textosBotones.length).toBeGreaterThan(0);
    for (const texto of textosBotones) {
      expect(texto).not.toMatch(/revelar|mostrar|enviar|comunicar|insinuar|ense[ñn]ar/i);
      expect(texto).not.toMatch(/cart/i);
    }
  });
  it('muestra el estado de conexión de cada miembro de la banda', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    expect(contenedor.querySelectorAll('.jugador-estatus--activo').length).toBe(3);
    expect(contenedor.querySelectorAll('.jugador-estatus--desconectado').length).toBe(1);
    expect(contenedor.textContent).toContain('Desconectado');
  });
});

describe('Vista de la mesa: recordatorio permanente (10.2)', () => {
  it('muestra de forma visible el recordatorio de no revelar cartas ni hacer bluff', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    const recordatorio = contenedor.querySelector('.recordatorio');
    expect(recordatorio).not.toBeNull();

    const texto = (recordatorio?.textContent ?? '').toLowerCase();
    expect(texto).toContain('prohibido');
    expect(texto).toContain('revelar');
    expect(texto).toContain('bluff');
    expect(texto).toContain('cartas de bolsillo');
  });

  it('mantiene el recordatorio incluso cuando aún no hay Golpe preparado', () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = { ...vistaEnCurso(), golpeActual: null };
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    expect(contenedor.querySelector('.recordatorio')).not.toBeNull();
  });
});

describe('Vista de la mesa: idioma español y glosario (11.1, 11.2)', () => {
  it('emplea los términos del glosario en los textos de la mesa', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);
    const html = contenedor.innerHTML;

    expect(html).toMatch(/Golpe/);
    expect(html).toMatch(/Bóveda/); // "Bóvedas doradas"
    expect(html).toMatch(/Alarma/); // "Alarmas rojas"
    expect(html).toMatch(/Ficha/); // "Fichas ... disponibles"
    expect(html).toMatch(/Cartas Comunitarias/);
    expect(html).toMatch(/Cartas de Bolsillo/);
  });

  it('no muestra textos de interfaz evidentes en inglés', () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);
    const texto = contenedor.textContent ?? '';

    // Palabras de UI claramente en inglés que no deberían aparecer.
    for (const palabra of ['Send', 'Message', 'Chat', 'Player', 'Start', 'Reveal', 'Cards']) {
      expect(texto).not.toMatch(new RegExp(`\\b${palabra}\\b`));
    }
  });
});

// ===========================================================================
// Ranking de manos en orden (11.3)
// ===========================================================================

describe('Ranking_de_Manos en orden (11.3)', () => {
  const ORDEN_UI = [
    'Escalera Real',
    'Escalera de Color',
    'Color',
    'Póker',
    'Full House',
    'Escalera',
    'Trío',
    'Dos Pares',
    'Par',
    'Carta Alta',
  ];

  it('CATEGORIAS_RANKING tiene 10 categorías de mayor a menor en el panel', () => {
    expect(CATEGORIAS_RANKING).toHaveLength(10);

    const nombres = CATEGORIAS_RANKING.map((e) => NOMBRE_CATEGORIA[e.categoria]);
    expect(nombres).toEqual(ORDEN_UI);

    // El orden propio de The Gang: Full House < Póker < Color (valores del enum).
    const categorias = CATEGORIAS_RANKING.map((e) => e.categoria);
    const iFull = categorias.indexOf(CategoriaMano.FULL_HOUSE);
    const iPoker = categorias.indexOf(CategoriaMano.POKER);
    const iColor = categorias.indexOf(CategoriaMano.COLOR);
    expect(iFull).toBeGreaterThan(iPoker);
    expect(iPoker).toBeGreaterThan(iColor);

    // En pantalla el enum va de mayor a menor.
    expect(categorias).toEqual([...categorias].sort((a, b) => b - a));
  });

  it('montarRanking crea el botón "Ranking de manos" y un panel con las 10 categorías en orden', () => {
    montarRanking();

    const boton = document.getElementById('ranking-boton');
    expect(boton).not.toBeNull();
    expect((boton?.textContent ?? '').trim()).toBe('Ranking de manos');

    const items = document.querySelectorAll('#ranking-overlay .ranking__item');
    expect(items).toHaveLength(10);

    const ejemplos = document.querySelectorAll('#ranking-overlay .ranking__ejemplo .carta');
    expect(ejemplos).toHaveLength(50);

    const nombresPanel = Array.from(
      document.querySelectorAll('#ranking-overlay .ranking__nombre'),
    ).map((n) => (n.textContent ?? '').trim());
    expect(nombresPanel).toEqual(ORDEN_UI);
  });

  it('montarRanking es idempotente (no duplica el botón en sucesivos re-render)', () => {
    montarRanking();
    montarRanking();
    expect(document.querySelectorAll('#ranking-boton')).toHaveLength(1);
  });
});
