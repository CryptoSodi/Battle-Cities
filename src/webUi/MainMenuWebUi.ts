import { SceneNavigator } from '../core';
import { PlayerIdentity } from '../auth';
import { EventClient } from '../events';
import { Session } from '../game';
import { InputManager, isPlaySolanaPsg1, MenuInputContext } from '../input';
import { apiFetch } from '../network/api';
import { NativeNotificationClient } from '../notifications/NativeNotificationClient';
import { PointsHighscoreManager } from '../points';
import { beginSinglePlayerReplaySession } from '../replay';
import { GameSceneType } from '../scenes';
import { TradingClient } from '../trading';

interface MainMenuWebUiOptions {
  inputManager: InputManager;
  isDev: boolean;
  navigator: SceneNavigator;
  notificationClient: NativeNotificationClient;
  playerIdentity: PlayerIdentity;
  pointsHighscoreManager: PointsHighscoreManager;
  session: Session;
}

interface MenuAction {
  action: string;
  group: 'main' | 'developer';
  label: string;
  variant?: 'danger';
}

let notificationPromptDismissedThisSession = false;

export class MainMenuWebUi {
  private readonly eventClient = new EventClient();
  private readonly tradingClient = new TradingClient();
  private readonly options: MainMenuWebUiOptions;
  private abortController: AbortController = null;
  private actionButtons: HTMLButtonElement[] = [];
  private active = false;
  private eventTickerClickCount = 0;
  private host: HTMLElement = null;
  private mobileGamepadQrElement: HTMLElement = null;
  private mobileGamepadQrRequested = false;
  private mountId = 0;

  public constructor(options: MainMenuWebUiOptions) {
    this.options = options;
  }

  public mount(): void {
    if (this.active) return;

    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Main menu web UI host is missing.');
    }

    this.active = true;
    this.abortController = new AbortController();
    this.eventTickerClickCount = 0;
    this.host = host;
    this.mountId += 1;
    const currentMountId = this.mountId;

    document.body.classList.add('web-ui-active');
    host.hidden = false;
    host.innerHTML = this.render();

    this.hydrateHud();
    this.bindActions();
    this.bindEventTicker();
    this.bindNotificationDialog();
    this.focusInitialAction();
    this.ensureMobileGamepadQrElement();

