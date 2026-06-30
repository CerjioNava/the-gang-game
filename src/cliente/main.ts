// Punto de entrada del Cliente_Jugador (SPA en español, temática de ladrones).
//
// Arma el armazón de la aplicación: crea la conexión WebSocket con el
// Servidor_Local, mantiene el store del cliente con la última VistaPartida y
// re-renderiza la interfaz. En esta etapa (tarea 16.1) se implementa el LOBBY;
// la mesa de juego (16.2) y el Showdown/ranking (16.3) quedan como puntos de
// extensión claramente señalados.

import './estilos.css';
import {
  esMensajeError,
  esMensajeEstado,
  mensajes,
  type MensajeServidor,
} from './protocolo';
import { StoreCliente, type EstadoCliente } from './estado';
import { ConexionServidor, construirUrlWebSocket } from './ws';
import { renderizarLobby, type AccionesLobby } from './vistas/lobby';
import { renderizarMesa, type AccionesMesa } from './vistas/mesa';
import { renderizarShowdown, renderizarResultado } from './vistas/showdown';
import { montarRanking } from './vistas/ranking';
import type { Ficha } from './protocolo';

const NOMBRE_MIN = 1;
const NOMBRE_MAX = 20;

const raiz = document.querySelector<HTMLDivElement>('#app');
if (raiz === null) {
  throw new Error('No se encontró el contenedor #app para montar la interfaz.');
}

const store = new StoreCliente();

const conexion = new ConexionServidor(construirUrlWebSocket(window.location), {
  alAbrir() {
    store.fijarConexion('CONECTADO');
  },
  alRecibir(mensaje: MensajeServidor) {
    manejarMensajeEntrante(mensaje);
  },
  alCerrar() {
    store.fijarConexion('DESCONECTADO');
  },
});

/** Aplica al store los mensajes que llegan del Servidor_Local. */
function manejarMensajeEntrante(mensaje: MensajeServidor): void {
  if (esMensajeEstado(mensaje)) {
    store.recibirVista(mensaje.payload);
    return;
  }
  if (esMensajeError(mensaje)) {
    store.recibirError(mensaje.payload.mensaje);
    return;
  }
  // Otros tipos (p. ej. CARTAS) se manejarán en las vistas de juego (16.2/16.3).
}

// ===========================================================================
// Acciones del Lobby
// ===========================================================================

const accionesLobby: AccionesLobby = {
  cambiarNombre(nombre: string) {
    store.fijarNombreBorrador(nombre);
  },
  unirse() {
    const nombre = store.obtener().nombreBorrador.trim();
    if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
      store.recibirError(
        `El alias debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`,
      );
      return;
    }
    conexion.enviar(mensajes.unirse(nombre));
  },
  iniciar() {
    conexion.enviar(mensajes.iniciar());
  },
};

// ===========================================================================
// Acciones de la mesa de juego (fase EN_CURSO)
// ===========================================================================

const accionesMesa: AccionesMesa = {
  tomarFicha(ficha: Ficha) {
    conexion.enviar(mensajes.tomarFicha(ficha));
  },
  intercambiarCentro(fichaCentro: Ficha) {
    conexion.enviar(mensajes.intercambiarCentro(fichaCentro));
  },
  intercambiarJugador(jugadorB: string) {
    conexion.enviar(mensajes.intercambiarJugador(jugadorB));
  },
  avanzar() {
    conexion.enviar(mensajes.avanzar());
  },
  resolverShowdown() {
    conexion.enviar(mensajes.resolverShowdown());
  },
};

// ===========================================================================
// Render principal
// ===========================================================================

/** Banner con el estado de la conexión con el Servidor_Local. */
function bannerConexion(estado: EstadoCliente): string {
  const texto: Record<EstadoCliente['conexion'], string> = {
    CONECTANDO: 'Estableciendo contacto con el escondite…',
    CONECTADO: 'Conectado al escondite',
    DESCONECTADO: 'Conexión perdida. Reintentando entrar al escondite…',
  };
  const clase = `banner banner--${estado.conexion.toLowerCase()}`;
  return `<div class="${clase}">${texto[estado.conexion]}</div>`;
}

/** Bloque de error temático (mensajes recibidos del servidor o de validación). */
function bloqueError(estado: EstadoCliente): string {
  if (estado.error === null) {
    return '';
  }
  return `<div class="alerta" role="alert">${estado.error}</div>`;
}

/**
 * Renderiza la interfaz completa según la fase de la Partida. El armazón decide
 * qué vista mostrar; el LOBBY está implementado y las fases de juego quedan como
 * marcadores de posición para las tareas 16.2 y 16.3.
 */
function render(estado: EstadoCliente): void {
  const cabecera = `
    <header class="app__cabecera">
      <h1>The Gang</h1>
      <p class="app__lema">Un golpe perfecto se planea en silencio.</p>
      ${bannerConexion(estado)}
    </header>
    ${bloqueError(estado)}
  `;

  const cuerpo = document.createElement('div');
  cuerpo.className = 'app__cuerpo';

  const fase = estado.vista?.fase ?? 'LOBBY';
  switch (fase) {
    case 'LOBBY':
      renderizarLobby(cuerpo, estado, accionesLobby);
      break;
    case 'EN_CURSO': {
      // Mesa de juego: cartas, fichas y acciones (tarea 16.2).
      renderizarMesa(cuerpo, estado, accionesMesa);
      // En el Showdown se añade, debajo de la mesa, el revelado de manos en el
      // orden de las Fichas rojas (tarea 16.3, criterio 8.2).
      if (estado.vista?.golpeActual?.ronda === 'SHOWDOWN') {
        const seccionShowdown = document.createElement('div');
        renderizarShowdown(seccionShowdown, estado.vista);
        cuerpo.appendChild(seccionShowdown);
      }
      break;
    }
    case 'FINALIZADA':
      // Pantalla de resultado final temática (tarea 16.3, criterio 9.3).
      if (estado.vista !== null) {
        renderizarResultado(cuerpo, estado.vista);
      } else {
        cuerpo.innerHTML = `
          <section class="resultado">
            <h2 class="resultado__titulo">El golpe ha terminado</h2>
          </section>`;
      }
      break;
    default:
      cuerpo.innerHTML = '';
  }

  raiz!.innerHTML = cabecera;
  raiz!.appendChild(cuerpo);
}

store.suscribir(render);
render(store.obtener());
// Monta el panel global del Ranking_de_Manos, disponible durante toda la Partida
// (tarea 16.3, criterio 11.3). Es independiente del re-render de la SPA.
montarRanking();
conexion.conectar();
