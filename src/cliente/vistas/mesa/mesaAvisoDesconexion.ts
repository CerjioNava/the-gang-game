import type { VistaPartida } from '../../protocolo';
import { htmlAvisoTerminacionDesconexion } from './mesaPokerHtml';

function segundosRestantes(vista: VistaPartida): number | null {
  const pendiente = vista.terminacionPorDesconexion;
  if (pendiente == null || vista.fase !== 'EN_CURSO') {
    return null;
  }
  return Math.max(0, Math.ceil((pendiente.terminaEn - Date.now()) / 1000));
}

/** Actualiza el banner de desconexión sin re-renderizar toda la mesa. */
export function actualizarAvisoDesconexion(mesa: HTMLElement, vista: VistaPartida): void {
  const segundos = segundosRestantes(vista);
  const previo = mesa.querySelector<HTMLElement>('.mesa-poker__aviso-desconexion');

  if (segundos === null) {
    previo?.remove();
    return;
  }

  if (previo !== null) {
    const cuenta = previo.querySelector('.mesa-poker__aviso-cuenta');
    if (cuenta !== null) {
      cuenta.textContent = String(segundos);
      return;
    }
  }

  const html = htmlAvisoTerminacionDesconexion(vista);
  if (html === '') {
    previo?.remove();
    return;
  }

  const hud = mesa.querySelector('.mesa-poker__hud');
  if (previo !== null) {
    previo.outerHTML = html;
  } else if (hud !== null) {
    hud.insertAdjacentHTML('afterend', html);
  } else {
    mesa.insertAdjacentHTML('afterbegin', html);
  }
}
