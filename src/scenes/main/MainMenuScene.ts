import { GameObject, SpriteAlignment, SpritePainter } from '../../core';
import { GameUpdateArgs, GameStorage, Session } from '../../game';
import { Menu, SpriteMenuItem, SpriteText } from '../../gameObjects';
import { InputManager, MenuInputContext } from '../../input';
import { MapLoader } from '../../map';
import { PointsHighscoreManager } from '../../points';
import { ShopManager } from '../../shop';
import { TradingClient } from '../../trading';
import { EventClient } from '../../events';
import { PlayerIdentity } from '../../auth';
import * as config from '../../config';
import { apiFetch } from '../../network/api';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

const SLIDE_SPEED = 240;

enum State {
  Sliding,
  Ready,
}

export class MainMenuScene extends GameScene {
  private group: GameObject;
  private background: GameObject;
  private logo: GameObject;
  private primaryPoints: SpriteText;
  private secondaryPoints: SpriteText;
  private commonHighscore: SpriteText;
  private playerStatus: SpriteText;
  private menu: Menu;
  private singlePlayerItem: SpriteMenuItem;
  private multiPlayerItem: SpriteMenuItem;
  private modesItem: SpriteMenuItem;
  private editorItem: SpriteMenuItem;
  private replayItem: SpriteMenuItem;
  private shopItem: SpriteMenuItem;
  private rankingItem: SpriteMenuItem;
  private moreItem: SpriteMenuItem;
  private settingsItem: SpriteMenuItem;
  private eventTicker: SpriteText;
  private logoutItem: SpriteMenuItem;
  private state: State = State.Ready;
  private session: Session;
  private mapLoader: MapLoader;
  private gameStorage: GameStorage;
  private pointsHighscoreManager: PointsHighscoreManager;
  private shopManager: ShopManager;
  private playerIdentity: PlayerIdentity;
  private mobileGamepadQrElement: HTMLElement = null;
  private mobileGamepadQrRequested = false;
  private mobileGamepadQrEnabled = false;

