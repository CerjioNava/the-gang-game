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

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoCliente } from "../src/cliente/estado";
import type {
  Carta,
  Ficha,
  MensajeChat,
  VistaPartida,
} from "../src/cliente/protocolo";
import { BOLSILLO_OCULTO } from "../src/dominio/proyeccion";
import { CategoriaMano } from "../src/dominio/modelos";
import { renderizarMesa, type AccionesMesa } from "../src/cliente/vistas/mesa";
import {
  descartarToastParaPruebas,
  reiniciarToastsDescartadosParaPruebas,
} from "../src/cliente/vistas/mesa/mesaToast";
import { ordenarPorFuerzaMano } from "../src/cliente/vistas/showdown";
import {
  renderizarLobby,
  renderizarReconexion,
  type AccionesLobby,
} from "../src/cliente/vistas/lobby";
import { htmlAvisoTerminacionDesconexion } from "../src/cliente/vistas/mesa/mesaPokerHtml";
import { actualizarAvisoDesconexion } from "../src/cliente/vistas/mesa/mesaAvisoDesconexion";
import { montarPanelHistorial } from "../src/cliente/vistas/mesa/historialGolpes";
import { montarPanelChat } from "../src/cliente/vistas/mesa/chat";
import { renderizarResultado } from "../src/cliente/vistas/showdown";
import {
  CATEGORIAS_RANKING,
  NOMBRE_CATEGORIA,
  montarRanking,
} from "../src/cliente/vistas/ranking";

// ===========================================================================
// Constructores de datos de ejemplo
// ===========================================================================

/** Acciones inertes: las pruebas verifican el render, no los callbacks. */
const ACCIONES_INERTES: AccionesMesa = {
  tomarFicha() {},
  intercambiarCentro() {},
  intercambiarJugador() {},
  avanzar() {},
  revelarShowdown() {},
  resolverShowdown() {},
  terminarPartida() {},
};

function carta(valor: number, palo: Carta["palo"]): Carta {
  return { valor, palo };
}

function ficha(color: Ficha["color"], estrellas: number): Ficha {
  return { color, estrellas };
}

/**
 * Construye una `VistaPartida` de ejemplo en fase EN_CURSO, con el Golpe en la
 * Ronda Flop (color activo AMARILLO): el Jugador local ('j1') ve sus dos Cartas
 * de Bolsillo y las del resto de la banda están OCULTAS.
 */
function vistaEnCurso(): VistaPartida {
  const centro: Ficha[] = [
    ficha("AMARILLO", 1),
    ficha("AMARILLO", 2),
    ficha("AMARILLO", 3),
    ficha("AMARILLO", 4),
  ];
  const porJugador: Record<string, Ficha[]> = {
    j1: [ficha("BLANCO", 2)],
    j2: [ficha("BLANCO", 1)],
    j3: [ficha("BLANCO", 3)],
    j4: [ficha("BLANCO", 4)],
  };

  return {
    fase: "EN_CURSO",
    perspectivaJugadorId: "j1",
    jugadores: [
      {
        id: "j1",
        nombre: "El Cerebro",
        bolsillo: [carta(14, "PICAS"), carta(13, "PICAS")],
        conectado: true,
      },
      {
        id: "j2",
        nombre: "La Sombra",
        bolsillo: BOLSILLO_OCULTO,
        conectado: true,
      },
      {
        id: "j3",
        nombre: "El Manos",
        bolsillo: BOLSILLO_OCULTO,
        conectado: false,
      },
      {
        id: "j4",
        nombre: "El Topo",
        bolsillo: BOLSILLO_OCULTO,
        conectado: true,
      },
    ],
    golpeActual: {
      numero: 1,
      ronda: "FLOP",
      comunitarias: [
        carta(2, "TREBOLES"),
        carta(7, "CORAZONES"),
        carta(10, "DIAMANTES"),
      ],
      fichas: {
        numJugadores: 4,
        centro,
        porJugador,
        colorActivo: "AMARILLO",
      },
      confirmados: [],
      reveladoShowdown: 0,
      ordenShowdown: [],
    },
    golpesJugados: 0,
    bovedasDoradas: 1,
    alarmasRojas: 0,
    resultado: null,
    espectadores: [],
    esEspectador: false,
    historialGolpes: [],
    historialShowdowns: [],
    ultimoResultadoGolpe: null,
    ultimoShowdownResuelto: null,
    terminacionPorDesconexion: null,
    historialChat: [],
  };
}

function estadoCliente(vista: VistaPartida): EstadoCliente {
  return {
    conexion: "CONECTADO",
    vista,
    error: null,
    nombreBorrador: "",
    descripcionBorrador: "",
    aliasElegido: null,
    modoUnirse: "JUGADOR",
    reconectando: false,
  };
}

function vistaConHistorialShowdown(): VistaPartida {
  const comunitarias: Carta[] = [
    carta(2, "TREBOLES"),
    carta(7, "CORAZONES"),
    carta(10, "DIAMANTES"),
    carta(11, "PICAS"),
    carta(3, "TREBOLES"),
  ];
  const jugadores: VistaPartida["jugadores"] = [
    {
      id: "j1",
      nombre: "El Cerebro",
      bolsillo: [carta(14, "PICAS"), carta(13, "PICAS")],
      conectado: true,
    },
    {
      id: "j2",
      nombre: "La Sombra",
      bolsillo: [carta(4, "CORAZONES"), carta(5, "CORAZONES")],
      conectado: true,
    },
    {
      id: "j3",
      nombre: "El Manos",
      bolsillo: [carta(9, "DIAMANTES"), carta(9, "TREBOLES")],
      conectado: true,
    },
    {
      id: "j4",
      nombre: "El Topo",
      bolsillo: [carta(6, "PICAS"), carta(8, "PICAS")],
      conectado: true,
    },
  ];
  const porJugador: Record<string, Ficha[]> = {
    j1: [ficha("ROJO", 1)],
    j2: [ficha("ROJO", 2)],
    j3: [ficha("ROJO", 3)],
    j4: [ficha("ROJO", 4)],
  };

  return {
    ...vistaEnCurso(),
    historialGolpes: [
      { numero: 1, exito: true, bovedasTras: 2, alarmasTras: 0 },
    ],
    historialShowdowns: [
      {
        numero: 1,
        exito: true,
        comunitarias,
        fichas: {
          numJugadores: 4,
          centro: [],
          porJugador,
          colorActivo: "ROJO",
        },
        jugadores,
      },
    ],
  };
}

