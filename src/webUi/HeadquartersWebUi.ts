import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { GameSceneType } from '../scenes';

const entries = [
  ['TREASURY', 'BALANCES, ITEMS AND HISTORY', 'VAULT', GameSceneType.MainTreasury],
  ['CAMPAIGNS', 'EVENTS, OPERATIONS AND REWARDS', 'MEDAL', GameSceneType.MainEvents],
  ['STAKING', 'LOCK BATC, EARN SP AND PERKS', 'LOCK', GameSceneType.MainStaking],
  ['TRADING', 'RAYDIUM SWAPS AND MARKET BOOSTS', 'SWAP', GameSceneType.MainTrading],
  ['BOOSTS', 'ACTIVE TRAIT BOOSTS AND PERKS', 'BOOST', GameSceneType.MainBoost],
  ['AIRDROP', 'TRACK BATC ALLOCATION AND CLAIM STATUS', 'DROP', GameSceneType.MainAirdrop],
  ['FIELD MANUAL', 'TANKS, WEAPONS, POWERUPS AND ENEMY INTELLIGENCE', 'INTEL', GameSceneType.MainWiki],
] as const;

export class HeadquartersWebUi {
  private active = false;
  private abortController: AbortController = null;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;

  public constructor(private readonly navigator: SceneNavigator, private readonly input: InputManager) {}
  public isActive(): boolean { return this.active; }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) throw new Error('Headquarters web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'headquarters-web-active');
    host.hidden = false;
    this.render();
    this.buttons.find((button) => button.dataset.hqEntry === '0')?.focus({ preventScroll: true });
  }
  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'headquarters-web-active');
  }
  public update(): void {
    if (!this.active) return;
    const input = this.input.getActiveMethod();
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.move(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext)) this.move(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev)) this.move(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext)) this.move(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }
  private render(): void {
    this.host.innerHTML = `<main class="operations-web"><header class="operations-web__header"><div><span class="operations-web__header-mark">HQ</span><h1>HEADQUARTERS</h1></div><button class="operations-web__back" data-hq-back>← BACK</button></header><section class="operations-web__shell"><section class="operations-web__intro"><h2>COMMAND CENTER</h2><p>MANAGE YOUR ASSETS, OPERATIONS, REWARDS AND BATTLE INTELLIGENCE.</p></section><h2 class="operations-web__section-title">OPERATIONS</h2><section class="operations-web__grid operations-web__grid--hq">${entries.map((entry, index) => `<button class="operations-web__card" data-hq-entry="${index}"><h3>${entry[0]}</h3><span class="operations-web__mark">${entry[2]}</span><p>${entry[1]}</p><strong>OPEN</strong></button>`).join('')}</section></section></main>`;
    this.bind();
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) => button.addEventListener('focus', () => this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button)), { signal }));
    this.host.querySelector('[data-hq-back]')?.addEventListener('click', () => this.navigator.back(), { signal });
    this.host.querySelectorAll<HTMLButtonElement>('[data-hq-entry]').forEach((button) => button.addEventListener('click', () => this.navigator.push(entries[Number(button.dataset.hqEntry)][3]), { signal }));
  }
  private focused(): HTMLButtonElement | null { return document.activeElement instanceof HTMLButtonElement && this.buttons.includes(document.activeElement) ? document.activeElement : null; }
  private move(x: number, y: number): void { moveFocus(this.buttons, this.focused() || this.buttons[0], x, y); }
}

export function moveFocus(buttons: HTMLButtonElement[], current: HTMLButtonElement, x: number, y: number): void {
  if (!current) return;
  const origin = current.getBoundingClientRect();
  const next = buttons.filter((button) => button !== current && !button.disabled).map((button) => ({ button, rect: button.getBoundingClientRect() })).filter(({ rect }) => x < 0 ? rect.right <= origin.left + 2 : x > 0 ? rect.left >= origin.right - 2 : y < 0 ? rect.bottom <= origin.top + 2 : rect.top >= origin.bottom - 2).sort((left, right) => {
    const score = (rect: DOMRect) => (x ? Math.abs(rect.left - origin.left) : Math.abs(rect.top - origin.top)) * 4 + (x ? Math.abs(rect.top - origin.top) : Math.abs(rect.left - origin.left));
    return score(left.rect) - score(right.rect);
  })[0]?.button;
  next?.focus({ preventScroll: true });
  next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