  protected setup({
    inputManager,
    mapLoader,
    pointsHighscoreManager,
    playerIdentity,
    session,
    spriteLoader,
    gameStorage,
  }: GameUpdateArgs): void {
    this.session = session;
    this.mapLoader = mapLoader;
    this.gameStorage = gameStorage;
    this.pointsHighscoreManager = pointsHighscoreManager;
    this.shopManager = new ShopManager(gameStorage);

    // Trait boosts apply to ALL matches including ranked (user decision).
    // Fetched once per menu visit and parked on the session, so run start
    // (which is synchronous) picks up whatever has arrived; recording stores
    // them in the replay for exact re-enactment. Best effort — offline play
    // simply runs unboosted.
    this.refreshRunBoosts();

    // Live-event ticker (plan: "top promotional ticker can point users into
    // the live event"). Filled in asynchronously; empty text when no event is
    // live or the backend is unreachable.
    this.loadEventTicker();
    this.playerIdentity = playerIdentity;

    // Restore source for maps to default
    mapLoader.restoreDefaultReader();

    this.group = new GameObject();
    this.group.size.copyFrom(this.root.size);

    // Title-screen artwork sits behind all other menu content.
    this.background = new GameObject();
    this.background.size.copyFrom(this.root.size);
    this.background.painter = new SpritePainter(
      spriteLoader.load('menu.background'),
      SpriteAlignment.AspectCover,
    );
    this.background.setZIndex(-100);
    this.root.add(this.background);

    const isMobileLayout = config.isMobileTouchViewport();
    const menuY = isMobileLayout
      ? Math.round(this.root.size.height * 0.5)
      : 490;

    this.logo = new GameObject();
    this.logo.size.set(
      isMobileLayout ? 720 : 360,
      isMobileLayout ? 600 : 300,
    );
    this.logo.setCenter(this.root.getSelfCenter());
    this.logo.position.subX(isMobileLayout ? 330 : 232);
    this.logo.position.setY(menuY - (isMobileLayout ? 620 : 318));
    this.logo.painter = new SpritePainter(
      spriteLoader.load('menu.logo'),
      SpriteAlignment.AspectFit,
    );
    this.group.add(this.logo);

    this.primaryPoints = new SpriteText(this.getPrimaryPointsText(), {
      color: config.COLOR_WHITE,
    });
    this.primaryPoints.position.set(92, 64);
    this.group.add(this.primaryPoints);

    this.secondaryPoints = new SpriteText(this.getSecondaryPointsText(), {
      color: config.COLOR_WHITE,
    });
    this.secondaryPoints.position.set(704, 64);
    if (session.secondaryPlayer.wasInLastGame()) {
      this.group.add(this.secondaryPoints);
    }

    this.commonHighscore = new SpriteText(this.getCommonHighscoreText(), {
      color: config.COLOR_WHITE,
    });
    this.commonHighscore.position.set(380, 64);
    this.group.add(this.commonHighscore);

    this.playerStatus = new SpriteText(this.getPlayerStatusText(), {
      color: config.COLOR_GRAY,
    });
    this.playerStatus.position.set(92, 112);
    this.group.add(this.playerStatus);

    // Live-event ticker strip; text arrives async (see loadEventTicker).
    this.eventTicker = new SpriteText('', { color: config.COLOR_YELLOW });
    this.eventTicker.position.set(92, 152);
    this.group.add(this.eventTicker);

    const menuItemWidth = isMobileLayout ? 420 : 228;
    const menuItemHeight = isMobileLayout ? 98 : 56;
    const createMenuItem = (spriteId: string): SpriteMenuItem =>
      new SpriteMenuItem(
        spriteLoader.load(spriteId),
        menuItemWidth,
        menuItemHeight,
      );

    this.singlePlayerItem = createMenuItem('menu.item.start');
    this.singlePlayerItem.selected.addListener(this.handleSinglePlayerSelected);

    this.multiPlayerItem = createMenuItem('menu.item.2players');
    this.multiPlayerItem.selected.addListener(this.handleMultiPlayerSelected);

    this.modesItem = createMenuItem('menu.item.modes');
    this.modesItem.selected.addListener(this.handleModesSelected);

    this.editorItem = createMenuItem('menu.item.construction');
    this.editorItem.selected.addListener(this.handleEditorSelected);

    // Dev-only: watch the last recorded match back (see src/replay). Never
    // shown outside config.IS_DEV builds -- see the menuItems assembly below.
    this.replayItem = createMenuItem('menu.item.replay');
    this.replayItem.selected.addListener(this.handleReplaySelected);

    this.shopItem = createMenuItem('menu.item.shop');
    this.shopItem.selected.addListener(this.handleShopSelected);

    this.rankingItem = createMenuItem('menu.item.ranking');
    this.rankingItem.selected.addListener(this.handleRankingSelected);

    this.moreItem = createMenuItem('menu.item.headquarters');
    this.moreItem.selected.addListener(this.handleMoreSelected);

    this.settingsItem = createMenuItem('menu.item.settings');
    this.settingsItem.selected.addListener(this.handleSettingsSelected);

    this.logoutItem = createMenuItem('menu.item.logout');
    this.logoutItem.selected.addListener(this.handleLogoutSelected);

    const menuItems = [this.singlePlayerItem];

    if (config.IS_DEV) {
      menuItems.push(
        this.multiPlayerItem,
        this.modesItem,
        this.editorItem,
        this.replayItem,
      );
    }

    menuItems.push(
      this.shopItem,
      this.rankingItem,
      this.moreItem,
      this.settingsItem,
      this.logoutItem,
    );

    this.menu = new Menu({
      cursorOffsetX: isMobileLayout ? -106 : 0,
      cursorSize: isMobileLayout ? 126 : 60,
      itemHeight: isMobileLayout ? 102 : 60,
      itemOffsetX: isMobileLayout ? 30 : 96,
      itemOffsetY: isMobileLayout ? 2 : 16,
    });
    this.menu.setItems(menuItems);
    this.menu.setCenter(this.root.getSelfCenter());
    this.menu.position.setY(menuY);
    this.group.add(this.menu);

    if (!this.session.haveSeenIntro()) {
      this.state = State.Sliding;
      this.group.position.setY(this.root.size.height);
      this.menu.hideCursor();
    }

    this.root.add(this.group);

    this.mobileGamepadQrEnabled = true;
    this.ensureMobileGamepadQrElement(inputManager);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { deltaTime, inputManager } = updateArgs;

    this.mobileGamepadQrEnabled = true;
    this.ensureMobileGamepadQrElement(inputManager);
    this.updateMobileGamepadQrVisibility(inputManager);

    const inputMethod = inputManager.getActiveMethod();

    if (this.state === State.Sliding) {
      let nextPosition = this.group.position.y - SLIDE_SPEED * deltaTime;
      if (nextPosition <= 0) {
        nextPosition = 0;
      }

      const isSkipped = inputMethod.isDownAny(MenuInputContext.Skip);
      if (isSkipped) {
        nextPosition = 0;
      }

      const hasReachedTop = nextPosition === 0;

      this.group.dirtyPaintBox();
      this.group.position.setY(nextPosition);
      this.group.updateMatrix(true);

      if (hasReachedTop) {
        this.state = State.Ready;
        this.menu.showCursor();
        this.session.setSeenIntro(true);
      } else {
        super.update(updateArgs);
      }
      return;
    }

    super.update(updateArgs);
  }

  private getPrimaryPointsText(): string {
    const points = this.session.primaryPlayer.getLastGamePoints() || 0;

    const pointsNumberText = points > 0 ? points.toString() : '00';
    const pointsText = pointsNumberText.padStart(6, ' ');

    const text = `Ⅰ-${pointsText}`;

    return text;
  }

