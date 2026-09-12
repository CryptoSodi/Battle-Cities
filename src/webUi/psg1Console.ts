import { isConsoleScreenUi as isPsg1Ui } from './webUiHost';
import { bindPsg1FocusScroll } from './focusScroll';

/** Skin the existing live controls without changing their actions or focus order. */
export function decoratePsg1Console(host: HTMLElement): void {
  const root = host.querySelector('main');
  if (!root) return;
  if (!isPsg1Ui()) {
    if (document.documentElement.dataset.uiPlatform === 'android') decoratePageHeadingIcons(root);
    return;
  }
  bindPsg1FocusScroll(host);
  root.classList.add('psg1-console');
  root
    .querySelectorAll(
      '.operations-web__card, .ranking-web__summary > div, .hq-page-web__heading, .hq-page-web__stat, .hq-page-web__item, .hq-page-web__card, .hq-page-web__manual-card, .hq-page-web__table, .hq-page-web__empty, .tank-select-web__fuel, .tank-select-web__card, .results-web__title, .results-web__headline-stats, .results-web__status-strip, .results-web__player, .results-web__footer, .results-web--loading > p',
    )
    .forEach((panel) => panel.classList.add('psg1-console-frame'));
  root
    .querySelectorAll<HTMLElement>('.hq-page-web__manual-card[data-wiki-entry]')
    .forEach((card) => {
      card.tabIndex = 0;
      card.setAttribute(
        'aria-label',
        card.querySelector('h3')?.textContent?.trim() || 'Field manual entry',
      );
    });
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
    title.textContent = 'QUARTERS';
  decoratePageHeadingIcons(root);
}

/** Use the same page identity art as the main menu; headings remain plain labels. */
function decoratePageHeadingIcons(root: HTMLElement): void {
  const headings: Array<[string, string]> = [
    ['.headquarters-web .operations-web__header h1', 'headquater'],
    ['.socials-web .operations-web__header h1', 'social'],
    ['.ranking-web [data-rank-scope]', 'ranking'],
  ];
  headings.forEach(([selector, icon]) => root.querySelectorAll<HTMLElement>(selector).forEach(heading => {
    if (heading.querySelector('.ui-page-heading-icon')) return;
    heading.classList.add('ui-page-heading');
    const image = document.createElement('img');
    image.className = 'ui-page-heading-icon';
    image.src = `/assets/android-home-v2/${icon}.png`;
    image.alt = '';
    image.draggable = false;
    heading.prepend(image);
  }));
}
