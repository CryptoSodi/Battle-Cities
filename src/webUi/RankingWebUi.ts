import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { RankingClient, RankingResponse, RankingScope } from '../ranking';
import { GameSceneType } from '../scenes';
import { animateBackNavigation } from './navigationAnimation';

export class RankingWebUi {
  private readonly client = new RankingClient();
  private abortController: AbortController = null;
  private active = false;
  private data: RankingResponse = null;
  private host: HTMLElement = null;
  private loading = false;
  private lastFocusKey = 'scope-gaming';
  private scope: RankingScope = 'gaming';
  private seasonId: string | null = null;
  private seasonMenuOpen = false;
  private pendingFocusSelector: string | null = null;

  private buttons: HTMLButtonElement[] = [];
  public constructor(
    private readonly navigator: SceneNavigator,
    private readonly inputManager: InputManager,
  ) {}
  public isActive(): boolean {
    return this.active;
  }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement))
      throw new Error('Ranking web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'ranking-web-active');
    host.hidden = false;
    this.render();
    void this.load();
  }
  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'ranking-web-active');
  }
  public update(): void {
    if (!this.active) return;
    const input = this.inputManager.getActiveMethod();
    if (this.seasonMenuOpen && input.isDownAny(MenuInputContext.VerticalPrev))
      this.moveSeasonFocus(-1);
    else if (
      this.seasonMenuOpen &&
      input.isDownAny(MenuInputContext.VerticalNext)
    )
      this.moveSeasonFocus(1);
    else if (input.isDownAny(MenuInputContext.HorizontalPrev))
      this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext))
      this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev))
      this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext))
      this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }
  private async load(): Promise<void> {
    this.loading = true;
    this.render();
    const data = await this.client.getRankings(this.scope, this.seasonId);
    if (!this.active) return;
    this.data = data;
    this.loading = false;
    this.render();
  }
  private render(): void {
    if (!this.host) return;
    const me = this.data?.me;
    const seasons = this.data
      ? [
          { id: '', label: 'CURRENT' },
          { id: null, label: 'ALL TIME' },
          ...this.data.seasons.map((season) => ({
            id: season.id,
            label: season.name.toUpperCase(),
          })),
        ]
      : [
          { id: '', label: 'CURRENT' },
          { id: null, label: 'ALL TIME' },
        ];
    this.host.innerHTML = `<main class="ranking-web"><nav class="ranking-web__tabs"><button data-rank-key="scope-gaming" data-rank-scope="gaming" class="${
      this.scope === 'gaming' ? 'is-active' : ''
    }">GAMING</button><button data-rank-key="scope-trading" data-rank-scope="trading" class="${
      this.scope === 'trading' ? 'is-active' : ''
    }">TRADING</button><span></span><button data-rank-key="back" data-rank-back class="ranking-web__back">◀ BACK</button></nav><section class="ranking-web__shell"><section class="ranking-web__summary"><div><span>GAMING RANK (S${this
      .data?.currentSeason.number ?? '-'})</span><strong>${
      me?.guest
        ? 'GUEST'
        : me?.rank
        ? `#${me.rank}  ${me.totalPoints} PTS`
        : '--'
    }</strong></div><div><span>TRADING RANK (ALL)</span><strong>${
      me?.guest ? 'LOG IN TO COMPETE' : '--'
    }</strong></div></section>${this.seasonPicker(
      seasons,
    )}<div class="ranking-web__header"><span>RANK</span><span>PLAYER</span><span>PERKS</span><span>POINTS</span></div><section class="ranking-web__rows">${
      this.loading
        ? '<p class="ranking-web__empty">LOADING RANKINGS...</p>'
        : this.data === null
        ? '<p class="ranking-web__empty">RANKINGS UNAVAILABLE. TRY AGAIN.</p>'
        : this.data.rows.length === 0
        ? '<p class="ranking-web__empty">NO RESULTS YET — PLAY A MATCH TO CLAIM A RANK.</p>'
        : this.data.rows
            .map(
              (row) =>
                `<button data-rank-key="player-${
                  row.playerId
                }" data-rank-player="${
                  row.playerId
                }" class="ranking-web__row rank-${Math.min(
                  row.rank,
                  4,
                )}"><strong>${
                  row.rank
                }</strong><span>${row.displayName.toUpperCase()}</span><em class="ranking-web__perks${
                  row.perks.length > 0 ? ' is-boosted' : ''
                }">${row.perks.length > 0 ? '' : '—'}</em><b>${
                  row.totalPoints
                }</b></button>`,
            )
            .join('')
    }</section></section></main>`;
    this.bind();
    const focusSelector =
      this.pendingFocusSelector || `[data-rank-key="${this.lastFocusKey}"]`;
    this.host
      .querySelector<HTMLButtonElement>(focusSelector)
      ?.focus({ preventScroll: true });
    this.pendingFocusSelector = null;
  }
  private seasonPicker(
    seasons: Array<{ id: string | null; label: string }>,
  ): string {
    const selected =
      seasons.find((season) => season.id === this.seasonId) || seasons[0];
    return `<div class="ranking-web__season-picker ${
      this.seasonMenuOpen ? 'is-open' : ''
    }"><button class="ranking-web__season" data-rank-key="season-toggle" data-rank-season-toggle aria-expanded="${
      this.seasonMenuOpen
    }" type="button"><span>SEASON: ${
      selected.label
    }</span><i aria-hidden="true">⌄</i></button>${
      this.seasonMenuOpen
        ? `<div class="ranking-web__season-options" role="listbox">${seasons
            .map(
              (season) =>
                `<button data-rank-key="season-${season.id ??
                  'all'}" data-rank-season-option="${season.id ??
                  'all'}" class="${
                  season.id === this.seasonId ? 'is-active' : ''
                }" role="option" aria-selected="${season.id ===
                  this.seasonId}" type="button">${season.label}</button>`,
            )
            .join('')}</div>`
        : ''
    }</div>`;
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) => {
      button.addEventListener(
        'pointerdown',
        () => button.focus({ preventScroll: true }),
        { signal },
      );
      button.addEventListener(
        'focus',
        () => {
          this.lastFocusKey = button.dataset.rankKey || this.lastFocusKey;
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
        },
        { signal },
      );
    });
    this.host
      .querySelector('[data-rank-back]')
      ?.addEventListener(
        'click',
        () => animateBackNavigation(this.host, this.navigator),
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-rank-scope]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            this.scope = button.dataset.rankScope as RankingScope;
            this.seasonId = null;
            this.seasonMenuOpen = false;
            void this.load();
          },
          { signal },
        ),
      );
    this.host
      .querySelector<HTMLButtonElement>('[data-rank-season-toggle]')
      ?.addEventListener(
        'click',
        () => {
          this.seasonMenuOpen = !this.seasonMenuOpen;
          this.pendingFocusSelector = this.seasonMenuOpen
            ? '[data-rank-season-option].is-active'
            : '[data-rank-season-toggle]';
          this.render();
        },
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-rank-season-option]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            const value = button.dataset.rankSeasonOption || 'all';
            this.seasonId = value === 'all' ? null : value;
            this.seasonMenuOpen = false;
            this.pendingFocusSelector = '[data-rank-season-toggle]';
            void this.load();
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-rank-player]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () =>
            this.navigator.push(GameSceneType.MainPlayerProfile, {
              playerId: button.dataset.rankPlayer,
            }),
          { signal },
        ),
      );
  }
  private focused(): HTMLButtonElement | null {
    return document.activeElement instanceof HTMLButtonElement &&
      this.buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
  }
  private moveSeasonFocus(direction: -1 | 1): void {
    const options = this.buttons.filter(
      (button) => button.dataset.rankSeasonOption !== undefined,
    );
    const current = this.focused();
    const index = current === null ? -1 : options.indexOf(current);
    if (index < 0) {
      options
        .find((button) => button.classList.contains('is-active'))
        ?.focus({
          preventScroll: true,
        });
      return;
    }
    if (direction < 0 && index === 0) {
      this.host
        .querySelector<HTMLButtonElement>('[data-rank-season-toggle]')
        ?.focus({ preventScroll: true });
      return;
    }
    options[
      Math.max(0, Math.min(options.length - 1, index + direction))
    ]?.focus({
      preventScroll: true,
    });
  }
  private moveFocus(horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1): void {
    const current = this.focused() || this.buttons[0];
    if (current === undefined) return;
    const currentRect = current.getBoundingClientRect();
    const next = this.buttons
      .filter((button) => button !== current)
      .map((button) => ({ button, rect: button.getBoundingClientRect() }))
      .filter(({ rect }) =>
        horizontal < 0
          ? rect.right <= currentRect.left + 2
          : horizontal > 0
          ? rect.left >= currentRect.right - 2
          : vertical < 0
          ? rect.bottom <= currentRect.top + 2
          : rect.top >= currentRect.bottom - 2,
      )
      .sort((a, b) => {
        const axis = (rect: DOMRect): number =>
          horizontal !== 0
            ? Math.abs(rect.left - currentRect.left)
            : Math.abs(rect.top - currentRect.top);
        return axis(a.rect) - axis(b.rect);
      })[0]?.button;
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
