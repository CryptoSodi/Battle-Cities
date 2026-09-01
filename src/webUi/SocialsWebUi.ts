import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { apiFetch, getApiUrl } from '../network/api';
import { moveFocus } from './HeadquartersWebUi';

interface SocialTask { id: string; postId: string; rewardFuel: number; claimed: boolean; }
interface XStatus { connected?: boolean; follows?: boolean; repostTask?: SocialTask | null; commentTask?: SocialTask | null; }
interface DiscordStatus { authenticated?: boolean; verified?: boolean; rewardClaimed?: boolean; discordUsername?: string | null; }

const FOLLOW_READY = 'battlecities.x-follow-refresh-ready';
const REPOST_READY = 'battlecities.x-repost-verify-ready';
const COMMENT_READY = 'battlecities.x-comment-verify-ready';

export class SocialsWebUi {
  private active = false;
  private abortController: AbortController = null;
  private buttons: HTMLButtonElement[] = [];
  private discord: DiscordStatus = {};
  private host: HTMLElement = null;
  private loading = false;
  private lastFocusKey = 'website';
  private status = '';
  private xStatus: XStatus = {};

  public constructor(private readonly navigator: SceneNavigator, private readonly input: InputManager) {}
  public isActive(): boolean { return this.active; }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) throw new Error('Socials web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'socials-web-active');
    host.hidden = false;
    this.render();
    window.addEventListener('focus', () => void this.refresh(false), { signal: this.abortController.signal });
    void this.refresh(false);
  }
  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'socials-web-active');
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
  private async refresh(verifyReady: boolean): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.status = verifyReady ? 'VERIFYING SOCIAL TASKS...' : 'CHECKING SOCIAL TASKS...';
    this.render();
    try {
      if (verifyReady) await this.verifyReadyTasks();
      const [xResponse, discordResponse] = await Promise.all([
        apiFetch('/api/integrations/x/status', { cache: 'no-store' }),
        apiFetch('/api/integrations/discord/verification', { cache: 'no-store' }),
      ]);
      this.xStatus = xResponse.ok ? await xResponse.json() : {};
      this.discord = discordResponse.ok ? await discordResponse.json() : {};
      this.status = 'SOCIAL TASK STATUS UPDATED';
    } catch {
      this.status = 'SOCIAL VERIFICATION UNAVAILABLE';
    }
    this.loading = false;
    if (this.active) this.render();
  }
  private async verifyReadyTasks(): Promise<void> {
    if (this.xStatus.connected && !this.xStatus.follows && this.ready(FOLLOW_READY) === '1') {
      const response = await apiFetch('/api/integrations/x/verify-follow', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (result.follows) this.setReady(FOLLOW_READY, '');
    }
    const repost = this.xStatus.repostTask;
    if (repost && !repost.claimed && this.ready(REPOST_READY) === repost.id) {
      const response = await apiFetch('/api/integrations/x/verify-repost', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (result.reposted) this.setReady(REPOST_READY, '');
    }
    const comment = this.xStatus.commentTask;
    if (comment && !comment.claimed && this.ready(COMMENT_READY) === comment.id) {
      const response = await apiFetch('/api/integrations/x/verify-comment', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (result.commented) this.setReady(COMMENT_READY, '');
    }
  }
  private render(): void {
    if (!this.host) return;
    const cards = [
      this.card('website', 'WEBSITE', 'WWW', 'BATTLECITIES.COM', 'VISIT WEBSITE', false),
      this.card('x-follow', 'X FOLLOW', 'X', this.xFollowDetail(), this.xFollowAction(), this.xStatus.follows === true),
      this.taskCard('x-repost', 'X REPOST', '↻', this.xStatus.repostTask, REPOST_READY, 'REPOST'),
      this.taskCard('x-comment', 'X COMMENT', '💬', this.xStatus.commentTask, COMMENT_READY, 'COMMENT'),
      this.card('instagram', 'INSTAGRAM', 'IG', '@BATTLECITIESHQ', 'FOLLOW INSTAGRAM', false),
      this.card('discord', 'DISCORD', 'D', this.discordDetail(), this.discordAction(), this.discord.rewardClaimed === true),
    ];
    this.host.innerHTML = `<main class="operations-web socials-web"><header class="operations-web__header"><div><span class="operations-web__header-mark">@</span><h1>SOCIALS</h1></div><nav><button class="socials-web__refresh" data-social-refresh data-social-key="refresh" ${this.loading ? 'disabled' : ''}>↻ REFRESH</button><button class="operations-web__back" data-social-back data-social-key="back">◀ BACK</button></nav></header><section class="operations-web__shell"><section class="operations-web__intro"><h2>JOIN THE BATTLE CITIES COMMUNITY</h2><p>COMPLETE SOCIAL TASKS, VERIFY THEM HERE AND SECURE AVAILABLE FUEL REWARDS.</p></section><section class="operations-web__grid operations-web__grid--social">${cards.join('')}</section><p class="operations-web__status" aria-live="polite">${this.status}</p></section></main>`;
    this.bind();
    const preferred = this.buttons.find((button) => button.dataset.socialKey === this.lastFocusKey) || this.buttons.find((button) => button.dataset.socialAction === 'website');
    preferred?.focus({ preventScroll: true });
  }
  private card(key: string, title: string, mark: string, detail: string, action: string, complete: boolean): string { return `<button class="operations-web__card ${complete ? 'is-complete' : ''}" data-social-action="${key}" data-social-key="${key}"><h3>${title}</h3><span class="operations-web__mark">${mark}</span><p>${detail}</p><strong>${action}</strong></button>`; }
  private taskCard(key: string, title: string, mark: string, task: SocialTask | null | undefined, storageKey: string, verb: string): string {
    if (!this.xStatus.connected || !this.xStatus.follows || !task) return this.card(key, title, mark, 'COMPLETE X FOLLOW FIRST', 'LOCKED', false);
    if (task.claimed) return this.card(key, title, mark, `COMPLETED · +${task.rewardFuel} FUEL`, `${verb}ED`, true);
    const ready = this.ready(storageKey) === task.id;
    return this.card(key, title, mark, ready ? 'READY FOR LIVE VERIFICATION' : `ACTIVE TASK · +${task.rewardFuel} FUEL`, ready ? `VERIFY ${verb}` : verb, false);
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button:not(:disabled)'));
    this.buttons.forEach((button) => button.addEventListener('focus', () => { this.lastFocusKey = button.dataset.socialKey || this.lastFocusKey; this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button)); }, { signal }));
    this.host.querySelector('[data-social-back]')?.addEventListener('click', () => this.navigator.back(), { signal });
    this.host.querySelector('[data-social-refresh]')?.addEventListener('click', () => void this.refresh(true), { signal });
    this.host.querySelectorAll<HTMLButtonElement>('[data-social-action]').forEach((button) => button.addEventListener('click', () => void this.act(button.dataset.socialAction || ''), { signal }));
  }
  private async act(action: string): Promise<void> {
    if (action === 'website') this.open('https://battlecities.com');
    else if (action === 'instagram') this.open('https://www.instagram.com/battlecitieshq');
    else if (action === 'x-follow') await this.actFollow();
    else if (action === 'x-repost') await this.actTask(this.xStatus.repostTask, REPOST_READY, 'https://x.com/intent/retweet?tweet_id=', '/api/integrations/x/verify-repost');
    else if (action === 'x-comment') await this.actTask(this.xStatus.commentTask, COMMENT_READY, 'https://x.com/intent/tweet?in_reply_to=', '/api/integrations/x/verify-comment');
    else if (action === 'discord') await this.actDiscord();
  }
  private async actFollow(): Promise<void> {
    if (!this.xStatus.connected) { this.open(getApiUrl('/api/integrations/x/oauth/start')); return; }
    if (this.xStatus.follows) { this.status = 'X FOLLOW ALREADY VERIFIED'; this.render(); return; }
    if (this.ready(FOLLOW_READY) === '1') { await this.refresh(true); return; }
    this.setReady(FOLLOW_READY, '1'); this.open('https://x.com/BattleCitiesHQ'); this.status = 'FOLLOW ON X, THEN PRESS REFRESH'; this.render();
  }
  private async actTask(task: SocialTask | null | undefined, storageKey: string, url: string, endpoint: string): Promise<void> {
    if (!task || task.claimed || !this.xStatus.follows) return;
    if (this.ready(storageKey) === task.id) { this.status = 'VERIFYING SOCIAL TASK...'; this.render(); await apiFetch(endpoint, { method: 'POST' }).catch(() => null); await this.refresh(false); return; }
    this.setReady(storageKey, task.id); this.open(`${url}${encodeURIComponent(task.postId)}`); this.status = 'COMPLETE THE TASK, THEN PRESS REFRESH'; this.render();
  }
  private async actDiscord(): Promise<void> {
    if (this.discord.rewardClaimed) { this.status = 'DISCORD REWARD ALREADY CLAIMED'; this.render(); return; }
    if (this.discord.verified) { this.status = 'CLAIMING DISCORD FUEL...'; this.render(); await apiFetch('/api/integrations/discord/claim-reward', { method: 'POST' }).catch(() => null); await this.refresh(false); return; }
    this.open(getApiUrl('/api/integrations/discord/oauth/start')); this.status = 'VERIFY IN DISCORD, THEN PRESS REFRESH'; this.render();
  }
  private xFollowDetail(): string { if (!this.xStatus.connected) return 'CONNECT X TO BEGIN'; if (this.xStatus.follows) return 'FOLLOW VERIFIED · 5 FUEL SECURED'; return this.ready(FOLLOW_READY) === '1' ? 'READY FOR LIVE VERIFICATION' : 'FOLLOW @BATTLECITIESHQ'; }
  private xFollowAction(): string { if (!this.xStatus.connected) return 'CONNECT X'; if (this.xStatus.follows) return 'FOLLOWED'; return this.ready(FOLLOW_READY) === '1' ? 'VERIFY FOLLOW' : 'FOLLOW ON X'; }
  private discordDetail(): string { if (!this.discord.authenticated) return 'LOGIN REQUIRED'; if (this.discord.rewardClaimed) return 'COMPLETED · 5 FUEL SECURED'; if (this.discord.verified) return 'MEMBERSHIP VERIFIED'; return 'JOIN AND VERIFY MEMBERSHIP'; }
  private discordAction(): string { if (this.discord.rewardClaimed) return 'VERIFIED'; if (this.discord.verified) return 'CLAIM FUEL'; return 'JOIN & VERIFY'; }
  private open(url: string): void { const opened = window.open(url, '_blank'); if (opened) opened.opener = null; else window.location.href = url; }
  private ready(key: string): string { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
  private setReady(key: string, value: string): void { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* storage can be unavailable */ } }
  private focused(): HTMLButtonElement | null { return document.activeElement instanceof HTMLButtonElement && this.buttons.includes(document.activeElement) ? document.activeElement : null; }
  private move(x: number, y: number): void { moveFocus(this.buttons, this.focused() || this.buttons[0], x, y); }
}
