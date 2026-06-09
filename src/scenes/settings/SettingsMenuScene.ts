import { GameStorage, GameUpdateArgs } from '../../game';
import { SceneMenu, SceneMenuTitle, TextMenuItem } from '../../gameObjects';
import * as config from '../../config';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

export class SettingsMenuScene extends GameScene {
  private title: SceneMenuTitle;
  private keybindingItem: TextMenuItem;
  private audioItem: TextMenuItem;
  private scanlinesItem: TextMenuItem;
  private interfaceItem: TextMenuItem;
  private backItem: TextMenuItem;
  private menu: SceneMenu;
  private gameStorage: GameStorage;

  protected setup({ gameStorage }: GameUpdateArgs): void {
    this.gameStorage = gameStorage;

    this.title = new SceneMenuTitle('SETTINGS');
    this.root.add(this.title);

    this.keybindingItem = new TextMenuItem('KEY BINDINGS');
    this.keybindingItem.selected.addListener(this.handleKeybindingSelected);

    this.audioItem = new TextMenuItem('AUDIO');
    this.audioItem.selected.addListener(this.handleAudioSelected);

    this.scanlinesItem = new TextMenuItem(this.getScanlinesText());
    this.scanlinesItem.selected.addListener(this.handleScanlinesSelected);

    this.interfaceItem = new TextMenuItem('INTERFACE');
    this.interfaceItem.selected.addListener(this.handleInterfaceSelected);

    this.backItem = new TextMenuItem('BACK');
    this.backItem.selected.addListener(this.handleBackSelected);

    const menuItems = [
      this.keybindingItem,
      this.audioItem,
      this.scanlinesItem,
      this.interfaceItem,
      this.backItem,
    ];

    this.menu = new SceneMenu();
    this.menu.setItems(menuItems);
    this.root.add(this.menu);
  }

  private handleKeybindingSelected = (): void => {
    this.navigator.push(GameSceneType.SettingsKeybinding);
  };

  private handleAudioSelected = (): void => {
    this.navigator.push(GameSceneType.SettingsAudio);
  };

  private handleScanlinesSelected = (): void => {
    const nextEnabled = !this.isScanlinesEnabled();

    this.gameStorage.setBoolean(
      config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
      nextEnabled,
    );
    this.gameStorage.save();

    document.body.classList.toggle('scanlines-disabled', !nextEnabled);
    this.scanlinesItem.setText(this.getScanlinesText());
  };

  private handleInterfaceSelected = (): void => {
    this.navigator.push(GameSceneType.SettingsInterface);
  };

  private handleBackSelected = (): void => {
    this.navigator.back();
  };

  private getScanlinesText(): string {
    const checkmark = this.isScanlinesEnabled() ? '+' : ' ';

    return `SCANLINES [${checkmark}]`;
  }

  private isScanlinesEnabled(): boolean {
    return this.gameStorage.getBoolean(
      config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
      true,
    );
  }
}
