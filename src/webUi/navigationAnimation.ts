import { SceneNavigator } from '../core';

const BACK_TRANSITION_MS = 200;
const RETURN_TRANSITION_ATTRIBUTE = 'data-web-ui-returning';

export function animateBackNavigation(host: HTMLElement, navigator: SceneNavigator): void {
  if (host.dataset.backNavigationPending === 'true') return;

  const screen = host.firstElementChild;
  if (!(screen instanceof HTMLElement)) {
    navigator.back();
    return;
  }

  host.dataset.backNavigationPending = 'true';
  screen.classList.add('web-ui-screen--leaving');
  host.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = true;
  });

  const complete = (): void => {
    document.documentElement.setAttribute(RETURN_TRANSITION_ATTRIBUTE, 'true');
    window.setTimeout(
      () => document.documentElement.removeAttribute(RETURN_TRANSITION_ATTRIBUTE),
      1000,
    );
    navigator.back();
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    complete();
    return;
  }

  window.setTimeout(complete, BACK_TRANSITION_MS);
}

export function applyReturnScreenTransition(host: HTMLElement): void {
  if (!document.documentElement.hasAttribute(RETURN_TRANSITION_ATTRIBUTE)) return;

  document.documentElement.removeAttribute(RETURN_TRANSITION_ATTRIBUTE);
  host.dataset.backNavigationPending = '';
  const screen = host.firstElementChild;
  if (!(screen instanceof HTMLElement)) return;

  screen.classList.add('web-ui-screen--returning');
  screen.addEventListener(
    'animationend',
    () => screen.classList.remove('web-ui-screen--returning'),
    { once: true },
  );
}