/** Crea un contenedor adjunto al documento y lo devuelve. */
function nuevoContenedor(): HTMLDivElement {
  const contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  return contenedor;
}

beforeEach(() => {
  // Aísla el DOM entre pruebas (el botón global del Ranking se monta en body).
  document.body.innerHTML = "";
});

// ===========================================================================
// Mesa de juego: comunicación, recordatorio, idioma y glosario
// ===========================================================================

describe("Vista de la mesa: restricciones de comunicación (10.1, 10.5)", () => {
  it("no incrusta un campo de texto libre en el render de la Mesa (el chat es un panel global aparte)", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    // El render de la Mesa no incrusta áreas ni campos de entrada de texto: el
    // chat vive en un overlay global (montado en document.body por
    // montarPanelChat), nunca dentro del propio HTML de la Mesa.
    expect(contenedor.querySelectorAll("textarea")).toHaveLength(0);
    const camposTexto = contenedor.querySelectorAll<HTMLInputElement>("input");
    expect(camposTexto).toHaveLength(0);

    // Se reserva el hueco del botón del chat en la barra, pero queda vacío hasta
    // que el panel global se monta explícitamente.
    const slotChat = contenedor.querySelector("#mesa-footer-chat");
    expect(slotChat).not.toBeNull();
    expect(slotChat?.childElementCount ?? -1).toBe(0);
  });

  it("no ofrece ningún botón para mostrar, revelar o comunicar las Cartas de Bolsillo", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    const textosBotones = Array.from(
      contenedor.querySelectorAll<HTMLButtonElement>("button"),
    ).map((b) => (b.textContent ?? "").trim());

    // Existen botones (tomar/intercambiar fichas, avanzar) pero NINGUNO es para
    // comunicar/revelar/mostrar/enviar cartas.
    expect(textosBotones.length).toBeGreaterThan(0);
    for (const texto of textosBotones) {
      expect(texto).not.toMatch(
        /revelar|mostrar|enviar|comunicar|insinuar|ense[ñn]ar/i,
      );
      expect(texto).not.toMatch(/cart/i);
    }
  });
  it("muestra el estado de conexión de cada miembro de la banda", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    expect(contenedor.querySelectorAll(".jugador-estatus--activo").length).toBe(
      3,
    );
    expect(
      contenedor.querySelectorAll(".jugador-estatus--desconectado").length,
    ).toBe(1);
    expect(
      contenedor
        .querySelector(".jugador-estatus--desconectado")
        ?.getAttribute("aria-label"),
    ).toBe("Desconectado");
  });
});

describe("Vista de la mesa: recordatorio permanente (10.2)", () => {
  it("muestra de forma visible el recordatorio de no revelar cartas", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    const recordatorio = contenedor.querySelector(".recordatorio");
    expect(recordatorio).not.toBeNull();

    const texto = (recordatorio?.textContent ?? "").toLowerCase();
    expect(texto).toContain("regla de oro");
    expect(texto).toContain("prohibido");
    expect(texto).toContain("revelar");
    expect(texto).toContain("sapos");
  });

  it("mantiene el recordatorio incluso cuando aún no hay Golpe preparado", () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = { ...vistaEnCurso(), golpeActual: null };
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    expect(contenedor.querySelector(".recordatorio")).not.toBeNull();
  });
});

