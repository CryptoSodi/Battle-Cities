import { isConsoleScreenUi as isPsg1Ui } from './webUiHost';

const boundHosts = new WeakSet<HTMLElement>();
const cardSelector =
  '.shop-web__card, .shop-web__loadout-slot, .operations-web__card, .hq-page-web__card, .tank-select-web__card, .ranking-web__row';

/** Recompose an open screen at a layout boundary without resetting its UI state. */
export function bindUiLayoutRefresh(host: HTMLElement, signal: AbortSignal, render: () => void): void {
  let waitingForDialog = false;
  const selector = (element: Element): string => {
    const key = Array.from(element.attributes).find(attribute =>
      attribute.name.startsWith('data-') && !attribute.name.startsWith('data-ui-') && attribute.name !== 'data-web-ui',
    );
    if (key) return `[${key.name}="${CSS.escape(key.value)}"]`;
    if (element.id) return `#${CSS.escape(element.id)}`;
    return element.classList[0] ? `.${CSS.escape(element.classList[0])}` : '';
  };
  const refresh = (): void => {
    if (signal.aborted) return;
    const dialog = host.querySelector('dialog[open]');
    if (dialog) {
      if (!waitingForDialog) {
        waitingForDialog = true;
        dialog.addEventListener('close', () => { waitingForDialog = false; refresh(); }, { once: true, signal });
      }
      return;
    }
    const active = document.activeElement;
    const focusKey = active && host.contains(active) ? selector(active) : '';
    const fields = Array.from(host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="password"]):not([type="file"]), textarea, select'))
      .map(element => ({ key: selector(element), value: element.value }));
    const scroll = Array.from(host.querySelectorAll<HTMLElement>('*'))
      .filter(element => element.scrollTop || element.scrollLeft)
      .map(element => ({ key: selector(element), top: element.scrollTop, left: element.scrollLeft }));
    render();
    fields.forEach(({ key, value }) => {
      const field = key && host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(key);
      if (field) field.value = value;
    });
    scroll.forEach(({ key, top, left }) => {
      const element = key && host.querySelector<HTMLElement>(key);
      if (element) { element.scrollTop = top; element.scrollLeft = left; }
    });
    const target = focusKey && host.querySelector<HTMLElement>(focusKey);
    if (target && !target.matches(':disabled')) {
      target.focus({ preventScroll: true });
      if (isPsg1Ui()) revealFocusedControl(target);
    }
  };
  window.addEventListener('battlecities:ui-device', refresh, { signal });
}

/** Reveal a focused control without scrolling fixed/overflow-hidden UI shells. */
export function revealFocusedControl(control: HTMLElement): void {
  const card = control.closest<HTMLElement>(cardSelector);
  const host = control.closest('[data-monitor-page], [data-web-ui]');
  for (
    let parent = control.parentElement;
    parent && parent !== host;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const vertical =
      /^(auto|scroll)$/.test(style.overflowY) &&
      parent.scrollHeight > parent.clientHeight;
    const horizontal =
      /^(auto|scroll)$/.test(style.overflowX) &&
      parent.scrollWidth > parent.clientWidth;
    if (!vertical && !horizontal) continue;
    const bounds = parent.getBoundingClientRect();
    const top = bounds.top + parent.clientTop;
    const left = bounds.left + parent.clientLeft;
    const cardBounds =
      card && parent.contains(card) ? card.getBoundingClientRect() : null;
    const controlBounds = control.getBoundingClientRect();
    const targetY =
      cardBounds && cardBounds.height <= parent.clientHeight - 8
        ? cardBounds
        : controlBounds;
    const targetX =
      cardBounds && cardBounds.width <= parent.clientWidth - 8
        ? cardBounds
        : controlBounds;
    if (vertical) {
      // An oversized control is anchored at its top, not repeatedly bounced
      // between its two clipped edges. Normal controls get a small focus inset.
      const inset = targetY.height <= parent.clientHeight - 8 ? 4 : 0;
      const bottom = top + parent.clientHeight - inset;
      if (targetY.top < top + inset || targetY.height > parent.clientHeight)
        parent.scrollTop += targetY.top - top - inset;
      else if (targetY.bottom > bottom)
        parent.scrollTop += targetY.bottom - bottom;
    }
    if (horizontal) {
      const right = left + parent.clientWidth;
      if (targetX.left < left || targetX.width > parent.clientWidth)
        parent.scrollLeft += targetX.left - left;
      else if (targetX.right > right)
        parent.scrollLeft += targetX.right - right;
    }
  }
}

/** One delegated listener survives page rerenders and works with Tab or D-pad. */
export function bindPsg1FocusScroll(host: HTMLElement): void {
  if (boundHosts.has(host)) return;
  boundHosts.add(host);
  host.addEventListener('focusin', (event) => {
    if (isPsg1Ui() && event.target instanceof HTMLElement)
      revealFocusedControl(event.target);
  });
}
