import type { VistaPartida } from '../../protocolo';
import { htmlToastResultado } from './mesaPokerHtml';

const TOAST_VISIBLE_MS = 4000;
const TOAST_SALIDA_MS = 400;

const toastsDescartados = new Set<string>();
const timersToast = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const timersSalida = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Clave estable del toast de resultado de golpe (null si no debe mostrarse). */
export function claveToastResultado(vista: VistaPartida): string | null {
  const resultado = vista.ultimoResultadoGolpe;
  if (resultado === null) {
    return null;
  }
  const golpe = vista.golpeActual;
  if (golpe === null || golpe.numero <= resultado.numero) {
    return null;
  }
  return `${resultado.numero}-${resultado.exito}`;
}

function envolverToastConClave(html: string, clave: string): string {
  return html.replace(
    /class="mesa-poker__toast([^"]*)"/,
    `class="mesa-poker__toast$1" data-toast-clave="${clave}"`,
  );
}

function limpiarTimersToast(mesa: HTMLElement): void {
  const visible = timersToast.get(mesa);
  if (visible !== undefined) {
    clearTimeout(visible);
    timersToast.delete(mesa);
  }
  const salida = timersSalida.get(mesa);
  if (salida !== undefined) {
    clearTimeout(salida);
    timersSalida.delete(mesa);
  }
}

function programarOcultarToast(mesa: HTMLElement, toast: HTMLElement, clave: string): void {
  limpiarTimersToast(mesa);
  const timerVisible = setTimeout(() => {
    toast.classList.add('mesa-poker__toast--saliendo');
    const timerSalida = setTimeout(() => {
      toast.remove();
      toastsDescartados.add(clave);
      timersSalida.delete(mesa);
    }, TOAST_SALIDA_MS);
    timersSalida.set(mesa, timerSalida);
  }, TOAST_VISIBLE_MS);
  timersToast.set(mesa, timerVisible);
}

/** Actualiza el toast de resultado en la mesa con auto-dismiss. */
export function actualizarToastResultado(mesa: HTMLElement, vista: VistaPartida): void {
  const clave = claveToastResultado(vista);
  let toastHtml = htmlToastResultado(vista);

  if (clave !== null && toastsDescartados.has(clave)) {
    toastHtml = '';
  } else if (clave !== null && toastHtml !== '') {
    toastHtml = envolverToastConClave(toastHtml, clave);
  }

  const toastPrevio = mesa.querySelector<HTMLElement>('.mesa-poker__toast');

  if (toastHtml === '') {
    toastPrevio?.remove();
    limpiarTimersToast(mesa);
    return;
  }

  const clavePrev = toastPrevio?.dataset['toastClave'] ?? null;
  if (toastPrevio !== null && clavePrev === clave && !toastPrevio.classList.contains('mesa-poker__toast--saliendo')) {
    return;
  }

  if (toastPrevio !== null) {
    toastPrevio.outerHTML = toastHtml;
  } else {
    mesa.insertAdjacentHTML('afterbegin', toastHtml);
  }

  const toastNuevo = mesa.querySelector<HTMLElement>('.mesa-poker__toast');
  if (toastNuevo !== null && clave !== null) {
    programarOcultarToast(mesa, toastNuevo, clave);
  }
}

/** Limpia timers al desmontar la mesa. */
export function limpiarToastMesa(mesa: HTMLElement): void {
  limpiarTimersToast(mesa);
}

/** Expuesto para tests: simula el fin del timer de visible. */
export function descartarToastParaPruebas(clave: string): void {
  toastsDescartados.add(clave);
}

/** Expuesto para tests: reinicia el registro de toasts descartados. */
export function reiniciarToastsDescartadosParaPruebas(): void {
  toastsDescartados.clear();
}