describe("Vista de la mesa: showdown (8.2)", () => {
  function vistaEnShowdown(): VistaPartida {
    const comunitarias = [
      carta(10, "TREBOLES"),
      carta(11, "TREBOLES"),
      carta(12, "TREBOLES"),
      carta(13, "TREBOLES"),
      carta(14, "TREBOLES"),
    ];
    return {
      ...vistaEnCurso(),
      jugadores: [
        {
          id: "j1",
          nombre: "El Cerebro",
          bolsillo: [carta(2, "PICAS"), carta(3, "PICAS")],
          conectado: true,
        },
        {
          id: "j2",
          nombre: "La Sombra",
          bolsillo: [carta(4, "PICAS"), carta(5, "PICAS")],
          conectado: true,
        },
        {
          id: "j3",
          nombre: "El Manos",
          bolsillo: [carta(6, "PICAS"), carta(7, "PICAS")],
          conectado: true,
        },
        {
          id: "j4",
          nombre: "El Topo",
          bolsillo: [carta(8, "PICAS"), carta(9, "PICAS")],
          conectado: true,
        },
      ],
      golpeActual: {
        numero: 1,
        ronda: "SHOWDOWN",
        comunitarias,
        fichas: {
          numJugadores: 4,
          centro: [],
          porJugador: {
            j1: [ficha("ROJO", 1)],
            j2: [ficha("ROJO", 2)],
            j3: [ficha("ROJO", 3)],
            j4: [ficha("ROJO", 4)],
          },
          colorActivo: "ROJO",
        },
        confirmados: [],
        reveladoShowdown: 0,
        ordenShowdown: ["j1", "j2", "j3", "j4"],
      },
    };
  }

  function vistaShowdownCompleto(): VistaPartida {
    return {
      ...vistaEnShowdown(),
      golpeActual: {
        ...vistaEnShowdown().golpeActual!,
        reveladoShowdown: 4,
      },
    };
  }

  it("no muestra panel de resultados en el overlay central", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(
      contenedor,
      estadoCliente(vistaEnShowdown()),
      ACCIONES_INERTES,
    );

    const overlay = contenedor.querySelector("#mesa-poker-overlay");
    expect(overlay?.innerHTML.trim()).toBe("");
    expect(overlay?.textContent ?? "").not.toMatch(
      /Bóveda abierta|Alarma activada/,
    );
  });

  it("con reveladoShowdown=0 muestra dorso en asientos ajenos", () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = {
      ...vistaEnShowdown(),
      perspectivaJugadorId: "j1",
      jugadores: [
        {
          id: "j1",
          nombre: "El Cerebro",
          bolsillo: [carta(2, "PICAS"), carta(3, "PICAS")],
          conectado: true,
        },
        {
          id: "j2",
          nombre: "La Sombra",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
        {
          id: "j3",
          nombre: "El Manos",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
        {
          id: "j4",
          nombre: "El Topo",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
      ],
    };
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    expect(contenedor.querySelector("#boton-revelar-showdown")).not.toBeNull();
    expect(contenedor.querySelectorAll(".carta-volteo").length).toBeGreaterThan(
      0,
    );
    expect(contenedor.querySelector(".asiento--revelando")).not.toBeNull();
  });

  it("con todas las manos reveladas muestra orden en la mesa y botón resolver", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(
      contenedor,
      estadoCliente(vistaShowdownCompleto()),
      ACCIONES_INERTES,
    );

    expect(
      contenedor.querySelector(".mesa-poker--showdown-resuelto"),
    ).not.toBeNull();
    expect(contenedor.querySelector(".showdown-mesa")).not.toBeNull();
    expect(contenedor.querySelector(".showdown-mesa__banner")).not.toBeNull();
    expect(contenedor.querySelectorAll(".showdown-mesa__fila").length).toBe(2);
    expect(contenedor.querySelectorAll(".ficha--verde").length).toBeGreaterThan(
      0,
    );
    expect(
      contenedor.querySelectorAll(".ficha--rojo.ficha--orden-showdown").length,
    ).toBe(4);
    expect(contenedor.querySelector(".showdown-resumen")).toBeNull();
    expect(contenedor.querySelector("#boton-resolver")).not.toBeNull();
    expect(contenedor.querySelector("#boton-revelar-showdown")).toBeNull();

    const asientoLocal = contenedor.querySelector(
      ".mesa-poker__local .asiento--local",
    );
    expect(asientoLocal).not.toBeNull();
    expect(asientoLocal!.classList.contains("asiento--showdown-compacto")).toBe(
      true,
    );
    expect(
      asientoLocal!.querySelectorAll(".carta--mini").length,
    ).toBeGreaterThan(0);
    expect(asientoLocal!.querySelector(".carta--hero")).toBeNull();
    expect(asientoLocal!.querySelector(".asiento__cartas-etiq")).toBeNull();
  });

  it("ordenarPorFuerzaMano devuelve rangos verdes ascendentes por fuerza", () => {
    const vista = vistaShowdownCompleto();
    const golpe = vista.golpeActual!;
    const orden = ordenarPorFuerzaMano(vista, golpe);
    expect(orden).not.toBeNull();
    expect(orden!.map((p) => p.rangoVerde)).toEqual([1, 2, 3, 4]);
  });
});

