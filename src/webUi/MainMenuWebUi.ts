import { SceneNavigator } from '../core';
import { PlayerIdentity } from '../auth';
import { EventClient } from '../events';
import { Session } from '../game';
import { InputManager, MenuInputContext } from '../input';
import { apiFetch } from '../network/api';
import { NativeNotificationClient } from '../notifications/NativeNotificationClient';
import { PointsHighscoreManager } from '../points';
import { beginSinglePlayerReplaySession } from '../replay';
import { GameSceneType } from '../scenes';
import { TradingClient } from '../trading';
import { CherryChatWebUi } from './CherryChatWebUi';

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

interface HomeRewardTier {
  amount: number;
  fromRank: number;
  toRank: number;
}

interface HomeRewardRow {
  displayName: string;
  playerId: string;
  rank: number;
  totalPoints: number;
}

interface HomeRewardsResponse {
  enabled: boolean;
  intervalStartedAt?: string;
  nextRewardAt: string | null;
  rewardIntervalMinutes: number;
  rows: HomeRewardRow[];
  tiers: HomeRewardTier[];
}

const HOME_REWARD_TIERS: HomeRewardTier[] = [
  { fromRank: 1, toRank: 1, amount: 1000 },
  { fromRank: 2, toRank: 2, amount: 750 },
  { fromRank: 3, toRank: 3, amount: 500 },
  { fromRank: 4, toRank: 10, amount: 250 },
];

let notificationPromptDismissedThisSession = false;

const MAIN_MENU_BUTTON_SPRITES: Record<
  string,
  { inactive: string; active: string }
> = {
  start: { inactive: 'sprite_1.png', active: 'sprite_2.png' },
  shop: { inactive: 'sprite_3.png', active: 'sprite_4.png' },
  ranking: { inactive: 'sprite_5.png', active: 'sprite_6.png' },
  leaderboard: { inactive: 'sprite_5.png', active: 'sprite_6.png' },
  headquarters: { inactive: 'sprite_7.png', active: 'sprite_8.png' },
  socials: { inactive: 'sprite_9.png', active: 'sprite_10.png' },
  settings: { inactive: 'sprite_11.png', active: 'sprite_12.png' },
  logout: { inactive: 'sprite_13.png', active: 'sprite_14.png' },
};

export class MainMenuWebUi {
  private readonly eventClient = new EventClient();
  private readonly tradingClient = new TradingClient();
  private readonly options: MainMenuWebUiOptions;
  private readonly cherryChat: CherryChatWebUi;
  private abortController: AbortController = null;
  private actionButtons: HTMLButtonElement[] = [];
  private active = false;
  private host: HTMLElement = null;
  private mountId = 0;
  private rewardsData: HomeRewardsResponse | null = null;
  private rewardsLoading = false;
  private rewardsTimer: number | null = null;
  private refreshTick = 0;
  private touchActionTimer: number | null = null;

  public constructor(options: MainMenuWebUiOptions) {
    this.options = options;
    this.cherryChat = new CherryChatWebUi(options.playerIdentity);
  }

  public mount(): void {
    if (this.active) return;

    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Main menu web UI host is missing.');
    }

    this.active = true;
    this.abortController = new AbortController();
    this.host = host;
    this.mountId += 1;
    const currentMountId = this.mountId;

    document.body.classList.add('web-ui-active', 'main-menu-web-active');
    host.hidden = false;
    host.innerHTML = this.render();

    this.hydrateHud();
    this.cherryChat.mount();
    this.bindActions();
    this.bindEventTicker();
    this.bindNotificationDialog();
    this.focusInitialAction();

