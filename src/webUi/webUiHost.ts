/** Subpages mount in the desktop monitor; native/compact layouts stay full-screen. */
export function getWebUiHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-monitor-page]') ||
    document.querySelector<HTMLElement>('[data-web-ui]');
}

export function isDesktopConsole(): boolean {
  return document.documentElement.dataset.uiPlatform === 'web' &&
    document.documentElement.dataset.uiDevice !== 'psg1';
}

/** Visual presentation only. Never use this to select physical input bindings. */
export function isConsoleScreenUi(): boolean {
  return document.documentElement.dataset.uiDevice === 'psg1' ||
    document.body.classList.contains('web-monitor-active');
}
