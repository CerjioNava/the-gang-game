/** Elementos DOM persistentes del marco de la aplicación (100vh, sin scroll). */
export interface ElementosShell {
  raiz: HTMLElement;
  hud: HTMLElement;
  alerta: HTMLElement;
  main: HTMLElement;
  footer: HTMLElement;
}

/** Monta el AppShell una sola vez dentro de `#app`. */
export function montarShell(raiz: HTMLElement): ElementosShell {
  raiz.className = 'app-shell';
  raiz.innerHTML = `
    <header class="app-shell__hud" id="app-hud" aria-label="Estado del escondite"></header>
    <div class="app-shell__alerta" id="app-alerta" role="alert" hidden></div>
    <main class="app-shell__main" id="app-main"></main>
    <footer class="app-shell__footer" id="app-footer"></footer>
  `;

  return {
    raiz,
    hud: raiz.querySelector<HTMLElement>('#app-hud')!,
    alerta: raiz.querySelector<HTMLElement>('#app-alerta')!,
    main: raiz.querySelector<HTMLElement>('#app-main')!,
    footer: raiz.querySelector<HTMLElement>('#app-footer')!,
  };
}