    void this.loadEvents(currentMountId);
    void this.refreshRunBoosts();
    void this.prepareNotificationPrompt(currentMountId);
  }

  public unmount(): void {
    if (!this.active) return;

    this.active = false;
    this.mountId += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.actionButtons = [];
    this.removeMobileGamepadQrElement();

    const dialog = this.host?.querySelector('dialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }

    this.host?.replaceChildren();
    if (this.host !== null) {
      this.host.hidden = true;
    }
    this.host = null;
    document.body.classList.remove('web-ui-active');
  }

  public update(): void {
    if (!this.active) return;

    this.updateMobileGamepadQrVisibility();
    const inputMethod = this.options.inputManager.getActiveMethod();
    const openDialog = this.host.querySelector('dialog[open]');

    if (openDialog instanceof HTMLDialogElement) {
      const dialogButtons = Array.from(
        openDialog.querySelectorAll<HTMLButtonElement>('button'),
      );
      const activeElement = document.activeElement;
      const currentIndex =
        activeElement instanceof HTMLButtonElement
          ? dialogButtons.indexOf(activeElement)
          : -1;

      if (
        inputMethod.isDownAny(MenuInputContext.VerticalPrev) ||
        inputMethod.isDownAny(MenuInputContext.VerticalNext)
      ) {
        const direction = inputMethod.isDownAny(MenuInputContext.VerticalPrev)
          ? -1
          : 1;
        const nextIndex =
          (Math.max(currentIndex, 0) + direction + dialogButtons.length) %
          dialogButtons.length;
        dialogButtons[nextIndex]?.focus({ preventScroll: true });
      }

      if (inputMethod.isDownAny(MenuInputContext.Select)) {
        (dialogButtons[currentIndex] || dialogButtons[0])?.click();
      }
      return;
    }

    if (inputMethod.isDownAny(MenuInputContext.VerticalPrev)) {
      this.focusRelativeAction(-1);
    }

    if (inputMethod.isDownAny(MenuInputContext.VerticalNext)) {
      this.focusRelativeAction(1);
    }

    if (inputMethod.isDownAny(MenuInputContext.Select)) {
      const activeButton = this.getFocusedAction();
      (activeButton || this.actionButtons[0])?.click();
    }
  }

  private render(): string {
    const mainActions: MenuAction[] = [
      { action: 'start', group: 'main', label: 'Start' },
    ];

    if (
      new URLSearchParams(window.location.search).get('enable2players') === '1'
    ) {
      mainActions.push({
        action: 'multiplayer',
        group: 'main',
        label: '2 Players',
      });
    }

    mainActions.push(
      { action: 'shop', group: 'main', label: 'Shop' },
      { action: 'ranking', group: 'main', label: 'Ranking' },
      { action: 'headquarters', group: 'main', label: 'Headquarters' },
      { action: 'socials', group: 'main', label: 'Socials' },
      { action: 'settings', group: 'main', label: 'Settings' },
      { action: 'logout', group: 'main', label: 'Logout', variant: 'danger' },
    );

    const developerActions: MenuAction[] = this.options.isDev
      ? [
          { action: 'modes', group: 'developer', label: 'Modes' },
          { action: 'editor', group: 'developer', label: 'Construction' },
          { action: 'replay', group: 'developer', label: 'Replay' },
        ]
      : [];
    const actions = mainActions.concat(developerActions);
    const renderActions = (group: MenuAction['group']): string =>
      actions
        .filter((item) => item.group === group)
        .map((item) => {
          const variantClass = item.variant
            ? ` main-menu-web__action--${item.variant}`
            : '';
          return `<button class="main-menu-web__action${variantClass}" data-menu-action="${item.action}" type="button">${item.label}</button>`;
        })
        .join('');

    return `
      <main class="main-menu-web" aria-labelledby="main-menu-title">
        <h1 id="main-menu-title" hidden>Battle Cities main menu</h1>
        <header class="main-menu-web__hud" aria-label="Player status">
          <section class="main-menu-web__stat main-menu-web__stat--player" aria-label="Player">
            <strong class="main-menu-web__stat-value" data-menu-player>PLAYER</strong>
          </section>
          <section class="main-menu-web__stat main-menu-web__stat--score" aria-label="Last score">
            <strong class="main-menu-web__stat-value" data-menu-score>000000</strong>
          </section>
          <section class="main-menu-web__stat main-menu-web__stat--highscore" aria-label="High score">
            <strong class="main-menu-web__stat-value" data-menu-highscore>000000</strong>
          </section>
        </header>

        <button class="main-menu-web__events" data-menu-event-ticker type="button" aria-label="Live Battle Cities events">
          <span class="main-menu-web__events-label">Live Event&nbsp; -</span>
          <span class="main-menu-web__events-viewport">
            <span class="main-menu-web__events-track" data-menu-events role="status" aria-live="polite">Loading live operations...</span>
          </span>
        </button>

        <section class="main-menu-web__content">
          <nav class="main-menu-web__commands${
            developerActions.length > 0
              ? ' main-menu-web__commands--developer'
              : ''
          }" aria-label="Battle Cities commands">
            ${renderActions('main')}
            ${developerActions.length > 0 ? renderActions('developer') : ''}
          </nav>
        </section>

        <dialog class="main-menu-web__dialog" data-menu-notification-dialog aria-labelledby="notification-title">
          <h2 id="notification-title">Battle updates</h2>
          <p>Get match, reward, and Battle Cities updates on this device.</p>
          <div class="main-menu-web__dialog-actions">
            <button class="main-menu-web__dialog-button main-menu-web__dialog-button--accept" data-notification-accept type="button">Enable</button>
            <button class="main-menu-web__dialog-button" data-notification-decline type="button">Not now</button>
          </div>
        </dialog>
      </main>
    `;
  }

  private hydrateHud(): void {
    this.setText('[data-menu-player]', this.getSafePlayerName());
    this.setText(
      '[data-menu-score]',
      this.formatScore(this.options.session.primaryPlayer.getLastGamePoints()),
    );
    this.setText(
      '[data-menu-highscore]',
      this.formatScore(
        this.options.pointsHighscoreManager.getOverallMaxPoints(),
      ),
    );
  }

  private bindActions(): void {
    this.actionButtons = Array.from(
      this.host.querySelectorAll<HTMLButtonElement>('[data-menu-action]'),
    );
    const signal = this.abortController.signal;

    this.actionButtons.forEach((button) => {
      button.addEventListener(
        'click',
        () => this.activateAction(button.dataset.menuAction || ''),
        { signal },
      );
      button.addEventListener(
        'focus',
        () => button.classList.add('is-focused'),
        { signal },
      );
      button.addEventListener(
        'blur',
        () => button.classList.remove('is-focused'),
        { signal },
      );
    });

    this.host.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
        }
      },
      { signal },
    );
  }

  private bindEventTicker(): void {
    const ticker = this.host.querySelector('[data-menu-event-ticker]');
    if (!(ticker instanceof HTMLButtonElement)) return;

    ticker.addEventListener(
      'click',
      () => {
        this.eventTickerClickCount += 1;
        if (this.eventTickerClickCount < 10) return;

        const url = new URL(window.location.href);
        url.searchParams.set('enable2players', '1');
        window.location.replace(url.toString());
      },
      { signal: this.abortController.signal },
    );
  }

  private bindNotificationDialog(): void {
    const dialog = this.host.querySelector('[data-menu-notification-dialog]');
    if (!(dialog instanceof HTMLDialogElement)) return;

    this.host.querySelector('[data-notification-accept]')?.addEventListener(
      'click',
      () => {
        notificationPromptDismissedThisSession = true;
        dialog.close();
        void this.options.notificationClient
          .requestPermission()
          .catch(() => undefined);
      },
      { signal: this.abortController.signal },
    );
    this.host.querySelector('[data-notification-decline]')?.addEventListener(
      'click',
      () => {
        notificationPromptDismissedThisSession = true;
        dialog.close();
      },
      { signal: this.abortController.signal },
    );
    dialog.addEventListener(
      'cancel',
      () => {
        notificationPromptDismissedThisSession = true;
      },
      { signal: this.abortController.signal },
    );
  }

  private focusInitialAction(): void {
    this.actionButtons[0]?.focus({ preventScroll: true });
  }

  private focusRelativeAction(direction: -1 | 1): void {
    if (this.actionButtons.length === 0) return;

    const current = this.getFocusedAction();
    const currentIndex =
      current === null ? 0 : this.actionButtons.indexOf(current);
    const nextIndex =
      (currentIndex + direction + this.actionButtons.length) %
      this.actionButtons.length;
    const next = this.actionButtons[nextIndex];
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest' });
  }

  private getFocusedAction(): HTMLButtonElement | null {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLButtonElement &&
      this.actionButtons.includes(activeElement)
      ? activeElement
      : null;
  }

  private activateAction(action: string): void {
    switch (action) {
      case 'start':
        beginSinglePlayerReplaySession();
        this.options.navigator.push(GameSceneType.MainTankSelect);
        break;
      case 'multiplayer':
        this.options.navigator.push(GameSceneType.MainTankSelect, {
          multiplayer: true,
        });
        break;
      case 'shop':
        this.options.navigator.push(GameSceneType.MainShop);
        break;
      case 'ranking':
        this.options.navigator.push(GameSceneType.MainRanking);
        break;
      case 'headquarters':
        this.options.navigator.push(GameSceneType.MainMore);
        break;
      case 'socials':
        this.options.navigator.push(GameSceneType.MainSocials);
        break;
      case 'settings':
        this.options.navigator.push(GameSceneType.SettingsMenu);
        break;
      case 'modes':
        this.options.navigator.push(GameSceneType.ModesMenu);
        break;
      case 'editor':
        this.options.navigator.push(GameSceneType.EditorMenu);
        break;
      case 'replay':
        this.options.navigator.push(GameSceneType.MainReplay);
        break;
      case 'logout':
        this.logout();
        break;
    }
  }

  private logout(): void {
    const button = this.host?.querySelector<HTMLButtonElement>(
      '[data-menu-action="logout"]',
    );
    if (button !== null && button !== undefined) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Signing out...';
    }

    apiFetch('/api/session', { method: 'DELETE' }).finally(() => {
      this.options.playerIdentity.clear();
      window.location.replace('/');
    });
  }

  private async loadEvents(mountId: number): Promise<void> {
    const events = await this.eventClient.listEvents();
    if (!this.active || mountId !== this.mountId) return;

    const liveEvents = events.filter((event) => event.status === 'live');
    this.setText(
      '[data-menu-events]',
      liveEvents.length === 0
        ? 'No live events right now'
        : liveEvents.map((event) => event.name.toUpperCase()).join('  ·  '),
    );
  }

  private async refreshRunBoosts(): Promise<void> {
    const status = await this.tradingClient.getBoostStatus();
    if (status === null || status.authenticated !== true) return;

    this.options.session.setRunBoosts({
      hull: status.trading.boosts.hull + status.staking.tier.hull,
      armor: status.trading.boosts.armor + status.staking.tier.armor,
      engine: status.trading.boosts.engine + status.staking.tier.engine,
      salvage: status.trading.boosts.salvage + status.staking.tier.salvage,
    });
  }

  private async prepareNotificationPrompt(mountId: number): Promise<void> {
    if (
      notificationPromptDismissedThisSession ||
      !this.options.notificationClient.isAvailable()
    ) {
      return;
    }

    try {
      const settings = await this.options.notificationClient.getSettings();
      if (
        !this.active ||
        mountId !== this.mountId ||
        settings?.supported !== true ||
        !settings.enabled ||
        settings.permission !== 'denied'
      ) {
        return;
      }

      const dialog = this.host.querySelector('[data-menu-notification-dialog]');
      if (dialog instanceof HTMLDialogElement && !dialog.open) {
        dialog.showModal();
      }
    } catch {
      // Native notifications are optional; the menu remains fully usable.
    }
  }

  private ensureMobileGamepadQrElement(): void {
    if (
      this.mobileGamepadQrRequested ||
      this.mobileGamepadQrElement !== null ||
      isPlaySolanaPsg1(
        this.options.inputManager.getNativeAndroidGamepad().getDeviceProfile(),
      )
    ) {
      return;
    }

    this.mobileGamepadQrRequested = true;
    this.options.inputManager
      .getMobileGamepadHost()
      .createQrElement()
      .then((element) => {
        this.mobileGamepadQrRequested = false;
        if (!this.active) return;

        this.removeMobileGamepadQrElement();
        this.mobileGamepadQrElement = element;
        document.body.appendChild(element);
        this.updateMobileGamepadQrVisibility();
      })
      .catch((error) => {
        this.mobileGamepadQrRequested = false;
        console.error(error);
      });
  }

  private updateMobileGamepadQrVisibility(): void {
    if (this.mobileGamepadQrElement === null) return;

    const gamepad = this.options.inputManager
      .getMobileGamepadHost()
      .getGamepad(0);
    const isConnected = gamepad !== null && gamepad.connected === true;
    this.mobileGamepadQrElement.classList.toggle('hidden', isConnected);
  }

  private removeMobileGamepadQrElement(): void {
    document
      .querySelectorAll('.mobile-gamepad-qr')
      .forEach((element) => element.remove());
    this.mobileGamepadQrElement = null;
  }

  private getSafePlayerName(): string {
    const name =
      this.options.playerIdentity.getPlayer()?.displayName || 'PLAYER';
    const safeName = name
      .toUpperCase()
      .replace(/[^A-Z0-9 -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (safeName || 'PLAYER').slice(0, 18);
  }

  private formatScore(value: number): string {
    return Math.max(0, Number(value) || 0)
      .toString()
      .padStart(6, '0')
      .slice(-6);
  }

  private setText(selector: string, value: string): void {
    const element = this.host?.querySelector(selector);
    if (element !== null && element !== undefined) {
      element.textContent = value;
    }
  }
}