describe("Vista de la mesa: idioma español y glosario (11.1, 11.2)", () => {
  it("emplea los términos del glosario en los textos de la mesa", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);
    const html = contenedor.innerHTML;

    expect(html).toMatch(/Golpe/);
    expect(html).toMatch(/Bóveda/); // "Bóvedas doradas"
    expect(html).toMatch(/Alarma/); // "Alarmas rojas"
    expect(html).toMatch(/Ficha/); // botones de intercambio en asientos
    expect(html).toMatch(/Cartas de Bolsillo/);
  });

  it("usa layout de mesa con comunitarias centradas, pool bajo comunitarias y rivales arriba", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    expect(contenedor.querySelector(".mesa-poker__pool-centro")).not.toBeNull();
    expect(contenedor.querySelector(".mesa-poker__pool-lateral")).toBeNull();
    expect(contenedor.querySelector(".mesa-poker__centro-etiq")).toBeNull();
    expect(contenedor.querySelector(".carta--mesa")).not.toBeNull();
    expect(contenedor.querySelector(".mesa-poker__rivales")).not.toBeNull();
    expect(
      contenedor.querySelector(".mesa-poker__local .asiento--local"),
    ).not.toBeNull();
    expect(
      contenedor.querySelectorAll(".mesa-poker__rivales .asiento--rival")
        .length,
    ).toBe(3);
  });

  it("renderiza dorsos con imagen SVG BACK", () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      jugadores: [
        {
          id: "j1",
          nombre: "El Cerebro",
          bolsillo: [carta(14, "PICAS"), carta(13, "PICAS")],
          conectado: true,
        },
        {
          id: "j2",
          nombre: "La Sombra",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
        {
          id: "j3",
          nombre: "El Manos",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
        {
          id: "j4",
          nombre: "El Topo",
          bolsillo: BOLSILLO_OCULTO,
          conectado: true,
        },
      ],
    };
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    const dorsos = contenedor.querySelectorAll(
      ".carta--dorso .carta__svg--dorso",
    );
    expect(dorsos.length).toBeGreaterThan(0);
    for (const dorso of dorsos) {
      expect((dorso as HTMLImageElement).src.length).toBeGreaterThan(0);
    }
  });

  it("muestra botón de historial y panel con orden y manos reveladas", async () => {
    const contenedor = nuevoContenedor();
    const vista = vistaConHistorialShowdown();
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);
    montarPanelHistorial(vista);

    const boton = contenedor.querySelector<HTMLButtonElement>(
      "#mesa-historial-boton",
    );
    expect(boton).not.toBeNull();
    expect(boton?.closest(".mesa-poker__hud-derecha")).not.toBeNull();
    boton?.click();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const overlay = document.querySelector<HTMLElement>(
      "#mesa-historial-overlay",
    );
    expect(overlay?.hidden).toBe(false);
    expect(overlay?.classList.contains("historial-overlay--visible")).toBe(true);
    expect(overlay?.textContent).toContain("Historial de golpes");
    expect(overlay?.textContent).toContain("Orden revelado");
    expect(overlay?.textContent).toContain("Orden correcto");
    expect(overlay?.textContent).toContain("Manos de la banda");
    expect(overlay?.textContent).toContain("El Cerebro");
  });

  it("unifica footer de partida con lema, ranking, acciones y espectadores", () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      espectadores: [
        { id: "obs1", nombre: "Mirada 1", conectado: true },
        { id: "obs2", nombre: "Mirada 2", conectado: true },
      ],
    };

    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    const footer = contenedor.querySelector(".mesa-poker__bar");
    expect(footer).not.toBeNull();
    expect(footer?.querySelector("#mesa-footer-ranking")).not.toBeNull();
    expect(footer?.querySelector("#mesa-poker-acciones")).not.toBeNull();
    expect(footer?.textContent).toContain(
      "Un golpe perfecto se planea en silencio",
    );
    expect(footer?.textContent).toContain(
      "Prohibido revelar sus cartas. No sean sapos.",
    );
    expect(footer?.textContent).toContain("2 espectadores");
  });

  it("en modo espectador muestra las cartas visibles de todos los jugadores", () => {
    const contenedor = nuevoContenedor();
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      perspectivaJugadorId: "obs1",
      esEspectador: true,
      espectadores: [{ id: "obs1", nombre: "Observador", conectado: true }],
      jugadores: [
        {
          id: "j1",
          nombre: "El Cerebro",
          bolsillo: [carta(14, "PICAS"), carta(13, "PICAS")],
          conectado: true,
        },
        {
          id: "j2",
          nombre: "La Sombra",
          bolsillo: [carta(4, "CORAZONES"), carta(5, "CORAZONES")],
          conectado: true,
        },
        {
          id: "j3",
          nombre: "El Manos",
          bolsillo: [carta(6, "DIAMANTES"), carta(7, "DIAMANTES")],
          conectado: true,
        },
        {
          id: "j4",
          nombre: "El Topo",
          bolsillo: [carta(8, "TREBOLES"), carta(9, "TREBOLES")],
          conectado: true,
        },
      ],
    };
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    expect(contenedor.querySelector(".mesa-poker--espectador")).not.toBeNull();
    expect(
      contenedor.querySelectorAll(".asiento__cartas .carta__svg").length,
    ).toBe(8);
    expect(contenedor.querySelectorAll(".carta--dorso").length).toBe(0);
  });

  it("muestra 4 ranuras de ficha bajo cada asiento durante las rondas", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    expect(contenedor.querySelectorAll(".asiento__ranuras-fichas").length).toBe(
      4,
    );
    expect(contenedor.querySelectorAll(".ficha-ranura").length).toBe(16);
    expect(contenedor.querySelectorAll(".ficha-ranura--llena").length).toBe(4);
    expect(contenedor.querySelectorAll(".ficha-ranura--vacia").length).toBe(12);
    expect(
      contenedor.querySelector(".ficha-ranura--activa.ficha-ranura--amarillo"),
    ).not.toBeNull();
  });

  it("muestra fichas del pool como círculos numerados sin texto TOMAR", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);

    const botones = contenedor.querySelectorAll<HTMLButtonElement>(
      ".mesa-poker__pool .ficha-boton",
    );
    expect(botones.length).toBeGreaterThan(0);
    for (const boton of botones) {
      expect(boton.textContent?.trim()).toMatch(/^\d+$/);
      expect(boton.textContent).not.toContain("TOMAR");
      expect(boton.textContent).not.toContain("★");
      expect(boton.classList.contains("ficha")).toBe(true);
    }
  });

  it("no muestra el overlay de showdown resuelto cuando ya empezó el siguiente golpe", () => {
    const contenedor = nuevoContenedor();
    reiniciarToastsDescartadosParaPruebas();
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      golpesJugados: 1,
      ultimoResultadoGolpe: { numero: 1, exito: false },
      ultimoShowdownResuelto: {
        numero: 1,
        exito: false,
        comunitarias: vistaEnCurso().golpeActual!.comunitarias,
        fichas: vistaEnCurso().golpeActual!.fichas,
        jugadores: vistaEnCurso().jugadores.map((j) => ({
          ...j,
          bolsillo:
            j.bolsillo === BOLSILLO_OCULTO
              ? BOLSILLO_OCULTO
              : (j.bolsillo as [Carta, Carta]),
        })),
      },
      golpeActual: {
        numero: 2,
        ronda: "PRE_FLOP",
        comunitarias: [],
        fichas: {
          numJugadores: 4,
          centro: [],
          porJugador: {
            j1: [ficha("BLANCO", 1)],
            j2: [ficha("BLANCO", 2)],
            j3: [ficha("BLANCO", 3)],
            j4: [ficha("BLANCO", 4)],
          },
          colorActivo: "BLANCO",
        },
        confirmados: [],
        reveladoShowdown: 0,
        ordenShowdown: [],
      },
    };

    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);

    expect(
      contenedor.querySelector("#mesa-poker-overlay .showdown--resuelto"),
    ).toBeNull();
    expect(
      contenedor.querySelector(".mesa-poker__toast--fracaso"),
    ).not.toBeNull();
  });

  it("oculta el toast de resultado tras unos segundos", () => {
    vi.useFakeTimers();
    try {
      const contenedor = nuevoContenedor();
      reiniciarToastsDescartadosParaPruebas();
      const vista: VistaPartida = {
        ...vistaEnCurso(),
        golpesJugados: 1,
        ultimoResultadoGolpe: { numero: 1, exito: false },
        golpeActual: {
          numero: 2,
          ronda: "PRE_FLOP",
          comunitarias: [],
          fichas: {
            numJugadores: 4,
            centro: [],
            porJugador: {
              j1: [ficha("BLANCO", 1)],
              j2: [ficha("BLANCO", 2)],
              j3: [ficha("BLANCO", 3)],
              j4: [ficha("BLANCO", 4)],
            },
            colorActivo: "BLANCO",
          },
          confirmados: [],
          reveladoShowdown: 0,
          ordenShowdown: [],
        },
      };

      renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);
      expect(
        contenedor.querySelector(".mesa-poker__toast--fracaso"),
      ).not.toBeNull();

      vi.advanceTimersByTime(4500);
      expect(
        contenedor.querySelector(".mesa-poker__toast--fracaso"),
      ).toBeNull();

      renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);
      expect(
        contenedor.querySelector(".mesa-poker__toast--fracaso"),
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("permite descartar toast manualmente en pruebas sin reinsertarlo", () => {
    const contenedor = nuevoContenedor();
    reiniciarToastsDescartadosParaPruebas();
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      golpesJugados: 1,
      ultimoResultadoGolpe: { numero: 1, exito: true },
      golpeActual: {
        ...vistaEnCurso().golpeActual!,
        numero: 2,
        ronda: "PRE_FLOP",
        comunitarias: [],
        reveladoShowdown: 0,
        ordenShowdown: [],
      },
    };

    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);
    expect(
      contenedor.querySelector(".mesa-poker__toast--exito"),
    ).not.toBeNull();

    descartarToastParaPruebas("1-true");
    renderizarMesa(contenedor, estadoCliente(vista), ACCIONES_INERTES);
    expect(contenedor.querySelector(".mesa-poker__toast--exito")).toBeNull();
  });
});

