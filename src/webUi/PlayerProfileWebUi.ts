import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import {
  PlayerProfileClient,
  PlayerProfileRequestError,
  PublicProfile,
} from '../playerProfile';

export class PlayerProfileWebUi {
  private readonly client = new PlayerProfileClient();
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private loading = false;
  private profile: PublicProfile = null;
  private error = '';
  private page = 1;

  public constructor(
    private readonly navigator: SceneNavigator,
    private readonly input: InputManager,
    private readonly getPlayerId: () => string | null,
  ) {}

  public isActive(): boolean {
    return this.active;
  }

  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Player profile web UI host is missing.');
    }
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'player-profile-web-active');
    host.hidden = false;
    this.load(1);
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'player-profile-web-active');
  }

  public update(): void {
    if (!this.active) return;
    const input = this.input.getActiveMethod();
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext)) this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev)) this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext)) this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }

  private async load(page: number): Promise<void> {
    const playerId = this.getPlayerId();
    if (!playerId) {
      this.error = 'INVALID PLAYER PROFILE';
      this.profile = null;
      this.loading = false;
      this.render();
      return;
    }
    this.loading = true;
    this.error = '';
    this.render();
    try {
      const profile = await this.client.getProfile(playerId, page);
      if (!this.active) return;
      this.profile = profile;
      this.page = profile.recentMatchesPage.page;
    } catch (error) {
      if (!this.active) return;
      this.profile = null;
      this.error = error instanceof PlayerProfileRequestError && error.status === 404 ? 'PLAYER NOT FOUND' : 'PROFILE SERVICE UNAVAILABLE';
    } finally {
      if (!this.active) return;
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    if (!this.host) return;
    this.host.innerHTML = `<main class="player-profile-web"><header class="player-profile-web__header"><h1>PLAYER PROFILE</h1><button data-profile-back type="button">← BACK</button></header><section class="player-profile-web__shell">${this.loading ? '<p class="player-profile-web__state">LOADING PLAYER PROFILE...</p>' : this.profile ? this.content(this.profile) : `<section class="player-profile-web__error"><h2>${this.error || 'PROFILE UNAVAILABLE'}</h2><p>CHECK YOUR CONNECTION, THEN TRY AGAIN</p><button data-profile-retry type="button">RETRY</button></section>`}</section></main>`;
    this.bind();
  }

  private content(profile: PublicProfile): string {
    const totalPages = Math.max(1, Math.ceil(profile.recentMatchesPage.total / profile.recentMatchesPage.pageSize));
    return `<section class="player-profile-web__hero"><div class="player-profile-web__avatar">${this.avatar(profile)}</div><div class="player-profile-web__identity"><h2>${this.escape(profile.displayName || 'PLAYER')}</h2><p>${this.provider(profile.provider)} · JOINED ${this.date(profile.joinedAt)}</p><small>${this.escape(profile.walletAddress || profile.id)}</small></div><button data-profile-share type="button">SHARE PROFILE</button></section><section class="player-profile-web__stats">${this.stat('SEASON RANK', this.rank(profile.stats.currentSeason.rank), profile.stats.currentSeason.name, 'is-yellow')}${this.stat('GAME POINTS', this.number(profile.stats.allTime.totalPoints), 'ALL TIME', 'is-green')}${this.stat('MATCHES', this.number(profile.stats.allTime.matches), 'RECORDED RUNS', '')}${this.stat('BEST SCORE', this.number(profile.highscores.primary), 'PRIMARY MODE', 'is-yellow')}</section><section class="player-profile-web__battles"><header><h2>RECENT BATTLES</h2><span>${profile.recentMatchesPage.total} ${profile.recentMatchesPage.total === 1 ? 'RECORD' : 'RECORDS'}</span></header>${profile.recentMatches.length ? `<div class="player-profile-web__match-header"><span>RESULT</span><span>MODE</span><span>STAGE</span><span>SCORE</span><span>POINTS</span><span>REPLAY</span></div><div class="player-profile-web__matches">${profile.recentMatches.map((match) => `<button class="player-profile-web__match ${match.won ? 'is-won' : 'is-lost'}" data-profile-match="${this.escape(match.id)}" ${match.replayAvailable ? '' : 'disabled'}><strong>${match.won ? 'VICTORY' : 'DEFEAT'}</strong><span>${match.mode === 'multi' ? 'MULTI' : 'SINGLE'}</span><span>${match.levelNumber}</span><b>${this.number(match.score)}</b><b>${this.number(match.gamePoints)}</b><em>${match.replayAvailable ? 'WATCH' : 'UNAVAILABLE'}</em></button>`).join('')}</div>` : '<p class="player-profile-web__empty">NO RECORDED BATTLES YET</p>'}${totalPages > 1 ? `<nav class="player-profile-web__pages"><button data-profile-page="${this.page - 1}" ${this.page <= 1 ? 'disabled' : ''}>← PREVIOUS</button><span>PAGE ${this.page} / ${totalPages}</span><button data-profile-page="${this.page + 1}" ${this.page >= totalPages ? 'disabled' : ''}>NEXT →</button></nav>` : ''}</section>`;
  }

  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button:not(:disabled)'));
    this.buttons.forEach((button) => button.addEventListener('focus', () => {
      this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
    }, { signal }));
    this.host.querySelector('[data-profile-back]')?.addEventListener('click', () => this.navigator.back(), { signal });
    this.host.querySelector('[data-profile-retry]')?.addEventListener('click', () => void this.load(this.page), { signal });
    this.host.querySelector('[data-profile-share]')?.addEventListener('click', () => void this.share(), { signal });
    this.host.querySelectorAll<HTMLButtonElement>('[data-profile-page]').forEach((button) => button.addEventListener('click', () => void this.load(Number(button.dataset.profilePage)), { signal }));
    this.host.querySelectorAll<HTMLButtonElement>('[data-profile-match]').forEach((button) => button.addEventListener('click', () => this.openReplay(button.dataset.profileMatch || ''), { signal }));
  }

  private async share(): Promise<void> {
    if (!this.profile) return;
    const url = new URL('/player-profile/index.html', window.location.origin);
    url.searchParams.set('playerId', this.profile.id);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${this.profile.displayName} | Battle Cities`, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
      }
    } catch { /* user cancelled or sharing is unavailable */ }
  }

  private openReplay(matchId: string): void {
    const playerId = this.getPlayerId();
    if (!playerId || !matchId) return;
    const url = new URL('/', window.location.origin);
    url.searchParams.set('profileReplayPlayer', playerId);
    url.searchParams.set('profileReplayMatch', matchId);
    window.open(url.toString(), '_blank', 'noopener');
  }

  private stat(label: string, value: string, note: string, color: string): string {
    return `<article class="player-profile-web__stat ${color}"><span>${label}</span><strong>${value}</strong><small>${this.escape(note)}</small></article>`;
  }
  private avatar(profile: PublicProfile): string {
    return profile.avatarUrl && /^https:\/\//.test(profile.avatarUrl) ? `<img src="${this.escape(profile.avatarUrl)}" alt="">` : this.escape(profile.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'BC');
  }
  private number(value: number): string { return Math.max(0, Number(value) || 0).toLocaleString(); }
  private rank(value: number | null): string { return value ? `#${value}` : '--'; }
  private date(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'UNKNOWN' : date.toLocaleDateString(); }
  private provider(value: PublicProfile['provider']): string { return value === 'wallet' ? 'WALLET PLAYER' : value === 'google' ? 'GOOGLE PLAYER' : 'GUEST PLAYER'; }
  private escape(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
  private focused(): HTMLButtonElement | null { return document.activeElement instanceof HTMLButtonElement && this.buttons.includes(document.activeElement) ? document.activeElement : null; }
  private moveFocus(horizontal: number, vertical: number): void {
    const current = this.focused() || this.buttons[0];
    if (!current) return;
    const rect = current.getBoundingClientRect();
    const next = this.buttons.filter((button) => button !== current).map((button) => ({ button, rect: button.getBoundingClientRect() })).filter(({ rect: candidate }) => horizontal > 0 ? candidate.left >= rect.right - 2 : horizontal < 0 ? candidate.right <= rect.left + 2 : vertical > 0 ? candidate.top >= rect.bottom - 2 : candidate.bottom <= rect.top + 2).sort((left, right) => {
      const primary = (candidate: DOMRect) => horizontal ? Math.abs(candidate.left - rect.left) : Math.abs(candidate.top - rect.top);
      const cross = (candidate: DOMRect) => horizontal ? Math.abs(candidate.top - rect.top) : Math.abs(candidate.left - rect.left);
      return primary(left.rect) * 4 + cross(left.rect) - (primary(right.rect) * 4 + cross(right.rect));
    })[0]?.button;
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
