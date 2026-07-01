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
import { StoreCliente, descripcionParaUnirse, descripcionManualValida, nombreParaUnirse, participanteRegistrado, tieneNombreValido, DESCRIPCION_MAX, type EstadoCliente } from './estado';
import { elegirAliasAlAzar } from './datos/nombresAzar';
import { ConexionServidor, construirUrlWebSocket } from './ws';
import {
  renderizarEntradaEspectador,
  renderizarLobby,
  type AccionesLobby,
} from './vistas/lobby';
import { renderizarMesa, type AccionesMesa } from './vistas/mesa';
import { renderizarShowdown, renderizarShowdownResuelto, renderizarResultado } from './vistas/showdown';
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
    render(store.obtener());
  }, 500);
}

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

  const vista = estado.vista;
  const fase = vista?.fase ?? 'LOBBY';
  const registrado = participanteRegistrado(estado);

  if (!registrado && fase !== 'LOBBY') {
    if (fase === 'FINALIZADA') {
      cuerpo.innerHTML = `
        <section class="lobby lobby--espectador">
          <h2>El golpe ha terminado</h2>
          <p class="lobby__intro">Esta Partida ya finalizó. No es posible unirse como espectador.</p>
        </section>`;
    } else {
      renderizarEntradaEspectador(cuerpo, estado, accionesLobby);
    }
  } else if (fase === 'LOBBY') {
    renderizarLobby(cuerpo, estado, accionesLobby);
  } else if (fase === 'EN_CURSO') {
    renderizarMesa(cuerpo, estado, accionesMesa);
    if (vista !== null) {
      if (vista.ultimoShowdownResuelto !== null) {
        const seccionShowdown = document.createElement('div');
        renderizarShowdownResuelto(seccionShowdown, vista);
        cuerpo.appendChild(seccionShowdown);
      } else if (vista.golpeActual?.ronda === 'SHOWDOWN') {
        const seccionShowdown = document.createElement('div');
        renderizarShowdown(seccionShowdown, vista);
        cuerpo.appendChild(seccionShowdown);
      }
    }
  } else if (fase === 'FINALIZADA') {
    if (estado.vista !== null) {
      if (estado.vista.ultimoShowdownResuelto !== null) {
        const seccionShowdown = document.createElement('div');
        renderizarShowdownResuelto(seccionShowdown, estado.vista);
        cuerpo.appendChild(seccionShowdown);
      }
      const seccionResultado = document.createElement('div');
      renderizarResultado(seccionResultado, estado.vista, accionesMesa);
      cuerpo.appendChild(seccionResultado);
    } else {
      cuerpo.innerHTML = `
        <section class="resultado">
          <h2 class="resultado__titulo">El golpe ha terminado</h2>
        </section>`;
    }
  } else {
    cuerpo.innerHTML = '';
  }

  raiz!.innerHTML = cabecera;
  raiz!.appendChild(cuerpo);
  programarTickTemporizador(vista);
}

store.suscribir(render);
render(store.obtener());
// Monta el panel global del Ranking_de_Manos, disponible durante toda la Partida
// (tarea 16.3, criterio 11.3). Es independiente del re-render de la SPA.
montarRanking();
conexion.conectar();
