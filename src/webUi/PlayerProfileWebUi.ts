import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import {
  PlayerProfileClient,
  PlayerProfileRequestError,
  PublicProfile,
} from '../playerProfile';
import { animateBackNavigation } from './navigationAnimation';

export class PlayerProfileWebUi {
  private readonly client = new PlayerProfileClient();
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private loading = false;
  private profile: PublicProfile = null;
  private error = '';
  private status = '';
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
    else if (input.isDownAny(MenuInputContext.Back))
      this.host.querySelector<HTMLButtonElement>('[data-ui-back]')?.click();
  }

  private async load(page: number): Promise<void> {
    const playerId = this.getPlayerId();
    if (!playerId) {
      this.error = 'INVALID PLAYER PROFILE';
      this.profile = null;
      this.loading = false;
      this.status = 'PROFILE ID INVALID';
      this.render();
      return;
    }
    this.loading = true;
    this.error = '';
    this.status = 'SYNCING PLAYER RECORD';
    this.render();
    try {
      const profile = await this.client.getProfile(playerId, page);
      if (!this.active) return;
      this.profile = profile;
      this.page = profile.recentMatchesPage.page;
      this.status = 'LIVE PLAYER RECORD LOADED';
    } catch (error) {
      if (!this.active) return;
      this.profile = null;
      this.error = error instanceof PlayerProfileRequestError && error.status === 404 ? 'PLAYER NOT FOUND' : 'PROFILE SERVICE UNAVAILABLE';
      this.status = 'PROFILE LINK OFFLINE';
    } finally {
      if (!this.active) return;
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    if (!this.host) return;
    const content = this.loading
      ? this.loadingMarkup()
      : this.profile
        ? this.content(this.profile)
        : `<section class="player-profile-web__error"><span>CONNECTION ERROR</span><h2>${this.error || 'PROFILE UNAVAILABLE'}</h2><p>CHECK YOUR CONNECTION, THEN TRY AGAIN.</p><button data-profile-retry type="button">RETRY CONNECTION</button></section>`;
    this.host.innerHTML = `<main class="player-profile-web" data-ui-page><header class="shop-web__tabs player-profile-web__header" data-ui-nav style="--ui-tab-count:1" aria-label="Player profile commands"><span class="shop-web__tab is-active" data-ui-tab aria-current="page"><h1>PLAYER PROFILE</h1></span><span data-ui-spacer aria-hidden="true"></span><button class="shop-web__back" data-ui-back data-profile-back type="button">◀ BACK</button></header><section class="player-profile-web__shell" aria-busy="${this.loading}"><div class="player-profile-web__content">${content}</div><p class="player-profile-web__status" data-profile-status role="status" aria-live="polite">${this.escape(this.status)}</p></section></main>`;
    this.bind();
  }

  private content(profile: PublicProfile): string {
    const totalPages = Math.max(1, Math.ceil(profile.recentMatchesPage.total / profile.recentMatchesPage.pageSize));
    const recordLabel = profile.recentMatchesPage.total === 1 ? 'RECORD' : 'RECORDS';
    return `<section class="player-profile-web__hero"><div class="player-profile-web__avatar">${this.avatar(profile)}</div><div class="player-profile-web__identity"><span>ACTIVE COMMANDER</span><h2>${this.escape(profile.displayName || 'PLAYER')}</h2><p>${this.provider(profile.provider)} <i aria-hidden="true">◆</i> JOINED ${this.date(profile.joinedAt)}</p><small>${this.escape(profile.walletAddress || profile.id)}</small></div><button class="player-profile-web__share" data-profile-share type="button"><span aria-hidden="true">↗</span> SHARE PROFILE</button></section><section class="player-profile-web__stats" aria-label="Player statistics">${this.stat('SEASON RANK', this.rank(profile.stats.currentSeason.rank), profile.stats.currentSeason.name, 'is-yellow')}${this.stat('GAME POINTS', this.number(profile.stats.allTime.totalPoints), 'ALL TIME', 'is-green')}${this.stat('MATCHES', this.number(profile.stats.allTime.matches), 'RECORDED RUNS', '')}${this.stat('BEST SCORE', this.number(profile.highscores.primary), 'PRIMARY MODE', 'is-yellow')}</section><section class="player-profile-web__battles"><header><div><span>BATTLE LOG</span><h2>RECENT BATTLES</h2></div><strong>${this.number(profile.recentMatchesPage.total)} ${recordLabel}</strong></header>${profile.recentMatches.length ? `<div class="player-profile-web__match-header" aria-hidden="true"><span>RESULT</span><span>MODE</span><span>STAGE</span><span>SCORE</span><span>POINTS</span><span>REPLAY</span></div><div class="player-profile-web__matches">${profile.recentMatches.map((match) => this.matchMarkup(match)).join('')}</div>` : '<section class="player-profile-web__empty"><strong>NO RECORDED BATTLES</strong><span>COMPLETED RUNS WILL BE LOGGED HERE.</span></section>'}${totalPages > 1 ? `<nav class="player-profile-web__pages" aria-label="Battle history pages"><button data-profile-page="${this.page - 1}" type="button" ${this.page <= 1 ? 'disabled' : ''}>◀ PREVIOUS</button><span>PAGE ${this.page} / ${totalPages}</span><button data-profile-page="${this.page + 1}" type="button" ${this.page >= totalPages ? 'disabled' : ''}>NEXT ▶</button></nav>` : ''}</section>`;
  }

  private matchMarkup(match: PublicProfile['recentMatches'][number]): string {
    return `<button class="player-profile-web__match ${match.won ? 'is-won' : 'is-lost'}" data-profile-match="${this.escape(match.id)}" type="button" ${match.replayAvailable ? '' : 'disabled'}><strong class="player-profile-web__match-result">${match.won ? 'VICTORY' : 'DEFEAT'}</strong><span><small>MODE</small>${match.mode === 'multi' ? 'MULTI' : 'SINGLE'}</span><span><small>STAGE</small>${match.levelNumber}</span><b><small>SCORE</small>${this.number(match.score)}</b><b><small>POINTS</small>${this.number(match.gamePoints)}</b><em>${match.replayAvailable ? 'WATCH ▶' : 'UNAVAILABLE'}</em></button>`;
  }

  private loadingMarkup(): string {
    return `<section class="player-profile-web__loading" aria-label="Loading player profile"><p>SYNCING PLAYER PROFILE...</p><div class="player-profile-web__loading-hero"><i></i><span></span><b></b></div><div class="player-profile-web__loading-stats"><i></i><i></i><i></i><i></i></div><div class="player-profile-web__loading-log"><span></span><i></i><i></i><i></i></div></section>`;
  }

  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button:not(:disabled)'));
    this.buttons.forEach((button) => button.addEventListener('focus', () => {
      this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
    }, { signal }));
    this.host.querySelector('[data-profile-back]')?.addEventListener('click', () => animateBackNavigation(this.host, this.navigator), { signal });
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
        this.setStatus('PROFILE LINK SHARED');
      } else {
        await navigator.clipboard.writeText(url.toString());
        this.setStatus('PROFILE LINK COPIED');
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
    return profile.avatarUrl && /^https:\/\//.test(profile.avatarUrl) ? `<img src="${this.escape(profile.avatarUrl)}" alt="${this.escape(profile.displayName || 'Player')} avatar">` : this.escape(profile.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'BC');
  }
  private setStatus(value: string): void { this.status = value; const element = this.host?.querySelector<HTMLElement>('[data-profile-status]'); if (element) element.textContent = value; }
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
