import { TITLE_IMAGE_URL } from './titleAssets';

export interface AccionesTitleScreen {
  entrarComoLadron(): void;
  entrarComoEspectador(): void;
}

/** HTML de la pantalla de título con dos rutas de entrada. */
export function htmlTitleScreen(): string {
  return `
    <section class="title-screen" aria-labelledby="title-screen-heading">
      <div class="title-screen__vignette" aria-hidden="true"></div>
      <div class="title-screen__hero">
        <img
          class="title-screen__image"
          src="${TITLE_IMAGE_URL}"
          alt=""
          width="960"
          height="540"
          decoding="async"
        />
      </div>
      <div class="title-screen__content">
        <div class="title-screen__subtitle-panel">
          <p id="title-screen-heading" class="title-screen__subtitle">
            El casino duerme. La Bóveda espera. Elige tu papel antes de cruzar la puerta del escondite.
          </p>
        </div>
        <div class="title-screen__actions">
          <button
            type="button"
            class="boton boton--title boton--title-ladron"
            data-accion="ENTRAR_LADRON"
          >
            <span class="title-screen__btn-label">Ladrón</span>
            <span class="title-screen__btn-hint">Entrar a la banda</span>
          </button>
          <button
            type="button"
            class="boton boton--title boton--title-espectador"
            data-accion="ENTRAR_ESPECTADOR"
          >
            <span class="title-screen__btn-label">Espectador</span>
            <span class="title-screen__btn-hint">Mirar desde las sombras</span>
          </button>
        </div>
      </div>
    </section>`;
}

/** Enlaza los CTAs de la pantalla de título. */
export function enlazarTitleScreen(
  contenedor: HTMLElement,
  acciones: AccionesTitleScreen,
): void {
  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="ENTRAR_LADRON"]')
    ?.addEventListener('click', () => {
      acciones.entrarComoLadron();
    });

  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="ENTRAR_ESPECTADOR"]')
    ?.addEventListener('click', () => {
      acciones.entrarComoEspectador();
    });
}
