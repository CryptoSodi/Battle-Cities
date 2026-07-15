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
import { Painter } from '../../core/Painter';
import { RenderContext } from '../../core/render';
import { RenderObject } from '../../core/RenderObject';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

const SLIDE_SPEED = 240;
const MOBILE_EVENT_TICKER_SPEED = 52;
const HUD_FONT = 'Lucida Console, Courier New, monospace';

class HudTextPainter extends Painter {
  constructor(
    private text: string,
    private readonly fontSize: number,
    private readonly color: string,
    private readonly maxWidth: number,
    private readonly align: CanvasTextAlign = 'center',
  ) {
    super();
  }

  public setText(text: string): void {
    this.text = text;
  }

  public paint(context: RenderContext, renderObject: RenderObject): void {
    const { min } = renderObject.getWorldBoundingBox();
    context.drawText(
      this.text,
      min.x,
      min.y,
      this.maxWidth,
      this.fontSize,
      HUD_FONT,
      '700',
      this.color,
      this.align,
    );
  }
}

class EventTickerPainter extends Painter {
  private eventName = '';
  private width = 390;
  private clipX = 0;
  private clipY = 0;
  private clipWidth = 0;
  private clipHeight = 0;

  public setEvent(eventName: string, width: number): void {
    this.eventName = eventName;
    this.width = width;
  }

  public setClip(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.clipX = x;
    this.clipY = y;
    this.clipWidth = width;
    this.clipHeight = height;
  }