  private getSecondaryPointsText(): string {
    const points = this.session.secondaryPlayer.getLastGamePoints() || 0;

    const pointsNumberText = points > 0 ? points.toString() : '00';
    const pointsText = pointsNumberText.padStart(6, ' ');

    const text = `Ⅱ-${pointsText}`;

    return text;
  }

  private getCommonHighscoreText(): string {
    const points = this.pointsHighscoreManager.getOverallMaxPoints();
    const pointsText = points.toString().padStart(6, ' ');

    const text = `HI-${pointsText}`;

    return text;
  }

  private getPlayerStatusText(): string {
    const player = this.playerIdentity.getPlayer();
    if (player === null) {
      return 'PLAYER UNKNOWN';
    }

    return `${this.playerIdentity.getProviderLabel().toUpperCase()}-${this.getSafePlayerName(
      player.displayName,
    )}`;
  }

  private getSafePlayerName(name: string): string {
    const safeName = name
      .toUpperCase()
      .replace(/[^A-Z0-9 -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const playerName = safeName || 'PLAYER';
    return playerName.length > 18 ? `${playerName.slice(0, 17)}-` : playerName;
  }

  private handleSinglePlayerSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    if (!this.prepareTokenRun()) {
      this.navigator.push(GameSceneType.MainShop);
      return;
    }

    this.session.start(1, this.mapLoader.getItemsCount());
    this.navigator.replace(GameSceneType.LevelLoad);
  };

  private handleMultiPlayerSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    if (!this.prepareTokenRun()) {
      this.navigator.push(GameSceneType.MainShop);
      return;
    }

    this.session.setMultiplayer();
    this.session.start(1, this.mapLoader.getItemsCount());
    this.navigator.replace(GameSceneType.LevelLoad);
  };

  private prepareTokenRun(): boolean {
    if (!this.shopManager.consumeFuelForRun()) {
      return false;
    }

    this.session.setRunConsumables(this.shopManager.getEquippedRunConsumables());

    return true;
  }

  private handleModesSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.ModesMenu);
  };

  private handleEditorSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.EditorMenu);
  };

  private handleShopSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.MainShop);
  };

  private handleRankingSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.MainRanking);
  };

  private handleMoreSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.MainMore);
  };

  private loadEventTicker(): void {
    new EventClient().listEvents().then((events) => {
      const live = events.find((event) => event.status === 'live');
      if (live === undefined || this.eventTicker === undefined) {
        return;
      }

      // The bitmap font's character set has no ':' or '>' — see
      // data/fonts/sprite-font.json.
      this.eventTicker.setText(
        `→ LIVE! ${live.name} - ENDS ${live.endsAt.slice(0, 10)}`,
      );
    });
  }

  private refreshRunBoosts(): void {
    new TradingClient().getBoostStatus().then((status) => {
      if (status === null || status.authenticated !== true) {
        return;
      }

      // Trading boosts and the staking perk tier stack additively per trait.
      this.session.setRunBoosts({
        hull: status.trading.boosts.hull + status.staking.tier.hull,
        armor: status.trading.boosts.armor + status.staking.tier.armor,
        engine: status.trading.boosts.engine + status.staking.tier.engine,
        salvage: status.trading.boosts.salvage + status.staking.tier.salvage,
      });
    });
  }

  // Dev-only: list recorded matches, then launch the selected replay.
  private handleReplaySelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.MainReplay);
  };

  private handleSettingsSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.SettingsMenu);
  };

  private handleLogoutSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();

    apiFetch('/api/session', {
      method: 'DELETE',
    }).finally(() => {
      this.playerIdentity.clear();
      window.location.replace('/');
    });
  };

  private ensureMobileGamepadQrElement(inputManager: InputManager): void {
    if (
      this.mobileGamepadQrRequested ||
      this.mobileGamepadQrElement !== null ||
      !this.mobileGamepadQrEnabled
    ) {
      return;
    }

    this.mobileGamepadQrRequested = true;
    inputManager
      .getMobileGamepadHost()
      .createQrElement()
      .then((element) => {
        this.mobileGamepadQrRequested = false;
        if (!this.mobileGamepadQrEnabled) {
          return;
        }

        this.removeMobileGamepadQrElement();
        this.mobileGamepadQrElement = element;
        document.body.appendChild(element);
        this.updateMobileGamepadQrVisibility(inputManager);
      })
      .catch((error) => {
        this.mobileGamepadQrRequested = false;
        console.error(error);
      });
  }

  private removeMobileGamepadQrElement(): void {
    const existingElements = document.querySelectorAll('.mobile-gamepad-qr');
    existingElements.forEach((element) => {
      element.remove();
    });

    this.mobileGamepadQrElement = null;
  }

  private updateMobileGamepadQrVisibility(inputManager: InputManager): void {
    if (this.mobileGamepadQrElement === null) {
      return;
    }

    const gamepad = inputManager.getMobileGamepadHost().getGamepad(0);
    const isConnected = gamepad !== null && gamepad.connected === true;
    this.mobileGamepadQrElement.classList.toggle('hidden', isConnected);
  }
}
