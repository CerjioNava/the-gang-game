import { describe, it, expect } from "vitest";
import {
  MAX_LONGITUD_MENSAJE,
  MAX_MENSAJES_CHAT,
  agregarMensajeChat,
  sanearTextoChat,
} from "../src/dominio/chat";
import { iniciarPartida } from "../src/dominio/motorJuego";
import { volverAlLobby } from "../src/dominio/lobby";
import type {
  EstadoPartida,
  Jugador,
  MensajeChat,
} from "../src/dominio/modelos";

// Pruebas de la lógica pura del chat de la Partida (src/dominio/chat.ts) y de
// los resets del historial de chat al iniciar una Partida y al volver al Lobby.

const SEMILLA = "chat-dominio-test";

function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i}`,
    nombre: `Ladron ${i}`,
    bolsillo: null,
  }));
}

function mensaje(id: string, texto: string): MensajeChat {
  return {
    id,
    autorId: "j0",
    autorNombre: "El Cerebro",
    texto,
    enviadoEnMs: 1_000,
  };
}

describe("sanearTextoChat", () => {
  it("recorta espacios y conserva el texto", () => {
    expect(sanearTextoChat("  hola banda  ")).toBe("hola banda");
  });

  it("rechaza cadena vacía o solo espacios", () => {
    expect(sanearTextoChat("")).toBeNull();
    expect(sanearTextoChat("     ")).toBeNull();
    expect(sanearTextoChat("\n\t")).toBeNull();
  });

  it("rechaza valores no string", () => {
    expect(sanearTextoChat(undefined)).toBeNull();
    expect(sanearTextoChat(42)).toBeNull();
    expect(sanearTextoChat(null)).toBeNull();
  });

  it("recorta a la longitud máxima", () => {
    const largo = "a".repeat(MAX_LONGITUD_MENSAJE + 50);
    const saneado = sanearTextoChat(largo);
    expect(saneado).not.toBeNull();
    expect(saneado!.length).toBe(MAX_LONGITUD_MENSAJE);
  });
});

describe("agregarMensajeChat", () => {
  it("agrega de forma inmutable sin mutar el estado previo", () => {
    const estado = { historialChat: [] } as unknown as EstadoPartida;
    const siguiente = agregarMensajeChat(estado, mensaje("m1", "hola"));

    expect(siguiente).not.toBe(estado);
    expect(estado.historialChat).toEqual([]);
    expect(siguiente.historialChat).toHaveLength(1);
    expect(siguiente.historialChat![0]!.texto).toBe("hola");
  });

  it("tolera historialChat indefinido", () => {
    const estado = {} as EstadoPartida;
    const siguiente = agregarMensajeChat(estado, mensaje("m1", "hola"));
    expect(siguiente.historialChat).toHaveLength(1);
  });

  it("conserva solo los últimos MAX_MENSAJES_CHAT mensajes", () => {
    let estado = { historialChat: [] } as unknown as EstadoPartida;
    const total = MAX_MENSAJES_CHAT + 10;
    for (let i = 0; i < total; i++) {
      estado = agregarMensajeChat(estado, mensaje(`m${i}`, `texto ${i}`));
    }
    expect(estado.historialChat).toHaveLength(MAX_MENSAJES_CHAT);
    // El primero conservado es el mensaje número 10 (los 10 más viejos se descartan).
    expect(estado.historialChat![0]!.id).toBe("m10");
    expect(estado.historialChat![MAX_MENSAJES_CHAT - 1]!.id).toBe(
      `m${total - 1}`,
    );
  });
});

describe("reset del historial de chat", () => {
  it("iniciarPartida arranca con el chat vacío", () => {
    const estado = iniciarPartida(crearJugadores(3), SEMILLA);
    expect(estado.historialChat).toEqual([]);
  });

  it("volverAlLobby limpia el historial de chat", () => {
    let estado = iniciarPartida(crearJugadores(3), SEMILLA);
    estado = agregarMensajeChat(estado, mensaje("m1", "coordinemos"));
    expect(estado.historialChat).toHaveLength(1);

    const lobby = volverAlLobby(estado);
    expect(lobby.fase).toBe("LOBBY");
    expect(lobby.historialChat).toEqual([]);
  });
});
