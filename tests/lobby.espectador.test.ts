import { describe, expect, it } from "vitest";

import {
  abandonarEspectador,
  actualizarIdentidadJugador,
  generarNombreEspectador,
  registrarEspectador,
  registrarJugador,
} from "../src/dominio/lobby";
import {
  PERSPECTIVA_INVITADO,
  proyectarEstadoPara,
} from "../src/dominio/proyeccion";
import { Coordinador } from "../src/servidor/coordinador";
import { crearAplicacion } from "../src/servidor/aplicacion";

describe("registro de espectadores (lobby)", () => {
  it("registra un espectador con nombre único", () => {
    const jugadores = [{ id: "j1", nombre: "El Cerebro", bolsillo: null }];
    const resultado = registrarEspectador([], jugadores, "El Informante", "s1");
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.espectadores).toHaveLength(1);
      expect(resultado.espectadores[0]?.nombre).toBe("El Informante");
    }
  });

  it("rechaza nombres duplicados entre jugadores y espectadores", () => {
    const jugadores = [{ id: "j1", nombre: "El Cerebro", bolsillo: null }];
    const espectadores = [{ id: "s1", nombre: "La Sombra" }];

    const duplicadoJugador = registrarEspectador(
      [],
      jugadores,
      "El Cerebro",
      "s2",
    );
    expect(duplicadoJugador.ok).toBe(false);

    const duplicadoEspectador = registrarEspectador(
      espectadores,
      jugadores,
      "La Sombra",
      "s2",
    );
    expect(duplicadoEspectador.ok).toBe(false);

    const jugadorDuplicado = registrarJugador(
      [],
      "La Sombra",
      "j2",
      espectadores,
    );
    expect(jugadorDuplicado.ok).toBe(false);
  });

  it("elimina un espectador al abandonar", () => {
    const lista = [
      { id: "s1", nombre: "A" },
      { id: "s2", nombre: "B" },
    ];
    expect(abandonarEspectador(lista, "s1")).toEqual([
      { id: "s2", nombre: "B" },
    ]);
  });

  it("genera un nombre interno único para espectadores sin alias", () => {
    const jugadores = [{ id: "j1", nombre: "El Cerebro", bolsillo: null }];
    expect(generarNombreEspectador([], jugadores)).toBe("Espectador 1");
    expect(
      generarNombreEspectador(
        [{ id: "s1", nombre: "Espectador 1" }],
        jugadores,
      ),
    ).toBe("Espectador 2");
  });

  it("permite actualizar alias de un jugador en lobby", () => {
    const jugadores = [
      { id: "j1", nombre: "El Cerebro", bolsillo: null },
      { id: "j2", nombre: "La Sombra", bolsillo: null },
    ];
    const resultado = actualizarIdentidadJugador(
      jugadores,
      [],
      "j2",
      "El Fantasma",
      "Nuevo perfil",
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.jugadores.find((j) => j.id === "j2")?.nombre).toBe(
        "El Fantasma",
      );
      expect(resultado.jugadores.find((j) => j.id === "j2")?.descripcion).toBe(
        "Nuevo perfil",
      );
    }
  });
});

