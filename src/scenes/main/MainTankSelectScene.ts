import { GameObject, RectPainter } from '../../core';
import { GameUpdateArgs } from '../../game';
import { ShopManager } from '../../shop';
import {
  TankAttributesFactory,
  TankBulletWallDamage,
  TankParty,
  TankTier,
  TankType,
} from '../../tank';
import * as config from '../../config';
import { GameSceneType } from '../GameSceneType';
import {
  PanelScene,
  UI,
  UiActionTarget,
  UiIcon,
  UiPanel,
  UiText,
} from './panelUi';

interface TankOption {
  tier: TankTier | null;
  name: string;
  role: string;
  spriteId: string;
  fuelCost: number;
  locked?: boolean;
}

interface TankSelectLocationParams {
  multiplayer?: boolean;
  stage?: number;
  matchId?: string;
  playerSlot?: number;
  stageRejoin?: boolean;
  transitionDeadline?: number;
}

const DESKTOP_COLUMNS = 4;
const MOBILE_WIDTH = 744;
const MOBILE_COLUMNS = 2;
const DESKTOP_VISIBLE_ROWS = 1;
const MOBILE_VISIBLE_ROWS = 2;

const TANK_OPTIONS: TankOption[] = [
  {
    tier: TankTier.A,
    name: 'VANGUARD',
    role: 'BALANCED CHASSIS',
    spriteId: 'tank.player.primary.a.up.1',
    fuelCost: 1,
  },
  {
    tier: TankTier.B,
    name: 'STRIKER',
    role: 'HIGH VELOCITY',
    spriteId: 'tank.player.primary.b.up.1',
    fuelCost: 2,
  },
  {
    tier: TankTier.C,
    name: 'TWIN FANG',
    role: 'RAPID FIRE',
    spriteId: 'tank.player.primary.c.up.1',
    fuelCost: 3,
  },
  {
    tier: TankTier.D,
    name: 'SIEGEBREAKER',
    role: 'HEAVY SHELLS',
    spriteId: 'tank.player.primary.d.up.1',
    fuelCost: 4,
  },
  {
    tier: null,
    name: 'CLASSIFIED I',
    role: 'FUTURE CHASSIS',
    spriteId: 'ui.icon.lock',
    fuelCost: 0,
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED II',
    role: 'FUTURE CHASSIS',
    spriteId: 'ui.icon.lock',
    fuelCost: 0,
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED III',
    role: 'FUTURE CHASSIS',
    spriteId: 'ui.icon.lock',
    fuelCost: 0,
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED IV',
    role: 'FUTURE CHASSIS',
    spriteId: 'ui.icon.lock',
    fuelCost: 0,
    locked: true,
  },
];

class TankOptionCard extends GameObject implements UiActionTarget {
  public painter: RectPainter;
  private readonly title: UiText;
  private readonly footer: UiPanel;
  private readonly footerText: UiText;
  private readonly selected: boolean;
  private readonly locked: boolean;
  private focused = false;

  constructor(
    option: TankOption,
    width: number,
    height: number,
    selected: boolean,
    mobile: boolean,
  ) {
    super(width, height);
    this.selected = selected;
    this.locked = option.locked === true;
    this.painter = new RectPainter(UI.CARD, UI.PANEL_LINE);
    this.painter.lineWidth = 2;

    const titleSize = mobile ? 31 : 28;
    this.title = new UiText(
      option.name,
      selected ? UI.WHITE : UI.GREEN,
      titleSize,
      '900',
      width - 28,
      'center',
    );
    this.title.position.set(14, 18);
    this.add(this.title);

    const role = new UiText(
      option.role,
      UI.MUTED_LIGHT,
      mobile ? 19 : 17,
      '800',
      width - 28,
      'center',
    );
    role.position.set(14, 58);
    this.add(role);

    const iconSize = mobile ? 132 : 126;
    const icon = new UiIcon(option.spriteId, iconSize);
    icon.position.set(Math.floor((width - iconSize) / 2), 88);
    this.add(icon);

    const stats = option.locked
      ? [
          { label: 'STATUS', value: 'LOCKED' },
          { label: 'INTEL', value: 'REDACTED' },
          { label: 'RELEASE', value: 'SOON' },
        ]
      : this.getTankStats(option.tier ?? TankTier.A);
    const statStartY = mobile ? 236 : 232;
    const statFontSize = mobile ? 19 : 17;
    stats.forEach((stat, index) => {
      const statY = statStartY + index * 31;
      const label = new UiText(
        stat.label,
        UI.MUTED,
        statFontSize,
        '800',
        Math.floor(width * 0.52) - 20,
      );
      label.position.set(18, statY);
      this.add(label);

      const value = new UiText(
        stat.value,
        UI.WHITE,
        statFontSize,
        '900',
        Math.floor(width * 0.48) - 18,
        'right',
      );
      value.position.set(Math.floor(width * 0.52), statY);
      this.add(value);
    });

    const footerHeight = mobile ? 58 : 56;
    const footerY = height - footerHeight - 8;
    this.footer = new UiPanel(
      width - 16,
      footerHeight,
      option.locked ? UI.PANEL_RAISED : selected ? UI.YELLOW : UI.PRICE,
      option.locked
        ? UI.PANEL_LINE
        : selected
        ? UI.YELLOW_LIGHT
        : UI.PRICE_BORDER,
    );
    this.footer.position.set(8, footerY);
    this.add(this.footer);

    const fuelIcon = new UiIcon(
      option.locked ? 'ui.icon.lock' : 'shop.fuel',
      mobile ? 34 : 32,
    );
    fuelIcon.position.set(Math.floor(width / 2) - 62, footerY + 11);
    this.add(fuelIcon);

    this.footerText = new UiText(
      option.locked ? 'LOCKED' : `${option.fuelCost} FUEL`,
      option.locked ? UI.MUTED_LIGHT : selected ? UI.WHITE : UI.PRICE_TEXT,
      mobile ? 24 : 22,
      '900',
      118,
      'center',
    );
    this.footerText.position.set(Math.floor(width / 2) - 38, footerY + 15);
    this.add(this.footerText);

    this.refreshStyle();
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.refreshStyle();
  }