    this.refreshTick = 0;
    void this.loadPresence(currentMountId);
    void this.loadEvents(currentMountId);
    void this.loadHomeRewards(currentMountId);
    void this.refreshRunBoosts();
    void this.prepareNotificationPrompt(currentMountId);
    this.rewardsTimer = window.setInterval(() => {
      this.syncHomeRewardsCountdown();
      if (++this.refreshTick % 30 === 0 && !document.hidden) {
        void this.loadHomeRewards(currentMountId);
        void this.loadEvents(currentMountId);
        void this.loadPresence(currentMountId);
      }
    }, 1000);
  }

  public unmount(): void {
    if (!this.active) return;

    this.active = false;
    this.mountId += 1;
    this.abortController?.abort();
    this.abortController = null;
    if (this.touchActionTimer !== null) {
      window.clearTimeout(this.touchActionTimer);
      this.touchActionTimer = null;
    }
    if (this.rewardsTimer !== null) {
      window.clearInterval(this.rewardsTimer);
      this.rewardsTimer = null;
    }
    this.actionButtons = [];
    this.rewardsData = null;
    this.rewardsLoading = false;
    this.cherryChat.unmount();

    const dialog = this.host?.querySelector('dialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }

    this.host?.replaceChildren();
    if (this.host !== null) {
      this.host.hidden = true;
    }
    this.host = null;
    document.body.classList.remove('web-ui-active', 'main-menu-web-active');
  }

  public update(): void {
    if (!this.active) return;
    if (this.cherryChat.blocksMenuInput()) return;

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
      if (inputMethod.isDownAny(MenuInputContext.Back)) {
        openDialog.close();
      }
      return;
    }

    if (
      inputMethod.isDownAny(MenuInputContext.VerticalPrev) ||
      inputMethod.isDownAny(MenuInputContext.HorizontalPrev)
    ) {
      this.focusRelativeAction(-1);
    }

    if (
      inputMethod.isDownAny(MenuInputContext.VerticalNext) ||
      inputMethod.isDownAny(MenuInputContext.HorizontalNext)
    ) {
      this.focusRelativeAction(1);
    }

    if (inputMethod.isDownAny(MenuInputContext.Select)) {
      const focused = document.activeElement;
      if (
        focused instanceof HTMLButtonElement &&
        focused.hasAttribute('data-home-rewards-retry')
      ) {
        focused.click();
        return;
      }
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
      { action: 'leaderboard', group: 'main', label: 'Leaderboard' },
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
          const sprites = MAIN_MENU_BUTTON_SPRITES[item.action];
          const imageLayers =
            item.group === 'main' && sprites
              ? `<img class="main-menu-web__action-image main-menu-web__action-image--inactive" src="/assets/menu-web/${sprites.inactive}" alt="" aria-hidden="true" draggable="false">
                 <img class="main-menu-web__action-image main-menu-web__action-image--active" src="/assets/menu-web/${sprites.active}" alt="" aria-hidden="true" draggable="false">`
              : '';
          return `<button class="main-menu-web__action${variantClass}" data-menu-action="${item.action}" type="button">${imageLayers}<span class="main-menu-web__action-label">${item.label}</span></button>`;
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

        <section class="main-menu-web__content">
          <nav class="main-menu-web__commands${
            developerActions.length > 0
              ? ' main-menu-web__commands--developer'
              : ''
          }" aria-label="Battle Cities commands">
            ${renderActions('main')}
            ${developerActions.length > 0 ? renderActions('developer') : ''}
          </nav>
          <section class="main-menu-web__overview" aria-label="Battle Cities command overview">
            <img class="main-menu-web__overview-banner" src="/assets/rewards-leaderboard-banner.png" alt="Battle Cities battlefield" width="1774" height="887">
            <section class="main-menu-web__reward-briefing" aria-labelledby="home-rewards-title">
              <header class="main-menu-web__reward-header">
                <img class="main-menu-web__panel-icon" src="/assets/home-reward-trophy.png" alt="" width="48" height="48">
                <div>
                  <h2 id="home-rewards-title">Live Rewards</h2>
                  <p>Top 10 every 30 minutes</p>
                </div>
                <div class="main-menu-web__reward-clock">
                  <i class="main-menu-web__clock-icon" aria-hidden="true"></i>
                  <div><span data-home-countdown-label>ROUND STATUS</span><output class="main-menu-web__reward-countdown" data-home-rewards-countdown>SYNCING</output></div>
                  <progress data-home-round-progress max="100" value="0" aria-label="Time remaining in this round"></progress>
                </div>
              </header>
              <div class="main-menu-web__reward-tiers" data-home-reward-tiers aria-label="BATC reward tiers">
                ${this.rewardTiersMarkup(HOME_REWARD_TIERS)}
              </div>
              <section class="main-menu-web__how-it-works" aria-labelledby="home-rewards-how-title">
                <h3 id="home-rewards-how-title">How it works</h3>
                <ol>
                  <li><b>1</b><span>Play battles and earn points</span></li>
                  <li><b>2</b><span>Reach the top 10 before the round closes</span></li>
                  <li><b>3</b><span>Eligible rewards go to your linked wallet</span></li>
                </ol>
              </section>
            </section>
            <section class="main-menu-web__leaderboard-preview" aria-labelledby="home-leaderboard-title" aria-live="polite">
              <header class="main-menu-web__leaderboard-header">
                <img class="main-menu-web__panel-icon" src="/assets/home-reward-trophy.png" alt="" width="48" height="48">
                <div>
                  <h2 id="home-leaderboard-title">Rewards Leaderboard</h2>
                  <p data-home-rewards-state>Loading current round</p>
                </div>
              </header>
              <div class="main-menu-web__leaderboard-columns" aria-hidden="true">
                <span>#</span><span>Player</span><span>Score</span><span>Reward</span>
              </div>
              <div class="main-menu-web__leaderboard-rows" data-home-rewards-rows aria-busy="true">
                ${this.rewardRowsLoadingMarkup()}
              </div>
              <footer class="main-menu-web__leaderboard-footer">
                <img src="/data/graphics/shop/icons/token-bact.png" alt="" width="64" height="64">
                <div><strong>BATC Rewards</strong><span>Play. Earn. Climb the leaderboard.</span></div>
              </footer>
            </section>
          </section>
        </section>

        <footer class="main-menu-web__hazard" aria-label="Live battlefield status">
          <div class="main-menu-web__ticker-window">
            <button type="button" class="main-menu-web__live-event" data-menu-event-ticker aria-label="Live events">
              <span class="main-menu-web__hazard-track">
                <span class="main-menu-web__ticker-run"><b>LIVE EVENTS</b><span data-menu-events-primary>Loading events…</span></span>
                <span class="main-menu-web__ticker-run" aria-hidden="true"><b>LIVE EVENTS</b><span data-menu-events-repeat>Loading events…</span></span>
              </span>
            </button>
          </div>
          <div class="main-menu-web__round-status">
            <span data-home-round>SYNCING ROUND</span>
            <span data-home-presence hidden></span>
          </div>
        </footer>
        <div class="main-menu-web__bottom-tank-scroller" aria-hidden="true">
          <span class="main-menu-web__bottom-tank-sprite"></span>
        </div>

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
    this.actionButtons[0]?.classList.add('is-selected');
    const signal = this.abortController.signal;

    this.actionButtons.forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          if (this.touchActionTimer === null) {
            this.activateAction(button.dataset.menuAction || '');
          }
        },
        { signal },
      );
      button.addEventListener(
        'pointerup',
        (event) => {
          if (event.pointerType !== 'touch' || this.touchActionTimer !== null) {
            return;
          }

          this.actionButtons.forEach((candidate) => {
            const selected = candidate === button;
            candidate.classList.toggle('is-selected', selected);
            candidate.disabled = true;
            candidate.toggleAttribute('aria-busy', selected);
          });
          button.classList.add('is-activating');
          this.touchActionTimer = window.setTimeout(() => {
            this.touchActionTimer = null;
            if (this.active) {
              this.activateAction(button.dataset.menuAction || '');
            }
          }, 180);
        },
        { signal },
      );
      button.addEventListener(
        'focus',
        () => {
          this.actionButtons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
          button.classList.add('is-focused');
        },
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
    // Append chat to directional order without the route-changing touch delay.
    const launcher = this.cherryChat.getLauncher();
    if (!launcher) return;
    this.actionButtons.push(launcher);
    launcher.addEventListener(
      'focus',
      () => {
        this.actionButtons.forEach((button) =>
          button.classList.toggle('is-selected', button === launcher),
        );
      },
      { signal },
    );
  }

  private bindEventTicker(): void {
    // Preserve the existing opt-in multiplayer shortcut on the relocated bar.
    let clicks = 0;
    this.host.querySelector('[data-menu-event-ticker]')?.addEventListener(
      'click',
      () => {
        if (++clicks < 10) return;
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
      case 'leaderboard':
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
      button.classList.add('is-selected');
    }

    apiFetch('/api/session', { method: 'DELETE' }).finally(() => {
      this.options.playerIdentity.clear();
      window.location.replace('/');
    });
  }

  private async loadPresence(mountId: number): Promise<void> {
    try {
      const response = await apiFetch('/api/presence', {
        signal: this.abortController.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Presence unavailable');
      const data = await response.json();
      if (!this.active || mountId !== this.mountId) return;
      const element = this.host.querySelector<HTMLElement>(
        '[data-home-presence]',
      );
      if (!element) return;
      element.hidden =
        data.liveUsersEnabled !== true || !Number.isFinite(data.online);
      element.textContent = `PLAYERS ONLINE · ${Math.max(
        0,
        data.online,
      ).toLocaleString()}`;
    } catch {
      if (this.active && mountId === this.mountId) {
        const element = this.host.querySelector<HTMLElement>(
          '[data-home-presence]',
        );
        if (element) element.hidden = true;
      }
    }
  }

  private async loadEvents(mountId: number): Promise<void> {
    let events;
    try {
      events = await this.eventClient.listEvents();
    } catch {
      if (this.active && mountId === this.mountId)
        this.setEventTickerText('Events unavailable');
      return;
    }
    if (!this.active || mountId !== this.mountId) return;

    const liveEvents = events.filter((event) => event.status === 'live');
    this.setEventTickerText(
      liveEvents.length === 0
        ? 'No live events right now'
        : liveEvents.map((event) => event.name.toUpperCase()).join('  ·  '),
    );
  }

  private async loadHomeRewards(mountId: number): Promise<void> {
    if (this.rewardsLoading) return;
    this.rewardsLoading = true;
    if (!this.rewardsData) this.setHomeRewardsLoadingState();

    try {
      const response = await apiFetch('/api/leaderboard/rewards', {
        signal: this.abortController.signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Rewards leaderboard is unavailable.');
      }
      const body = await response.json();
      if (!Array.isArray(body?.rows) || !Array.isArray(body?.tiers)) {
        throw new Error('Rewards leaderboard response is invalid.');
      }
      if (!this.active || mountId !== this.mountId) return;
      this.rewardsData = body as HomeRewardsResponse;
      this.renderHomeRewards();
    } catch {
      if (!this.active || mountId !== this.mountId) return;
      this.rewardsData = null;
      this.renderHomeRewardsError(mountId);
    } finally {
      if (this.active && mountId === this.mountId) {
        this.rewardsLoading = false;
      }
    }
  }

  private setHomeRewardsLoadingState(): void {
    const rows = this.host?.querySelector<HTMLElement>(
      '[data-home-rewards-rows]',
    );
    if (rows) {
      rows.setAttribute('aria-busy', 'true');
      rows.innerHTML = this.rewardRowsLoadingMarkup();
    }
    this.setText('[data-home-rewards-state]', 'Loading current round');
    this.setText('[data-home-rewards-countdown]', 'SYNCING ROUND');
  }

  private renderHomeRewards(): void {
    const rows = this.host?.querySelector<HTMLElement>(
      '[data-home-rewards-rows]',
    );
    if (!rows || !this.rewardsData) return;

    rows.setAttribute('aria-busy', 'false');
    rows.innerHTML = this.rewardRowsMarkup(
      this.rewardsData.rows,
      this.rewardsData.tiers.length > 0
        ? this.rewardsData.tiers
        : HOME_REWARD_TIERS,
    );
    this.setText(
      '[data-home-rewards-state]',
      this.rewardsData.enabled
        ? 'Top 10 · current 30-minute round'
        : 'Live scores · payouts not enabled',
    );
    const tiers = this.host.querySelector('[data-home-reward-tiers]');
    if (tiers) tiers.innerHTML = this.rewardTiersMarkup(this.rewardsData.tiers);
    this.syncHomeRewardsCountdown();
  }

  private renderHomeRewardsError(mountId: number): void {
    const rows = this.host?.querySelector<HTMLElement>(
      '[data-home-rewards-rows]',
    );
    if (!rows) return;

    rows.setAttribute('aria-busy', 'false');
    rows.innerHTML = `<div class="main-menu-web__leaderboard-message main-menu-web__leaderboard-message--error"><strong>COULDN'T LOAD LIVE SCORES</strong><span>Check your connection and try again.</span><button type="button" data-home-rewards-retry>RETRY</button></div>`;
    this.setText('[data-home-rewards-state]', 'Live board unavailable');
    this.setText('[data-home-rewards-countdown]', 'ROUND UNAVAILABLE');
    rows
      .querySelector<HTMLButtonElement>('[data-home-rewards-retry]')
      ?.addEventListener('click', () => void this.loadHomeRewards(mountId), {
        signal: this.abortController.signal,
      });
  }

  private syncHomeRewardsCountdown(): void {
    const output = this.host?.querySelector<HTMLOutputElement>(
      '[data-home-rewards-countdown]',
    );
    if (!output) return;

    const nextRewardAt = this.rewardsData?.nextRewardAt;
    const target = nextRewardAt ? Date.parse(nextRewardAt) : Number.NaN;
    if (!Number.isFinite(target)) {
      output.textContent = this.rewardsLoading
        ? 'SYNCING ROUND'
        : 'ROUND UNAVAILABLE';
      this.setText('[data-home-round]', output.textContent);
      return;
    }

    const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    output.textContent = `00:${minutes}:${remainingSeconds}`;
    this.setText('[data-home-countdown-label]', this.rewardsData?.enabled ? 'NEXT REWARD IN' : 'ROUND ENDS IN');
    const progress = this.host.querySelector<HTMLProgressElement>('[data-home-round-progress]');
    if (progress) progress.value = Math.min(100, Math.max(0, seconds / Math.max(1, (this.rewardsData?.rewardIntervalMinutes || 30) * 60) * 100));
    const started = this.rewardsData?.intervalStartedAt;
    const roundTime =
      started && Number.isFinite(Date.parse(started))
        ? new Date(started).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
            hour12: false,
          }) + ' UTC'
        : 'CURRENT';
    this.setText(
      '[data-home-round]',
      `${
        this.rewardsData?.enabled ? 'PAYOUT ROUND' : 'SCORE ROUND'
      } ${roundTime} · ${minutes}:${remainingSeconds}`,
    );
  }

  private rewardRowsMarkup(
    rows: HomeRewardRow[],
    tiers: HomeRewardTier[],
  ): string {
    if (rows.length === 0) {
      return `<div class="main-menu-web__leaderboard-message"><strong>NO SCORES THIS ROUND</strong><span>Play a battle to claim a place on the board.</span></div>`;
    }

    return rows
      .slice(0, 10)
      .map((row) => {
        const reward = this.rewardForRank(row.rank, tiers);
        return `<div class="main-menu-web__leaderboard-row main-menu-web__leaderboard-row--${Math.min(
          row.rank,
          4,
        )}"><strong>${row.rank}</strong><span>${this.escapeMarkup(
          row.displayName,
        )}</span><b>${Math.max(0, row.totalPoints).toLocaleString()}</b><em>${
          reward > 0 ? `${reward.toLocaleString()} BATC` : '—'
        }</em></div>`;
      })
      .join('');
  }

  private rewardRowsLoadingMarkup(): string {
    return Array.from(
      { length: 6 },
      (_, index) =>
        `<div class="main-menu-web__leaderboard-skeleton" aria-hidden="true"><i>${index +
          1}</i><span></span><b></b><em></em></div>`,
    ).join('');
  }

  private rewardTiersMarkup(tiers: HomeRewardTier[]): string {
    return tiers
      .map((tier) => {
        const rank =
          tier.fromRank === tier.toRank
            ? this.ordinal(tier.fromRank)
            : `${tier.fromRank}TH–${tier.toRank}TH`;
        return `<article class="main-menu-web__reward-tier main-menu-web__reward-tier--${
          tier.fromRank
        }"><i class="main-menu-web__chest main-menu-web__chest--${Math.min(
          tier.fromRank,
          4,
        )}" aria-hidden="true"></i><div class="main-menu-web__podium"><strong>${rank}</strong><span>${tier.amount.toLocaleString()} $BATC</span>${tier.fromRank === tier.toRank ? '' : '<small>(Each)</small>'}</div></article>`;
      })
      .join('');
  }

  private rewardForRank(rank: number, tiers: HomeRewardTier[]): number {
    return (
      tiers.find((tier) => rank >= tier.fromRank && rank <= tier.toRank)
        ?.amount || 0
    );
  }

  private ordinal(value: number): string {
    if (value === 1) return '1ST';
    if (value === 2) return '2ND';
    if (value === 3) return '3RD';
    return `${value}TH`;
  }

  private escapeMarkup(value: string): string {
    return String(value || 'PLAYER').replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        }[character]),
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

  private setEventTickerText(value: string): void {
    this.setText('[data-menu-events-primary]', value);
    this.setText('[data-menu-events-repeat]', value);
  }
}