  public paint(context: RenderContext, renderObject: RenderObject): void {
    const { min } = renderObject.getWorldBoundingBox();
    const prefixWidth = 170;
    context.pushClip(
      this.clipX,
      this.clipY,
      this.clipWidth,
      this.clipHeight,
    );
    context.drawText(
      'LIVE EVENT  -',
      min.x,
      min.y,
      prefixWidth,
      22,
      HUD_FONT,
      '700',
      config.COLOR_YELLOW,
      'left',
    );
    context.drawText(
      this.eventName,
      min.x + prefixWidth + 6,
      min.y,
      this.width - prefixWidth - 6,
      22,
      HUD_FONT,
      '700',
      config.COLOR_WHITE,
      'left',
    );
    context.popClip();
  }
}

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
  private mobileEventTicker: GameObject = null;
  private mobileEventTickerPainter: EventTickerPainter = null;
  private mobileEventNames: string[] = [];
  private mobileEventIndex = 0;
  private mobileEventTickerInnerLeft = 0;
  private mobileEventTickerInnerRight = 0;
  private mobileEventTickerStartX = 0;
  private mobileEventTickerEndX = 0;
  private mobileEventTickerActive = false;
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

    this.playerIdentity = playerIdentity;

    // Restore source for maps to default
    mapLoader.restoreDefaultReader();

    this.group = new GameObject();
    this.group.size.copyFrom(this.root.size);

    const isMobileLayout = config.isMobileTouchViewport();

    // Title-screen artwork sits behind all other menu content.
    this.background = new GameObject();
    this.background.size.copyFrom(this.root.size);
    this.background.painter = new SpritePainter(
      spriteLoader.load(
        isMobileLayout ? 'menu.background.mobile' : 'menu.background',
      ),
      isMobileLayout ? SpriteAlignment.Stretch : SpriteAlignment.AspectCover,
    );
    this.background.setZIndex(-100);
    if (!isMobileLayout) {
      this.root.add(this.background);
    }

    const menuY = isMobileLayout
      ? Math.round(this.root.size.height * 0.5)
      : 490;

    this.logo = new GameObject();
    this.logo.size.set(
      isMobileLayout ? 504 : 360,
      isMobileLayout ? 420 : 300,
    );
    this.logo.position.setX(
      (this.root.size.width - this.logo.size.width) / 2,
    );
    this.logo.position.setY(isMobileLayout ? 190 : menuY - 318);
    this.logo.painter = new SpritePainter(
      spriteLoader.load('menu.logo'),
      SpriteAlignment.AspectFit,
    );
    this.group.add(this.logo);

    this.primaryPoints = new SpriteText(this.getPrimaryPointsText(), {
      color: config.COLOR_WHITE,
    });
    this.primaryPoints.position.set(isMobileLayout ? 300 : 92, 64);
    if (!isMobileLayout) {
      this.root.add(this.primaryPoints);
    }

    this.secondaryPoints = new SpriteText(this.getSecondaryPointsText(), {
      color: config.COLOR_WHITE,
    });
    this.secondaryPoints.position.set(isMobileLayout ? 820 : 704, 64);
    if (!isMobileLayout && session.secondaryPlayer.wasInLastGame()) {
      this.root.add(this.secondaryPoints);
    }

    this.commonHighscore = new SpriteText(this.getCommonHighscoreText(), {
      color: config.COLOR_WHITE,
    });
    this.commonHighscore.position.set(isMobileLayout ? 650 : 380, 64);
    if (!isMobileLayout) {
      this.root.add(this.commonHighscore);
    }

    this.playerStatus = new SpriteText(this.getPlayerStatusText(), {
      color: config.COLOR_GRAY,
    });
    this.playerStatus.position.set(isMobileLayout ? 300 : 92, 112);
    if (!isMobileLayout) {
      this.root.add(this.playerStatus);
    } else {
      this.setupMobileHud(spriteLoader);
    }

    if (isMobileLayout) {
      this.setupMobileEventTicker(spriteLoader);
    } else {
      this.eventTicker = new SpriteText('', { color: config.COLOR_YELLOW });
      this.eventTicker.position.set(92, 152);
      this.root.add(this.eventTicker);
    }
    this.loadEventTicker();

    const menuItemWidth = isMobileLayout ? 380 : 228;
    const menuItemHeight = isMobileLayout ? 88 : 56;
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
      cursorOffsetX: isMobileLayout ? -86 : 30,
      cursorSize: isMobileLayout ? 112 : 60,
      itemHeight: isMobileLayout ? 92 : 60,
      itemOffsetX: isMobileLayout ? 50 : 126,
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

    this.updateMobileEventTicker(deltaTime);
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

  private setupMobileHud(
    spriteLoader: GameUpdateArgs['spriteLoader'],
  ): void {
    const sideHeight = 124;
    const scoreHeight = 148;
    const overlap = 30;
    const playerWidth = 280;
    const scoreWidth = 240;
    const highScoreWidth = 280;
    const totalWidth =
      playerWidth + scoreWidth + highScoreWidth - overlap * 2;
    const x = Math.round((this.root.size.width - totalWidth) / 2);
    const sideY = 14;
    const scoreY = 2;
    const scoreX = x + playerWidth - overlap;
    const highScoreX = scoreX + scoreWidth - overlap;

    const addPanel = (
      spriteId: string,
      panelX: number,
      panelY: number,
      width: number,
      height: number,
      zIndex: number,
    ): void => {
      const panel = new GameObject(width, height);
      panel.position.set(panelX, panelY);
      panel.painter = new SpritePainter(
        spriteLoader.load(spriteId),
        SpriteAlignment.Stretch,
      );
      panel.setZIndex(zIndex);
      this.root.add(panel);
    };

    addPanel(
      'menu.hud.player',
      x,
      sideY,
      playerWidth,
      sideHeight,
      0,
    );
    addPanel(
      'menu.hud.highScore',
      highScoreX,
      sideY,
      highScoreWidth,
      sideHeight,
      0,
    );
    addPanel(
      'menu.hud.score',
      scoreX,
      scoreY,
      scoreWidth,
      scoreHeight,
      1,
    );

    const addText = (
      text: string,
      textX: number,
      textY: number,
      width: number,
      fontSize: number,
      color = config.COLOR_WHITE,
    ): void => {
      const textObject = new GameObject(width, Math.ceil(fontSize * 1.3));
      textObject.position.set(textX, textY);
      textObject.painter = new HudTextPainter(
        text,
        fontSize,
        color,
        width,
      );
      textObject.setZIndex(2);
      this.root.add(textObject);
    };

    addText(this.getMobilePlayerName(), x + 88, sideY + 40, 174, 22);
    addText(
      this.getMobileScoreText(),
      scoreX + 33,
      scoreY + 78,
      174,
      30,
      config.COLOR_YELLOW,
    );
    addText(
      this.getMobileHighScoreText(),
      highScoreX + 102,
      sideY + 68,
      142,
      28,
    );
  }

  private setupMobileEventTicker(
    spriteLoader: GameUpdateArgs['spriteLoader'],
  ): void {
    const barWidth = 650;
    const barHeight = 61;
    const barX = Math.round((this.root.size.width - barWidth) / 2);
    const barY = 153;
    const textWidth = 390;
    const horizontalInset = 80;

    const bar = new GameObject(barWidth, barHeight);
    bar.position.set(barX, barY);
    bar.painter = new SpritePainter(
      spriteLoader.load('menu.hud.eventBar'),
      SpriteAlignment.AspectFit,
    );
    bar.setZIndex(3);
    this.root.add(bar);

    this.mobileEventTickerInnerLeft = barX + horizontalInset;
    this.mobileEventTickerInnerRight = barX + barWidth - horizontalInset;
    this.mobileEventTickerStartX = this.mobileEventTickerInnerRight;
    this.mobileEventTickerEndX =
      this.mobileEventTickerInnerLeft - textWidth;
    this.mobileEventTickerPainter = new EventTickerPainter();
    this.mobileEventTickerPainter.setClip(
      this.mobileEventTickerInnerLeft,
      barY + 14,
      this.mobileEventTickerInnerRight - this.mobileEventTickerInnerLeft,
      34,
    );
    this.mobileEventTicker = new GameObject(textWidth, 30);
    this.mobileEventTicker.position.set(
      this.mobileEventTickerStartX,
      barY + 18,
    );
    this.mobileEventTicker.painter = this.mobileEventTickerPainter;
    this.mobileEventTicker.setZIndex(4);
    this.root.add(this.mobileEventTicker);
  }

  private updateMobileEventTicker(deltaTime: number): void {
    if (!this.mobileEventTickerActive || this.mobileEventTicker === null) {
      return;
    }

    let nextX =
      this.mobileEventTicker.position.x +
      -MOBILE_EVENT_TICKER_SPEED * deltaTime;
    if (nextX < this.mobileEventTickerEndX) {
      this.mobileEventIndex =
        (this.mobileEventIndex + 1) % this.mobileEventNames.length;
      this.showMobileEvent(this.mobileEventIndex);
      return;
    }

    this.mobileEventTicker.dirtyPaintBox();
    this.mobileEventTicker.position.setX(nextX);
    this.mobileEventTicker.updateMatrix();
  }

  private showMobileEvent(index: number): void {
    const eventName = this.mobileEventNames[index];
    if (
      eventName === undefined ||
      this.mobileEventTicker === null ||
      this.mobileEventTickerPainter === null
    ) {
      return;
    }

    const width = Math.min(
      470,
      Math.max(300, 176 + eventName.length * 13),
    );
    this.mobileEventTickerStartX = this.mobileEventTickerInnerRight;
    this.mobileEventTickerEndX = this.mobileEventTickerInnerLeft - width;
    this.mobileEventTickerPainter.setEvent(eventName, width);
    this.mobileEventTicker.dirtyPaintBox();
    this.mobileEventTicker.size.set(width, 30);
    this.mobileEventTicker.position.setX(this.mobileEventTickerStartX);
    this.mobileEventTicker.updateMatrix();
    this.mobileEventTicker.setNeedsPaint();
  }

  private getMobilePlayerName(): string {
    const player = this.playerIdentity.getPlayer();
    const name = this.getSafePlayerName(player?.displayName || 'PLAYER');
    return name.length > 10 ? name.slice(0, 10) : name;
  }

  private getMobileScoreText(): string {
    const score = this.session.primaryPlayer.getLastGamePoints() || 0;
    return score.toString().padStart(6, '0').slice(-6);
  }

  private getMobileHighScoreText(): string {
    return this.pointsHighscoreManager
      .getOverallMaxPoints()
      .toString()
      .padStart(6, '0')
      .slice(-6);
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
      const liveEvents = events.filter((event) => event.status === 'live');
      const eventNames =
        liveEvents.length === 0
          ? ['NO EVENTS']
          : liveEvents.map((event) => event.name.toUpperCase());

      if (this.mobileEventTickerPainter !== null) {
        this.mobileEventNames = eventNames;
        this.mobileEventIndex = 0;
        this.showMobileEvent(this.mobileEventIndex);
        this.mobileEventTickerActive = true;
      } else if (this.eventTicker !== undefined) {
        // The bitmap font's character set has no ':' or '>' — see
        // data/fonts/sprite-font.json.
        this.eventTicker.setText(
          liveEvents
            .map(
              (event) =>
                `LIVE ${event.name} - ENDS ${event.endsAt.slice(0, 10)}`,
            )
            .join(' - '),
        );
      }
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
