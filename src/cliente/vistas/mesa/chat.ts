// Panel de chat de la Partida del Cliente_Jugador.
//
// Se monta como un elemento GLOBAL: un botón reubicable "Chat" que abre/cierra
// un panel lateral IZQUIERDO superpuesto (máx. 1/4 del ancho), disponible en
// EN_CURSO y en la pantalla de fin. Sigue el mismo patrón de animación que el
// panel de Ranking_de_Manos e Historial de golpes.
//
// Punto crítico de UX: en cada actualización de estado solo se re-renderiza la
// LISTA de mensajes, nunca el formulario, para no borrar lo que el Jugador está
// escribiendo ni perder el foco del input.
//
// Todos los textos están en español con temática de ladrones.

import type { MensajeChat, VistaPartida } from "../../protocolo";

const ID_BOTON = "chat-boton";
const ID_OVERLAY = "chat-overlay";
const CLASE_OVERLAY_VISIBLE = "chat-overlay--visible";
const DURACION_CIERRE_MS = 300;

/** Callback vigente para enviar un mensaje; se refresca en cada montaje. */
let alEnviarActual: ((texto: string) => void) | null = null;
/** Última vista conocida, para re-renderizar la lista al abrir. */
let vistaActual: VistaPartida | null = null;
/** Número de mensajes mostrados por última vez (para autoscroll). */
let ultimoConteo = 0;
let escapeRegistrado = false;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Construye el HTML de un mensaje del chat. */
function mensajeHtml(mensaje: MensajeChat, perspectivaId: string): string {
  const propio = mensaje.autorId === perspectivaId;
  const clase = propio ? " chat-mensaje--propio" : "";
  return `
    <li class="chat-mensaje${clase}">
      <span class="chat-mensaje__autor">${escapar(mensaje.autorNombre)}</span>
      <span class="chat-mensaje__texto">${escapar(mensaje.texto)}</span>
    </li>`;
}

/** Construye el HTML de la lista completa de mensajes. */
function listaMensajesHtml(vista: VistaPartida): string {
  const mensajes = vista.historialChat;
  if (mensajes.length === 0) {
    return `<li class="chat-panel__vacio">Aún no hay mensajes. Coordina el golpe con la banda.</li>`;
  }
  return mensajes
    .map((mensaje) => mensajeHtml(mensaje, vista.perspectivaJugadorId))
    .join("");
}

/** Re-renderiza solo la lista de mensajes, preservando el formulario. */
function actualizarLista(overlay: HTMLElement, vista: VistaPartida): void {
  const lista = overlay.querySelector<HTMLElement>(".chat-panel__mensajes");
  if (lista === null) {
    return;
  }
  lista.innerHTML = listaMensajesHtml(vista);

  const total = vista.historialChat.length;
  if (total !== ultimoConteo) {
    ultimoConteo = total;
    lista.scrollTop = lista.scrollHeight;
  }
}

/** Ajusta la visibilidad del formulario según si la perspectiva puede escribir. */
function actualizarFormulario(overlay: HTMLElement, vista: VistaPartida): void {
  const form = overlay.querySelector<HTMLElement>(".chat-panel__form");
  const aviso = overlay.querySelector<HTMLElement>(".chat-panel__solo-lectura");
  const puedeEscribir = !vista.esEspectador;
  if (form !== null) {
    form.hidden = !puedeEscribir;
  }
  if (aviso !== null) {
    aviso.hidden = puedeEscribir;
  }
}

function abrirPanel(overlay: HTMLElement, boton: HTMLElement): void {
  overlay.hidden = false;
  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    overlay.classList.add(CLASE_OVERLAY_VISIBLE);
    const lista = overlay.querySelector<HTMLElement>(".chat-panel__mensajes");
    if (lista !== null) {
      lista.scrollTop = lista.scrollHeight;
    }
    if (vistaActual !== null && !vistaActual.esEspectador) {
      overlay
        .querySelector<HTMLInputElement>(".chat-panel__input")
        ?.focus();
    }
  });
}

function cerrarPanel(overlay: HTMLElement, boton: HTMLElement | null): void {
  if (overlay.hidden) {
    return;
  }

  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton?.setAttribute("aria-expanded", "false");

  const panel = overlay.querySelector(".chat-panel");
  const finalizar = (): void => {
    overlay.hidden = true;
  };

  if (panel === null) {
    finalizar();
    return;
  }

  const onFin = (evento: Event): void => {
    if (
      evento.target !== panel ||
      !(evento instanceof TransitionEvent) ||
      evento.propertyName !== "transform"
    ) {
      return;
    }
    panel.removeEventListener("transitionend", onFin);
    finalizar();
  };

  panel.addEventListener("transitionend", onFin);
  window.setTimeout(() => {
    if (
      overlay.hidden === false &&
      !overlay.classList.contains(CLASE_OVERLAY_VISIBLE)
    ) {
      panel.removeEventListener("transitionend", onFin);
      finalizar();
    }
  }, DURACION_CIERRE_MS);
}

