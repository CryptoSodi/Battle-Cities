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
import { isPsg1Ui } from './deviceUi';
import { bindPsg1FocusScroll } from './focusScroll';

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
    bindPsg1FocusScroll(host);
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
      .join(
        '',
      )}<article><h2>ACCOUNT</h2><button type="button" class="settings-web__logout" data-setting="logout" ${
      this.signingOut ? 'disabled aria-busy="true"' : ''
    }>${this.signingOut ? 'SIGNING OUT…' : 'LOGOUT'}</button></article>${
      this.supportsPhonePairing()
        ? '<section class="settings-web__pairing"><h2>PHONE CONTROLLER</h2><p>Scan with your phone to use it as a controller for this game.</p><div data-settings-pairing role="status">Preparing pairing code…</div><button type="button" data-setting="pairing" class="settings-web__pairing-retry" hidden>RETRY PAIRING</button></section>'
        : ''
    }</section><p class="settings-web__status">${
      this.status
    }</p><small>VERSION ${
      process.env.BATTLECITY_VERSION
    }</small></section></main>`;
    if (isPsg1Ui() || document.documentElement.dataset.uiPlatform === 'android') this.decoratePsg1();
    this.bind();
    if (this.supportsPhonePairing()) void this.loadPairing(renderId);
    (
      this.host.querySelector<HTMLButtonElement>(
        `[data-setting="${this.lastFocusKey}"]`,
      ) || this.host.querySelector<HTMLButtonElement>('[data-settings-back]')
    )?.focus({ preventScroll: true });
  }
  private decoratePsg1(): void {
    const paths: Record<string, string> = {
      mute:
        '<path d="M8 24h12L36 10v44L20 40H8z"/><path d="m44 23 14 18m0-18L44 41"/>',
      scanline:
        '<rect x="7" y="10" width="50" height="42" rx="3"/><path d="M15 20h34M15 28h34M15 36h34M15 44h34"/>',
      notifications:
        '<path d="M16 43V27a16 16 0 0 1 32 0v16l6 5H10zM26 55h12"/>',
      logout:
        '<path d="M9 19 46 8v12H9v34h47V20H9z"/><path d="M39 31h20v14H39z"/><circle cx="46" cy="38" r="2"/>',
    };
    const descriptions: Record<string, string> = {
      mute: 'Game audio',
      scanline: 'Retro screen effect',
      notifications: 'Game notifications',
    };
    const player = this.playerIdentity.getPlayer();
    descriptions.logout = player?.walletAddress
      ? `${player.walletAddress.slice(0, 5)}...${player.walletAddress.slice(
          -4,
        )}`
      : this.playerIdentity.getDisplayName();
    this.host
      .querySelectorAll<HTMLElement>('.settings-web__rows article')
      .forEach((row) => {
        const key = row.querySelector<HTMLElement>('[data-setting]')?.dataset
          .setting;
        if (!key || !paths[key]) return;
        const icon = document.createElement('span');
        icon.className = 'psg1-setting-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="bevel">${paths[key]}</svg>`;
        row.prepend(icon);
        const description = document.createElement('small');
        description.textContent = descriptions[key];
        row.querySelector('h2')?.append(description);
      });
    const gear = document.createElement('img');
    gear.src = '/assets/android-home-v2/gear.png';
    gear.alt = '';
    this.host.querySelector('h1')?.prepend(gear);
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
