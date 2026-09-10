import { isPsg1Ui } from './deviceUi';

/** Skin the existing live controls without changing their actions or focus order. */
export function decoratePsg1Console(host: HTMLElement): void {
  if (!isPsg1Ui()) return;
  const root = host.querySelector('main');
  if (!root) return;
  root.classList.add('psg1-console');
  root
    .querySelectorAll(
      '.operations-web__card, .ranking-web__summary > div, .hq-page-web__heading, .hq-page-web__stat, .hq-page-web__item, .hq-page-web__card, .hq-page-web__manual-card, .hq-page-web__table, .hq-page-web__empty',
    )
    .forEach((panel) => panel.classList.add('psg1-console-frame'));
  if (root.classList.contains('hq-page-web')) {
    const shell = root.querySelector('.hq-page-web__shell');
    const heading = root.querySelector(
      '.hq-page-web__content > .hq-page-web__heading',
    );
    if (shell && heading) shell.prepend(heading);
  }
  const title = root.querySelector(
    '.headquarters-web__header h1, .operations-web__header h1',
  );
  if (title && root.classList.contains('headquarters-web'))
    title.textContent = 'QUATERS';
}
