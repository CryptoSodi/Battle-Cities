import * as config from '../config';
import { SceneNavigator } from '../core';
import { AudioManager, GameStorage } from '../game';
import { InputManager, MenuInputContext } from '../input';
import { NativeNotificationClient, NativeNotificationSettings } from '../notifications/NativeNotificationClient';
import { moveFocus } from './HeadquartersWebUi';

export class SettingsWebUi {
  private readonly notificationClient = new NativeNotificationClient();
  private active = false;
  private abortController: AbortController = null;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private notificationSettings: NativeNotificationSettings = null;
  private status = '';

  public constructor(private readonly navigator: SceneNavigator, private readonly input: InputManager, private readonly audio: AudioManager, private readonly storage: GameStorage) {}
  public isActive(): boolean { return this.active; }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) throw new Error('Settings web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'settings-web-active');
    host.hidden = false;
    this.render();
    this.buttons.find((button) => button.dataset.setting === 'mute')?.focus({ preventScroll: true });
    if (this.notificationClient.isAvailable()) void this.loadNotifications();
  }
  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'settings-web-active');
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
    const rows = [
      ['mute', 'MUTE', this.audio.isGlobalMuted()],
      ['scanline', 'SCANLINE', this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES, false)],
      ...(this.notificationClient.isAvailable() ? [['notifications', 'NOTIFICATIONS', this.notificationsEnabled()]] : []),
    ] as Array<[string, string, boolean]>;
    this.host.innerHTML = `<main class="settings-web"><header><h1>SETTINGS</h1><button data-settings-back>◀ BACK</button></header><section class="settings-web__shell"><section class="settings-web__rows">${rows.map(([key, label, enabled]) => `<article><h2>${label}</h2><button class="settings-web__toggle ${enabled ? 'is-active' : ''}" data-setting="${key}" role="switch" aria-checked="${enabled}"><span>${enabled ? 'ON' : 'OFF'}</span><i></i></button></article>`).join('')}</section><p class="settings-web__status">${this.status}</p><small>VERSION ${process.env.BATTLECITY_VERSION}</small></section></main>`;
    this.bind();
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) => button.addEventListener('focus', () => this.buttons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button)), { signal }));
    this.host.querySelector('[data-settings-back]')?.addEventListener('click', () => this.navigator.back(), { signal });
    this.host.querySelectorAll<HTMLButtonElement>('[data-setting]').forEach((button) => button.addEventListener('click', () => this.toggle(button.dataset.setting || ''), { signal }));
  }
  private toggle(key: string): void {
    if (key === 'mute') { this.audio.setGlobalMuted(!this.audio.isGlobalMuted()); this.audio.saveSettings(); this.render(); }
    if (key === 'scanline') { const enabled = !this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES, false); this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES, enabled); this.storage.save(); document.body.classList.toggle('scanlines-disabled', !enabled); this.render(); }
    if (key === 'notifications') void this.toggleNotifications();
    this.buttons.find((button) => button.dataset.setting === key)?.focus({ preventScroll: true });
  }
  private async loadNotifications(): Promise<void> { try { this.notificationSettings = await this.notificationClient.getSettings(); if (this.active) this.render(); } catch { this.status = 'ANDROID NOTIFICATIONS UNAVAILABLE'; if (this.active) this.render(); } }
  private async toggleNotifications(): Promise<void> { try { this.status = 'UPDATING ANDROID NOTIFICATIONS'; this.render(); this.notificationSettings = await this.notificationClient.setEnabled(!this.notificationsEnabled()); this.status = this.notificationsEnabled() ? 'ANDROID NOTIFICATIONS ON' : 'ANDROID NOTIFICATIONS OFF'; } catch { this.status = 'ANDROID NOTIFICATIONS UNAVAILABLE'; } if (this.active) this.render(); }
  private notificationsEnabled(): boolean { return this.notificationSettings?.supported === true && this.notificationSettings.enabled && this.notificationSettings.permission === 'granted'; }
  private focused(): HTMLButtonElement | null { return document.activeElement instanceof HTMLButtonElement && this.buttons.includes(document.activeElement) ? document.activeElement : null; }
  private move(x: number, y: number): void { moveFocus(this.buttons, this.focused() || this.buttons[0], x, y); }
}
