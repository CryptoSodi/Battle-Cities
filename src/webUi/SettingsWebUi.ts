import * as config from '../config';
import { PlayerIdentity } from '../auth';
import { apiFetch } from '../network/api';
import { SceneNavigator } from '../core';
import { AudioManager, GameStorage } from '../game';
import { InputManager, isPlaySolanaPsg1, MenuInputContext } from '../input';
import {
  NativeNotificationClient,
  NativeNotificationSettings,
} from '../notifications/NativeNotificationClient';
import { moveFocus } from './HeadquartersWebUi';
import { animateBackNavigation } from './navigationAnimation';

export class SettingsWebUi {
  private readonly notificationClient = new NativeNotificationClient();
  private active = false;
  private abortController: AbortController = null;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private lastFocusKey = 'mute';
  private notificationSettings: NativeNotificationSettings = null;
  private status = '';
  private pairingRequest: Promise<HTMLElement> = null;
  private renderId = 0;
  private signingOut = false;

  public constructor(
    private readonly navigator: SceneNavigator,
    private readonly input: InputManager,
    private readonly audio: AudioManager,
    private readonly storage: GameStorage,
    private readonly playerIdentity: PlayerIdentity,
  ) {}
  public isActive(): boolean {
    return this.active;
  }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement))
      throw new Error('Settings web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abortController = new AbortController();
    document.body.classList.add('web-ui-active', 'settings-web-active');
    host.hidden = false;
    this.render();
    this.buttons
      .find((button) => button.dataset.setting === 'mute')
      ?.focus({ preventScroll: true });
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
    else if (input.isDownAny(MenuInputContext.Back))
      this.host.querySelector<HTMLButtonElement>('[data-ui-back]')?.click();
  }
  private render(): void {
    const renderId = ++this.renderId;
    const rows = [
      ['mute', 'MUTE', this.audio.isGlobalMuted()],
      [
        'scanline',
        'SCANLINE',
        this.storage.getBoolean(
          config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
          false,
        ),
      ],
      ...(this.notificationClient.isAvailable()
        ? [['notifications', 'NOTIFICATIONS', this.notificationsEnabled()]]
        : []),
    ] as Array<[string, string, boolean]>;
    this.host.innerHTML = `<main class="settings-web" data-ui-page><header data-ui-nav style="--ui-tab-count:1"><h1 data-ui-tab class="is-active">SETTINGS</h1><span data-ui-spacer aria-hidden="true"></span><button type="button" data-ui-back data-settings-back>◀ BACK</button></header><section class="settings-web__shell"><section class="settings-web__rows">${rows
      .map(
        ([key, label, enabled]) =>
          `<article><h2>${label}</h2><button class="settings-web__toggle ${
            enabled ? 'is-active' : ''
          }" data-setting="${key}" role="switch" aria-checked="${enabled}"><span>${
            enabled ? 'ON' : 'OFF'
          }</span><i></i></button></article>`,
      )
      .join('')}<article><h2>ACCOUNT</h2><button type="button" class="settings-web__logout" data-setting="logout" ${this.signingOut ? 'disabled aria-busy="true"' : ''}>${this.signingOut ? 'SIGNING OUT…' : 'LOGOUT'}</button></article>${
      this.supportsPhonePairing()
        ? '<section class="settings-web__pairing"><h2>PHONE CONTROLLER</h2><p>Scan with your phone to use it as a controller for this game.</p><div data-settings-pairing role="status">Preparing pairing code…</div><button type="button" data-setting="pairing" class="settings-web__pairing-retry" hidden>RETRY PAIRING</button></section>'
        : ''
    }</section><p class="settings-web__status">${
      this.status
    }</p><small>VERSION ${
      process.env.BATTLECITY_VERSION
    }</small></section></main>`;
    this.bind();
    if (this.supportsPhonePairing()) void this.loadPairing(renderId);
    (
      this.host.querySelector<HTMLButtonElement>(
        `[data-setting="${this.lastFocusKey}"]`,
      ) || this.host.querySelector<HTMLButtonElement>('[data-settings-back]')
    )?.focus({ preventScroll: true });
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
          if (button.dataset.setting)
            this.lastFocusKey = button.dataset.setting;
          else if (button.hasAttribute('data-settings-back'))
            this.lastFocusKey = 'back';
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
          this.host
            .querySelectorAll('.settings-web__rows article')
            .forEach((row) =>
              row.classList.toggle('is-selected', row.contains(button)),
            );
        },
        { signal },
      );
    });
    this.host
      .querySelector('[data-settings-back]')
      ?.addEventListener(
        'click',
        () => animateBackNavigation(this.host, this.navigator),
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-setting]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => this.toggle(button.dataset.setting || ''),
          { signal },
        ),
      );
  }
  private toggle(key: string): void {
    if (key === 'logout') {
      void this.logout();
      return;
    }
    if (key === 'pairing') {
      this.pairingRequest = null;
      this.render();
    }
    if (key === 'mute') {
      this.audio.setGlobalMuted(!this.audio.isGlobalMuted());
      this.audio.saveSettings();
      this.render();
    }
    if (key === 'scanline') {
      const enabled = !this.storage.getBoolean(
        config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
        false,
      );
      this.storage.setBoolean(
        config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
        enabled,
      );
      this.storage.save();
      document.body.classList.toggle('scanlines-disabled', !enabled);
      this.render();
    }
    if (key === 'notifications') void this.toggleNotifications();
    this.buttons
      .find((button) => button.dataset.setting === key)
      ?.focus({ preventScroll: true });
  }
  private async logout(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    this.render();
    try {
      const response = await apiFetch('/api/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Logout failed');
      this.playerIdentity.clear();
      window.location.replace('/');
    } catch {
      this.signingOut = false;
      this.status = 'COULD NOT LOG OUT. CHECK YOUR CONNECTION AND TRY AGAIN.';
      if (this.active) this.render();
    }
  }
  private supportsPhonePairing(): boolean {
    return !isPlaySolanaPsg1(
      this.input.getNativeAndroidGamepad().getDeviceProfile(),
    );
  }
  private async loadPairing(renderId: number): Promise<void> {
    try {
      if (!this.pairingRequest)
        this.pairingRequest = this.input
          .getMobileGamepadHost()
          .createQrElement();
      const element = await this.pairingRequest;
      if (!this.active || this.renderId !== renderId) return;
      this.host
        .querySelector('[data-settings-pairing]')
        ?.replaceChildren(element);
    } catch {
      if (!this.active || this.renderId !== renderId) return;
      const target = this.host.querySelector('[data-settings-pairing]');
      if (target)
        target.textContent =
          'Pairing unavailable. Check your connection and retry.';
      const retry = this.host.querySelector<HTMLButtonElement>(
        '[data-setting="pairing"]',
      );
      if (retry) retry.hidden = false;
    }
  }
  private async loadNotifications(): Promise<void> {
    try {
      this.notificationSettings = await this.notificationClient.getSettings();
      if (this.active) this.render();
    } catch {
      this.status = 'ANDROID NOTIFICATIONS UNAVAILABLE';
      if (this.active) this.render();
    }
  }
  private async toggleNotifications(): Promise<void> {
    try {
      this.status = 'UPDATING ANDROID NOTIFICATIONS';
      this.render();
      this.notificationSettings = await this.notificationClient.setEnabled(
        !this.notificationsEnabled(),
      );
      this.status = this.notificationsEnabled()
        ? 'ANDROID NOTIFICATIONS ON'
        : 'ANDROID NOTIFICATIONS OFF';
    } catch {
      this.status = 'ANDROID NOTIFICATIONS UNAVAILABLE';
    }
    if (this.active) this.render();
  }
  private notificationsEnabled(): boolean {
    return (
      this.notificationSettings?.supported === true &&
      this.notificationSettings.enabled &&
      this.notificationSettings.permission === 'granted'
    );
  }
  private focused(): HTMLButtonElement | null {
    return document.activeElement instanceof HTMLButtonElement &&
      this.buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
  }
  private move(x: number, y: number): void {
    const visible = this.buttons.filter(
      (button) => !button.hidden && !button.disabled,
    );
    moveFocus(visible, this.focused() || visible[0], x, y);
  }
}
