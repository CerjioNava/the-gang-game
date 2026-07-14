import { describe, it, expect } from "vitest";
import {
  crearCoordinador,
  MensajeCliente,
  type Coordinador,
} from "../src/servidor/coordinador";

// Pruebas del Coordinador para el chat de la Partida (ENVIAR_CHAT) y para la
// terminación de la Partida por cualquier jugador cuando ya ha finalizado.

const NOMBRES: Record<string, string> = {
  j0: "El Cerebro",
  j1: "La Sombra",
  j2: "El Manos",
};

/** Une a tres jugadores (j0 anfitrión) y un espectador; opcionalmente inicia. */
function montar(iniciar: boolean): Coordinador {
  const coordinador = crearCoordinador({ generarSemilla: () => "chat-coord" });

  for (const id of ["j0", "j1", "j2"]) {
    const resultado = coordinador.procesarMensaje(id, {
      tipo: MensajeCliente.UNIRSE,
      payload: { nombre: NOMBRES[id] },
    });
    expect(resultado.clase).toBe("DIFUNDIR");
  }

  coordinador.procesarMensaje("esp1", {
    tipo: MensajeCliente.UNIRSE,
    payload: { rol: "ESPECTADOR", nombre: "Mirón" },
  });

  if (iniciar) {
    const conexionPorJugador = new Map([
      ["j0", true],
      ["j1", true],
      ["j2", true],
    ]);
    const resultado = coordinador.procesarMensaje(
      "j0",
      { tipo: MensajeCliente.INICIAR },
      { conexionPorJugador },
    );
    expect(resultado.clase).toBe("DIFUNDIR");
  }

  return coordinador;
}

describe("Coordinador: ENVIAR_CHAT durante la Partida", () => {
  it("un jugador difunde el mensaje y aparece en la vista con el autor correcto", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("j1", {
      tipo: MensajeCliente.ENVIAR_CHAT,
      payload: { texto: "  Cuidado con las cámaras  " },
    });
    expect(resultado.clase).toBe("DIFUNDIR");

    const vista = coordinador.obtenerVistaPara("j2");
    expect(vista.historialChat).toHaveLength(1);
    const mensaje = vista.historialChat[0]!;
    expect(mensaje.texto).toBe("Cuidado con las cámaras");
    expect(mensaje.autorId).toBe("j1");
    expect(mensaje.autorNombre).toBe("La Sombra");
    expect(typeof mensaje.id).toBe("string");
    expect(mensaje.id.length).toBeGreaterThan(0);
  });

  it("rechaza a un espectador y no añade el mensaje", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("esp1", {
      tipo: MensajeCliente.ENVIAR_CHAT,
      payload: { texto: "no debería aparecer" },
    });
    expect(resultado.clase).toBe("ERROR");

    expect(coordinador.obtenerVistaPara("j0").historialChat).toHaveLength(0);
  });

  it("ignora un mensaje vacío o de solo espacios", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("j0", {
      tipo: MensajeCliente.ENVIAR_CHAT,
      payload: { texto: "    " },
    });
    expect(resultado.clase).toBe("IGNORADO");
    expect(coordinador.obtenerVistaPara("j0").historialChat).toHaveLength(0);
  });

  it("rechaza el chat en el LOBBY (antes de iniciar)", () => {
    const coordinador = montar(false);

    const resultado = coordinador.procesarMensaje("j0", {
      tipo: MensajeCliente.ENVIAR_CHAT,
      payload: { texto: "hola" },
    });
    expect(resultado.clase).toBe("ERROR");
    if (resultado.clase === "ERROR") {
      expect(resultado.error.codigo).toBe("ACCION_NO_PERMITIDA");
    }
  });
});

describe("Coordinador: terminar una Partida EN_CURSO sigue siendo del anfitrión", () => {
  it("un jugador no anfitrión no puede terminar la Partida en curso", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("j1", {
      tipo: MensajeCliente.TERMINAR_PARTIDA,
    });
    expect(resultado.clase).toBe("ERROR");
    if (resultado.clase === "ERROR") {
      expect(resultado.error.codigo).toBe("ACCION_NO_PERMITIDA");
    }
    expect(coordinador.obtenerEstado().fase).toBe("EN_CURSO");
  });

  it("el anfitrión puede terminar la Partida en curso y vuelve al Lobby", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("j0", {
      tipo: MensajeCliente.TERMINAR_PARTIDA,
    });
    expect(resultado.clase).toBe("DIFUNDIR");
    expect(coordinador.obtenerEstado().fase).toBe("LOBBY");
  });

  it("un espectador nunca puede terminar la Partida", () => {
    const coordinador = montar(true);

    const resultado = coordinador.procesarMensaje("esp1", {
      tipo: MensajeCliente.TERMINAR_PARTIDA,
    });
    expect(resultado.clase).toBe("ERROR");
    expect(coordinador.obtenerEstado().fase).toBe("EN_CURSO");
  });
});
