// Vista de LOBBY del Cliente_Jugador.
//
// Permite a un Jugador unirse a la banda con un nombre (1..20 caracteres),
// muestra la lista de miembros ya registrados y ofrece el botón para "Dar el
// golpe" (iniciar la Partida), habilitado solo con 3..6 Jugadores.
//
// Todos los textos están en español con temática de ladrones y usan los términos
// del glosario (Golpe, Bóveda, Alarma, Ficha, Showdown).
//
// _Requirements: 2.1, 2.5, 11.1, 11.2_

import { jugadorRegistrado, type EstadoCliente } from '../estado';

/** Acciones que la vista de Lobby puede solicitar a la capa de aplicación. */
export interface AccionesLobby {
  /** Cambia el borrador del nombre (sin re-render). */
  cambiarNombre(nombre: string): void;
  /** Envía la intención de unirse a la banda con el nombre actual. */
  unirse(): void;
  /** Envía la intención de iniciar la Partida (dar el golpe). */
  iniciar(): void;
}

/** Límites de nombre del Jugador (criterio 2.1). */
const NOMBRE_MIN = 1;
const NOMBRE_MAX = 20;
/** Rango de Jugadores admitido por el Modo Básico. */
const JUGADORES_MIN = 3;
const JUGADORES_MAX = 6;

/** Escapa texto para insertarlo de forma segura como contenido HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza la vista de Lobby dentro de `contenedor` y conecta los eventos a las
 * `acciones`. Se vuelve a invocar en cada cambio de estado relevante.
 */
export function renderizarLobby(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const vista = estado.vista;
  const jugadores = vista?.jugadores ?? [];
  const registrado = jugadorRegistrado(estado);
  const total = jugadores.length;
  const puedeIniciar = total >= JUGADORES_MIN && total <= JUGADORES_MAX;

  const listaHtml =
    total === 0
      ? '<li class="lobby__vacio">Aún no hay nadie en el escondite. Sé el primero en unirte.</li>'
      : jugadores
          .map((j) => {
            const esTu = vista !== null && j.id === vista.perspectivaJugadorId;
            const etiqueta = esTu ? ' <span class="lobby__tu">(tú)</span>' : '';
            return `<li class="lobby__jugador">${escapar(j.nombre)}${etiqueta}</li>`;
          })
          .join('');

  contenedor.innerHTML = `
    <section class="lobby">
      <header class="lobby__cabecera">
        <h2>El escondite</h2>
        <p class="lobby__intro">
          Reúne a tu banda para planear el Golpe. Necesitáis entre
          ${JUGADORES_MIN} y ${JUGADORES_MAX} ladrones para asaltar la Bóveda.
        </p>
      </header>

      ${
        registrado
          ? `<p class="lobby__estado-unido">Estás dentro de la banda. Esperando a más miembros…</p>`
          : `
        <form class="lobby__formulario" id="form-unirse" novalidate>
          <label for="campo-nombre">Tu alias de ladrón</label>
          <input
            id="campo-nombre"
            name="nombre"
            type="text"
            maxlength="${NOMBRE_MAX}"
            minlength="${NOMBRE_MIN}"
            autocomplete="off"
            placeholder="p. ej. El Cerebro"
            value="${escapar(estado.nombreBorrador)}"
          />
          <button type="submit" class="boton boton--principal">
            Unirse a la banda
          </button>
        </form>`
      }

      <div class="lobby__miembros">
        <h3>Miembros de la banda (${total}/${JUGADORES_MAX})</h3>
        <ul class="lobby__lista">${listaHtml}</ul>
      </div>

      <button
        type="button"
        id="boton-iniciar"
        class="boton boton--golpe"
        ${puedeIniciar ? '' : 'disabled'}
      >
        Dar el golpe
      </button>
      ${
        puedeIniciar
          ? ''
          : `<p class="lobby__aviso">Hacen falta al menos ${JUGADORES_MIN} ladrones para dar el golpe.</p>`
      }
    </section>
  `;

  // Enlaces de eventos.
  const form = contenedor.querySelector<HTMLFormElement>('#form-unirse');
  if (form) {
    const campo = form.querySelector<HTMLInputElement>('#campo-nombre');
    if (campo) {
      // Restaurar el foco y el cursor tras el re-render mientras se teclea.
      if (estado.nombreBorrador.length > 0) {
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }
      campo.addEventListener('input', () => {
        acciones.cambiarNombre(campo.value);
      });
    }
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      acciones.unirse();
    });
  }

  const botonIniciar = contenedor.querySelector<HTMLButtonElement>('#boton-iniciar');
  botonIniciar?.addEventListener('click', () => {
    acciones.iniciar();
  });
}
