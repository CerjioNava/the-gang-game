import type { AliasAzar } from '../datos/nombresAzar';
import { DESCRIPCION_MAX, type EstadoCliente } from '../estado';
import { nombreParaUnirse, tieneNombreValido } from '../estado';

export interface AccionesIdentidad {
  sacarAliasAlAzar(): void;
  activarAliasManual(): void;
  cambiarNombre(nombre: string): void;
  cambiarDescripcion(descripcion: string): void;
  guardarIdentidad(): void;
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
    <article class="identity-card alias-carta" aria-live="polite">
      <p class="alias-carta__categoria">${escapar(alias.categoria)}</p>
      <h3 class="alias-carta__nombre">${escapar(alias.nombre)}</h3>
      <p class="alias-carta__desc">${escapar(alias.descripcion)}</p>
    </article>`;
}

function formularioManualHtml(
  estado: EstadoCliente,
  nombreActual: string,
  descActual: string,
): string {
  const nombre = estado.aliasElegido?.esManual === true ? estado.nombreBorrador : nombreActual;
  const desc =
    estado.aliasElegido?.esManual === true ? estado.descripcionBorrador : descActual;

  return `
    <label class="alias-manual__etiqueta" for="campo-identidad-nombre">Alias (${NOMBRE_MIN}–${NOMBRE_MAX} caracteres)</label>
    <input
      id="campo-identidad-nombre"
      class="alias-manual__input"
      type="text"
      maxlength="${NOMBRE_MAX}"
      minlength="${NOMBRE_MIN}"
      autocomplete="off"
      placeholder="p. ej. El Cerebro"
      value="${escapar(nombre)}"
    />
    <label class="alias-manual__etiqueta" for="campo-identidad-desc">Descripción (opcional)</label>
    <textarea
      id="campo-identidad-desc"
      class="alias-manual__textarea"
      maxlength="${DESCRIPCION_MAX}"
      rows="3"
      placeholder="Cuéntanos quién eres en la banda…"
    >${escapar(desc)}</textarea>
    <p class="alias-manual__contador" id="campo-identidad-desc-contador">${desc.length}/${DESCRIPCION_MAX}</p>`;
}

/** Panel de identidad editable para ladrones ya unidos al lobby. */
export function panelIdentidadHtml(
  estado: EstadoCliente,
  nombreActual: string,
  descActual: string,
): string {
  const alias = estado.aliasElegido;
  const modoManual = alias?.esManual === true;

  let cuerpo = '';
  if (alias !== null && !modoManual) {
    cuerpo = `
      ${aliasAzarHtml({
        nombre: alias.nombre,
        descripcion: alias.descripcion ?? '',
        categoria: alias.categoria ?? 'Identidad asignada',
      })}
      <div class="identity-panel__acciones">
        <button type="button" class="boton boton--alias" data-accion="SACAR_OTRO_ALIAS">
          Sacar otro alias
        </button>
        <button type="button" class="boton boton--alias" data-accion="ALIAS_MANUAL">
          Editar manualmente
        </button>
      </div>`;
  } else if (modoManual) {
    cuerpo = `
      ${formularioManualHtml(estado, nombreActual, descActual)}
      <div class="identity-panel__acciones identity-panel__acciones--solo">
        <button type="button" class="boton boton--alias" data-accion="SACAR_OTRO_ALIAS">
          Preferir un alias al azar
        </button>
        <button type="button" class="boton boton--principal" data-accion="GUARDAR_IDENTIDAD">
          Guardar identidad
        </button>
      </div>`;
  } else {
    cuerpo = `
      <p class="identity-panel__ayuda">
        Puedes cambiar tu alias hasta que alguien dé el golpe. Sortea otro o edítalo a mano.
      </p>
      <div class="identity-panel__acciones">
        <button type="button" class="boton boton--alias" data-accion="SACAR_OTRO_ALIAS">
          Sacar otro alias
        </button>
        <button type="button" class="boton boton--alias" data-accion="ALIAS_MANUAL">
          Editar manualmente
        </button>
      </div>`;
  }

  return `
    <section class="identity-panel" aria-labelledby="identity-panel-titulo">
      <h3 id="identity-panel-titulo" class="identity-panel__titulo">Tu identidad</h3>
      <p class="identity-panel__actual">
        Ahora eres <strong>${escapar(nombreActual)}</strong> en la banda.
      </p>
      ${cuerpo}
    </section>`;
}

function validarManual(estado: EstadoCliente, nombre: string, desc: string): boolean {
  const nombreOk = nombre.trim().length >= NOMBRE_MIN && nombre.trim().length <= NOMBRE_MAX;
  const descOk = desc.trim().length <= DESCRIPCION_MAX;
  void estado;
  return nombreOk && descOk;
}

/** Enlaza eventos del panel de identidad dentro de `contenedor`. */
export function enlazarPanelIdentidad(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesIdentidad,
): void {
  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="SACAR_OTRO_ALIAS"]')
    ?.addEventListener('click', () => {
      acciones.sacarAliasAlAzar();
    });

  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="ALIAS_MANUAL"]')
    ?.addEventListener('click', () => {
      acciones.activarAliasManual();
    });

  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="GUARDAR_IDENTIDAD"]')
    ?.addEventListener('click', () => {
      acciones.guardarIdentidad();
    });

  const campoNombre = contenedor.querySelector<HTMLInputElement>('#campo-identidad-nombre');
  const campoDesc = contenedor.querySelector<HTMLTextAreaElement>('#campo-identidad-desc');
  const contadorDesc = contenedor.querySelector<HTMLElement>('#campo-identidad-desc-contador');
  const botonGuardar = contenedor.querySelector<HTMLButtonElement>(
    '[data-accion="GUARDAR_IDENTIDAD"]',
  );

  const actualizarGuardar = (): void => {
    if (botonGuardar === null) {
      return;
    }
    const nombre = campoNombre?.value ?? estado.nombreBorrador;
    const desc = campoDesc?.value ?? estado.descripcionBorrador;
    botonGuardar.disabled = !validarManual(estado, nombre, desc);
  };

  campoNombre?.addEventListener('input', () => {
    acciones.cambiarNombre(campoNombre.value);
    actualizarGuardar();
  });

  campoDesc?.addEventListener('input', () => {
    acciones.cambiarDescripcion(campoDesc.value);
    if (contadorDesc !== null) {
      contadorDesc.textContent = `${campoDesc.value.length}/${DESCRIPCION_MAX}`;
    }
    actualizarGuardar();
  });

  if (campoNombre !== null) {
    actualizarGuardar();
  }

  void nombreParaUnirse(estado);
  void tieneNombreValido(estado);
}