  private refreshStyle(): void {
    const highlighted = this.selected || this.focused;
    this.painter.fillColor = highlighted ? UI.CARD_FOCUS : UI.CARD;
    this.painter.strokeColor = highlighted ? UI.YELLOW : UI.PANEL_LINE;
    this.painter.lineWidth = highlighted ? 3 : 2;
    this.title.setColor(
      highlighted ? UI.WHITE : this.locked ? UI.MUTED : UI.GREEN,
    );
    this.footer.painter.fillColor = this.locked
      ? UI.PANEL_RAISED
      : highlighted
      ? UI.YELLOW
      : UI.PRICE;
    this.footer.painter.strokeColor = this.locked
      ? highlighted
        ? UI.YELLOW
        : UI.PANEL_LINE
      : highlighted
      ? UI.YELLOW_LIGHT
      : UI.PRICE_BORDER;
    this.footerText.setColor(
      this.locked
        ? highlighted
          ? UI.WHITE
          : UI.MUTED_LIGHT
        : highlighted
        ? UI.WHITE
        : UI.PRICE_TEXT,
    );
    this.setNeedsPaint();
  }

  private getTankStats(tier: TankTier): Array<{
    label: string;
    value: string;
  }> {
    const type = new TankType(TankParty.Player, tier);
    const attributes = TankAttributesFactory.create(type);
    return [
      {
        label: 'ROUNDS',
        value: attributes.bulletMaxCount > 1 ? 'TWIN' : 'SINGLE',
      },
      {
        label: 'VELOCITY',
        value: attributes.bulletSpeed >= 900 ? 'HIGH' : 'STANDARD',
      },
      {
        label: 'WALL DAMAGE',
        value:
          attributes.bulletWallDamage === TankBulletWallDamage.High
            ? 'HEAVY'
            : 'STANDARD',
      },
    ];
  }
}

export class MainTankSelectScene extends PanelScene {
  private shopManager: ShopManager;
  private selectedIndex = 0;
  private returnTankIndex = 0;
  private scrollRow = 0;
  private transitionTimer: UiText = null;
  private transitionTimerSecond = -1;
  private transitionExpired = false;

  protected setup(updateArgs: GameUpdateArgs): void {
    const { gameStorage } = updateArgs;
    this.shopManager = new ShopManager(gameStorage);
    super.setup(updateArgs);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    super.update(updateArgs);
    this.updateTransitionTimer();
  }

  protected getTitle(): string {
    return 'SELECT TANK';
  }