// ===========================================================================
// Ranking de manos en orden (11.3)
// ===========================================================================

describe("Ranking_de_Manos en orden (11.3)", () => {
  const ORDEN_UI = [
    "Escalera Real",
    "Escalera de Color",
    "Color",
    "Póker",
    "Full House",
    "Escalera",
    "Trío",
    "Dos Pares",
    "Par",
    "Carta Alta",
  ];

  it("CATEGORIAS_RANKING tiene 10 categorías de mayor a menor en el panel", () => {
    expect(CATEGORIAS_RANKING).toHaveLength(10);

    const nombres = CATEGORIAS_RANKING.map(
      (e) => NOMBRE_CATEGORIA[e.categoria],
    );
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

    const boton = document.getElementById("ranking-boton");
    expect(boton).not.toBeNull();
    expect((boton?.textContent ?? "").trim()).toBe("Ranking de manos");

    const overlay = document.getElementById("ranking-overlay");
    expect(overlay?.querySelector(".ranking-overlay__fondo")).not.toBeNull();
    expect(overlay?.querySelector(".ranking-panel")).not.toBeNull();

    const items = document.querySelectorAll("#ranking-overlay .ranking__item");
    expect(items).toHaveLength(10);

    const ejemplos = document.querySelectorAll(
      "#ranking-overlay .ranking__ejemplo .carta",
    );
    expect(ejemplos).toHaveLength(50);

    const nombresPanel = Array.from(
      document.querySelectorAll("#ranking-overlay .ranking__nombre"),
    ).map((n) => (n.textContent ?? "").trim());
    expect(nombresPanel).toEqual(ORDEN_UI);
  });

  it("montarRanking es idempotente (no duplica el botón en sucesivos re-render)", () => {
    montarRanking();
    montarRanking();
    expect(document.querySelectorAll("#ranking-boton")).toHaveLength(1);
  });
});

// ===========================================================================
// Chat de la Partida: panel lateral izquierdo
// ===========================================================================

