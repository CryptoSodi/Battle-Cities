import { InputManager, MenuInputContext } from '../input';

export interface ResultsWebUiPlayer {
  bonus: number;
  isPrimary: boolean;
  kills: number[];
  name: string;
  rank: number;
  totalKills: number;
  totalPoints: number;
}

export interface ResultsWebUiState {
  battleTime: string;
  defeated: number;
  enemyTotal: number;
  highscore: number;
  mvp: string;
  players: ResultsWebUiPlayer[];
  result: 'perfect' | 'clear' | 'failed';
  stage: number;
  status: string;
  timer: string;
  totalKills: number;
}

export interface ResultsWebUiController {
  advanceResultsFromWebUi(deltaTime: number): void;
  continueFromWebUi(): void;
  getResultsWebUiState(): ResultsWebUiState | null;
  shareResultsFromWebUi(): Promise<void>;
}

interface ResultsWebUiOptions {
  getController: () => ResultsWebUiController;
  inputManager: InputManager;
}

const TIER_LABELS = ['I', 'II', 'III', 'IV'];

export class ResultsWebUi {
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private lastFocusKey = 'continue';
  private rendered = false;

  public constructor(private readonly options: ResultsWebUiOptions) {}

  public isActive(): boolean {
    return this.active;
  }

  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Results web UI host is missing.');
    }
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'results-web-active');
    host.hidden = false;
    this.render();
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    this.rendered = false;
    document.body.classList.remove('web-ui-active', 'results-web-active');
  }

  public update(deltaTime: number): void {
    if (!this.active) return;
    const controller = this.options.getController();
    controller.advanceResultsFromWebUi(deltaTime);
    if (!this.active) return;

    const state = controller.getResultsWebUiState();
    if (state === null) return;
    if (!this.rendered) this.render(state);
    else this.syncState(state);

    const input = this.options.inputManager.getActiveMethod();
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext))
      this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev))
      this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext))
      this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }

  private render(state: ResultsWebUiState | null = null): void {
    if (!this.host) return;
    if (state === null) {
      this.host.innerHTML = `<main class="results-web results-web--loading"><p>PROCESSING BATTLE REPORT...</p></main>`;
      return;
    }

    const resultLabel =
      state.result === 'perfect'
        ? 'PERFECT CLEAR'
        : state.result === 'clear'
        ? 'STAGE CLEAR'
        : 'MISSION FAILED';
    this.host.innerHTML = `<main class="results-web results-web--${
      state.result
    }"><header class="results-web__header"><div class="results-web__title"><span>AFTER ACTION REPORT</span><h1>STAGE ${
      state.stage
    } RESULTS</h1></div><div class="results-web__headline-stats"><div><span>HI-SCORE</span><strong>${
      state.highscore
    }</strong></div><div><span>ENEMIES</span><strong>${state.defeated} / ${
      state.enemyTotal
    }</strong></div><div><span>BATTLE TIME</span><strong>${
      state.battleTime
    }</strong></div></div><button class="results-web__continue is-active" data-results-key="continue" data-results-continue type="button">CONTINUE</button></header><section class="results-web__shell"><section class="results-web__status-strip"><div><span>MISSION STATUS</span><strong>${resultLabel}</strong></div><output data-results-timer>${
      state.timer
    }</output></section><div class="results-web__table-head"><span>RANK</span><span>PLAYER</span>${TIER_LABELS.map(
      (label, index) =>
        `<span class="results-web__tier-head"><i class="results-web__tank-icon results-web__tank-icon--${index}" aria-hidden="true"></i><small>TIER ${label}</small></span>`,
    ).join(
      '',
    )}<span>BONUS</span><span>TOTAL</span></div><section class="results-web__players">${state.players
      .map((player) => this.playerRow(player))
      .join(
        '',
      )}</section><footer class="results-web__footer"><div><span>TANKS DESTROYED</span><strong>${
      state.totalKills
    }</strong></div><div><span>BATTLE TIME</span><strong>${
      state.battleTime
    }</strong></div><div><span>MVP</span><strong>${
      state.mvp
    }</strong></div></footer><div class="results-web__actions"><p data-results-status aria-live="polite">${
      state.status
    }</p><button class="results-web__share" data-results-key="share" data-results-share type="button">SHARE RESULTS</button></div></section></main>`;
    this.rendered = true;
    this.bind();
    (
      this.host.querySelector<HTMLButtonElement>(
        `[data-results-key="${this.lastFocusKey}"]`,
      ) || this.buttons[0]
    )?.focus({ preventScroll: true });
  }

  private playerRow(player: ResultsWebUiPlayer): string {
    return `<article class="results-web__player ${
      player.isPrimary ? 'is-primary' : ''
    }"><strong class="results-web__rank">#${
      player.rank
    }</strong><div class="results-web__player-name"><strong>${
      player.name
    }</strong>${
      player.isPrimary ? '<small>YOU</small>' : ''
    }</div>${player.kills
      .map(
        (kills, index) =>
          `<div class="results-web__tier"><i class="results-web__tank-icon results-web__tank-icon--${index}" aria-hidden="true"></i><small>TIER ${TIER_LABELS[index]}</small><strong>${kills}</strong></div>`,
      )
      .join('')}<div class="results-web__bonus"><small>${
      player.bonus > 0 ? 'STAGE LEADER' : 'TOTAL KILLS'
    }</small><strong>${
      player.bonus > 0 ? `+${player.bonus}` : player.totalKills
    }</strong></div><strong class="results-web__points">${
      player.totalPoints
    }<small>PTS</small></strong></article>`;
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
          this.lastFocusKey = button.dataset.resultsKey || this.lastFocusKey;
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
        },
        { signal },
      );
    });
    this.host
      .querySelector('[data-results-continue]')
      ?.addEventListener(
        'click',
        () => this.options.getController().continueFromWebUi(),
        { signal },
      );
    this.host.querySelector('[data-results-share]')?.addEventListener(
      'click',
      () => {
        void this.options
          .getController()
          .shareResultsFromWebUi()
          .then(() => {
            if (this.active) {
              this.render(this.options.getController().getResultsWebUiState());
            }
          });
      },
      { signal },
    );
  }

  private syncState(state: ResultsWebUiState): void {
    const timer = this.host.querySelector<HTMLOutputElement>(
      '[data-results-timer]',
    );
    if (timer !== null && timer.textContent !== state.timer) {
      timer.textContent = state.timer;
    }
    const status = this.host.querySelector<HTMLElement>(
      '[data-results-status]',
    );
    if (status !== null && status.textContent !== state.status) {
      status.textContent = state.status;
    }
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
