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

export function applyScreenTransition(host: HTMLElement): void {
  const isReturning = document.documentElement.hasAttribute(
    RETURN_TRANSITION_ATTRIBUTE,
  );
  if (isReturning) {
    document.documentElement.removeAttribute(RETURN_TRANSITION_ATTRIBUTE);
  }
  host.dataset.backNavigationPending = '';
  const screen = host.firstElementChild;
  if (!(screen instanceof HTMLElement)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const transitionClass = isReturning
    ? 'web-ui-screen--returning'
    : 'web-ui-screen--entering';
  screen.classList.add(transitionClass);
  const handleAnimationEnd = (event: AnimationEvent): void => {
    if (event.target !== screen) return;
    screen.classList.remove(transitionClass);
    screen.removeEventListener('animationend', handleAnimationEnd);
  };
  screen.addEventListener('animationend', handleAnimationEnd);
}
