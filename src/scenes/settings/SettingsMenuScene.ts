import { AudioManager, GameStorage, GameUpdateArgs } from '../../game';
import * as config from '../../config';

import { PanelScene, UI } from '../main/panelUi';

const MOBILE_WIDTH = 744;

export class SettingsMenuScene extends PanelScene {
  private audioManager: AudioManager;
  private gameStorage: GameStorage;

  protected setup(updateArgs: GameUpdateArgs): void {
    this.audioManager = updateArgs.audioManager;
    this.gameStorage = updateArgs.gameStorage;
    super.setup(updateArgs);
  }

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 76 : 96;
  }

  protected getInitialFocusKey(): string {
    return 'mute';
  }

  protected getBackButtonY(): number {
    return config.isMobileTouchViewport() ? 8 : 44;
  }

  protected getBackButtonWidth(): number {
    return config.isMobileTouchViewport() ? 152 : 140;
  }

  protected getBackButtonRightInset(): number {
    return config.isMobileTouchViewport() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return config.isMobileTouchViewport() ? 60 : 48;
  }

  protected load(): void {
    this.statusText = '';
  }

  protected renderContent(): void {
    const mobile = config.isMobileTouchViewport();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();

    this.renderHeader(x, mobile ? 8 : y - 57, mobile);
    this.renderShell(x, y, width, mobile);
    this.renderSettingRows(x, y, width, mobile);
  }

  private renderHeader(x: number, y: number, mobile: boolean): void {
    const width = mobile ? 360 : 400;
    const height = mobile ? 60 : 58;
    this.addPanel(
      x + (mobile ? 0 : 12),
      y,
      width,
      height,
      UI.YELLOW,
      UI.YELLOW_LIGHT,
    );
    this.addText(
      'SETTINGS',
      x + (mobile ? 0 : 12),
      y + (mobile ? 17 : 15),
      UI.WHITE,
      mobile ? 31 : 32,
      '900',
      width,
      'center',
    );
  }

  private renderShell(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const sideInset = mobile ? 0 : 8;
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      Math.max(320, this.root.size.height - y - (mobile ? 12 : 18)),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + 6,
      y + 5,
      width + sideInset * 2 - 12,
      3,
      UI.YELLOW,
      null,
    );
    accent.setZIndex(-1);
  }

  private renderSettingRows(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? 24 : 48;
    const rowWidth = width - inset * 2;
    const rowHeight = mobile ? 140 : 156;
    const firstRowY = y + (mobile ? 38 : 62);
    const rowGap = mobile ? 20 : 28;

    this.renderSettingRow(
      x + inset,
      firstRowY,
      rowWidth,
      rowHeight,
      'MUTE',
      this.audioManager.isGlobalMuted(),
      'mute',
      () => this.toggleMute(),
      mobile,
    );
    this.renderSettingRow(
      x + inset,
      firstRowY + rowHeight + rowGap,
      rowWidth,
      rowHeight,
      'SCANLINE',
      this.isScanlinesEnabled(),
      'scanline',
      () => this.toggleScanlines(),
      mobile,
    );
  }

  private renderSettingRow(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    enabled: boolean,
    key: string,
    onSelect: () => void,
    mobile: boolean,
  ): void {
    this.addPanel(x, y, width, height, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      label,
      x + (mobile ? 28 : 48),
      y + Math.floor((height - (mobile ? 42 : 54)) / 2),
      UI.WHITE,
      mobile ? 32 : 42,
      '900',
      width / 2,
    );

    const toggleWidth = mobile ? 180 : 220;
    const toggleHeight = mobile ? 64 : 72;
    this.addToggle(
      x + width - toggleWidth - (mobile ? 24 : 48),
      y + Math.floor((height - toggleHeight) / 2),
      toggleWidth,
      toggleHeight,
      enabled,
      key,
      onSelect,
    );
  }

  private toggleMute(): void {
    this.audioManager.setGlobalMuted(!this.audioManager.isGlobalMuted());
    this.audioManager.saveSettings();
    this.refresh('mute');
  }

  private toggleScanlines(): void {
    const nextEnabled = !this.isScanlinesEnabled();
    this.gameStorage.setBoolean(
      config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
      nextEnabled,
    );
    this.gameStorage.save();
    document.body.classList.toggle('scanlines-disabled', !nextEnabled);
    this.refresh('scanline');
  }

  private isScanlinesEnabled(): boolean {
    return this.gameStorage.getBoolean(
      config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
      false,
    );
  }
}
