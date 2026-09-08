import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { apiFetch } from '../network/api';
import { GameSceneType } from '../scenes';

import { animateBackNavigation } from './navigationAnimation';

interface RewardTier {
  amount: number;
  fromRank: number;
  toRank: number;
}

interface RewardRow {
  displayName: string;
  playerId: string;
  rank: number;
  totalPoints: number;
}

interface RewardsLeaderboardResponse {
  enabled: boolean;
  nextRewardAt: string | null;
  rewardIntervalMinutes: number;
  rows: RewardRow[];
  tiers: RewardTier[];
}

const FALLBACK_TIERS: RewardTier[] = [
  { fromRank: 1, toRank: 1, amount: 1000 },
  { fromRank: 2, toRank: 2, amount: 750 },
  { fromRank: 3, toRank: 3, amount: 500 },
  { fromRank: 4, toRank: 10, amount: 250 },
];

export class RewardsLeaderboardWebUi {
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private data: RewardsLeaderboardResponse | null = null;
  private host: HTMLElement = null;
  private lastFocusKey = 'back';
  private loading = false;
  private timerId: number | null = null;

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
    if (!(host instanceof HTMLElement)) {
      throw new Error('Rewards leaderboard web UI host is missing.');
    }
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'rewards-leaderboard-active');
    host.hidden = false;
    this.render();
    this.timerId = window.setInterval(() => this.syncCountdown(), 1000);
    void this.load();
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'rewards-leaderboard-active');
  }

  public update(): void {
    if (!this.active) return;
    const input = this.inputManager.getActiveMethod();
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext)) this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev)) this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext)) this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
    else if (input.isDownAny(MenuInputContext.Back)) {
      this.host.querySelector<HTMLButtonElement>('[data-ui-back]')?.click();
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.render();
    try {
      const response = await apiFetch('/api/leaderboard/rewards');
      if (!response.ok) throw new Error('Rewards leaderboard is unavailable.');
      const body = await response.json();
      if (!Array.isArray(body?.rows) || !Array.isArray(body?.tiers)) {
        throw new Error('Rewards leaderboard response is invalid.');
      }
      this.data = body as RewardsLeaderboardResponse;
    } catch {
      this.data = null;
    } finally {
      if (!this.active) return;
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    if (!this.host) return;
    const tiers = this.data?.tiers?.length ? this.data.tiers : FALLBACK_TIERS;
    const rows = this.data?.rows || [];
    const enabled = this.data?.enabled === true;
    const state = this.loading
      ? 'LOADING LIVE RANKS...'
      : enabled
      ? 'TOP 10 · EVERY 30 MINUTES'
      : 'REWARDS ARMING · WALLET LOGIN REQUIRED';

    this.host.innerHTML = `<main class="rewards-leaderboard-web" data-ui-page><header class="rewards-leaderboard-web__nav" data-ui-nav><div class="rewards-leaderboard-web__title"><img src="/assets/headquarters/campaigns-medal.png" alt="" aria-hidden="true"><div><span>LIVE COMPETITION</span><h1>REWARDS LEADERBOARD</h1></div></div><span data-ui-spacer aria-hidden="true"></span><button type="button" data-ui-back data-rewards-key="back">◀ BACK</button></header><section class="rewards-leaderboard-web__layout"><section class="rewards-leaderboard-web__briefing"><img class="rewards-leaderboard-web__banner" src="/assets/rewards-leaderboard-banner.png" alt="Battle Cities battlefield"><section class="rewards-leaderboard-web__rewards"><div class="rewards-leaderboard-web__round"><div><span>LIVE REWARDS</span><strong>${state}</strong></div><output data-rewards-countdown>${this.countdownText()}</output></div><div class="rewards-leaderboard-web__tiers">${tiers.map((tier) => `<article class="rewards-leaderboard-web__tier rewards-leaderboard-web__tier--${tier.fromRank}"><span>${this.rankLabel(tier)}</span><strong>${this.formatBatc(tier.amount)}</strong><small>BATC</small></article>`).join('')}</div><section class="rewards-leaderboard-web__how"><h2>HOW IT WORKS</h2><ol><li><b>1</b><span>Play battles and earn points.</span></li><li><b>2</b><span>Finish in the top 10 at the round close.</span></li><li><b>3</b><span>BATC is sent automatically to your linked wallet.</span></li></ol></section></section></section><section class="rewards-leaderboard-web__board" aria-live="polite"><header><div><span>TOP 10</span><h2>THIS ROUND</h2></div><p>${enabled ? 'LIVE' : 'SETUP'}</p></header><div class="rewards-leaderboard-web__table-head"><span>#</span><span>PLAYER</span><span>SCORE</span><span>REWARD</span></div><div class="rewards-leaderboard-web__rows">${this.rowsMarkup(rows, tiers)}</div><footer><img src="/data/graphics/shop/icons/token-bact.png" alt=""><div><strong>BATC REWARDS</strong><span>Play. Earn. Climb the leaderboard.</span></div></footer></section></section></main>`;
    this.bind();
  }

  private rowsMarkup(rows: RewardRow[], tiers: RewardTier[]): string {
    if (this.loading) return '<p class="rewards-leaderboard-web__empty">SYNCING BATTLE SCORES...</p>';
    if (rows.length === 0) return '<p class="rewards-leaderboard-web__empty">NO SCORES YET — PLAY A BATTLE TO ENTER THE NEXT REWARD ROUND.</p>';
    return rows.slice(0, 10).map((row) => `<button type="button" data-rewards-key="player-${row.playerId}" data-rewards-player="${row.playerId}" class="rewards-leaderboard-web__row rank-${Math.min(row.rank, 4)}"><strong>${row.rank}</strong><span>${this.escape(row.displayName)}</span><b>${row.totalPoints.toLocaleString()}</b><em>${this.formatBatc(this.rewardForRank(row.rank, tiers))}</em></button>`).join('');
  }

  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) => {
      button.addEventListener('pointerdown', () => button.focus({ preventScroll: true }), { signal });
      button.addEventListener('focus', () => {
        this.lastFocusKey = button.dataset.rewardsKey || this.lastFocusKey;
        this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
      }, { signal });
    });
    this.host.querySelector<HTMLButtonElement>('[data-ui-back]')?.addEventListener('click', () => animateBackNavigation(this.host, this.navigator), { signal });
    this.host.querySelectorAll<HTMLButtonElement>('[data-rewards-player]').forEach((button) => button.addEventListener('click', () => this.navigator.push(GameSceneType.MainPlayerProfile, { playerId: button.dataset.rewardsPlayer }), { signal }));
    this.host.querySelector<HTMLButtonElement>(`[data-rewards-key="${this.lastFocusKey}"]`)?.focus({ preventScroll: true });
  }

  private syncCountdown(): void {
    const countdown = this.host?.querySelector<HTMLOutputElement>('[data-rewards-countdown]');
    if (countdown && countdown.textContent !== this.countdownText()) countdown.textContent = this.countdownText();
  }

  private countdownText(): string {
    const at = this.data?.nextRewardAt ? Date.parse(this.data.nextRewardAt) : NaN;
    if (!Number.isFinite(at) || this.data?.enabled !== true) return 'REWARDS ARMING';
    const seconds = Math.max(0, Math.floor((at - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    return `NEXT REWARD IN ${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  private rewardForRank(rank: number, tiers: RewardTier[]): number {
    return tiers.find((tier) => rank >= tier.fromRank && rank <= tier.toRank)?.amount || 0;
  }

  private rankLabel(tier: RewardTier): string {
    return tier.fromRank === tier.toRank ? `${tier.fromRank}${tier.fromRank === 1 ? 'ST' : tier.fromRank === 2 ? 'ND' : 'RD'}` : `${tier.fromRank}TH–${tier.toRank}TH`;
  }

  private formatBatc(amount: number): string { return amount > 0 ? amount.toLocaleString() : '—'; }
  private escape(value: string): string { return String(value || 'PLAYER').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
  private focused(): HTMLButtonElement | null { return document.activeElement instanceof HTMLButtonElement && this.buttons.includes(document.activeElement) ? document.activeElement : null; }
  private moveFocus(horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1): void {
    const current = this.focused() || this.buttons[0];
    if (!current) return;
    const currentRect = current.getBoundingClientRect();
    const next = this.buttons.filter((button) => button !== current).map((button) => ({ button, rect: button.getBoundingClientRect() })).filter(({ rect }) => horizontal < 0 ? rect.right <= currentRect.left + 2 : horizontal > 0 ? rect.left >= currentRect.right - 2 : vertical < 0 ? rect.bottom <= currentRect.top + 2 : rect.top >= currentRect.bottom - 2).sort((a, b) => horizontal !== 0 ? Math.abs(a.rect.left - currentRect.left) - Math.abs(b.rect.left - currentRect.left) : Math.abs(a.rect.top - currentRect.top) - Math.abs(b.rect.top - currentRect.top))[0]?.button;
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