describe("Chat de la Partida: panel lateral (montarPanelChat)", () => {
  function nuevoSlot(): HTMLElement {
    const slot = document.createElement("div");
    slot.id = "slot-chat-test";
    document.body.appendChild(slot);
    return slot;
  }

  function mensaje(
    id: string,
    autorId: string,
    autorNombre: string,
    texto: string,
  ): MensajeChat {
    return { id, autorId, autorNombre, texto, enviadoEnMs: 0 };
  }

  function vistaConChat(
    historialChat: MensajeChat[],
    overrides: Partial<VistaPartida> = {},
  ): VistaPartida {
    return { ...vistaEnCurso(), historialChat, ...overrides };
  }

  it("monta el botón 'Chat' en el slot y crea el overlay con panel y formulario", () => {
    const slot = nuevoSlot();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });

    const boton = document.getElementById("chat-boton");
    expect(boton).not.toBeNull();
    expect((boton?.textContent ?? "").trim()).toBe("Chat");
    expect(boton?.parentElement).toBe(slot);

    const overlay = document.getElementById("chat-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.hidden).toBe(true);
    expect(overlay?.querySelector(".chat-overlay__fondo")).not.toBeNull();
    expect(overlay?.querySelector(".chat-panel")).not.toBeNull();
    expect(overlay?.querySelector(".chat-panel__form")).not.toBeNull();
    expect(overlay?.querySelector(".chat-panel__input")).not.toBeNull();
  });

  it("es idempotente: no duplica el botón ni el overlay en sucesivos montajes", () => {
    const slot = nuevoSlot();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });

    expect(document.querySelectorAll("#chat-boton")).toHaveLength(1);
    expect(document.querySelectorAll("#chat-overlay")).toHaveLength(1);
  });

  it("abre el panel (clase chat-overlay--visible) al pulsar el botón", async () => {
    const slot = nuevoSlot();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });

    const boton = document.getElementById("chat-boton");
    const overlay = document.getElementById("chat-overlay");
    boton?.dispatchEvent(new Event("click"));

    // La clase visible se añade dentro de requestAnimationFrame.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(overlay?.hidden).toBe(false);
    expect(overlay?.classList.contains("chat-overlay--visible")).toBe(true);
    expect(boton?.getAttribute("aria-expanded")).toBe("true");
  });

  it("renderiza los mensajes del historialChat, marcando los propios", () => {
    const slot = nuevoSlot();
    const historial = [
      mensaje("m1", "j2", "La Sombra", "Cuidado con las alarmas"),
      mensaje("m2", "j1", "El Cerebro", "Voy por la bóveda del centro"),
    ];
    montarPanelChat({
      slot,
      vista: vistaConChat(historial),
      alEnviar: () => {},
    });

    const items = document.querySelectorAll("#chat-overlay .chat-mensaje");
    expect(items).toHaveLength(2);

    const textos = Array.from(items).map((li) =>
      (li.querySelector(".chat-mensaje__texto")?.textContent ?? "").trim(),
    );
    expect(textos).toEqual([
      "Cuidado con las alarmas",
      "Voy por la bóveda del centro",
    ]);

    // El mensaje del jugador local ('j1') se marca como propio.
    const propios = document.querySelectorAll(
      "#chat-overlay .chat-mensaje--propio",
    );
    expect(propios).toHaveLength(1);
    expect(
      (propios[0]?.querySelector(".chat-mensaje__texto")?.textContent ?? "")
        .trim(),
    ).toBe("Voy por la bóveda del centro");
  });

  it("muestra un mensaje de lista vacía cuando no hay historial", () => {
    const slot = nuevoSlot();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });

    expect(document.querySelectorAll("#chat-overlay .chat-mensaje")).toHaveLength(
      0,
    );
    expect(
      document.querySelector("#chat-overlay .chat-panel__vacio"),
    ).not.toBeNull();
  });

  it("al enviar el formulario invoca alEnviar con el texto y limpia el input", () => {
    const slot = nuevoSlot();
    const alEnviar = vi.fn();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar });

    const form = document.querySelector<HTMLFormElement>(
      "#chat-overlay .chat-panel__form",
    );
    const input = document.querySelector<HTMLInputElement>(
      "#chat-overlay .chat-panel__input",
    );
    expect(form).not.toBeNull();
    expect(input).not.toBeNull();

    input!.value = "  Reunión en el flop  ";
    form!.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(alEnviar).toHaveBeenCalledTimes(1);
    expect(alEnviar).toHaveBeenCalledWith("Reunión en el flop");
    expect(input!.value).toBe("");
  });

  it("no invoca alEnviar si el mensaje está vacío o solo tiene espacios", () => {
    const slot = nuevoSlot();
    const alEnviar = vi.fn();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar });

    const form = document.querySelector<HTMLFormElement>(
      "#chat-overlay .chat-panel__form",
    );
    const input = document.querySelector<HTMLInputElement>(
      "#chat-overlay .chat-panel__input",
    );
    input!.value = "     ";
    form!.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(alEnviar).not.toHaveBeenCalled();
  });

  it("para un espectador oculta el formulario y muestra el aviso de solo lectura", () => {
    const slot = nuevoSlot();
    montarPanelChat({
      slot,
      vista: vistaConChat([], {
        esEspectador: true,
        perspectivaJugadorId: "obs1",
      }),
      alEnviar: () => {},
    });

    const form = document.querySelector<HTMLElement>(
      "#chat-overlay .chat-panel__form",
    );
    const aviso = document.querySelector<HTMLElement>(
      "#chat-overlay .chat-panel__solo-lectura",
    );
    expect(form?.hidden).toBe(true);
    expect(aviso?.hidden).toBe(false);
  });

  it("con slot null (fase LOBBY) oculta el botón y lo saca del slot", () => {
    const slot = nuevoSlot();
    montarPanelChat({ slot, vista: vistaConChat([]), alEnviar: () => {} });

    const boton = document.getElementById("chat-boton");
    expect(boton?.parentElement).toBe(slot);

    montarPanelChat({ slot: null, vista: vistaConChat([]), alEnviar: () => {} });
    expect(boton?.hidden).toBe(true);
    expect(boton?.parentElement).toBe(document.body);
  });
});

// ===========================================================================
// Pantalla de fin: terminar la Partida (cualquier jugador, no espectador)
// ===========================================================================

