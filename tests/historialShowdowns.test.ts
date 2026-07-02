import { describe, expect, it } from "vitest";

import { aplicarAccion, iniciarPartida } from "../src/dominio/motorJuego";
import { volverAlLobby } from "../src/dominio/lobby";
import { proyectarEstadoPara } from "../src/dominio/proyeccion";
import type { EstadoPartida, Ficha, Jugador } from "../src/dominio/modelos";

function crearJugadores(cantidad: number): Jugador[] {
  return Array.from({ length: cantidad }, (_, indice) => ({
    id: `j${indice + 1}`,
    nombre: `Ladrón ${indice + 1}`,
    bolsillo: null,
  }));
}

function prepararShowdownCompleto(estado: EstadoPartida): EstadoPartida {
  const golpe = estado.golpeActual;
  if (golpe === null) {
    throw new Error("La prueba requiere un golpe en curso.");
  }

  const porJugador: Record<string, Ficha[]> = {};
  estado.jugadores.forEach((jugador, indice) => {
    const previas = golpe.fichas.porJugador[jugador.id] ?? [];
    porJugador[jugador.id] = [
      ...previas.filter((ficha) => ficha.color !== "ROJO"),
      { color: "ROJO", estrellas: indice + 1 },
    ];
  });

  return {
    ...estado,
    golpeActual: {
      ...golpe,
      ronda: "SHOWDOWN",
      comunitarias: golpe.baraja.slice(0, 5),
      baraja: golpe.baraja.slice(5),
      fichas: {
        ...golpe.fichas,
        centro: golpe.fichas.centro.filter((ficha) => ficha.color !== "ROJO"),
        porJugador,
        colorActivo: "ROJO",
      },
      confirmados: [],
      reveladoShowdown: estado.jugadores.length,
    },
  };
}

function resolverGolpe(estado: EstadoPartida): EstadoPartida {
  const resultado = aplicarAccion(prepararShowdownCompleto(estado), {
    tipo: "RESOLVER_SHOWDOWN",
  });
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) {
    throw new Error("No se pudo resolver el showdown.");
  }
  return resultado.estado;
}

describe("historialShowdowns", () => {
  it("acumula snapshots completos al resolver golpes", () => {
    let estado = iniciarPartida(crearJugadores(3), "historial");

    estado = resolverGolpe(estado);
    estado = resolverGolpe(estado);

    expect(estado.historialGolpes).toHaveLength(2);
    expect(estado.historialShowdowns).toHaveLength(2);
    expect(
      estado.historialShowdowns?.[0]?.bolsillosRevelados["j1"],
    ).toHaveLength(2);
    expect(estado.historialShowdowns?.[1]?.comunitarias).toHaveLength(5);
  });

  it("mantiene el historial detallado al mover fichas del siguiente golpe", () => {
    let estado = resolverGolpe(
      iniciarPartida(crearJugadores(3), "persistente"),
    );
    const ficha = estado.golpeActual?.fichas.centro.find(
      (f) => f.color === "BLANCO",
    );
    expect(ficha).toBeDefined();
    if (ficha === undefined) {
      return;
    }

    const resultado = aplicarAccion(estado, {
      tipo: "TOMAR_FICHA",
      jugadorId: "j1",
      ficha,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      return;
    }
    expect(resultado.estado.ultimoShowdownResuelto).toBeNull();
    expect(resultado.estado.historialShowdowns).toHaveLength(1);
  });

  it("se proyecta con manos visibles y se limpia al volver al lobby", () => {
    const estado = resolverGolpe(
      iniciarPartida(crearJugadores(3), "proyeccion"),
    );
    const vista = proyectarEstadoPara(estado, "j1");

    expect(vista.historialShowdowns).toHaveLength(1);
    expect(
      vista.historialShowdowns[0]?.jugadores.every((j) =>
        Array.isArray(j.bolsillo),
      ),
    ).toBe(true);

    const lobby = volverAlLobby(estado);
    expect(lobby.historialShowdowns).toEqual([]);
  });
});
