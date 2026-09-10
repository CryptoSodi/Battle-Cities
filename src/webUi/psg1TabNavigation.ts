import { MenuInputContext } from '../input';
import { isPsg1Ui } from './deviceUi';

/** Shoulder shortcuts only activate view tabs/filters, never purchase or Back actions. */
export function handlePsg1TabNavigation(
  host: HTMLElement,
  input: { isDownAny(controls: number[]): boolean },
  home = false,
): boolean {
  if (!isPsg1Ui()) return false;
  const previous = input.isDownAny(MenuInputContext.PreviousTab);
  const next = input.isDownAny(MenuInputContext.NextTab);
  if (!previous && !next) return false;
  const focused = document.activeElement;
  if (
    host.querySelector('dialog[open], [role="listbox"]') ||
    (focused instanceof HTMLElement && focused.matches('input, textarea, select, [contenteditable="true"]'))
  ) return true;
  if (previous && next) return true;

  const rowSelector = home ? '.android-home-tabs' : '[data-ui-nav], .shop-web__filters';
  const focusedRow = focused instanceof HTMLElement ? focused.closest(rowSelector) : null;
  const row = focusedRow && host.contains(focusedRow) ? focusedRow : host.querySelector(home ? rowSelector : '[data-ui-nav]');
  if (!row) return true;
  const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>(
    'button[data-ui-tab], button[data-shop-filter], button[data-reward-tab-button]',
  )).filter(button => !button.disabled && button.getClientRects().length > 0);
  if (buttons.length < 2) return true;
  const focusedIndex = buttons.indexOf(focused as HTMLButtonElement);
  const activeIndex = buttons.findIndex(button => button.matches('.is-active, [aria-selected="true"], [aria-current="page"]'));
  const index = focusedIndex >= 0 ? focusedIndex : Math.max(0, activeIndex);
  const target = buttons[(index + (previous ? -1 : 1) + buttons.length) % buttons.length];
  // Home shortcuts preserve START/card focus; subpage rerenders restore this tab.
  if (!home || focusedIndex >= 0) target.focus({ preventScroll: true });
  target.click();
  return true;
}
