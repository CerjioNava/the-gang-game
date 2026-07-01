// Selector de alias para el Lobby: sorteo temático o entrada manual.

import type { AliasAzar } from '../datos/nombresAzar';
import { DESCRIPCION_MAX, type EstadoCliente } from '../estado';
import { nombreParaUnirse, tieneNombreValido } from '../estado';

/** Acciones del selector de alias compartido entre Lobby y entrada de espectador. */
export interface AccionesSelectorAlias {
  sacarAliasAlAzar(): void;
  activarAliasManual(): void;
  cambiarNombre(nombre: string): void;
  cambiarDescripcion(descripcion: string): void;
}

const NOMBRE_MIN = 1;
const NOMBRE_MAX = 20;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function aliasAzarHtml(alias: AliasAzar): string {
  return `
    <article class="alias-carta" aria-live="polite">
      <p class="alias-carta__categoria">${escapar(alias.categoria)}</p>
      <h3 class="alias-carta__nombre">${escapar(alias.nombre)}</h3>
      <p class="alias-carta__desc">${escapar(alias.descripcion)}</p>
    </article>`;
}

function formularioManualHtml(estado: EstadoCliente, idCampo: string, idDesc: string): string {
  return `
    <label class="alias-manual__etiqueta" for="${idCampo}">Alias (${NOMBRE_MIN}–${NOMBRE_MAX} caracteres)</label>
    <input
      id="${idCampo}"
      class="alias-manual__input"
      type="text"
      maxlength="${NOMBRE_MAX}"
      minlength="${NOMBRE_MIN}"
      autocomplete="off"
      placeholder="p. ej. El Cerebro"
      value="${escapar(estado.nombreBorrador)}"
    />
    <label class="alias-manual__etiqueta" for="${idDesc}">Descripción (opcional)</label>
    <textarea
      id="${idDesc}"
      class="alias-manual__textarea"
      maxlength="${DESCRIPCION_MAX}"
      rows="3"
      placeholder="Cuéntanos quién eres en la banda…"
    >${escapar(estado.descripcionBorrador)}</textarea>
    <p class="alias-manual__contador" id="${idDesc}-contador">${estado.descripcionBorrador.length}/${DESCRIPCION_MAX}</p>
    <div class="selector-alias__acciones selector-alias__acciones--solo">
      <button type="button" class="boton boton--alias" data-accion="SACAR_ALIAS_AZAR">
        Preferir un alias al azar
      </button>
    </div>`;
}

function cuerpoSelector(estado: EstadoCliente, ids: { nombre: string; desc: string }): string {
  const alias = estado.aliasElegido;
  const modoManual = alias?.esManual === true;

  if (alias !== null && !modoManual) {
    return `
      ${aliasAzarHtml({ nombre: alias.nombre, descripcion: alias.descripcion ?? '', categoria: alias.categoria ?? '' })}
      <div class="selector-alias__acciones">
        <button type="button" class="boton boton--alias" data-accion="SACAR_OTRO_ALIAS">
          Sacar otro alias
        </button>
        <button type="button" class="boton boton--alias" data-accion="ALIAS_MANUAL">
          Escribir alias manualmente
        </button>
      </div>`;
  }

  if (modoManual) {
    return formularioManualHtml(estado, ids.nombre, ids.desc);
  }

  return `
    <p class="selector-alias__ayuda">
      Sortea un alias de la banda con su leyenda, o escríbelo tú si ya tienes uno en mente.
    </p>
    <div class="selector-alias__acciones">
      <button type="button" class="boton boton--alias" data-accion="SACAR_ALIAS_AZAR">
        Sacar alias al azar
      </button>
      <button type="button" class="boton boton--alias" data-accion="ALIAS_MANUAL">
        Escribir alias manualmente
      </button>
    </div>`;
}

function envolverSelector(
  titulo: string,
  cuerpo: string,
  estado: EstadoCliente,
  soloEspectador: boolean,
): string {
  const habilitado = tieneNombreValido(estado);
  const atributo = habilitado ? '' : ' disabled';

  const botones = soloEspectador
    ? `
      <div class="lobby__acciones-entrada lobby__acciones-entrada--solo">
        <button type="button" class="boton boton--secundario" data-accion="UNIRSE_ESPECTADOR"${atributo}>
          Entrar como espectador
        </button>
      </div>`
    : `
      <div class="lobby__acciones-entrada">
        <button type="button" class="boton boton--principal" data-accion="UNIRSE_JUGADOR"${atributo}>
          Unirse a la banda
        </button>
        <button type="button" class="boton boton--secundario" data-accion="UNIRSE_ESPECTADOR"${atributo}>
          Entrar como espectador
        </button>
      </div>`;

  return `
    <section class="selector-alias" aria-labelledby="selector-alias-titulo">
      <h3 id="selector-alias-titulo" class="selector-alias__titulo">${titulo}</h3>
      ${cuerpo}
      ${botones}
      ${habilitado ? '' : '<p class="selector-alias__aviso">Elige o escribe un alias para habilitar la entrada.</p>'}
    </section>`;
}

