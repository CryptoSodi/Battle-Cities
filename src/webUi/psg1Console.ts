import { isPsg1Ui } from './deviceUi';

/** Skin the existing live controls without changing their actions or focus order. */
export function decoratePsg1Console(host: HTMLElement): void {
  if (!isPsg1Ui()) return;
  const root = host.querySelector('main');
  if (!root) return;
  root.classList.add('psg1-console');
  root
    .querySelectorAll('.operations-web__card, .ranking-web__summary > div')
    .forEach((panel) => panel.classList.add('psg1-console-frame'));
  const title = root.querySelector(
    '.headquarters-web__header h1, .operations-web__header h1',
  );
  if (title && root.classList.contains('headquarters-web'))
    title.textContent = 'QUATERS';
}
