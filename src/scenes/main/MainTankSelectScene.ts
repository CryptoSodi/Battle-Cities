import { GameObject, RectPainter } from '../../core';
import { GameUpdateArgs, Session } from '../../game';
import { MapLoader } from '../../map';
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
  tier: TankTier;
  name: string;
  role: string;
  spriteId: string;
  fuelCost: number;
}

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
];

class TankOptionCard extends GameObject implements UiActionTarget {
  public painter: RectPainter;
  private readonly title: UiText;
  private readonly footer: UiPanel;
  private readonly footerText: UiText;
  private readonly selected: boolean;
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

    const type = new TankType(TankParty.Player, option.tier);
    const attributes = TankAttributesFactory.create(type);
    const stats = [
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
      selected ? UI.YELLOW : UI.PRICE,
      selected ? UI.YELLOW_LIGHT : UI.PRICE_BORDER,
    );
    this.footer.position.set(8, footerY);
    this.add(this.footer);

    const fuelIcon = new UiIcon('shop.fuel', mobile ? 34 : 32);
    fuelIcon.position.set(Math.floor(width / 2) - 62, footerY + 11);
    this.add(fuelIcon);

    this.footerText = new UiText(
      `${option.fuelCost} FUEL`,
      selected ? UI.WHITE : UI.PRICE_TEXT,
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
    this.title.setColor(highlighted ? UI.WHITE : UI.GREEN);
    this.footer.painter.fillColor = highlighted ? UI.YELLOW : UI.PRICE;
    this.footer.painter.strokeColor = highlighted
      ? UI.YELLOW_LIGHT
      : UI.PRICE_BORDER;
    this.footerText.setColor(highlighted ? UI.WHITE : UI.PRICE_TEXT);
    this.setNeedsPaint();
  }
}

export class MainTankSelectScene extends PanelScene {
  private session: Session;
  private mapLoader: MapLoader;
  private shopManager: ShopManager;
  private selectedIndex = 0;

  protected setup(updateArgs: GameUpdateArgs): void {
    const { gameStorage, mapLoader, session } = updateArgs;
    this.session = session;
    this.mapLoader = mapLoader;
    this.shopManager = new ShopManager(gameStorage);
    super.setup(updateArgs);
  }

  protected getTitle(): string {
    return 'SELECT TANK';
  }

  protected getTitleIcon(): string {
    return 'tank.player.primary.a.up.1';
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 76 : 96;
  }

  protected getInitialFocusKey(): string {
    return this.getTankKey(this.selectedIndex);
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const columns = this.getColumns();
    const selectedKey = this.getTankKey(this.selectedIndex);

    if (direction > 0 && currentKey === 'back') {
      return selectedKey;
    }
    if (direction < 0 && currentKey === 'deploy') {
      return selectedKey;
    }

    const index = this.getTankIndex(currentKey);
    if (index === -1) {
      return null;
    }
    const row = Math.floor(index / columns);
    const lastRow = Math.floor((TANK_OPTIONS.length - 1) / columns);
    if (direction < 0 && row === 0) {
      return 'back';
    }
    if (direction > 0 && row === lastRow) {
      return 'deploy';
    }
    return null;
  }

  protected load(): void {
    this.statusText = '';
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
    const rows = Math.ceil(TANK_OPTIONS.length / columns);
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

    TANK_OPTIONS.forEach((option, index) => {
      const cardX = innerX + (index % columns) * (cardWidth + gap);
      const cardY = gridY + Math.floor(index / columns) * (cardHeight + gap);
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
      'DEPLOY  →',
      'deploy',
      () => this.deploySelectedTank(),
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
      y + 13,
      UI.MUTED,
      mobile ? 20 : 18,
      '800',
      230,
    );
    this.addText(
      `${this.shopManager.getFuelBalance()}`,
      x + 82,
      y + 38,
      UI.YELLOW,
      mobile ? 30 : 27,
      '900',
      230,
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

  private deploySelectedTank(): void {
    const option = TANK_OPTIONS[this.selectedIndex];
    if (!this.shopManager.consumeFuelForRun(option.fuelCost)) {
      this.setStatus(`NEED ${option.fuelCost} FUEL - VISIT THE SHOP`);
      return;
    }

    this.session.setPlayerTankTier(0, option.tier);
    this.session.primaryPlayer.setTankTier(option.tier);
    this.session.setRunConsumables(
      this.shopManager.getEquippedRunConsumables(),
    );
    this.session.start(1, this.mapLoader.getItemsCount());
    this.navigator.replace(GameSceneType.LevelLoad);
  }

  private getColumns(): number {
    return config.isMobileTouchViewport() ? 2 : 4;
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
}