describe("Pantalla de fin: botón 'Terminar partida' (renderizarResultado)", () => {
  function vistaFinalizada(overrides: Partial<VistaPartida> = {}): VistaPartida {
    return {
      ...vistaEnCurso(),
      fase: "FINALIZADA",
      golpeActual: null,
      resultado: "VICTORIA",
      bovedasDoradas: 3,
      ...overrides,
    };
  }

  it("un jugador NO anfitrión ve el botón 'Terminar partida'", () => {
    const contenedor = nuevoContenedor();
    renderizarResultado(
      contenedor,
      vistaFinalizada({ perspectivaJugadorId: "j2", anfitrionId: "j1" }),
      { terminarPartida() {} },
    );

    const boton = contenedor.querySelector<HTMLButtonElement>(
      "#boton-terminar-partida",
    );
    expect(boton).not.toBeNull();
    expect((boton?.textContent ?? "").trim()).toBe("Terminar partida");
  });

  it("el anfitrión también ve el botón 'Terminar partida'", () => {
    const contenedor = nuevoContenedor();
    renderizarResultado(
      contenedor,
      vistaFinalizada({ perspectivaJugadorId: "j1", anfitrionId: "j1" }),
      { terminarPartida() {} },
    );

    expect(
      contenedor.querySelector("#boton-terminar-partida"),
    ).not.toBeNull();
  });

  it("un espectador NO ve el botón 'Terminar partida' pero sí el slot del chat", () => {
    const contenedor = nuevoContenedor();
    renderizarResultado(
      contenedor,
      vistaFinalizada({
        perspectivaJugadorId: "obs1",
        anfitrionId: "j1",
        esEspectador: true,
      }),
      { terminarPartida() {} },
    );

    expect(contenedor.querySelector("#boton-terminar-partida")).toBeNull();
    expect(contenedor.querySelector("#pantalla-fin-chat")).not.toBeNull();
  });

  it("sin acciones (undefined) no se muestra el botón, pero sí el slot del chat", () => {
    const contenedor = nuevoContenedor();
    renderizarResultado(
      contenedor,
      vistaFinalizada({ perspectivaJugadorId: "j2", anfitrionId: "j1" }),
    );

    expect(contenedor.querySelector("#boton-terminar-partida")).toBeNull();
    expect(contenedor.querySelector("#pantalla-fin-chat")).not.toBeNull();
  });

  it("al pulsar 'Terminar partida' invoca la acción terminarPartida", () => {
    const contenedor = nuevoContenedor();
    const terminarPartida = vi.fn();
    renderizarResultado(
      contenedor,
      vistaFinalizada({ perspectivaJugadorId: "j2", anfitrionId: "j1" }),
      { terminarPartida },
    );

    contenedor
      .querySelector<HTMLButtonElement>("#boton-terminar-partida")
      ?.dispatchEvent(new Event("click"));

    expect(terminarPartida).toHaveBeenCalledTimes(1);
  });
});

const ACCIONES_LOBBY_INERTES: AccionesLobby = {
  entrarComoLadron() {},
  entrarComoEspectador() {},
  sacarAliasAlAzar() {},
  activarAliasManual() {},
  cambiarNombre() {},
  cambiarDescripcion() {},
  guardarIdentidad() {},
  iniciar() {},
  expulsarMiembro() {},
  volverAlMenu() {},
  reconectarConAlias() {},
};

describe("Vista de lobby: pantalla de título", () => {
  it("muestra los botones Ladrón y Espectador cuando no hay registro", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: {
          fase: "LOBBY",
          perspectivaJugadorId: "local",
          anfitrionId: undefined,
          jugadores: [],
          espectadores: [],
          esEspectador: false,
          golpeActual: null,
          golpesJugados: 0,
          bovedasDoradas: 0,
          alarmasRojas: 0,
          resultado: null,
          historialGolpes: [],
          historialShowdowns: [],
          ultimoResultadoGolpe: null,
          ultimoShowdownResuelto: null,
          terminacionPorDesconexion: null,
          historialChat: [],
          ajustes: { sinKickers: true },
        },
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(contenedor.querySelector(".title-screen")).not.toBeNull();
    expect(
      contenedor.querySelector('[data-accion="ENTRAR_LADRON"]'),
    ).not.toBeNull();
    expect(
      contenedor.querySelector('[data-accion="ENTRAR_ESPECTADOR"]'),
    ).not.toBeNull();
    expect(
      contenedor.querySelector(".title-screen__subtitle-panel"),
    ).not.toBeNull();
    expect(contenedor.textContent).toContain("El casino duerme");
    expect(contenedor.textContent).toContain("Entrar a la banda");
    expect(contenedor.textContent).toContain("Mirar desde las sombras");
    expect(contenedor.textContent).not.toContain(
      "Un golpe perfecto se planea en silencio",
    );
    expect(contenedor.querySelector(".title-screen__title")).toBeNull();
    contenedor.remove();
  });
});

describe("Vista de lobby: volver al menú", () => {
  function vistaLobbyJugador(perspectivaId: string): VistaPartida {
    return {
      fase: "LOBBY",
      perspectivaJugadorId: perspectivaId,
      anfitrionId: "j1",
      jugadores: [
        {
          id: perspectivaId,
          nombre: "El Cerebro",
          bolsillo: null,
          conectado: true,
        },
      ],
      espectadores: [],
      esEspectador: false,
      golpeActual: null,
      golpesJugados: 0,
      bovedasDoradas: 0,
      alarmasRojas: 0,
      resultado: null,
      historialGolpes: [],
      historialShowdowns: [],
      ultimoResultadoGolpe: null,
      ultimoShowdownResuelto: null,
      terminacionPorDesconexion: null,
      historialChat: [],
      ajustes: { sinKickers: true },
    };
  }

  function vistaLobbyEspectador(perspectivaId: string): VistaPartida {
    return {
      fase: "LOBBY",
      perspectivaJugadorId: perspectivaId,
      anfitrionId: undefined,
      jugadores: [],
      espectadores: [
        { id: perspectivaId, nombre: "Espectador 1", conectado: true },
      ],
      esEspectador: true,
      golpeActual: null,
      golpesJugados: 0,
      bovedasDoradas: 0,
      alarmasRojas: 0,
      resultado: null,
      historialGolpes: [],
      historialShowdowns: [],
      ultimoResultadoGolpe: null,
      ultimoShowdownResuelto: null,
      terminacionPorDesconexion: null,
      historialChat: [],
      ajustes: { sinKickers: true },
    };
  }

  it("muestra botón volver en la sala de planificación", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: vistaLobbyJugador("j1"),
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(
      contenedor.querySelector('[data-accion="VOLVER_MENU"]'),
    ).not.toBeNull();
    expect(contenedor.textContent).toContain("Volver al menú");
    contenedor.remove();
  });

  it("muestra botón volver en la sala de espectador", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: vistaLobbyEspectador("obs1"),
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "ESPECTADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(
      contenedor.querySelector('[data-accion="VOLVER_MENU"]'),
    ).not.toBeNull();
    contenedor.remove();
  });
});