  protected getTitleIcon(): string {
    return 'tank.player.primary.a.up.1';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 76 : 96;
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

  protected getHeaderActionFontSize(): number {
    return 24;
  }

  protected getHeaderActionFontWeight(): string {
    return '700';
  }

  protected getInitialFocusKey(): string {
    return this.getTankKey(this.selectedIndex);
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const columns = this.getColumns();
    const returnKey = this.getTankKey(this.returnTankIndex);

    if (direction > 0 && currentKey === 'back') {
      this.scrollToTank(this.returnTankIndex, returnKey);
      return returnKey;
    }
    if (direction < 0 && currentKey === 'deploy') {
      this.scrollToTank(this.returnTankIndex, returnKey);
      return returnKey;
    }

    const index = this.getTankIndex(currentKey);
    if (index === -1) {
      return null;
    }
    const row = Math.floor(index / columns);
    const nextRow = row + direction;
    const totalRows = Math.ceil(TANK_OPTIONS.length / columns);
    if (direction < 0 && row === 0) {
      this.returnTankIndex = index;
      return 'back';
    }
    if (direction > 0 && nextRow >= totalRows) {
      this.returnTankIndex = index;
      return 'deploy';
    }

    const column = index % columns;
    const targetIndex = Math.min(
      TANK_OPTIONS.length - 1,
      nextRow * columns + column,
    );
    const targetKey = this.getTankKey(targetIndex);
    this.returnTankIndex = targetIndex;
    this.scrollToTank(targetIndex, targetKey);
    return targetKey;
  }

  protected load(): void {
    this.statusText = '';
  }

  protected handleTouchScroll(direction: number): boolean {
    if (!config.isMobileTouchViewport()) {
      return false;
    }
    const maxScrollRow = this.getMaxScrollRow();
    const nextScrollRow = Math.max(
      0,
      Math.min(this.scrollRow + direction, maxScrollRow),
    );
    if (nextScrollRow === this.scrollRow) {
      return false;
    }
    this.scrollRow = nextScrollRow;
    const firstVisibleIndex = this.scrollRow * this.getColumns();
    this.returnTankIndex = firstVisibleIndex;
    this.refresh(this.getTankKey(firstVisibleIndex));
    return true;
  }

  protected renderContent(): void {
    const mobile = config.isMobileTouchViewport();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();
    const inset = mobile ? 18 : 20;
    const innerX = x + inset;
    const innerWidth = width - inset * 2;
    const summaryHeight = mobile ? 92 : 82;
    const columns = this.getColumns();
    const gap = mobile ? 18 : 14;
    const cardWidth = Math.floor((innerWidth - gap * (columns - 1)) / columns);
    const cardHeight = mobile ? 410 : 410;
    const gridY = y + summaryHeight + 38;
    const rows = this.getVisibleRows();
    const gridHeight = rows * cardHeight + (rows - 1) * gap;
    const deployY = gridY + gridHeight + (mobile ? 28 : 24);
    const shellHeight = Math.max(
      deployY + 88 - y,
      this.root.size.height - y - 24,
    );

    const shell = this.addPanel(
      x,
      y,
      width,
      shellHeight,
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);
    const accent = this.addPanel(x + 6, y + 5, width - 12, 3, UI.YELLOW, null);
    accent.setZIndex(-1);

    this.renderFuelSummary(innerX, y + 16, innerWidth, summaryHeight - 16);

    const firstVisibleIndex = this.scrollRow * columns;
    const visibleOptions = TANK_OPTIONS.slice(
      firstVisibleIndex,
      firstVisibleIndex + columns * rows,
    );
    const lastVisibleIndex = firstVisibleIndex + visibleOptions.length;
    this.addText(
      `TANKS ${firstVisibleIndex + 1}-${lastVisibleIndex}/${TANK_OPTIONS.length}`,
      innerX,
      gridY - 31,
      UI.MUTED_LIGHT,
      mobile ? 21 : 19,
      '800',
      Math.floor(innerWidth * 0.45),
    );
    const remaining = this.getTransitionSeconds();
    if (remaining !== null) {
      this.transitionTimerSecond = remaining;
      this.transitionTimer = this.addText(
        this.formatTransitionTime(remaining),
        innerX + Math.floor(innerWidth * 0.45),
        gridY - 31,
        UI.GREEN,
        mobile ? 21 : 19,
        '900',
        Math.ceil(innerWidth * 0.55),
        'right',
      );
    }

    visibleOptions.forEach((option, visibleIndex) => {
      const index = firstVisibleIndex + visibleIndex;
      const cardX = innerX + (visibleIndex % columns) * (cardWidth + gap);
      const cardY =
        gridY + Math.floor(visibleIndex / columns) * (cardHeight + gap);
      const card = new TankOptionCard(
        option,
        cardWidth,
        cardHeight,
        index === this.selectedIndex,
        mobile,
      );
      card.position.set(cardX, cardY);
      this.root.add(card);
      this.addActionTarget(this.getTankKey(index), card, () => {
        this.returnTankIndex = index;
        if (option.locked) {
          this.setStatus('LOCKED - NEW TANK INTEL COMING SOON');
          return;
        }
        this.selectedIndex = index;
        this.statusText = '';
        this.refresh(this.getTankKey(index));
      });
    });

    const deployWidth = mobile ? 330 : 280;
    this.addButton(
      x + Math.floor((width - deployWidth) / 2),
      deployY,
      deployWidth,
      mobile ? 64 : 58,
      'CONTINUE  →',
      'deploy',
      () => this.continueToLoadout(),
      false,
      'purchase',
      mobile ? 29 : 27,
    );
  }

  private renderFuelSummary(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const option = TANK_OPTIONS[this.selectedIndex];
    const mobile = config.isMobileTouchViewport();
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    const iconSize = mobile ? 50 : 44;
    this.addIcon(
      'shop.fuel',
      x + 18,
      y + Math.floor((height - iconSize) / 2),
      iconSize,
    );
    this.addText(
      'FUEL AVAILABLE',
      x + 82,
      y + Math.floor((height - (mobile ? 24 : 22)) / 2),
      UI.MUTED,
      mobile ? 20 : 18,
      '800',
      mobile ? 190 : 170,
    );
    this.addText(
      `${this.shopManager.getFuelBalance()}`,
      x + (mobile ? 276 : 258),
      y + Math.floor((height - (mobile ? 34 : 31)) / 2),
      UI.YELLOW,
      mobile ? 30 : 27,
      '900',
      mobile ? 120 : 100,
    );
    this.addText(
      `${option.name}  /  ${option.fuelCost} FUEL PER DEPLOYMENT`,
      x + Math.floor(width * 0.42),
      y + Math.floor((height - 30) / 2) + 2,
      UI.WHITE,
      mobile ? 24 : 22,
      '900',
      Math.floor(width * 0.55),
      'right',
    );
  }

  private continueToLoadout(): void {
    const option = TANK_OPTIONS[this.selectedIndex];
    if (option.locked || option.tier === null) {
      return;
    }

    if (!this.shopManager.canStartRun(option.fuelCost)) {
      this.setStatus(`NEED ${option.fuelCost} FUEL - VISIT THE SHOP`);
      return;
    }

    this.navigator.push(GameSceneType.MainShop, {
      battleSetup: true,
      multiplayer: this.isMultiplayerSelection(),
      stage: (this.params as TankSelectLocationParams).stage,
      matchId: (this.params as TankSelectLocationParams).matchId,
      playerSlot: (this.params as TankSelectLocationParams).playerSlot,
      stageRejoin: (this.params as TankSelectLocationParams).stageRejoin,
      transitionDeadline: (this.params as TankSelectLocationParams)
        .transitionDeadline,
      tankTier: option.tier,
      fuelCost: option.fuelCost,
    });
  }

  private getColumns(): number {
    return config.isMobileTouchViewport() ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
  }

  private getVisibleRows(): number {
    return config.isMobileTouchViewport()
      ? MOBILE_VISIBLE_ROWS
      : DESKTOP_VISIBLE_ROWS;
  }

  private getMaxScrollRow(): number {
    const totalRows = Math.ceil(TANK_OPTIONS.length / this.getColumns());
    return Math.max(0, totalRows - this.getVisibleRows());
  }

  private scrollToTank(index: number, focusKey: string): void {
    const row = Math.floor(index / this.getColumns());
    let nextScrollRow = this.scrollRow;
    if (row < this.scrollRow) {
      nextScrollRow = row;
    } else if (row >= this.scrollRow + this.getVisibleRows()) {
      nextScrollRow = row - this.getVisibleRows() + 1;
    }
    if (nextScrollRow !== this.scrollRow) {
      this.scrollRow = nextScrollRow;
      this.refresh(focusKey);
    }
  }

  private getTankKey(index: number): string {
    return `tank-${index}`;
  }

  private getTankIndex(key: string): number {
    if (!key.startsWith('tank-')) {
      return -1;
    }
    const index = Number(key.slice('tank-'.length));
    return Number.isInteger(index) ? index : -1;
  }

  private isMultiplayerSelection(): boolean {
    return (this.params as TankSelectLocationParams).multiplayer === true;
  }

  private updateTransitionTimer(): void {
    if (this.transitionExpired) return;
    const seconds = this.getTransitionSeconds();
    if (seconds === null) return;
    if (seconds !== this.transitionTimerSecond) {
      this.transitionTimerSecond = seconds;
      this.transitionTimer?.setText(this.formatTransitionTime(seconds));
    }
    if (seconds === 0) {
      this.transitionExpired = true;
      this.navigator.replace(GameSceneType.MainMenu);
    }
  }

  private getTransitionSeconds(): number | null {
    const deadline = Number(
      (this.params as TankSelectLocationParams).transitionDeadline,
    );
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }

  private formatTransitionTime(seconds: number): string {
    const stage = Math.max(
      1,
      Math.floor((this.params as TankSelectLocationParams).stage || 1),
    );
    return `STAGE ${stage} SLOT ${seconds.toString().padStart(2, '0')}S`;
  }

}
