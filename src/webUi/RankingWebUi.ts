import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { RankingClient, RankingResponse, RankingScope } from '../ranking';
import { GameSceneType } from '../scenes';

export class RankingWebUi {
  private readonly client = new RankingClient();
  private abortController: AbortController = null;
  private active = false;
  private data: RankingResponse = null;
  private host: HTMLElement = null;
  private loading = false;
  private scope: RankingScope = 'gaming';
  private seasonId: string | null = null;

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
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
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
    this.host.innerHTML = `<main class="ranking-web"><nav class="ranking-web__tabs"><button data-rank-scope="gaming" class="${
      this.scope === 'gaming' ? 'is-active' : ''
    }">GAMING</button><button data-rank-scope="trading" class="${
      this.scope === 'trading' ? 'is-active' : ''
    }">TRADING</button><span></span><button data-rank-back class="ranking-web__back">← BACK</button></nav><section class="ranking-web__shell"><section class="ranking-web__summary"><div><span>GAMING RANK (S${this
      .data?.currentSeason.number ?? '-'})</span><strong>${
      me?.guest
        ? 'GUEST'
        : me?.rank
        ? `#${me.rank}  ${me.totalPoints} PTS`
        : '--'
    }</strong></div><div><span>TRADING RANK (ALL)</span><strong>${
      me?.guest ? 'LOG IN TO COMPETE' : '--'
    }</strong></div></section><select class="ranking-web__season" data-rank-season aria-label="Season">${seasons
      .map(
        (season) =>
          `<option value="${season.id ?? 'all'}" ${
            season.id === this.seasonId ? 'selected' : ''
          }>SEASON: ${season.label}</option>`,
      )
      .join(
        '',
      )}</select><div class="ranking-web__header"><span>RANK</span><span>PLAYER</span><span>PERKS</span><span>POINTS</span></div><section class="ranking-web__rows">${
      this.loading
        ? '<p class="ranking-web__empty">LOADING RANKINGS...</p>'
        : this.data === null
        ? '<p class="ranking-web__empty">RANKINGS UNAVAILABLE. TRY AGAIN.</p>'
        : this.data.rows.length === 0
        ? '<p class="ranking-web__empty">NO RESULTS YET — PLAY A MATCH TO CLAIM A RANK.</p>'
        : this.data.rows
            .map(
              (row) =>
                `<button data-rank-player="${
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
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) =>
      button.addEventListener(
        'focus',
        () => {
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
        },
        { signal },
      ),
    );
    this.host
      .querySelector('[data-rank-back]')
      ?.addEventListener('click', () => this.navigator.back(), { signal });
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-rank-scope]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            this.scope = button.dataset.rankScope as RankingScope;
            this.seasonId = null;
            void this.load();
          },
          { signal },
        ),
      );
    this.host
      .querySelector<HTMLSelectElement>('[data-rank-season]')
      ?.addEventListener(
        'change',
        (event) => {
          const value = (event.target as HTMLSelectElement).value;
          this.seasonId = value === 'all' ? null : value;
          void this.load();
        },
        { signal },
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