export function selectorAliasHtml(estado: EstadoCliente): string {
  return envolverSelector(
    'Tu identidad en el escondite',
    cuerpoSelector(estado, { nombre: 'campo-nombre-manual', desc: 'campo-desc-manual' }),
    estado,
    false,
  );
}

export function selectorAliasEspectadorHtml(estado: EstadoCliente): string {
  const cuerpo = cuerpoSelector(estado, {
    nombre: 'campo-nombre-espectador',
    desc: 'campo-desc-espectador',
  }).replace(
    'Sortea un alias de la banda con su leyenda, o escríbelo tú si ya tienes uno en mente.',
    'Sortea un alias para observar el golpe sin jugar.',
  );
  return envolverSelector('Tu identidad de observador', cuerpo, estado, true);
}

export interface AccionesEntradaLobby extends AccionesSelectorAlias {
  unirseComoJugador(): void;
  unirseComoEspectador(): void;
}

function actualizarBotonesEntrada(contenedor: HTMLElement, valido: boolean): void {
  contenedor.querySelectorAll<HTMLButtonElement>(
    '[data-accion="UNIRSE_JUGADOR"], [data-accion="UNIRSE_ESPECTADOR"]',
  ).forEach((boton) => {
    boton.disabled = !valido;
  });
  const aviso = contenedor.querySelector<HTMLElement>('.selector-alias__aviso');
  if (aviso !== null) {
    aviso.hidden = valido;
  }
}

/** Enlaza eventos del selector de alias dentro de `contenedor`. */
export function enlazarSelectorAlias(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesEntradaLobby,
): void {
  contenedor.querySelector<HTMLButtonElement>('[data-accion="SACAR_ALIAS_AZAR"]')?.addEventListener('click', () => {
    acciones.sacarAliasAlAzar();
  });

  contenedor.querySelector<HTMLButtonElement>('[data-accion="SACAR_OTRO_ALIAS"]')?.addEventListener('click', () => {
    acciones.sacarAliasAlAzar();
  });

  contenedor.querySelector<HTMLButtonElement>('[data-accion="ALIAS_MANUAL"]')?.addEventListener('click', () => {
    acciones.activarAliasManual();
  });

  contenedor.querySelector<HTMLButtonElement>('[data-accion="UNIRSE_JUGADOR"]')?.addEventListener('click', () => {
    acciones.unirseComoJugador();
  });

  contenedor.querySelector<HTMLButtonElement>('[data-accion="UNIRSE_ESPECTADOR"]')?.addEventListener('click', () => {
    acciones.unirseComoEspectador();
  });

  const campoManual =
    contenedor.querySelector<HTMLInputElement>('#campo-nombre-manual') ??
    contenedor.querySelector<HTMLInputElement>('#campo-nombre-espectador');
  const campoDesc =
    contenedor.querySelector<HTMLTextAreaElement>('#campo-desc-manual') ??
    contenedor.querySelector<HTMLTextAreaElement>('#campo-desc-espectador');
  const contadorDesc =
    contenedor.querySelector<HTMLElement>('#campo-desc-manual-contador') ??
    contenedor.querySelector<HTMLElement>('#campo-desc-espectador-contador');

  const validarManual = (): boolean => {
    const nombre = (campoManual?.value ?? estado.nombreBorrador).trim();
    const desc = campoDesc?.value ?? estado.descripcionBorrador;
    const nombreOk = nombre.length >= NOMBRE_MIN && nombre.length <= NOMBRE_MAX;
    const descOk = desc.trim().length <= DESCRIPCION_MAX;
    return nombreOk && descOk;
  };

  if (campoManual !== null) {
    if (estado.nombreBorrador.length > 0) {
      campoManual.focus();
      campoManual.setSelectionRange(campoManual.value.length, campoManual.value.length);
    }
    campoManual.addEventListener('input', () => {
      acciones.cambiarNombre(campoManual.value);
      actualizarBotonesEntrada(contenedor, validarManual());
    });
  }

  if (campoDesc !== null) {
    campoDesc.addEventListener('input', () => {
      acciones.cambiarDescripcion(campoDesc.value);
      if (contadorDesc !== null) {
        contadorDesc.textContent = `${campoDesc.value.length}/${DESCRIPCION_MAX}`;
      }
      actualizarBotonesEntrada(contenedor, validarManual());
    });
  }

  if (campoManual !== null) {
    actualizarBotonesEntrada(contenedor, validarManual());
  }

  void nombreParaUnirse(estado);
}
