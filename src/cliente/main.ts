// Punto de entrada del Cliente_Jugador (SPA en español, temática de ladrones).
//
// Arma el armazón de la aplicación: crea la conexión WebSocket con el
// Servidor_Local, mantiene el store del cliente con la última VistaPartida y
// re-renderiza la interfaz dentro del AppShell persistente.

import './estilos.css';
import {
  esMensajeError,
  esMensajeEstado,
  mensajes,
  type MensajeServidor,
} from './protocolo';
import {
  StoreCliente,
  descripcionParaUnirse,
  descripcionManualValida,
  nombreParaUnirse,
  tieneNombreValido,
  DESCRIPCION_MAX,
  type EstadoCliente,
} from './estado';
import { elegirAliasAlAzar } from './datos/nombresAzar';
import { ConexionServidor, construirUrlWebSocket } from './ws';
import { montarShell } from './app/shell';
import { renderizarFase } from './app/renderRouter';
import { type AccionesLobby } from './vistas/lobby';
import { type AccionesMesa } from './vistas/mesa';
import { montarRanking } from './vistas/ranking';
import type { Ficha } from './protocolo';

const NOMBRE_MIN = 1;
const NOMBRE_MAX = 20;

const raiz = document.querySelector<HTMLDivElement>('#app');
if (raiz === null) {
  throw new Error('No se encontró el contenedor #app para montar la interfaz.');
}

const shell = montarShell(raiz);
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
}

// ===========================================================================
// Acciones del Lobby
// ===========================================================================

const accionesLobby: AccionesLobby = {
  cambiarNombre(nombre: string) {
    store.fijarNombreBorrador(nombre);
  },
  cambiarDescripcion(descripcion: string) {
    store.fijarDescripcionBorrador(descripcion);
  },
  sacarAliasAlAzar() {
    const vista = store.obtener().vista;
    const usados = new Set<string>();
    for (const j of vista?.jugadores ?? []) {
      usados.add(j.nombre);
    }
    for (const e of vista?.espectadores ?? []) {
      usados.add(e.nombre);
    }
    const alias = elegirAliasAlAzar(usados);
    store.actualizar({
      aliasElegido: {
        nombre: alias.nombre,
        descripcion: alias.descripcion,
        categoria: alias.categoria,
        esManual: false,
      },
      nombreBorrador: alias.nombre,
      error: null,
    });
  },
  activarAliasManual() {
    store.actualizar({
      aliasElegido: {
        nombre: store.obtener().nombreBorrador.trim(),
        descripcion: null,
        categoria: null,
        esManual: true,
      },
      error: null,
    });
  },
  unirseComoJugador() {
    if (!enviarUnirse('JUGADOR')) {
      return;
    }
  },
  unirseComoEspectador() {
    if (!enviarUnirse('ESPECTADOR')) {
      return;
    }
  },
  iniciar() {
    conexion.enviar(mensajes.iniciar());
  },
  expulsarMiembro(jugadorId: string) {
    conexion.enviar(mensajes.expulsarMiembro(jugadorId));
  },
  configurarAjustes(ajustes: { sinKickers: boolean }) {
    conexion.enviar(mensajes.configurarAjustes(ajustes));
  },
};

function enviarUnirse(modo: 'JUGADOR' | 'ESPECTADOR'): boolean {
  const estado = store.obtener();
  if (!tieneNombreValido(estado)) {
    store.recibirError(
      `El alias debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`,
    );
    return false;
  }
  if (!descripcionManualValida(estado)) {
    store.recibirError(`La descripción no puede superar ${DESCRIPCION_MAX} caracteres.`);
    return false;
  }
  const nombre = nombreParaUnirse(estado);
  const descripcion = descripcionParaUnirse(estado);
  store.actualizar({ modoUnirse: modo, error: null });
  conexion.enviar(mensajes.unirse(nombre, modo, descripcion));
  return true;
}

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
  revelarShowdown() {
    conexion.enviar(mensajes.revelarShowdown());
  },
  terminarPartida() {
    conexion.enviar(mensajes.terminarPartida());
  },
};

let temporizadorTick: ReturnType<typeof setInterval> | null = null;

function programarTickTemporizador(vista: EstadoCliente['vista']): void {
  if (temporizadorTick !== null) {
    clearInterval(temporizadorTick);
    temporizadorTick = null;
  }
  const finAt = vista?.golpeActual?.temporizadorFinAt;
  if (finAt == null || finAt <= Date.now()) {
    return;
  }
  temporizadorTick = setInterval(() => {
    const actual = store.obtener().vista?.golpeActual?.temporizadorFinAt;
    if (actual == null || actual <= Date.now()) {
      if (temporizadorTick !== null) {
        clearInterval(temporizadorTick);
        temporizadorTick = null;
      }
    }
    renderApp(store.obtener());
  }, 500);
}

/** Monta el botón de ranking en el slot del footer (se recrea tras cada render del shell). */
function montarRankingEnFooter(): void {
  const slot = shell.footer.querySelector<HTMLElement>('#app-footer-ranking');
  montarRanking(slot);
}

// ===========================================================================
// Render principal
// ===========================================================================

function renderApp(estado: EstadoCliente): void {
  renderizarFase(estado, shell, { lobby: accionesLobby, mesa: accionesMesa });
  montarRankingEnFooter();
  programarTickTemporizador(estado.vista);
}

store.suscribir(renderApp);
renderApp(store.obtener());
conexion.conectar();
