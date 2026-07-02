import { GameObject, SpriteAlignment, SpritePainter } from '../../core';
import { GameUpdateArgs, GameStorage, Session } from '../../game';
import { Menu, SpriteText, TextMenuItem } from '../../gameObjects';
import { InputManager, MenuInputContext } from '../../input';
import { MapConfig, MapLoader } from '../../map';
import { PointsHighscoreManager } from '../../points';
import { loadReplay } from '../../replay';
import { ShopManager } from '../../shop';
import * as config from '../../config';

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
  private primaryPoints: SpriteText;
  private secondaryPoints: SpriteText;
  private commonHighscore: SpriteText;
  private menu: Menu;
  private singlePlayerItem: TextMenuItem;
  private multiPlayerItem: TextMenuItem;
  private modesItem: TextMenuItem;
  private editorItem: TextMenuItem;
  private replayItem: TextMenuItem;
  private shopItem: TextMenuItem;
  private settingsItem: TextMenuItem;
  private aboutItem: TextMenuItem;
  private state: State = State.Ready;
  private session: Session;
  private mapLoader: MapLoader;
  private gameStorage: GameStorage;
  private pointsHighscoreManager: PointsHighscoreManager;
  private shopManager: ShopManager;
  private mobileGamepadQrElement: HTMLElement = null;
  private mobileGamepadQrRequested = false;
  private mobileGamepadQrEnabled = false;

  protected setup({
    inputManager,
    mapLoader,
    pointsHighscoreManager,
    session,
    spriteLoader,
    gameStorage,
  }: GameUpdateArgs): void {
    this.session = session;
    this.mapLoader = mapLoader;
    this.gameStorage = gameStorage;
    this.pointsHighscoreManager = pointsHighscoreManager;
    this.shopManager = new ShopManager(gameStorage);

    // Restore source for maps to default
    mapLoader.restoreDefaultReader();

    this.group = new GameObject();
    this.group.size.copyFrom(this.root.size);

    // Full-screen title-screen artwork (includes the "BATTLE CITIES" title),
    // stretched to the menu area and sitting behind all other menu content.
    this.background = new GameObject();
    this.background.size.copyFrom(this.root.size);
    this.background.painter = new SpritePainter(
      spriteLoader.load('menu.background'),
      SpriteAlignment.Stretch,
    );
    this.background.setZIndex(-100);
    this.group.add(this.background);

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

    this.singlePlayerItem = new TextMenuItem('START');
    this.singlePlayerItem.selected.addListener(this.handleSinglePlayerSelected);

    this.multiPlayerItem = new TextMenuItem('2 PLAYERS');
    this.multiPlayerItem.selected.addListener(this.handleMultiPlayerSelected);

    this.modesItem = new TextMenuItem('MODES');
    this.modesItem.selected.addListener(this.handleModesSelected);

    this.editorItem = new TextMenuItem('CONSTRUCTION');
    this.editorItem.selected.addListener(this.handleEditorSelected);

    // Dev-only: watch the last recorded match back (see src/replay). Never
    // shown outside config.IS_DEV builds -- see the menuItems assembly below.
    this.replayItem = new TextMenuItem('REPLAY');
    this.replayItem.selected.addListener(this.handleReplaySelected);

    this.shopItem = new TextMenuItem('SHOP');
    this.shopItem.selected.addListener(this.handleShopSelected);

    this.settingsItem = new TextMenuItem('SETTINGS');
    this.settingsItem.selected.addListener(this.handleSettingsSelected);

    this.aboutItem = new TextMenuItem('ABOUT');
    this.aboutItem.selected.addListener(this.handleAboutSelected);

    const menuItems = [this.singlePlayerItem];

    if (config.IS_DEV) {
      menuItems.push(
        this.multiPlayerItem,
        this.modesItem,
        this.editorItem,
        this.replayItem,
      );
    }

    menuItems.push(this.shopItem, this.settingsItem, this.aboutItem);

    this.menu = new Menu();
    this.menu.setItems(menuItems);
    this.menu.setCenter(this.root.getSelfCenter());
    this.menu.position.setY(490);
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

  // Dev-only: load the map the last recorded match was played on, then enter
  // LevelPlay with that recording -- LevelPlayScene sees `replay` in its
  // params and plays it back instead of reading live input. No-ops (besides a
  // console warning) if nothing has been recorded yet.
  private handleReplaySelected = (): void => {
    const replay = loadReplay(this.gameStorage);
    if (replay === null) {
      // eslint-disable-next-line no-console
      console.warn('No recorded replay found — play a match first.');
      return;
    }

    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();

    const handleLoaded = (mapConfig: MapConfig): void => {
      this.mapLoader.error.removeListener(handleError);
      this.navigator.push(GameSceneType.LevelPlay, { mapConfig, replay });
    };
    const handleError = (): void => {
      this.mapLoader.loaded.removeListener(handleLoaded);
      // eslint-disable-next-line no-console
      console.warn(
        `Could not load level ${replay.levelNumber} for the recorded replay.`,
      );
    };

    this.mapLoader.loaded.addListenerOnce(handleLoaded);
    this.mapLoader.error.addListenerOnce(handleError);
    this.mapLoader.loadAsync(replay.levelNumber);
  };

  private handleSettingsSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.SettingsMenu);
  };

  private handleAboutSelected = (): void => {
    this.mobileGamepadQrEnabled = false;
    this.removeMobileGamepadQrElement();
    this.navigator.push(GameSceneType.MainAbout);
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
