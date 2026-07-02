import { AudioManager, GameUpdateArgs } from '../../game';
import { SceneMenu, SceneMenuTitle, TextMenuItem } from '../../gameObjects';
import * as config from '../../config';

import { GameScene } from '../GameScene';

export class SettingsAudioScene extends GameScene {
  private title: SceneMenuTitle;
  private volumeItem: TextMenuItem;
  private muteItem: TextMenuItem;
  private backItem: TextMenuItem;
  private menu: SceneMenu;
  private audioManager: AudioManager;

  protected setup({ audioManager }: GameUpdateArgs): void {
    this.audioManager = audioManager;

    this.title = new SceneMenuTitle('SETTINGS → AUDIO');
    this.root.add(this.title);

    this.volumeItem = new TextMenuItem(this.getVolumeText());
    this.volumeItem.selected.addListener(this.handleVolumeSelected);

    this.muteItem = new TextMenuItem(this.getMuteText());
    this.muteItem.selected.addListener(this.handleMuteSelected);

    this.backItem = new TextMenuItem('BACK');
    this.backItem.selected.addListener(this.handleBackSelected);

    const menuItems = [this.volumeItem, this.muteItem, this.backItem];

    this.menu = new SceneMenu();
    this.menu.setItems(menuItems);
    this.root.add(this.menu);
  }

  private handleVolumeSelected = (): void => {
    // Cycle to the next discrete master-volume step, wrapping around.
    const steps = config.AUDIO_VOLUME_STEPS;
    const current = this.audioManager.getMasterVolume();
    let index = steps.findIndex((step) => Math.abs(step - current) < 0.001);
    if (index === -1) {
      index = 0;
    }
    const next = steps[(index + 1) % steps.length];

    this.audioManager.setMasterVolume(next);
    this.audioManager.saveSettings();

    this.volumeItem.setText(this.getVolumeText());
  };

  private getVolumeText(): string {
    // No "%" glyph in the bitmap font's character set (see
    // data/fonts/sprite-font.json) -- show the bare number instead.
    const percent = Math.round(this.audioManager.getMasterVolume() * 100);
    return `VOLUME [${percent}]`;
  }

  private handleMuteSelected = (): void => {
    const isGlobalMuted = this.audioManager.isGlobalMuted();
    const nextIsGlobalMuted = !isGlobalMuted;

    this.audioManager.setGlobalMuted(nextIsGlobalMuted);
    this.audioManager.saveSettings();

    this.muteItem.setText(this.getMuteText());
  };

  private handleBackSelected = (): void => {
    this.navigator.back();
  };

  private getMuteText(): string {
    const isMuted = this.audioManager.isGlobalMuted();
    const checkmark = isMuted ? '+' : ' ';
    const text = `MUTE [${checkmark}]`;

    return text;
  }
}