describe("Coordinador: modo espectador", () => {
  function contextoConectados(...ids: string[]) {
    return { conexionPorJugador: new Map(ids.map((id) => [id, true])) };
  }

  function coordinadorConTresJugadores(): Coordinador {
    const c = new Coordinador({ generarSemilla: () => 42 });
    for (const [id, nombre] of [
      ["j1", "Uno"],
      ["j2", "Dos"],
      ["j3", "Tres"],
    ] as const) {
      const r = c.procesarMensaje(id, { tipo: "UNIRSE", payload: { nombre } });
      expect(r.clase).toBe("DIFUNDIR");
    }
    return c;
  }

  it("permite unirse como espectador sin alias explícito", () => {
    const c = new Coordinador();
    const union = c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { rol: "ESPECTADOR" },
    });
    expect(union.clase).toBe("DIFUNDIR");
    expect(c.obtenerEstado().espectadores?.[0]?.nombre).toBe("Espectador 1");
  });

  it("la aplicación acepta UNIRSE como espectador sin nombre en el payload", () => {
    const app = crearAplicacion();
    const enviados: Array<{ tipo: string; payload: unknown }> = [];
    const conexion = {
      id: "conexion-espectador",
      enviar(mensaje: { tipo: string; payload: unknown }) {
        enviados.push(mensaje);
      },
      cerrar() {},
    };

    app.manejadores.alConectar!(conexion);
    app.manejadores.alRecibirMensaje!(conexion, {
      tipo: "UNIRSE",
      payload: { rol: "ESPECTADOR" },
    });

    const errores = enviados.filter((m) => m.tipo === "ERROR");
    expect(errores).toHaveLength(0);

    const estados = enviados.filter((m) => m.tipo === "ESTADO");
    expect(estados.length).toBeGreaterThan(0);
    const vista = estados[estados.length - 1]?.payload as {
      esEspectador?: boolean;
    };
    expect(vista.esEspectador).toBe(true);
  });

  it("la aplicación saca al espectador al abandonar y devuelve vista invitado", () => {
    const app = crearAplicacion();
    const enviados: Array<{ tipo: string; payload: unknown }> = [];
    const conexion = {
      id: "conexion-espectador",
      enviar(mensaje: { tipo: string; payload: unknown }) {
        enviados.push(mensaje);
      },
      cerrar() {},
    };

    app.manejadores.alConectar!(conexion);
    app.manejadores.alRecibirMensaje!(conexion, {
      tipo: "UNIRSE",
      payload: { rol: "ESPECTADOR" },
    });
    expect(app.coordinador.obtenerEstado().espectadores).toHaveLength(1);

    app.manejadores.alRecibirMensaje!(conexion, { tipo: "ABANDONAR" });

    expect(app.coordinador.obtenerEstado().espectadores).toHaveLength(0);
    const estados = enviados.filter((m) => m.tipo === "ESTADO");
    const ultima = estados[estados.length - 1]?.payload as {
      perspectivaJugadorId?: string;
      esEspectador?: boolean;
    };
    expect(ultima?.perspectivaJugadorId).toBe(PERSPECTIVA_INVITADO);
    expect(ultima?.esEspectador).toBe(false);
  });

  it("permite cambiar alias durante el lobby", () => {
    const c = new Coordinador();
    c.procesarMensaje("j1", {
      tipo: "UNIRSE",
      payload: { nombre: "El Cerebro" },
    });
    const cambio = c.procesarMensaje("j1", {
      tipo: "CAMBIAR_ALIAS",
      payload: { nombre: "El Fantasma", descripcion: "Nueva leyenda" },
    });
    expect(cambio.clase).toBe("DIFUNDIR");
    expect(c.obtenerEstado().jugadores[0]?.nombre).toBe("El Fantasma");
  });

  it("permite a un jugador no anfitrión expulsar a otro miembro", () => {
    const c = coordinadorConTresJugadores();
    const expulsado = c.obtenerEstado().jugadores[2]!;
    const resultado = c.procesarMensaje("j2", {
      tipo: "EXPULSAR",
      payload: { jugadorId: expulsado.id },
    });
    expect(resultado.clase).toBe("DIFUNDIR");
    expect(c.obtenerEstado().jugadores).toHaveLength(2);
  });

  it("permite unirse como espectador con la Partida en curso", () => {
    const c = coordinadorConTresJugadores();
    const inicio = c.procesarMensaje(
      "j1",
      { tipo: "INICIAR" },
      contextoConectados("j1", "j2", "j3"),
    );
    expect(inicio.clase).toBe("DIFUNDIR");

    const union = c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { nombre: "Observador", rol: "ESPECTADOR" },
    });
    expect(union.clase).toBe("DIFUNDIR");
    expect(c.obtenerEstado().espectadores).toHaveLength(1);

    const vista = c.obtenerVistaPara("obs1");
    expect(vista.esEspectador).toBe(true);
    expect(
      vista.jugadores.every(
        (j) => j.bolsillo === null || Array.isArray(j.bolsillo),
      ),
    ).toBe(true);
    expect(
      vista.jugadores.filter((j) => Array.isArray(j.bolsillo)).length,
    ).toBe(3);
  });

  it("bloquea acciones de juego a los espectadores", () => {
    const c = coordinadorConTresJugadores();
    c.procesarMensaje(
      "j1",
      { tipo: "INICIAR" },
      contextoConectados("j1", "j2", "j3"),
    );
    c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { nombre: "Observador", rol: "ESPECTADOR" },
    });

    const accion = c.procesarMensaje("obs1", { tipo: "AVANZAR" });
    expect(accion.clase).toBe("ERROR");
    if (accion.clase === "ERROR") {
      expect(accion.error.codigo).toBe("ACCION_NO_PERMITIDA");
    }
  });

  it("conserva espectadores al iniciar la Partida", () => {
    const c = coordinadorConTresJugadores();
    c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { nombre: "Observador", rol: "ESPECTADOR" },
    });
    c.procesarMensaje(
      "j1",
      { tipo: "INICIAR" },
      contextoConectados("j1", "j2", "j3", "obs1"),
    );

    expect(c.obtenerEstado().fase).toBe("EN_CURSO");
    expect(c.obtenerEstado().espectadores).toHaveLength(1);
  });
});

describe("proyección para espectadores", () => {
  it("marca esEspectador y lista de espectadores en la vista", () => {
    const c = new Coordinador();
    c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { nombre: "Observador", rol: "ESPECTADOR" },
    });
    const vista = proyectarEstadoPara(c.obtenerEstado(), "obs1");
    expect(vista.esEspectador).toBe(true);
    expect(vista.espectadores).toHaveLength(1);
  });

  it("revela las cartas de bolsillo de todos los jugadores al espectador", () => {
    const c = new Coordinador({ generarSemilla: () => 42 });
    for (const [id, nombre] of [
      ["j1", "Uno"],
      ["j2", "Dos"],
      ["j3", "Tres"],
    ] as const) {
      c.procesarMensaje(id, { tipo: "UNIRSE", payload: { nombre } });
    }
    c.procesarMensaje(
      "j1",
      {
        tipo: "INICIAR",
        payload: {},
      },
      {
        conexionPorJugador: new Map([
          ["j1", true],
          ["j2", true],
          ["j3", true],
        ]),
      },
    );
    c.procesarMensaje("obs1", {
      tipo: "UNIRSE",
      payload: { nombre: "Observador", rol: "ESPECTADOR" },
    });

    const vista = proyectarEstadoPara(c.obtenerEstado(), "obs1");
    expect(vista.esEspectador).toBe(true);
    expect(vista.jugadores.every((j) => Array.isArray(j.bolsillo))).toBe(true);
  });
});