describe("Vista de lobby: iniciar partida", () => {
  function vistaLobby(
    perspectivaId: string,
    anfitrionId: string,
  ): VistaPartida {
    return {
      fase: "LOBBY",
      perspectivaJugadorId: perspectivaId,
      anfitrionId,
      jugadores: [
        { id: "j1", nombre: "El Cerebro", bolsillo: null, conectado: true },
        { id: "j2", nombre: "La Sombra", bolsillo: null, conectado: true },
        { id: "j3", nombre: "El Manos", bolsillo: null, conectado: true },
      ],
      espectadores: [],
      esEspectador: false,
      golpeActual: null,
      golpesJugados: 0,
      bovedasDoradas: 0,
      alarmasRojas: 0,
      resultado: null,
      historialGolpes: [],
      historialShowdowns: [],
      ultimoResultadoGolpe: null,
      ultimoShowdownResuelto: null,
      terminacionPorDesconexion: null,
      historialChat: [],
      ajustes: { sinKickers: true },
    };
  }

  it("permite a un jugador no anfitrión dar el golpe cuando hay aforo válido", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: vistaLobby("j2", "j1"),
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    const boton = contenedor.querySelector<HTMLButtonElement>("#boton-iniciar");
    expect(boton?.disabled).toBe(false);
    expect(contenedor.textContent).not.toContain(
      "Solo el anfitrión puede dar el golpe",
    );
    expect(
      contenedor.querySelector(".lobby-room--planificacion"),
    ).not.toBeNull();
    contenedor.remove();
  });

  it("muestra botón de expulsión para cualquier ladrón sobre otros miembros", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: vistaLobby("j2", "j1"),
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    const expulsiones = contenedor.querySelectorAll('[data-accion="EXPULSAR"]');
    expect(expulsiones.length).toBeGreaterThan(0);
    contenedor.remove();
  });

  it("no muestra ajustes del golpe en el lobby", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    renderizarLobby(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: vistaLobby("j3", "j1"),
        error: null,
        nombreBorrador: "",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(contenedor.textContent).not.toContain("Ajustes del Golpe");
    expect(contenedor.querySelector("#check-sin-kickers")).toBeNull();
    contenedor.remove();
  });
});

describe("Vista de la mesa: aviso de desconexión", () => {
  it("muestra banner con nombre del ladrón y cuenta atrás", () => {
    const vista: VistaPartida = {
      ...vistaEnCurso(),
      terminacionPorDesconexion: {
        jugadorId: "j3",
        jugadorNombre: "El Manos",
        terminaEn: Date.now() + 8_000,
      },
    };
    const html = htmlAvisoTerminacionDesconexion(vista);

    expect(html).toContain("mesa-poker__aviso-desconexion");
    expect(html).toContain("El Manos se desconectó");
    expect(html).toMatch(/mesa-poker__aviso-cuenta">\d+/);
  });

  it("actualiza solo la cuenta del banner en el DOM", () => {
    const contenedor = nuevoContenedor();
    renderizarMesa(contenedor, estadoCliente(vistaEnCurso()), ACCIONES_INERTES);
    const mesa = contenedor.querySelector<HTMLElement>(".mesa-poker");
    expect(mesa).not.toBeNull();
    if (mesa === null) {
      return;
    }

    const terminaEn = Date.now() + 5_000;
    actualizarAvisoDesconexion(mesa, {
      ...vistaEnCurso(),
      terminacionPorDesconexion: {
        jugadorId: "j3",
        jugadorNombre: "El Manos",
        terminaEn,
      },
    });

    const banner = mesa.querySelector(".mesa-poker__aviso-desconexion");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("El Manos se desconectó");

    actualizarAvisoDesconexion(mesa, {
      ...vistaEnCurso(),
      terminacionPorDesconexion: {
        jugadorId: "j3",
        jugadorNombre: "El Manos",
        terminaEn: terminaEn - 2_000,
      },
    });

    const cuenta = mesa.querySelector(".mesa-poker__aviso-cuenta");
    expect(cuenta?.textContent).toMatch(/^\d+$/);
  });
});

describe("Vista de lobby: reconexión en EN_CURSO", () => {
  it("muestra alias pre-rellenado y botón para volver a la banda", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);

    renderizarReconexion(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: null,
        error: null,
        nombreBorrador: "La Sombra",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: false,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(contenedor.querySelector(".lobby-room--reconexion")).not.toBeNull();
    expect(
      contenedor.querySelector<HTMLInputElement>("#reconexion-alias")?.value,
    ).toBe("La Sombra");
    expect(contenedor.textContent).toContain("Volver a la banda");
    contenedor.remove();
  });

  it("muestra estado reconectando sin botón de envío", () => {
    const contenedor = document.createElement("div");
    document.body.appendChild(contenedor);

    renderizarReconexion(
      contenedor,
      {
        conexion: "CONECTADO",
        vista: null,
        error: null,
        nombreBorrador: "La Sombra",
        descripcionBorrador: "",
        aliasElegido: null,
        reconectando: true,
        modoUnirse: "JUGADOR",
      },
      ACCIONES_LOBBY_INERTES,
    );

    expect(
      contenedor.querySelector(".lobby-room__reconectando"),
    ).not.toBeNull();
    expect(contenedor.querySelector('[data-accion="RECONNECT"]')).toBeNull();
    contenedor.remove();
  });
});