/** Crea el botón y el overlay del chat una sola vez. */
function crearElementos(): { boton: HTMLButtonElement; overlay: HTMLElement } {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.id = ID_BOTON;
  boton.className = "boton boton--alias chat-boton";
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-controls", ID_OVERLAY);
  boton.textContent = "Chat";

  const overlay = document.createElement("div");
  overlay.id = ID_OVERLAY;
  overlay.className = "chat-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="chat-overlay__fondo"></div>
    <aside class="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-titulo">
      <header class="chat-panel__cabecera">
        <h2 id="chat-titulo">Chat de la banda</h2>
        <button type="button" class="chat-panel__cerrar" aria-label="Cerrar el chat">×</button>
      </header>
      <ul class="chat-panel__mensajes" aria-live="polite" aria-label="Mensajes del chat"></ul>
      <p class="chat-panel__solo-lectura" hidden>Observas la Partida: solo los ladrones pueden escribir.</p>
      <form class="chat-panel__form">
        <input
          type="text"
          class="chat-panel__input"
          name="mensaje"
          maxlength="500"
          autocomplete="off"
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje para la banda"
        />
        <button type="submit" class="boton boton--alias chat-panel__enviar">Enviar</button>
      </form>
    </aside>`;

  boton.addEventListener("click", () => {
    if (overlay.hidden || !overlay.classList.contains(CLASE_OVERLAY_VISIBLE)) {
      abrirPanel(overlay, boton);
    } else {
      cerrarPanel(overlay, boton);
    }
  });

  overlay.addEventListener("click", (evento) => {
    const objetivo = evento.target as HTMLElement;
    if (
      objetivo.classList.contains("chat-overlay__fondo") ||
      objetivo.classList.contains("chat-panel__cerrar")
    ) {
      cerrarPanel(overlay, boton);
    }
  });

  const form = overlay.querySelector<HTMLFormElement>(".chat-panel__form");
  const input = overlay.querySelector<HTMLInputElement>(".chat-panel__input");
  form?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (input === null) {
      return;
    }
    const texto = input.value.trim();
    if (texto.length === 0) {
      return;
    }
    alEnviarActual?.(texto);
    input.value = "";
    input.focus();
  });

  return { boton, overlay };
}

export interface OpcionesPanelChat {
  /** Slot donde colocar el botón; null oculta el chat (p. ej. en LOBBY). */
  slot: HTMLElement | null;
  /** Vista actual de la Partida (aporta historialChat y perspectiva). */
  vista: VistaPartida;
  /** Callback para enviar un mensaje al Servidor_Local. */
  alEnviar: (texto: string) => void;
}

/**
 * Monta (idempotente) el botón y el panel del chat. En cada llamada solo
 * re-renderiza la lista de mensajes, preservando el input del formulario.
 */
export function montarPanelChat(opciones: OpcionesPanelChat): void {
  const { slot, vista, alEnviar } = opciones;
  alEnviarActual = alEnviar;
  vistaActual = vista;

  let boton = document.getElementById(ID_BOTON) as HTMLButtonElement | null;
  let overlay = document.getElementById(ID_OVERLAY);

  if (boton === null || overlay === null) {
    const creados = crearElementos();
    boton = creados.boton;
    overlay = creados.overlay;
    document.body.appendChild(overlay);
  }

  if (!escapeRegistrado) {
    document.addEventListener("keydown", (evento) => {
      const overlayActual = document.getElementById(ID_OVERLAY);
      if (
        evento.key === "Escape" &&
        overlayActual !== null &&
        !overlayActual.hidden &&
        overlayActual.classList.contains(CLASE_OVERLAY_VISIBLE)
      ) {
        cerrarPanel(
          overlayActual,
          document.getElementById(ID_BOTON),
        );
      }
    });
    escapeRegistrado = true;
  }

  if (slot === null) {
    cerrarPanel(overlay, boton);
    boton.hidden = true;
    if (boton.parentElement !== document.body) {
      document.body.appendChild(boton);
    }
    return;
  }

  boton.hidden = false;
  if (boton.parentElement !== slot) {
    slot.appendChild(boton);
  }

  actualizarFormulario(overlay, vista);
  actualizarLista(overlay, vista);
}
