import type { EstadoCliente } from '../estado';
import { participanteRegistrado } from '../estado';
import type { AccionesLobby } from '../vistas/lobby';
import type { AccionesMesa } from '../vistas/mesa';
import {
  renderizarEntradaEspectador,
  renderizarLobby,
  renderizarReconexion,
} from '../vistas/lobby';
import { renderizarMesa } from '../vistas/mesa';
import {
  renderizarResultado,
  renderizarShowdownResuelto,
} from '../vistas/showdown';
import type { ElementosShell } from './shell';

export interface AccionesApp {
  lobby: AccionesLobby;
  mesa: AccionesMesa;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHud(estado: EstadoCliente, shell: ElementosShell): void {
  const conexion = estado.conexion;
  const textoConexion: Record<EstadoCliente['conexion'], string> = {
    CONECTANDO: 'Conectando…',
    CONECTADO: 'En línea',
    DESCONECTADO: 'Reconectando…',
  };
  const vista = estado.vista;
  const fase = vista?.fase ?? 'LOBBY';
  const tituloFase =
    fase === 'LOBBY'
      ? 'El escondite'
      : fase === 'EN_CURSO'
        ? `Golpe ${(vista?.golpesJugados ?? 0) + 1}`
        : 'Fin del golpe';

  shell.hud.innerHTML = `
    <div class="app-shell__hud-inner">
      <div class="app-shell__marca">
        <span class="app-shell__titulo">The Gang</span>
        <span class="app-shell__fase">${escapar(tituloFase)}</span>
      </div>
      <div class="app-shell__estado">
        <span class="app-shell__conexion app-shell__conexion--${conexion.toLowerCase()}">${textoConexion[conexion]}</span>
      </div>
    </div>`;
}

function renderAlerta(estado: EstadoCliente, shell: ElementosShell): void {
  if (estado.error === null) {
    shell.alerta.hidden = true;
    shell.alerta.textContent = '';
    return;
  }
  shell.alerta.hidden = false;
  shell.alerta.textContent = estado.error;
}

function renderFooter(_estado: EstadoCliente, shell: ElementosShell): void {
  if (shell.footer.querySelector('#app-footer-ranking') !== null) {
    return;
  }
  shell.footer.innerHTML = `
    <div class="app-shell__footer-inner">
      <p class="app-shell__lema">Un golpe perfecto se planea en silencio.</p>
      <div id="app-footer-ranking"></div>
    </div>`;
}

/** Renderiza el contenido principal según la fase de la Partida. */
export function renderizarFase(
  estado: EstadoCliente,
  shell: ElementosShell,
  acciones: AccionesApp,
): void {
  renderHud(estado, shell);
  renderAlerta(estado, shell);
  renderFooter(estado, shell);

  const main = shell.main;
  const vista = estado.vista;
  const fase = vista?.fase ?? 'LOBBY';
  const registrado = participanteRegistrado(estado);

  if (fase === 'EN_CURSO' && main.querySelector('.mesa-poker') !== null) {
    renderizarMesa(main, estado, acciones.mesa);
    return;
  }

  main.innerHTML = '';

  if (!registrado && fase !== 'LOBBY') {
    if (fase === 'FINALIZADA') {
      main.innerHTML = `
        <section class="lobby lobby--espectador lobby--horizontal">
          <h2>El golpe ha terminado</h2>
          <p class="lobby__intro">Esta Partida ya finalizó. No es posible unirse como espectador.</p>
        </section>`;
    } else if (fase === 'EN_CURSO') {
      renderizarReconexion(main, estado, acciones.lobby);
    } else {
      renderizarEntradaEspectador(main, estado, acciones.lobby);
    }
    return;
  }

  if (fase === 'LOBBY') {
    renderizarLobby(main, estado, acciones.lobby);
    return;
  }

  if (fase === 'EN_CURSO') {
    renderizarMesa(main, estado, acciones.mesa);
    return;
  }

  if (fase === 'FINALIZADA' && vista !== null) {
    const wrap = document.createElement('div');
    wrap.className = 'pantalla-fin';
    if (vista.ultimoShowdownResuelto !== null) {
      const sd = document.createElement('div');
      sd.className = 'pantalla-fin__showdown';
      renderizarShowdownResuelto(sd, vista);
      wrap.appendChild(sd);
    }
    const res = document.createElement('div');
    res.className = 'pantalla-fin__resultado';
    renderizarResultado(res, vista, acciones.mesa);
    wrap.appendChild(res);
    main.appendChild(wrap);
    return;
  }

  main.innerHTML = `
    <section class="resultado">
      <h2 class="resultado__titulo">El golpe ha terminado</h2>
    </section>`;
}
