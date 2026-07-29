import {
  GameObject,
  RectPainter,
  SpriteAlignment,
  SpritePainter,
  Vector,
} from '../../core';
import { Painter } from '../../core/Painter';
import { RenderContext } from '../../core/render';
import {
  UI_FONT_FAMILY,
  UI_TEXT_LETTER_SPACING,
  UI_TEXT_STROKE_COLOR,
  UI_TEXT_STROKE_WIDTH,
} from '../../core/text/UiTypography';
import { GameUpdateArgs, Session } from '../../game';
import { MenuInputContext } from '../../input';
import { MapLoader } from '../../map';
import { apiFetch } from '../../network/api';
import { storeMultiplayerRuntime } from '../../network/multiplayerRuntime';
import {
  ShopCatalogItem,
  ShopCurrency,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopManager,
} from '../../shop';
import { TankTier } from '../../tank';
import * as config from '../../config';
import type {
  MultiplayerAssignment,
  MultiplayerStartResponse,
} from '@battlecities/shared';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

enum ShopView {
  Shop,
  Loadout,
}

enum ShopCategory {
  All,
  Fuel,
  Powerups,
  Packs,
}

enum ShopMarket {
  Token,
  Sol,
}

type ShopActionKind = 'view' | 'market' | 'category' | 'page' | 'catalog' | 'slot' | 'wallet' | 'start' | 'back';
type ShopNavLayer = 'top' | 'category' | 'items' | 'side';

interface ShopAction {
  key: string;
  kind: ShopActionKind;
  target: ShopButton | ShopCard;
  navLayer?: ShopNavLayer;
  navRow?: number;
  navCol?: number;
  view?: ShopView;
  market?: ShopMarket;
  category?: ShopCategory;
  itemId?: ShopItemId;
  itemIndex?: number;
  slot?: ShopLoadoutSlot;
}

interface ShopLocationParams {
  battleSetup?: boolean;
  multiplayer?: boolean;
  tankTier?: TankTier;
  fuelCost?: number;
}

const COLOR_PAGE = '#05080a';
const COLOR_PANEL = '#0b1014';
const COLOR_PANEL_ALT = '#12181d';
const COLOR_PANEL_RAISED = '#182026';
const COLOR_PANEL_LINE = '#35414a';
const COLOR_PANEL_HIGHLIGHT = '#65717a';
const COLOR_CARD = '#0b1013';
const COLOR_CARD_FOCUS = '#18242b';
const COLOR_CARD_TITLE = '#35cf06';
const COLOR_YELLOW = '#f2ad0d';
const COLOR_YELLOW_LIGHT = '#ffd75a';
const COLOR_YELLOW_DARK = '#8f6506';
const COLOR_MUTED = '#8f989f';
const COLOR_PRICE = '#174d11';
const COLOR_PRICE_BORDER = '#4d982f';
const COLOR_PRICE_TEXT = '#f3e6a6';
const COLOR_RED = '#5b1b18';
const COLOR_RED_FOCUS = '#982d26';
const COLOR_RED_BORDER = '#d34c3e';

const SHOP_WIDTH = 1240;
const SHOP_HEIGHT = 820;
const SIDE_WIDTH = 314;
const SIDE_PANEL_WIDTH = SIDE_WIDTH - 16;
const SIDE_CONTENT_WIDTH = SIDE_WIDTH - 56;
const SIDE_CONTENT_INSET = Math.floor(
  (SIDE_PANEL_WIDTH - SIDE_CONTENT_WIDTH) / 2,
);
const TOP_Y = 96;
const TAB_HEIGHT = 58;
const FILTER_HEIGHT = 56;
const FILTER_TAB_COLUMNS = 4;
const FILTER_TAB_GAP = 20;
const FILTER_TAB_WIDTH = Math.floor(
  (SHOP_WIDTH - SIDE_WIDTH - 92 - FILTER_TAB_GAP * (FILTER_TAB_COLUMNS - 1)) /
    FILTER_TAB_COLUMNS,
);
const CARD_COLUMNS = 4;
const CATALOG_VISIBLE_ROWS = 3;
const CARD_WIDTH = 202;
const CARD_HEIGHT = 198;
const CARD_GAP_X = 8;
const CARD_GAP_Y = 8;
const LOADOUT_SLOT_WIDTH = 192;
const LOADOUT_SLOT_HEIGHT = 132;
const LOADOUT_SLOT_GAP_X = 22;
const LOADOUT_OWNED_TILE_WIDTH = 192;
const LOADOUT_OWNED_TILE_GAP_X = 22;
const SIDE_OWNED_COLUMNS = 3;
const SIDE_OWNED_GAP_X = 8;
const SIDE_OWNED_GAP_Y = 10;
const SIDE_OWNED_TILE_WIDTH = Math.floor(
  (SIDE_WIDTH - 56 - SIDE_OWNED_GAP_X * (SIDE_OWNED_COLUMNS - 1)) /
    SIDE_OWNED_COLUMNS,
);
const SIDE_OWNED_TILE_HEIGHT = 96;
const SIDE_OWNED_GRID_WIDTH =
  SIDE_OWNED_TILE_WIDTH * SIDE_OWNED_COLUMNS +
  SIDE_OWNED_GAP_X * (SIDE_OWNED_COLUMNS - 1);
const SIDE_OWNED_GRID_INSET = Math.floor(
  (SIDE_PANEL_WIDTH - SIDE_OWNED_GRID_WIDTH) / 2,
);
const ICON_SIZE = 82;
const SHOP_FONT = UI_FONT_FAMILY;

const MOBILE_SHOP_WIDTH = 744;
const MOBILE_PAGE_INSET = 16;
const MOBILE_INNER_WIDTH = MOBILE_SHOP_WIDTH - MOBILE_PAGE_INSET * 2;
const MOBILE_TOP_Y = 8;
const MOBILE_TAB_HEIGHT = 60;
const MOBILE_SHELL_Y = 76;
const MOBILE_SUMMARY_HEIGHT = 94;
const MOBILE_OWNED_COLUMNS = 8;
const MOBILE_OWNED_GAP = 8;
const MOBILE_OWNED_TILE_WIDTH = Math.floor(
  (MOBILE_INNER_WIDTH - MOBILE_OWNED_GAP * (MOBILE_OWNED_COLUMNS - 1)) /
    MOBILE_OWNED_COLUMNS,
);
const MOBILE_OWNED_TILE_HEIGHT = 104;
const MOBILE_FILTER_HEIGHT = 60;
const MOBILE_FILTER_GAP = 10;
const MOBILE_FILTER_WIDTH = Math.floor(
  (MOBILE_INNER_WIDTH - MOBILE_FILTER_GAP * (FILTER_TAB_COLUMNS - 1)) /
    FILTER_TAB_COLUMNS,
);
const MOBILE_CARD_COLUMNS = 3;
const MOBILE_CATALOG_VISIBLE_ROWS = 4;
const MOBILE_CARD_GAP = 12;
const MOBILE_CARD_WIDTH = Math.floor(
  (MOBILE_INNER_WIDTH - MOBILE_CARD_GAP * (MOBILE_CARD_COLUMNS - 1)) /
    MOBILE_CARD_COLUMNS,
);
const MOBILE_CARDS_Y = 496;
const MOBILE_CARD_MIN_HEIGHT = 150;
const MOBILE_CARD_MAX_HEIGHT = 216;

class NativeTextPainter extends Painter {
  public text: string;
  public color: string;
  public fontSize: number;
  public fontWeight: string;
  public maxWidth: number;
  public align: CanvasTextAlign;

  constructor(
    text: string,
    color: string,
    fontSize: number,
    fontWeight: string,
    maxWidth: number,
    align: CanvasTextAlign = 'left',
  ) {
    super();
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.fontWeight = fontWeight;
    this.maxWidth = maxWidth;
    this.align = align;
  }

  public paint(context: RenderContext, renderObject: GameObject): void {
    const { min } = renderObject.getWorldBoundingBox();
    context.drawText(
      this.text,
      min.x,
      min.y,
      this.maxWidth,
      this.fontSize,
      SHOP_FONT,
      this.fontWeight,
      this.color,
      this.align,
      UI_TEXT_STROKE_COLOR,
      UI_TEXT_STROKE_WIDTH,
      UI_TEXT_LETTER_SPACING,
    );
  }
}

class ShopText extends GameObject {
  public painter: NativeTextPainter;

  constructor(
    text = '',
    color = config.COLOR_WHITE,
    fontSize = 24,
    fontWeight = '700',
    maxWidth: number = null,
    align: CanvasTextAlign = 'left',
  ) {
    const width = maxWidth ?? Math.max(24, Math.ceil(text.length * fontSize * 0.62));
    super(width, Math.ceil(fontSize * 1.35));
    this.painter = new NativeTextPainter(text, color, fontSize, fontWeight, width, align);
  }

  public setText(text: string): void {
    this.painter.text = text;
    this.setNeedsPaint();
  }

  public setColor(color: string): void {
    this.painter.color = color;
    this.setNeedsPaint();
  }
}

class ShopPanel extends GameObject {
  public painter: RectPainter;

  constructor(width: number, height: number, fill = COLOR_PANEL, stroke = null) {
    super(width, height);
    this.painter = new RectPainter(fill, stroke);
    this.painter.lineWidth = 2;
  }
}

class ShopButton extends GameObject {
  private background: RectPainter;
  private highlight: ShopPanel;
  private label: ShopText;
  private active = false;
  private focused = false;
  private readonly variant: 'normal' | 'back';

  constructor(
    width: number,
    height: number,
    text: string,
    variant: 'normal' | 'back' = 'normal',
    iconId: string = null,
  ) {
    super(width, height);
    this.variant = variant;

    this.background = new RectPainter(COLOR_PANEL_ALT, COLOR_YELLOW_DARK);
    this.background.lineWidth = 2;
    this.painter = this.background;

    this.highlight = new ShopPanel(width - 8, 2, COLOR_PANEL_LINE, null);
    this.highlight.position.set(4, 4);
    this.add(this.highlight);

    const labelFontSize = 24;
    const labelLineHeight = Math.ceil(labelFontSize * 1.18);
    const labelY = Math.floor((height - labelLineHeight) / 2) + 3;
    let labelX = 2;
    let labelWidth = width - 4;

    if (iconId !== null) {
      const iconSize = 34;
      const iconGap = 10;
      const estimatedTextWidth = Math.ceil(
        text.length * labelFontSize * 0.48,
      );
      const contentWidth = iconSize + iconGap + estimatedTextWidth;
      const contentX = Math.max(10, Math.floor((width - contentWidth) / 2));
      const icon = new ShopIcon(iconId, 34, SpriteAlignment.AspectFit);
      icon.position.set(contentX, Math.floor((height - iconSize) / 2));
      this.add(icon);

      labelX = contentX + iconSize + iconGap;
      labelWidth = Math.min(estimatedTextWidth + 4, width - labelX - 8);
    }

    this.label = new ShopText(
      text,
      config.COLOR_WHITE,
      labelFontSize,
      '700',
      labelWidth,
      iconId === null ? 'center' : 'left',
    );
    this.label.position.set(labelX, labelY);
    this.add(this.label);
  }

  public setText(text: string): void {
    this.label.setText(text);
  }

  public setActive(active: boolean): void {
    this.active = active;
    this.refreshStyle();
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.refreshStyle();
  }

  private refreshStyle(): void {
    if (this.active) {
      this.background.fillColor = COLOR_YELLOW;
      this.background.strokeColor = COLOR_YELLOW_LIGHT;
      this.highlight.painter.fillColor = COLOR_YELLOW_LIGHT;
      this.label.setColor(config.COLOR_WHITE);
    } else if (this.variant === 'back' && this.focused) {
      this.background.fillColor = COLOR_RED_FOCUS;
      this.background.strokeColor = COLOR_RED_BORDER;
      this.highlight.painter.fillColor = COLOR_RED_BORDER;
      this.label.setColor(config.COLOR_WHITE);
    } else if (this.focused) {
      this.background.fillColor = COLOR_PANEL_RAISED;
      this.background.strokeColor = COLOR_YELLOW;
      this.highlight.painter.fillColor = COLOR_PANEL_HIGHLIGHT;
      this.label.setColor(config.COLOR_WHITE);
    } else {
      this.background.fillColor = COLOR_PANEL_ALT;
      this.background.strokeColor = COLOR_PANEL_LINE;
      this.highlight.painter.fillColor = COLOR_PANEL_LINE;
      this.label.setColor(COLOR_YELLOW);
    }

    this.background.lineWidth = this.focused ? 3 : 2;
    this.setNeedsPaint();
  }
}

class ShopIcon extends GameObject {
  public painter: SpritePainter = null;
  private readonly spriteId: string;
  private readonly alignment: SpriteAlignment;

  constructor(
    spriteId: string,
    size = ICON_SIZE,
    alignment = SpriteAlignment.Stretch,
  ) {
    super(size, size);
    this.spriteId = spriteId;
    this.alignment = alignment;
  }

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    this.painter = new SpritePainter(
      spriteLoader.load(this.spriteId),
      this.alignment,
    );
  }
}

class ShopCard extends GameObject {
  private background: RectPainter;
  private footer: ShopPanel;
  private topHighlight: ShopPanel;
  private title: ShopText;
  private detail: ShopText;
  private price: ShopText;
  private priceIcon: ShopIcon = null;
  private icon: ShopIcon;
  private focused = false;
  private readonly priceFontSize: number;
  private readonly priceIconSize: number;

  constructor(
    width: number,
    height: number,
    iconId: string,
    detailFontSizeOverride: number = null,
    detailMaxWidthOverride: number = null,
    footerVariant: 'purchase' | 'equip' = 'purchase',
    iconAlignment = SpriteAlignment.Stretch,
    showIconFrame = true,
    swapBodyLayout = false,
    iconPadding = 0,
    priceIconId: string = null,
    uiScale = 1,
  ) {
    super(width, height);
    const compact = height <= LOADOUT_SLOT_HEIGHT;
    const scaledIconSize = Math.round(ICON_SIZE * uiScale);
    const scaledIconPadding = Math.round(iconPadding * uiScale);
    const titleFontSize = Math.round((compact ? 21 : 23) * uiScale);
    const detailFontSize =
      detailFontSizeOverride ?? Math.round((compact ? 16 : 24) * uiScale);
    const priceFontSize = Math.round((compact ? 19 : 20) * uiScale);
    this.priceFontSize = priceFontSize;
    this.priceIconSize = Math.round(
      (footerVariant === 'purchase' ? 30 : 26) * uiScale,
    );
    const footerInset = Math.round(11 * uiScale);
    const footerHeight = Math.round(38 * uiScale);
    const footerY = height - Math.round(47 * uiScale);
    const iconY = Math.round((compact ? 34 : 42) * uiScale);
    const titleY = Math.round((compact ? 12 : 16) * uiScale);
    const detailY = Math.round((compact ? 42 : 78) * uiScale);
    const priceLineHeight = Math.ceil(priceFontSize * 1.18);
    const priceY =
      footerY + Math.floor((footerHeight - priceLineHeight) / 2) + 2;
    const detailMaxWidth =
      detailMaxWidthOverride ??
      (swapBodyLayout
        ? width - scaledIconSize - Math.round(28 * uiScale)
        : width - scaledIconSize - Math.round(48 * uiScale));
    const iconFrameX = swapBodyLayout
      ? Math.round(10 * uiScale)
      : width - scaledIconSize - Math.round(14 * uiScale);
    const iconSize = Math.max(
      Math.round(24 * uiScale),
      scaledIconSize - scaledIconPadding * 2,
    );

    this.background = new RectPainter(COLOR_CARD, COLOR_YELLOW_DARK);
    this.background.lineWidth = 1;
    this.painter = this.background;

    this.topHighlight = new ShopPanel(width - 10, 2, COLOR_PANEL_LINE, null);
    this.topHighlight.position.set(5, 5);
    this.add(this.topHighlight);

    this.footer = new ShopPanel(
      width - footerInset * 2,
      footerHeight,
      COLOR_PRICE,
      COLOR_PRICE_BORDER,
    );
    this.footer.position.set(footerInset, footerY);
    this.add(this.footer);

    if (showIconFrame) {
      const iconFrame = new ShopPanel(
        scaledIconSize + Math.round(8 * uiScale),
        scaledIconSize + Math.round(8 * uiScale),
        '#070a0c',
        COLOR_PANEL_HIGHLIGHT,
      );
      iconFrame.position.set(iconFrameX, iconY - Math.round(4 * uiScale));
      this.add(iconFrame);
    }

    this.icon = new ShopIcon(iconId, iconSize, iconAlignment);
    this.icon.position.set(
      iconFrameX + Math.round(4 * uiScale) + scaledIconPadding,
      iconY + scaledIconPadding,
    );
    this.add(this.icon);

    this.title = new ShopText(
      '',
      COLOR_CARD_TITLE,
      titleFontSize,
      '700',
      width - 36,
      'center',
    );
    this.title.position.set(18, titleY);
    this.add(this.title);

    this.detail = new ShopText('', COLOR_YELLOW, detailFontSize, '700', detailMaxWidth);
    this.detail.position.set(
      swapBodyLayout
        ? scaledIconSize + Math.round(24 * uiScale)
        : Math.round(20 * uiScale),
      detailY,
    );
    this.add(this.detail);

    this.price = new ShopText(
      '',
      COLOR_PRICE_TEXT,
      priceFontSize,
      '700',
      width - 16,
      priceIconId === null ? 'center' : 'left',
    );
    this.price.position.set(8, priceY);
    this.add(this.price);

    if (priceIconId !== null) {
      this.priceIcon = new ShopIcon(
        priceIconId,
        this.priceIconSize,
        SpriteAlignment.AspectFit,
      );
      this.priceIcon.position.set(
        8,
        footerY + Math.floor((footerHeight - this.priceIconSize) / 2),
      );
      this.add(this.priceIcon);
    }
  }

  public setContent(
    title: string,
    detail: string,
    price: string,
  ): void {
    this.title.setText(title);
    this.detail.setText(detail);
    this.price.setText(price);

    if (this.priceIcon !== null) {
      const estimatedTextWidth = Math.min(
        this.size.width - this.priceIconSize - 32,
        Math.ceil(price.length * this.priceFontSize * 0.58),
      );
      const groupWidth = this.priceIconSize + 8 + estimatedTextWidth;
      const groupX = Math.round((this.size.width - groupWidth) / 2);
      this.priceIcon.position.x = groupX;
      this.price.position.x = groupX + this.priceIconSize + 8;
    }
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.background.fillColor = focused ? COLOR_CARD_FOCUS : COLOR_CARD;
    this.background.strokeColor = focused ? COLOR_YELLOW_LIGHT : COLOR_YELLOW_DARK;
    this.background.lineWidth = focused ? 3 : 1;
    this.topHighlight.painter.fillColor = focused ? COLOR_YELLOW_LIGHT : COLOR_PANEL_LINE;
    this.title.setColor(focused ? config.COLOR_WHITE : COLOR_CARD_TITLE);
    this.detail.setColor(focused ? config.COLOR_WHITE : COLOR_YELLOW);
    this.footer.painter.fillColor = focused ? COLOR_YELLOW : COLOR_PRICE;
    this.footer.painter.strokeColor = focused
      ? COLOR_YELLOW_LIGHT
      : COLOR_PRICE_BORDER;
    this.price.setColor(focused ? config.COLOR_WHITE : COLOR_PRICE_TEXT);
    this.setNeedsPaint();
  }
}

export class MainShopScene extends GameScene<ShopLocationParams> {
  private shopManager: ShopManager;
  private session: Session;
  private mapLoader: MapLoader;
  private panelHeight = SHOP_HEIGHT;
  private view = ShopView.Shop;
  private market = ShopMarket.Token;
  private category = ShopCategory.All;
  private catalogScrollRow = 0;
  private statusText = 'CONNECT WALLET';
  private actions: ShopAction[] = [];
  private focusedActionIndex = 0;
  private pendingActionIndex: number = null;
  private verticalParentKeys: { [layer: string]: string } = {};
  private battleStartPending = false;

  protected setup({ gameStorage, mapLoader, session }: GameUpdateArgs): void {
    this.shopManager = new ShopManager(gameStorage);
    this.mapLoader = mapLoader;
    this.session = session;
    if (this.isBattleSetup()) {
      this.view = ShopView.Loadout;
      this.statusText = 'EQUIP POWERUPS, THEN START';
    }
    this.renderShop();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager, pointerClick, pointerSwipe } = updateArgs;
    const inputMethod = inputManager.getActiveMethod();

    if (
      pointerSwipe !== null &&
      config.isMobileTouchViewport() &&
      this.handleCatalogSwipe(pointerSwipe)
    ) {
      updateArgs.pointerSwipe = null;
    } else if (pointerClick !== null && this.handlePointer(pointerClick)) {
      updateArgs.pointerClick = null;
    } else if (inputMethod.isDownAny(MenuInputContext.HorizontalPrev)) {
      this.focusDirection(-1, 0);
    } else if (inputMethod.isDownAny(MenuInputContext.HorizontalNext)) {
      this.focusDirection(1, 0);
    } else if (inputMethod.isDownAny(MenuInputContext.VerticalPrev)) {
      this.focusDirection(0, -1);
    } else if (inputMethod.isDownAny(MenuInputContext.VerticalNext)) {
      this.focusDirection(0, 1);
    } else if (inputMethod.isDownAny(MenuInputContext.Select)) {
      this.queueFocusedAction();
    }

    this.activatePendingAction();

    super.update(updateArgs);
  }

  private renderShop(preferredFocusKey: string = null): void {
    this.root.removeAllChildren();
    this.actions = [];

    const background = new ShopPanel(
      this.root.size.width,
      this.root.size.height,
      COLOR_PAGE,
    );
    background.setZIndex(-10);
    this.root.add(background);

    if (config.isMobileTouchViewport()) {
      this.renderMobileShop(preferredFocusKey);
      return;
    }

    const originX = Math.max(24, Math.round((this.root.size.width - SHOP_WIDTH) / 2));
    const originY = Math.max(24, TOP_Y);
    this.panelHeight = config.isMobileTouchViewport()
      ? Math.max(
          SHOP_HEIGHT,
          this.root.size.height - originY - 24,
        )
      : SHOP_HEIGHT;

    const shell = new ShopPanel(
      SHOP_WIDTH,
      this.panelHeight,
      COLOR_PANEL,
      COLOR_PANEL_LINE,
    );
    shell.position.set(originX, originY);
    shell.setZIndex(-2);
    this.root.add(shell);

    const shellAccent = new ShopPanel(SHOP_WIDTH - 12, 2, COLOR_YELLOW_DARK, null);
    shellAccent.position.set(originX + 6, originY + 5);
    this.root.add(shellAccent);

    const tabY = originY - TAB_HEIGHT + 1;
    if (this.isBattleSetup()) {
      this.addViewTab(originX + 12, tabY, 'LOADOUT', ShopView.Loadout);
    } else {
      this.addMarketTab(originX + 12, tabY, 'TOKEN SHOP', ShopMarket.Token);
      this.addMarketTab(originX + 230, tabY, 'SOL SHOP', ShopMarket.Sol);
      this.addViewTab(originX + 448, tabY, 'LOADOUT', ShopView.Loadout);
    }

    const sideX = originX + 8;
    const panelY = originY + 16;
    const contentPanelX = originX + SIDE_WIDTH + 8;
    const contentPanelWidth = SHOP_WIDTH - SIDE_WIDTH - 16;
    const contentPanel = new ShopPanel(
      contentPanelWidth,
      this.panelHeight - 32,
      COLOR_PAGE,
      COLOR_PANEL_LINE,
    );
    contentPanel.position.set(contentPanelX, panelY);
    contentPanel.setZIndex(-1);
    this.root.add(contentPanel);

    this.renderSidePanel(sideX, panelY);
    this.renderContent(contentPanelX + 24, panelY + 18);

    this.addButton(originX + SHOP_WIDTH - 152, tabY + 5, 140, 48, '←  BACK', {
      key: 'back',
      kind: 'back',
    });

    this.focusActionByKey(preferredFocusKey);
  }

  private renderMobileShop(preferredFocusKey: string): void {
    const originX = Math.round((this.root.size.width - MOBILE_SHOP_WIDTH) / 2);
    this.panelHeight = this.root.size.height - MOBILE_SHELL_Y - 16;

    const shell = new ShopPanel(
      MOBILE_SHOP_WIDTH,
      this.panelHeight,
      COLOR_PANEL,
      COLOR_PANEL_LINE,
    );
    shell.position.set(originX, MOBILE_SHELL_Y);
    shell.setZIndex(-2);
    this.root.add(shell);

    const shellAccent = new ShopPanel(
      MOBILE_SHOP_WIDTH - 12,
      2,
      COLOR_YELLOW_DARK,
      null,
    );
    shellAccent.position.set(originX + 6, MOBILE_SHELL_Y + 5);
    this.root.add(shellAccent);

    if (this.isBattleSetup()) {
      this.addButton(
        originX,
        MOBILE_TOP_Y,
        190,
        MOBILE_TAB_HEIGHT,
        'LOADOUT',
        { key: `view:${ShopView.Loadout}`, kind: 'view', view: ShopView.Loadout },
        true,
        'shop.tab.loadout',
      );
    } else {
      this.addButton(
        originX,
        MOBILE_TOP_Y,
        190,
        MOBILE_TAB_HEIGHT,
        'TOKEN SHOP',
        { key: `market:${ShopMarket.Token}`, kind: 'market', market: ShopMarket.Token },
        this.view === ShopView.Shop && this.market === ShopMarket.Token,
        'shop.tab.token',
      );
      this.addButton(
        originX + 198,
        MOBILE_TOP_Y,
        170,
        MOBILE_TAB_HEIGHT,
        'SOL SHOP',
        { key: `market:${ShopMarket.Sol}`, kind: 'market', market: ShopMarket.Sol },
        this.view === ShopView.Shop && this.market === ShopMarket.Sol,
        'shop.tab.solana',
      );
      this.addButton(
        originX + 376,
        MOBILE_TOP_Y,
        180,
        MOBILE_TAB_HEIGHT,
        'LOADOUT',
        { key: `view:${ShopView.Loadout}`, kind: 'view', view: ShopView.Loadout },
        this.view === ShopView.Loadout,
        'shop.tab.loadout',
      );
    }
    this.addButton(
      originX + 592,
      MOBILE_TOP_Y,
      152,
      MOBILE_TAB_HEIGHT,
      '←  BACK',
      { key: 'back', kind: 'back' },
    );

    const contentX = originX + MOBILE_PAGE_INSET;
    this.renderMobileSummary(
      contentX,
      MOBILE_SHELL_Y + 12,
      MOBILE_INNER_WIDTH,
    );
    this.renderMobileOwnedItems(contentX, 206, MOBILE_INNER_WIDTH);

    if (this.view === ShopView.Shop) {
      this.renderMobileShopContent(contentX);
    } else {
      this.renderMobileLoadoutContent(contentX);
    }

    this.focusActionByKey(preferredFocusKey);
  }

  private renderMobileSummary(x: number, y: number, width: number): void {
    const panel = new ShopPanel(
      width,
      MOBILE_SUMMARY_HEIGHT,
      COLOR_PAGE,
      COLOR_PANEL_LINE,
    );
    panel.position.set(x, y);
    this.root.add(panel);

    this.addButton(
      x + 12,
      y + 17,
      154,
      60,
      this.shopManager.isWalletConnected() ? 'CONNECTED' : 'CONNECT',
      { key: 'wallet', kind: 'wallet' },
      this.shopManager.isWalletConnected(),
    );

    [180, 356, 532].forEach((offset) => {
      const divider = new ShopPanel(2, 64, COLOR_PANEL_LINE, null);
      divider.position.set(x + offset, y + 15);
      this.root.add(divider);
    });

    this.addMobileResource(
      x + 200,
      y + 6,
      'BACT',
      this.shopManager.getTokenBalance().toString(),
      'shop.tab.token',
    );
    this.addMobileResource(
      x + 376,
      y + 6,
      'SOL',
      this.formatSol(this.shopManager.getSolBalance()),
      'shop.tab.solana',
    );
    this.addMobileResource(
      x + 552,
      y + 6,
      'FUEL',
      this.shopManager.getFuelBalance().toString(),
      'shop.fuel',
    );
  }

  private addMobileResource(
    x: number,
    y: number,
    label: string,
    value: string,
    iconId: string,
  ): void {
    const icon = new ShopIcon(iconId, 46, SpriteAlignment.AspectFit);
    icon.position.set(x + 7, y + 15);
    this.root.add(icon);

    const labelText = new ShopText(label, config.COLOR_WHITE, 22, '700', 84);
    labelText.position.set(x + 62, y + 13);
    this.root.add(labelText);

    const valueText = new ShopText(value, COLOR_MUTED, 24, '700', 84);
    valueText.position.set(x + 62, y + 42);
    this.root.add(valueText);
  }

  private renderMobileOwnedItems(x: number, y: number, width: number): void {
    const title = new ShopText('Owned Items', config.COLOR_WHITE, 26, '700', width);
    title.position.set(x, y);
    this.root.add(title);

    const ownedItems = [
      ShopInventoryItemId.Shield,
      ShopInventoryItemId.BaseDefence,
      ShopInventoryItemId.Freeze,
      ShopInventoryItemId.Speed,
      ShopInventoryItemId.Upgrade,
      ShopInventoryItemId.ZoomOut,
      ShopInventoryItemId.Wipeout,
      ShopInventoryItemId.ExtraLife,
    ];

    ownedItems.forEach((itemId, index) => {
      this.addMobileInventoryTile(
        x + index * (MOBILE_OWNED_TILE_WIDTH + MOBILE_OWNED_GAP),
        y + 40,
        itemId,
      );
    });

    const divider = new ShopPanel(width, 2, COLOR_PANEL_LINE, null);
    divider.position.set(x, y + 154);
    this.root.add(divider);
  }

  private addMobileInventoryTile(
    x: number,
    y: number,
    itemId: ShopInventoryItemId,
  ): void {
    const tile = new ShopPanel(
      MOBILE_OWNED_TILE_WIDTH,
      MOBILE_OWNED_TILE_HEIGHT,
      COLOR_PANEL_ALT,
      COLOR_PANEL_LINE,
    );
    tile.position.set(x, y);
    this.root.add(tile);

    const iconSize = 68;
    const icon = new ShopIcon(
      this.getOwnedInventoryIconId(itemId),
      iconSize,
      SpriteAlignment.AspectFit,
    );
    icon.position.set(
      x + Math.floor((MOBILE_OWNED_TILE_WIDTH - iconSize) / 2),
      y + 5,
    );
    this.root.add(icon);

    const countStrip = new ShopPanel(
      MOBILE_OWNED_TILE_WIDTH - 4,
      29,
      '#070a0c',
      null,
    );
    countStrip.position.set(x + 2, y + MOBILE_OWNED_TILE_HEIGHT - 31);
    this.root.add(countStrip);

    const count = new ShopText(
      this.getInventoryCountText(itemId),
      COLOR_YELLOW,
      24,
      '700',
      MOBILE_OWNED_TILE_WIDTH,
      'center',
    );
    count.position.set(x, y + 75);
    this.root.add(count);
  }

  private renderMobileShopContent(x: number): void {
    const filterY = 378;
    const categories: Array<[string, ShopCategory]> = [
      ['ALL', ShopCategory.All],
      ['FUEL', ShopCategory.Fuel],
      ['POWER', ShopCategory.Powerups],
      ['PACKS', ShopCategory.Packs],
    ];
    categories.forEach(([label, category], index) => {
      this.addCategoryButton(
        x + index * (MOBILE_FILTER_WIDTH + MOBILE_FILTER_GAP),
        filterY,
        label,
        category,
        MOBILE_FILTER_WIDTH,
        MOBILE_FILTER_HEIGHT,
      );
    });

    const allItems = this.getVisibleCatalogItems();
    if (allItems.length === 0) {
      const sectionText = new ShopText(
        `${this.getCategoryTitle()} 0/0`,
        config.COLOR_WHITE,
        26,
        '700',
        MOBILE_INNER_WIDTH,
      );
      sectionText.position.set(x, 458);
      this.root.add(sectionText);

      const empty = new ShopText(
        'No items in this category',
        COLOR_MUTED,
        26,
        '700',
        MOBILE_INNER_WIDTH,
        'center',
      );
      empty.position.set(x, MOBILE_CARDS_Y + 60);
      this.root.add(empty);
      return;
    }

    const totalRows = Math.max(
      1,
      Math.ceil(allItems.length / MOBILE_CARD_COLUMNS),
    );
    const maxScrollRow = Math.max(0, totalRows - MOBILE_CATALOG_VISIBLE_ROWS);
    this.catalogScrollRow = Math.max(0, Math.min(this.catalogScrollRow, maxScrollRow));
    const firstVisibleIndex = this.catalogScrollRow * MOBILE_CARD_COLUMNS;
    const visibleItems = allItems.slice(
      firstVisibleIndex,
      firstVisibleIndex + MOBILE_CARD_COLUMNS * MOBILE_CATALOG_VISIBLE_ROWS,
    );
    const lastVisibleIndex = firstVisibleIndex + visibleItems.length;
    const sectionText = new ShopText(
      `${this.getCategoryTitle()} ${firstVisibleIndex + 1}-${lastVisibleIndex}/${allItems.length}`,
      config.COLOR_WHITE,
      26,
      '700',
      MOBILE_INNER_WIDTH,
    );
    sectionText.position.set(x, 458);
    this.root.add(sectionText);

    const cardRows = Math.min(totalRows, MOBILE_CATALOG_VISIBLE_ROWS);
    const heightBudget =
      this.root.size.height -
      MOBILE_CARDS_Y -
      52 -
      MOBILE_CARD_GAP * (cardRows - 1);
    const cardHeight = Math.max(
      MOBILE_CARD_MIN_HEIGHT,
      Math.min(MOBILE_CARD_MAX_HEIGHT, Math.floor(heightBudget / cardRows)),
    );

    visibleItems.forEach((item, index) => {
      const itemIndex = firstVisibleIndex + index;
      this.addMobileCatalogCard(
        x + (index % MOBILE_CARD_COLUMNS) * (MOBILE_CARD_WIDTH + MOBILE_CARD_GAP),
        MOBILE_CARDS_Y +
          Math.floor(index / MOBILE_CARD_COLUMNS) *
            (cardHeight + MOBILE_CARD_GAP),
        item,
        Math.floor(itemIndex / MOBILE_CARD_COLUMNS),
        itemIndex % MOBILE_CARD_COLUMNS,
        itemIndex,
        cardHeight,
      );
    });

    const status = new ShopText(
      this.statusText === 'CONNECT WALLET' ? 'ALL ITEMS LOADED' : this.statusText,
      COLOR_MUTED,
      18,
      '700',
      MOBILE_INNER_WIDTH,
      'center',
    );
    status.position.set(x, this.root.size.height - 38);
    this.root.add(status);
  }

  private renderMobileLoadoutContent(x: number): void {
    const title = new ShopText(
      'Equipped Slots',
      config.COLOR_WHITE,
      28,
      '700',
      MOBILE_INNER_WIDTH,
    );
    title.position.set(x, 394);
    this.root.add(title);

    const helper = new ShopText(
      'Select a slot to cycle owned items',
      COLOR_MUTED,
      20,
      '700',
      MOBILE_INNER_WIDTH,
    );
    helper.position.set(x, 432);
    this.root.add(helper);

    const gap = 12;
    const cardWidth = Math.floor((MOBILE_INNER_WIDTH - gap) / 2);
    const footerReserve = this.isBattleSetup() ? 152 : 70;
    const cardHeight = Math.min(
      232,
      Math.floor((this.root.size.height - 510 - footerReserve - gap) / 2),
    );
    const slots: Array<[ShopLoadoutSlot, string]> = [
      [ShopLoadoutSlot.ActiveOne, 'SLOT 1'],
      [ShopLoadoutSlot.ActiveTwo, 'SLOT 2'],
      [ShopLoadoutSlot.ActiveThree, 'SLOT 3'],
      [ShopLoadoutSlot.ActiveFour, 'SLOT 4'],
    ];
    slots.forEach(([slot, label], index) => {
      this.addMobileSlotCard(
        x + (index % 2) * (cardWidth + gap),
        470 + Math.floor(index / 2) * (cardHeight + gap),
        cardWidth,
        cardHeight,
        slot,
        label,
        Math.floor(index / 2),
        index % 2,
      );
    });

    const note = new ShopText(
      this.isBattleSetup()
        ? this.statusText
        : 'Use 1-4 in game to consume equipped powers',
      COLOR_MUTED,
      20,
      '700',
      MOBILE_INNER_WIDTH,
      'center',
    );
    note.position.set(
      x,
      this.root.size.height - (this.isBattleSetup() ? 116 : 42),
    );
    this.root.add(note);

    if (this.isBattleSetup()) {
      this.addBattleStartButton(
        x + Math.floor((MOBILE_INNER_WIDTH - 250) / 2),
        this.root.size.height - 82,
        250,
        58,
        2,
      );
    }
  }

  private renderSidePanel(x: number, y: number): void {
    const panel = new ShopPanel(
      SIDE_PANEL_WIDTH,
      this.panelHeight - 32,
      COLOR_PAGE,
      COLOR_PANEL_LINE,
    );
    panel.position.set(x, y);
    panel.setZIndex(-1);
    this.root.add(panel);

    const heading = new ShopText('Inventory', config.COLOR_WHITE, 28, '700', SIDE_CONTENT_WIDTH);
    heading.position.set(x + SIDE_CONTENT_INSET, y + 30);
    this.root.add(heading);

    this.addButton(
      x + SIDE_CONTENT_INSET,
      y + 68,
      SIDE_CONTENT_WIDTH,
      44,
      this.shopManager.isWalletConnected() ? 'CONNECTED' : 'CONNECT',
      { key: 'wallet', kind: 'wallet' },
      this.shopManager.isWalletConnected(),
    );

    this.addResourceChip(
      x + SIDE_CONTENT_INSET,
      y + 124,
      'BACT',
      this.shopManager.getTokenBalance().toString(),
      'shop.tab.token',
    );
    this.addResourceChip(
      x + SIDE_CONTENT_INSET,
      y + 184,
      'SOL',
      this.formatSol(this.shopManager.getSolBalance()),
      'shop.tab.solana',
    );
    this.addResourceChip(
      x + SIDE_CONTENT_INSET,
      y + 244,
      'FUEL',
      this.shopManager.getFuelBalance().toString(),
      'shop.fuel',
    );

    if (this.view === ShopView.Loadout) {
      return;
    }

    const inventoryY = y + 324;
    const inventoryTitle = new ShopText('Owned Items', config.COLOR_WHITE, 24, '700', SIDE_CONTENT_WIDTH);
    inventoryTitle.position.set(x + SIDE_CONTENT_INSET, inventoryY);
    this.root.add(inventoryTitle);

    const ownedItems = [
      ShopInventoryItemId.Shield,
      ShopInventoryItemId.BaseDefence,
      ShopInventoryItemId.Freeze,
      ShopInventoryItemId.Speed,
      ShopInventoryItemId.Upgrade,
      ShopInventoryItemId.ZoomOut,
      ShopInventoryItemId.Wipeout,
      ShopInventoryItemId.ExtraLife,
    ];

    ownedItems.forEach((itemId, index) => {
      const col = index % SIDE_OWNED_COLUMNS;
      const row = Math.floor(index / SIDE_OWNED_COLUMNS);
      this.addInventoryTile(
        x + SIDE_OWNED_GRID_INSET + col * (SIDE_OWNED_TILE_WIDTH + SIDE_OWNED_GAP_X),
        inventoryY + 42 + row * (SIDE_OWNED_TILE_HEIGHT + SIDE_OWNED_GAP_Y),
        itemId,
      );
    });

    if (this.statusText !== '') {
      const status = new ShopText(
        this.statusText,
        COLOR_MUTED,
        18,
        '600',
        SIDE_CONTENT_WIDTH,
      );
      status.position.set(x + SIDE_CONTENT_INSET, y + this.panelHeight - 76);
      this.root.add(status);
    }
  }

  private renderContent(x: number, y: number): void {
    if (this.view === ShopView.Shop) {
      this.renderShopContent(x, y);
      return;
    }

    this.renderLoadoutContent(x, y);
  }

  private renderShopContent(x: number, y: number): void {
    const contentY = y + 18;

    this.addCategoryButton(x, contentY, 'ALL', ShopCategory.All, FILTER_TAB_WIDTH);
    this.addCategoryButton(
      x + FILTER_TAB_WIDTH + FILTER_TAB_GAP,
      contentY,
      'FUEL',
      ShopCategory.Fuel,
      FILTER_TAB_WIDTH,
    );
    this.addCategoryButton(
      x + (FILTER_TAB_WIDTH + FILTER_TAB_GAP) * 2,
      contentY,
      'POWER',
      ShopCategory.Powerups,
      FILTER_TAB_WIDTH,
    );
    this.addCategoryButton(
      x + (FILTER_TAB_WIDTH + FILTER_TAB_GAP) * 3,
      contentY,
      'PACKS',
      ShopCategory.Packs,
      FILTER_TAB_WIDTH,
    );

    const line = new ShopPanel(SHOP_WIDTH - SIDE_WIDTH - 92, 2, COLOR_PANEL_LINE);
    line.position.set(x, contentY + FILTER_HEIGHT + 14);
    this.root.add(line);

    const allItems = this.getVisibleCatalogItems();
    const visibleItemCount = CARD_COLUMNS * CATALOG_VISIBLE_ROWS;
    const totalRows = Math.max(1, Math.ceil(allItems.length / CARD_COLUMNS));
    const maxScrollRow = Math.max(0, totalRows - CATALOG_VISIBLE_ROWS);
    this.catalogScrollRow = Math.max(0, Math.min(this.catalogScrollRow, maxScrollRow));
    const firstVisibleIndex = this.catalogScrollRow * CARD_COLUMNS;
    const items = allItems.slice(
      firstVisibleIndex,
      firstVisibleIndex + visibleItemCount,
    );

    if (items.length === 0) {
      const empty = new ShopText('No items in this category', COLOR_MUTED, 26, '700', 520);
      empty.position.set(x, contentY + 110);
      this.root.add(empty);
      return;
    }

    if (this.category === ShopCategory.All) {
      const sectionText = new ShopText(
        `All Items ${firstVisibleIndex + 1}-${firstVisibleIndex + items.length}/${allItems.length}`,
        config.COLOR_WHITE,
        26,
        '700',
        520,
      );
      sectionText.position.set(x, contentY + 84);
      this.root.add(sectionText);

      items.forEach((item, index) => {
        const itemIndex = firstVisibleIndex + index;
        const cardX = x + (index % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
        const cardY =
          contentY + 124 + Math.floor(index / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
        this.addCatalogCard(
          cardX,
          cardY,
          item,
          Math.floor(itemIndex / CARD_COLUMNS),
          index % CARD_COLUMNS,
          itemIndex,
        );
      });
      return;
    }

    const sectionText = new ShopText(
      `${this.getCategoryTitle()} ${firstVisibleIndex + 1}-${firstVisibleIndex + items.length}/${allItems.length}`,
      config.COLOR_WHITE,
      26,
      '700',
      520,
    );
    sectionText.position.set(x, contentY + 84);
    this.root.add(sectionText);

    items.forEach((item, index) => {
      const itemIndex = firstVisibleIndex + index;
      const cardX = x + (index % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
      const cardY = contentY + 124 + Math.floor(index / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
      this.addCatalogCard(
        cardX,
        cardY,
        item,
        Math.floor(itemIndex / CARD_COLUMNS),
        index % CARD_COLUMNS,
        itemIndex,
      );
    });
  }

  private renderLoadoutContent(x: number, y: number): void {
    const title = new ShopText('Loadout', config.COLOR_WHITE, 34, '700', 360);
    title.position.set(x, y);
    this.root.add(title);

    const helper = new ShopText('Select a slot to cycle owned items', COLOR_MUTED, 20, '700', 520);
    helper.position.set(x, y + 34);
    this.root.add(helper);

    const ownedTitle = new ShopText('Owned Consumables', config.COLOR_WHITE, 28, '700', 420);
    ownedTitle.position.set(x, y + 88);
    this.root.add(ownedTitle);

    this.addOwnedConsumableTile(x, y + 132, ShopInventoryItemId.Shield);
    this.addOwnedConsumableTile(
      x + LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X,
      y + 132,
      ShopInventoryItemId.BaseDefence,
    );
    this.addOwnedConsumableTile(
      x + (LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X) * 2,
      y + 132,
      ShopInventoryItemId.Freeze,
    );
    this.addOwnedConsumableTile(
      x + (LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X) * 3,
      y + 132,
      ShopInventoryItemId.Speed,
    );
    this.addOwnedConsumableTile(x, y + 234, ShopInventoryItemId.Upgrade);
    this.addOwnedConsumableTile(
      x + LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X,
      y + 234,
      ShopInventoryItemId.ZoomOut,
    );
    this.addOwnedConsumableTile(
      x + (LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X) * 2,
      y + 234,
      ShopInventoryItemId.Wipeout,
    );
    this.addOwnedConsumableTile(
      x + (LOADOUT_OWNED_TILE_WIDTH + LOADOUT_OWNED_TILE_GAP_X) * 3,
      y + 234,
      ShopInventoryItemId.ExtraLife,
    );

    const slotsY = y + 370;
    const slotsTitle = new ShopText('Equipped Slots', config.COLOR_WHITE, 28, '700', 420);
    slotsTitle.position.set(x, slotsY);
    this.root.add(slotsTitle);

    this.addSlotCard(x, slotsY + 44, ShopLoadoutSlot.ActiveOne, 'SLOT 1', 0, 0);
    this.addSlotCard(
      x + LOADOUT_SLOT_WIDTH + LOADOUT_SLOT_GAP_X,
      slotsY + 44,
      ShopLoadoutSlot.ActiveTwo,
      'SLOT 2',
      0,
      1,
    );
    this.addSlotCard(
      x + (LOADOUT_SLOT_WIDTH + LOADOUT_SLOT_GAP_X) * 2,
      slotsY + 44,
      ShopLoadoutSlot.ActiveThree,
      'SLOT 3',
      0,
      2,
    );
    this.addSlotCard(
      x + (LOADOUT_SLOT_WIDTH + LOADOUT_SLOT_GAP_X) * 3,
      slotsY + 44,
      ShopLoadoutSlot.ActiveFour,
      'SLOT 4',
      0,
      3,
    );

    const note = new ShopText(
      this.isBattleSetup()
        ? this.statusText
        : 'Use 1-4 in game to consume equipped powers',
      COLOR_MUTED,
      20,
      '700',
      this.isBattleSetup() ? 540 : 620,
    );
    note.position.set(x, slotsY + 252);
    this.root.add(note);

    if (this.isBattleSetup()) {
      this.addBattleStartButton(
        x + 650,
        slotsY + 232,
        220,
        54,
        1,
      );
    }
  }

  private addMarketTab(
    x: number,
    y: number,
    text: string,
    market: ShopMarket,
  ): void {
    this.addButton(x, y, 210, TAB_HEIGHT, text, {
      key: `market:${market}`,
      kind: 'market',
      market,
    }, this.view === ShopView.Shop && this.market === market,
    market === ShopMarket.Token ? 'shop.tab.token' : 'shop.tab.solana');
  }

  private addViewTab(
    x: number,
    y: number,
    text: string,
    view: ShopView,
  ): void {
    this.addButton(x, y, 210, TAB_HEIGHT, text, {
      key: `view:${view}`,
      kind: 'view',
      view,
    }, this.view === view, 'shop.tab.loadout');
  }

  private addCategoryButton(
    x: number,
    y: number,
    text: string,
    category: ShopCategory,
    width = 140,
    height = FILTER_HEIGHT,
  ): void {
    this.addButton(x, y, width, height, text, {
      key: `category:${category}`,
      kind: 'category',
      category,
    }, this.category === category);
  }

  private addCatalogCard(
    x: number,
    y: number,
    item: ShopCatalogItem,
    row: number,
    col: number,
    itemIndex: number,
  ): void {
    const isStarterPack = item.id === ShopItemId.StarterPack;
    const card = new ShopCard(
      CARD_WIDTH,
      CARD_HEIGHT,
      this.getItemIconId(item.id),
      isStarterPack ? 18 : null,
      isStarterPack ? 80 : null,
      'equip',
      SpriteAlignment.AspectFit,
      false,
      true,
      12,
      this.market === ShopMarket.Token ? 'shop.tab.token' : 'shop.tab.solana',
    );
    card.position.set(x, y);
    card.setContent(
      this.getItemTitle(item.id),
      this.getRewardText(item),
      this.getPriceText(item),
    );
    this.root.add(card);

    this.actions.push({
      key: `catalog:${item.id}`,
      kind: 'catalog',
      itemId: item.id,
      itemIndex,
      target: card,
      navLayer: 'items',
      navRow: row,
      navCol: col,
    });
  }

  private addMobileCatalogCard(
    x: number,
    y: number,
    item: ShopCatalogItem,
    row: number,
    col: number,
    itemIndex: number,
    height: number,
  ): void {
    const isStarterPack = item.id === ShopItemId.StarterPack;
    const uiScale = Math.max(
      1.08,
      Math.min(1.22, (height / CARD_HEIGHT) * 1.12),
    );
    const card = new ShopCard(
      MOBILE_CARD_WIDTH,
      height,
      this.getItemIconId(item.id),
      isStarterPack ? Math.round(18 * uiScale) : null,
      isStarterPack ? Math.round(90 * uiScale) : null,
      'equip',
      SpriteAlignment.AspectFit,
      false,
      true,
      6,
      this.market === ShopMarket.Token ? 'shop.tab.token' : 'shop.tab.solana',
      uiScale,
    );
    card.position.set(x, y);
    card.setContent(
      this.getItemTitle(item.id),
      this.getRewardText(item),
      this.getPriceText(item),
    );
    this.root.add(card);

    this.actions.push({
      key: `catalog:${item.id}`,
      kind: 'catalog',
      itemId: item.id,
      itemIndex,
      target: card,
      navLayer: 'items',
      navRow: row,
      navCol: col,
    });
  }

  private addMobileSlotCard(
    x: number,
    y: number,
    width: number,
    height: number,
    slot: ShopLoadoutSlot,
    title: string,
    row: number,
    col: number,
  ): void {
    const itemId = this.shopManager.getEquipped(slot);
    const uiScale = Math.max(0.9, Math.min(1.12, height / CARD_HEIGHT));
    const card = new ShopCard(
      width,
      height,
      itemId === null
        ? 'shop.loadout.empty'
        : this.getOwnedInventoryIconId(itemId),
      null,
      null,
      'equip',
      SpriteAlignment.AspectFit,
      false,
      true,
      10,
      null,
      uiScale,
    );
    card.position.set(x, y);
    card.setContent(
      title,
      this.getCompactSlotLabel(this.getSlotLabel(slot)),
      'EQUIP',
    );
    this.root.add(card);

    this.actions.push({
      key: `slot:${slot}`,
      kind: 'slot',
      slot,
      target: card,
      navLayer: 'items',
      navRow: row,
      navCol: col,
    });
  }

  private addSlotCard(
    x: number,
    y: number,
    slot: ShopLoadoutSlot,
    title: string,
    row: number,
    col: number,
  ): void {
    const itemId = this.shopManager.getEquipped(slot);
    const card = new ShopCard(
      CARD_WIDTH,
      CARD_HEIGHT,
      itemId === null ? 'shop.loadout.empty' : this.getOwnedInventoryIconId(itemId),
      null,
      null,
      'equip',
      SpriteAlignment.AspectFit,
      false,
      true,
      12,
      null,
    );
    card.position.set(x, y);
    card.setContent(
      title,
      this.getCompactSlotLabel(this.getSlotLabel(slot)),
      'EQUIP',
    );
    this.root.add(card);

    this.actions.push({
      key: `slot:${slot}`,
      kind: 'slot',
      slot,
      target: card,
      navLayer: 'items',
      navRow: row,
      navCol: col,
    });
  }

  private addCompactSlotCard(
    x: number,
    y: number,
    slot: ShopLoadoutSlot,
    title: string,
    row: number,
    col: number,
  ): void {
    const itemId = this.shopManager.getEquipped(slot);
    const card = new ShopCard(
      LOADOUT_SLOT_WIDTH,
      LOADOUT_SLOT_HEIGHT,
      itemId === null ? 'shop.loadout.empty' : this.getOwnedInventoryIconId(itemId),
      null,
      null,
      'purchase',
      SpriteAlignment.AspectFit,
      false,
      true,
      12,
      null,
    );
    card.position.set(x, y);
    card.setContent(
      title,
      this.getCompactSlotLabel(this.getSlotLabel(slot)),
      'EQUIP',
    );
    this.root.add(card);

    this.actions.push({
      key: `slot:${slot}`,
      kind: 'slot',
      slot,
      target: card,
      navLayer: 'items',
      navRow: row,
      navCol: col,
    });
  }

  private addOwnedConsumableTile(
    x: number,
    y: number,
    itemId: ShopInventoryItemId,
  ): void {
    const tile = new ShopPanel(
      LOADOUT_OWNED_TILE_WIDTH,
      82,
      COLOR_PANEL_ALT,
      COLOR_PANEL_LINE,
    );
    tile.position.set(x, y);
    this.root.add(tile);

    const icon = new ShopIcon(
      this.getOwnedInventoryIconId(itemId),
      60,
      SpriteAlignment.AspectFit,
    );
    icon.position.set(x + 8, y + 10);
    this.root.add(icon);

    const label = new ShopText(this.getInventoryLabel(itemId), config.COLOR_WHITE, 16, '700', 112);
    label.position.set(x + 76, y + 14);
    this.root.add(label);

    const count = new ShopText(`${this.getInventoryCountText(itemId)} OWNED`, COLOR_YELLOW, 16, '700', 112);
    count.position.set(x + 76, y + 44);
    this.root.add(count);
  }

  private addButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    action: Omit<ShopAction, 'target'>,
    active = false,
    iconId: string = null,
  ): ShopButton {
    const button = new ShopButton(
      width,
      height,
      text,
      action.kind === 'back' ? 'back' : 'normal',
      iconId,
    );
    button.position.set(x, y);
    button.setActive(active);
    this.root.add(button);

    this.actions.push(
      Object.assign({}, action, {
        target: button,
        navLayer: this.getActionNavLayer(action.kind),
        navRow: 0,
        navCol: x,
      }),
    );

    return button;
  }

  private addBattleStartButton(
    x: number,
    y: number,
    width: number,
    height: number,
    row: number,
  ): void {
    this.addButton(
      x,
      y,
      width,
      height,
      this.battleStartPending ? 'STARTING...' : 'START BATTLE',
      { key: 'start', kind: 'start' },
      true,
    );
    const action = this.actions[this.actions.length - 1];
    action.navLayer = 'items';
    action.navRow = row;
    action.navCol = 1.5;
  }

  private addResourceChip(
    x: number,
    y: number,
    label: string,
    value: string,
    iconId: string,
  ): void {
    const chip = new ShopPanel(
      SIDE_CONTENT_WIDTH,
      58,
      COLOR_PANEL_ALT,
      COLOR_PANEL_LINE,
    );
    chip.position.set(x, y);
    this.root.add(chip);

    const icon = new ShopIcon(iconId, 42);
    icon.position.set(x + 12, y + 8);
    this.root.add(icon);

    const text = new ShopText(`${label} ${value}`, label === 'BACT' ? COLOR_YELLOW : config.COLOR_WHITE);
    text.position.set(x + 68, y + 18);
    this.root.add(text);
  }

  private addInventoryTile(
    x: number,
    y: number,
    itemId: ShopInventoryItemId,
  ): void {
    const tile = new ShopPanel(
      SIDE_OWNED_TILE_WIDTH,
      SIDE_OWNED_TILE_HEIGHT,
      COLOR_PANEL_ALT,
      COLOR_PANEL_HIGHLIGHT,
    );
    tile.position.set(x, y);
    this.root.add(tile);

    const icon = new ShopIcon(
      this.getOwnedInventoryIconId(itemId),
      54,
      SpriteAlignment.AspectFit,
    );
    icon.position.set(x + Math.floor((SIDE_OWNED_TILE_WIDTH - 54) / 2), y + 8);
    this.root.add(icon);

    const countStrip = new ShopPanel(
      SIDE_OWNED_TILE_WIDTH - 4,
      29,
      '#070a0c',
      null,
    );
    countStrip.position.set(x + 2, y + 65);
    this.root.add(countStrip);

    const count = new ShopText(
      this.getInventoryCountText(itemId),
      COLOR_YELLOW,
      22,
      '700',
      SIDE_OWNED_TILE_WIDTH - 6,
      'center',
    );
    count.position.set(x + 3, y + 69);
    this.root.add(count);
  }

  private addLoadoutRow(
    x: number,
    y: number,
    label: string,
    value: string,
  ): void {
    const labelText = new ShopText(label, COLOR_MUTED);
    labelText.position.set(x, y);
    this.root.add(labelText);

    const valueText = new ShopText(this.getCompactSlotLabel(value), config.COLOR_WHITE);
    valueText.position.set(x + 76, y);
    this.root.add(valueText);
  }

  private addTextBlock(
    x: number,
    y: number,
    rows: Array<[string, string, string]>,
  ): void {
    rows.forEach((row, index) => {
      const label = new ShopText(row[0], COLOR_MUTED);
      label.position.set(x, y + index * 42);
      this.root.add(label);

      const value = new ShopText(row[1], row[2]);
      value.position.set(x + 168, y + index * 42);
      this.root.add(value);
    });
  }

  private handlePointer(point: Vector): boolean {
    const actionIndex = this.actions.findIndex((action) => {
      return action.target.getWorldBoundingBox().containsPoint(point);
    });

    if (actionIndex === -1) {
      return false;
    }

    this.setFocusedAction(actionIndex);
    this.queueFocusedAction();
    return true;
  }

  private queueFocusedAction(): void {
    this.pendingActionIndex = this.focusedActionIndex;
  }

  private activatePendingAction(): void {
    if (this.pendingActionIndex === null) {
      return;
    }

    const action = this.actions[this.pendingActionIndex];
    this.pendingActionIndex = null;

    if (action === undefined) {
      return;
    }

    this.activateAction(action);
  }

  private activateAction(action: ShopAction): void {
    if (action.kind === 'view') {
      this.view = action.view;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'market') {
      this.view = ShopView.Shop;
      this.market = action.market;
      this.catalogScrollRow = 0;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'category') {
      this.category = action.category;
      this.catalogScrollRow = 0;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'wallet') {
      this.shopManager.connectWallet();
      this.statusText = 'WALLET CONNECTED';
      this.verticalParentKeys = {};
      this.renderShop(this.getActiveTopKey());
      return;
    }

    if (action.kind === 'catalog') {
      const result = this.shopManager.purchaseItem(
        action.itemId,
        this.market === ShopMarket.Sol ? ShopCurrency.Sol : ShopCurrency.Token,
      );
      this.statusText = result.statusText;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'slot') {
      if (this.battleStartPending) {
        return;
      }
      const itemId = this.shopManager.equipNext(action.slot);
      this.statusText =
        itemId === null ? 'SLOT CLEARED' : `EQUIPPED ${this.getInventoryLabel(itemId)}`;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'start') {
      void this.startBattle();
      return;
    }

    if (action.kind === 'back') {
      this.navigator.back();
    }
  }

  private focusActionByKey(preferredFocusKey: string): boolean {
    const index = this.actions.findIndex((action) => {
      return action.key === preferredFocusKey;
    });

    this.setFocusedAction(index === -1 ? 0 : index);
    return index !== -1;
  }

  private setFocusedAction(nextIndex: number): void {
    const currentAction = this.actions[this.focusedActionIndex];
    if (currentAction !== undefined) {
      currentAction.target.setFocused(false);
    }

    this.focusedActionIndex = Math.max(
      0,
      Math.min(nextIndex, this.actions.length - 1),
    );

    const nextAction = this.actions[this.focusedActionIndex];
    if (nextAction !== undefined) {
      nextAction.target.setFocused(true);
    }
  }

  private focusDirection(dx: number, dy: number): void {
    const currentAction = this.actions[this.focusedActionIndex];
    if (currentAction === undefined) {
      return;
    }

    if (currentAction.navLayer !== undefined) {
      this.focusLayerDirection(currentAction, dx, dy);
      return;
    }

    const currentCenter = currentAction.target.getWorldBoundingBox().getCenter();
    let bestIndex = -1;
    let bestScore = null;

    this.actions.forEach((action, index) => {
      if (index === this.focusedActionIndex) {
        return;
      }

      const center = action.target.getWorldBoundingBox().getCenter();
      const deltaX = center.x - currentCenter.x;
      const deltaY = center.y - currentCenter.y;

      if ((dx < 0 && deltaX >= 0) || (dx > 0 && deltaX <= 0)) {
        return;
      }
      if ((dy < 0 && deltaY >= 0) || (dy > 0 && deltaY <= 0)) {
        return;
      }

      const primary = dx !== 0 ? Math.abs(deltaX) : Math.abs(deltaY);
      const secondary = dx !== 0 ? Math.abs(deltaY) : Math.abs(deltaX);
      const score = primary * 4 + secondary;

      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex !== -1) {
      this.setFocusedAction(bestIndex);
    }
  }

  private focusLayerDirection(
    currentAction: ShopAction,
    dx: number,
    dy: number,
  ): void {
    if (currentAction.kind === 'wallet') {
      this.focusWalletDirection(currentAction, dx, dy);
      return;
    }

    if (dx !== 0) {
      this.focusHorizontal(currentAction, dx);
      return;
    }

    if (dy !== 0) {
      this.focusVertical(currentAction, dy);
    }
  }

  private focusHorizontal(currentAction: ShopAction, dx: number): void {
    const actions = this.getNavActions(currentAction.navLayer, currentAction.navRow);
    const currentIndex = actions.indexOf(currentAction);

    if (
      currentAction.navLayer === 'category' &&
      dx < 0 &&
      currentIndex === 0 &&
      !this.shopManager.isWalletConnected() &&
      this.focusActionByKey('wallet')
    ) {
      return;
    }

    const nextAction = actions[currentIndex + dx];

    if (nextAction === undefined) {
      return;
    }

    const nextIndex = this.actions.indexOf(nextAction);
    this.setFocusedAction(nextIndex);

    if (
      nextAction.kind === 'market' ||
      nextAction.kind === 'view' ||
      nextAction.kind === 'category'
    ) {
      this.pendingActionIndex = nextIndex;
      this.activatePendingAction();
    }
  }

  private focusVertical(currentAction: ShopAction, dy: number): void {
    if (currentAction.navLayer === 'top' && dy > 0) {
      if (
        !this.shopManager.isWalletConnected() &&
        this.focusActionByKey('wallet')
      ) {
        return;
      }

      this.focusChildLayer(currentAction, this.view === ShopView.Shop ? 'category' : 'items');
      return;
    }

    if (currentAction.navLayer === 'category') {
      if (dy < 0) {
        if (
          !this.shopManager.isWalletConnected() &&
          this.focusActionByKey('wallet')
        ) {
          return;
        }

        if (this.shopManager.isWalletConnected()) {
          this.focusActionByKey(this.getActiveTopKey());
        } else {
          this.focusParentLayer('category', 'top', currentAction.navCol);
        }
      } else {
        this.focusChildLayer(currentAction, 'items');
      }
      return;
    }

    if (currentAction.navLayer === 'items') {
      const nextRow = currentAction.navRow + dy;
      if (nextRow < 0) {
        this.focusParentLayer(
          'items',
          this.view === ShopView.Shop ? 'category' : 'top',
          currentAction.navCol,
        );
        return;
      }

      if (this.view === ShopView.Shop && this.scrollCatalogToRow(nextRow, currentAction.navCol)) {
        return;
      }

      const rowActions = this.getNavActions('items', nextRow);
      const nextAction = this.findClosestNavColumn(rowActions, currentAction.navCol);
      if (nextAction !== null) {
        this.setFocusedAction(this.actions.indexOf(nextAction));
      }
    }
  }

  private focusWalletDirection(
    currentAction: ShopAction,
    dx: number,
    dy: number,
  ): void {
    if (dy < 0) {
      this.focusActionByKey(this.getActiveTopKey());
      return;
    }

    if (dy > 0 || dx > 0) {
      this.focusChildLayer(
        currentAction,
        this.view === ShopView.Shop ? 'category' : 'items',
      );
    }
  }

  private scrollCatalogToRow(row: number, navCol: number): boolean {
    const allItems = this.getVisibleCatalogItems();
    const columns = this.getCatalogColumnCount();
    const visibleRows = this.getCatalogVisibleRows();
    const totalRows = Math.max(1, Math.ceil(allItems.length / columns));
    const maxScrollRow = Math.max(0, totalRows - visibleRows);
    let nextScrollRow = this.catalogScrollRow;

    if (row < this.catalogScrollRow) {
      nextScrollRow = row;
    } else if (row >= this.catalogScrollRow + visibleRows) {
      nextScrollRow = row - visibleRows + 1;
    }

    nextScrollRow = Math.max(0, Math.min(nextScrollRow, maxScrollRow));
    if (nextScrollRow === this.catalogScrollRow) {
      return false;
    }

    const itemIndex = Math.min(allItems.length - 1, row * columns + navCol);
    this.catalogScrollRow = nextScrollRow;
    this.renderShop(`catalog:${allItems[itemIndex].id}`);
    return true;
  }

  private handleCatalogSwipe(direction: number): boolean {
    if (this.view !== ShopView.Shop) {
      return false;
    }

    const allItems = this.getVisibleCatalogItems();
    const columns = this.getCatalogColumnCount();
    const totalRows = Math.ceil(allItems.length / columns);
    const maxScrollRow = Math.max(
      0,
      totalRows - this.getCatalogVisibleRows(),
    );
    const nextScrollRow = Math.max(
      0,
      Math.min(this.catalogScrollRow + direction, maxScrollRow),
    );
    if (nextScrollRow === this.catalogScrollRow) {
      return false;
    }

    this.catalogScrollRow = nextScrollRow;
    const firstVisible = allItems[nextScrollRow * columns];
    this.renderShop(
      firstVisible === undefined ? null : `catalog:${firstVisible.id}`,
    );
    return true;
  }

  private getCatalogColumnCount(): number {
    return config.isMobileTouchViewport() ? MOBILE_CARD_COLUMNS : CARD_COLUMNS;
  }

  private getCatalogVisibleRows(): number {
    return config.isMobileTouchViewport()
      ? MOBILE_CATALOG_VISIBLE_ROWS
      : CATALOG_VISIBLE_ROWS;
  }

  private focusChildLayer(currentAction: ShopAction, layer: ShopNavLayer): void {
    this.verticalParentKeys[layer] = currentAction.key;
    if (layer === 'category' && this.focusActionByKey(`category:${this.category}`)) {
      return;
    }

    this.focusFirstInLayer(layer);
  }

  private focusParentLayer(
    childLayer: ShopNavLayer,
    parentLayer: ShopNavLayer,
    fallbackColumn: number,
  ): void {
    const parentKey = this.verticalParentKeys[childLayer];
    if (
      parentKey === 'wallet' &&
      this.shopManager.isWalletConnected()
    ) {
      this.focusActionByKey(this.getActiveTopKey());
      return;
    }

    if (parentKey !== undefined && this.focusActionByKey(parentKey)) {
      return;
    }

    this.focusNearestColumn(parentLayer, fallbackColumn);
  }

  private getActiveTopKey(): string {
    return this.view === ShopView.Loadout
      ? `view:${ShopView.Loadout}`
      : `market:${this.market}`;
  }

  private focusFirstInLayer(layer: ShopNavLayer): void {
    const actions = this.getNavActions(layer);
    if (actions.length > 0) {
      this.setFocusedAction(this.actions.indexOf(actions[0]));
    }
  }

  private focusNearestColumn(layer: ShopNavLayer, navCol: number): void {
    const actions = this.getNavActions(layer);
    const nextAction = this.findClosestNavColumn(actions, navCol);
    if (nextAction !== null) {
      this.setFocusedAction(this.actions.indexOf(nextAction));
    }
  }

  private findClosestNavColumn(
    actions: ShopAction[],
    navCol: number,
  ): ShopAction {
    let closestAction: ShopAction = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    actions.forEach((action) => {
      const distance = Math.abs(action.navCol - navCol);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAction = action;
      }
    });

    return closestAction;
  }

  private getNavActions(
    layer: ShopNavLayer,
    row: number = null,
  ): ShopAction[] {
    return this.actions
      .filter((action) => {
        return (
          action.navLayer === layer &&
          (row === null || action.navRow === row)
        );
      })
      .sort((a, b) => a.navCol - b.navCol);
  }

  private getActionNavLayer(kind: ShopActionKind): ShopNavLayer {
    if (kind === 'market' || kind === 'view' || kind === 'back') {
      return 'top';
    }
    if (kind === 'category') {
      return 'category';
    }
    if (kind === 'wallet') {
      return 'side';
    }
    return null;
  }

  private isBattleSetup(): boolean {
    return this.params.battleSetup === true && this.params.tankTier !== undefined;
  }

  private async startBattle(): Promise<void> {
    if (!this.isBattleSetup() || this.battleStartPending) {
      return;
    }

    const tankTier = this.params.tankTier;
    const fuelCost = Math.max(0, Math.floor(this.params.fuelCost ?? 1));
    if (!this.shopManager.canStartRun(fuelCost)) {
      this.statusText = `NEED ${fuelCost} FUEL - VISIT THE SHOP`;
      this.renderShop('start');
      return;
    }

    this.battleStartPending = true;
    if (this.params.multiplayer === true) {
      await this.startOnlineBattle(tankTier);
      return;
    }

    if (!this.shopManager.consumeFuelForRun(fuelCost)) {
      this.battleStartPending = false;
      this.statusText = `NEED ${fuelCost} FUEL - VISIT THE SHOP`;
      this.renderShop('start');
      return;
    }

    this.session.setPlayerTankTier(0, tankTier);
    this.session.primaryPlayer.setTankTier(tankTier);
    this.session.setRunConsumables(
      this.shopManager.getEquippedRunConsumables(),
    );
    this.session.start(1, this.mapLoader.getItemsCount());
    this.navigator.replace(GameSceneType.LevelLoad);
  }

  private async startOnlineBattle(tankTier: TankTier): Promise<void> {
    this.statusText = 'MATCHMAKING - WAITING FOR ANOTHER COMMANDER';
    this.renderShop('start');
    try {
      await this.shopManager.syncAccount();
      const response = await apiFetch('/api/multiplayer/direct/start', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tankTier }),
      });
      let body = (await response.json()) as MultiplayerStartResponse;
      let assignment = body.assignment;
      if (assignment === undefined) {
        throw new Error(body.error || `Matchmaking failed (${response.status})`);
      }

      while (body.runtime === undefined) {
        await this.waitForMatchmakingPoll();
        body = await this.reconnectMatch(assignment);
        assignment = body.assignment ?? assignment;
      }

      storeMultiplayerRuntime(body.runtime);
      window.location.assign('/');
    } catch (error) {
      this.battleStartPending = false;
      console.error('[multiplayer] matchmaking failed', error);
      this.statusText =
        (error as Error).message || 'COULD NOT START MULTIPLAYER';
      this.renderShop('start');
    }
  }

  private async reconnectMatch(
    assignment: MultiplayerAssignment,
  ): Promise<MultiplayerStartResponse> {
    const response = await apiFetch(
      `/api/multiplayer/matches/${encodeURIComponent(
        assignment.match.id,
      )}/reconnect`,
      { method: 'POST', headers: { accept: 'application/json' } },
    );
    const body = (await response.json()) as MultiplayerStartResponse;
    if (body.assignment === undefined) {
      throw new Error(body.error || `Match reconnect failed (${response.status})`);
    }
    return body;
  }

  private waitForMatchmakingPoll(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 1500));
  }

  private getVisibleCatalogItems(): ShopCatalogItem[] {
    return this.shopManager.getCatalog().filter((item) => {
      if (this.category === ShopCategory.All) {
        return true;
      }
      if (this.category === ShopCategory.Fuel) {
        return item.reward.fuel !== undefined && item.reward.inventory === undefined;
      }
      if (this.category === ShopCategory.Packs) {
        return item.reward.fuel !== undefined && item.reward.inventory !== undefined;
      }
      return item.reward.inventory !== undefined && item.reward.fuel === undefined;
    });
  }

  private getItemSection(itemId: ShopItemId): string {
    switch (itemId) {
      case ShopItemId.FuelOne:
      case ShopItemId.FuelFive:
      case ShopItemId.FuelTwenty:
        return 'INSTANT FUEL';
      case ShopItemId.StarterPack:
        return 'BUNDLES';
      default:
        return 'POWERUPS';
    }
  }

  private getCategoryTitle(): string {
    switch (this.category) {
      case ShopCategory.Fuel:
        return 'Fuel';
      case ShopCategory.Powerups:
        return 'Powerups';
      case ShopCategory.Packs:
        return 'Packs';
      default:
        return 'All Items';
    }
  }

  private getItemTitle(itemId: ShopItemId): string {
    switch (itemId) {
      case ShopItemId.BaseDefence:
        return 'BASE DEF';
      case ShopItemId.StarterPack:
        return 'STARTER';
      default:
        const item = this.shopManager.getCatalog().find((catalogItem) => {
          return catalogItem.id === itemId;
        });
        return item === undefined ? 'ITEM' : item.name;
    }
  }

  private getItemIconId(itemId: ShopItemId): string {
    switch (itemId) {
      case ShopItemId.FuelOne:
      case ShopItemId.FuelFive:
      case ShopItemId.FuelTwenty:
        return 'shop.fuel';
      case ShopItemId.Shield:
        return 'shop.owned.helmet';
      case ShopItemId.BaseDefence:
        return 'shop.owned.shovel';
      case ShopItemId.Freeze:
        return 'shop.owned.clock';
      case ShopItemId.Speed:
        return 'shop.owned.speed';
      case ShopItemId.Upgrade:
        return 'shop.owned.star';
      case ShopItemId.ZoomOut:
        return 'shop.owned.zoomout';
      case ShopItemId.Wipeout:
        return 'shop.owned.grenade';
      case ShopItemId.ExtraLife:
        return 'shop.owned.life';
      case ShopItemId.StarterPack:
        return 'shop.bundle';
      default:
        return 'shop.coin';
    }
  }

  private getRewardText(item: ShopCatalogItem): string {
    if (item.id === ShopItemId.StarterPack) {
      return '+5 + KIT';
    }

    const rewards = [];
    if (item.reward.fuel !== undefined) {
      rewards.push(`+${item.reward.fuel}`);
    }
    if (item.reward.inventory !== undefined) {
      Object.keys(item.reward.inventory).forEach((key) => {
        const itemId = key as ShopInventoryItemId;
        rewards.push(`+${item.reward.inventory[itemId]}`);
      });
    }
    return rewards.join(' / ');
  }

  private getPriceText(item: ShopCatalogItem): string {
    if (this.market === ShopMarket.Sol) {
      return `${this.formatSol(item.solPrice)} SOL`;
    }
    return `${item.price} BACT`;
  }

  private formatSol(value: number): string {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  private getItemMeta(itemId: ShopItemId): string {
    switch (itemId) {
      case ShopItemId.FuelOne:
      case ShopItemId.FuelFive:
      case ShopItemId.FuelTwenty:
        return 'RUN FUEL';
      case ShopItemId.ExtraLife:
        return 'PASSIVE';
      case ShopItemId.StarterPack:
        return 'BUNDLE';
      default:
        return 'ACTIVE';
    }
  }

  private getOwnedText(itemId: ShopItemId): string {
    if (itemId === ShopItemId.FuelOne || itemId === ShopItemId.FuelFive || itemId === ShopItemId.FuelTwenty) {
      return `FUEL ${this.shopManager.getFuelBalance()}`;
    }
    if (itemId === ShopItemId.StarterPack) {
      return 'BUNDLE';
    }
    return `OWN ${this.getInventoryCountText(itemId as unknown as ShopInventoryItemId)}`;
  }

  private getInventoryCountText(itemId: ShopInventoryItemId): string {
    return this.shopManager.getInventoryCount(itemId).toString().padStart(2, '0');
  }

  private getInventoryIconId(itemId: ShopInventoryItemId): string {
    switch (itemId) {
      case ShopInventoryItemId.Shield:
        return 'powerup.helmet';
      case ShopInventoryItemId.BaseDefence:
        return 'powerup.shovel';
      case ShopInventoryItemId.Freeze:
        return 'powerup.clock';
      case ShopInventoryItemId.Speed:
        return 'powerup.speed';
      case ShopInventoryItemId.Upgrade:
        return 'powerup.star';
      case ShopInventoryItemId.ZoomOut:
        return 'powerup.zoomout';
      case ShopInventoryItemId.Wipeout:
        return 'powerup.grenade';
      case ShopInventoryItemId.ExtraLife:
        return 'powerup.life';
      default:
        return 'shop.bundle';
    }
  }

  private getOwnedInventoryIconId(itemId: ShopInventoryItemId): string {
    switch (itemId) {
      case ShopInventoryItemId.Shield:
        return 'shop.owned.helmet';
      case ShopInventoryItemId.BaseDefence:
        return 'shop.owned.shovel';
      case ShopInventoryItemId.Freeze:
        return 'shop.owned.clock';
      case ShopInventoryItemId.Speed:
        return 'shop.owned.speed';
      case ShopInventoryItemId.Upgrade:
        return 'shop.owned.star';
      case ShopInventoryItemId.ZoomOut:
        return 'shop.owned.zoomout';
      case ShopInventoryItemId.Wipeout:
        return 'shop.owned.grenade';
      case ShopInventoryItemId.ExtraLife:
        return 'shop.owned.life';
      default:
        return 'shop.bundle';
    }
  }

  private getSlotLabel(slot: ShopLoadoutSlot): string {
    const itemId = this.shopManager.getEquipped(slot);
    if (itemId === null) {
      return 'EMPTY';
    }

    return this.getInventoryLabel(itemId);
  }

  private getCompactSlotLabel(label: string): string {
    switch (label) {
      case 'BASE DEF':
        return 'BASE';
      case 'WIPEOUT':
        return 'WIPE';
      case 'EXTRA LIFE':
        return 'LIFE';
      case 'ZOOM OUT':
        return 'ZOOM';
      default:
        return label;
    }
  }

  private getInventoryLabel(itemId: ShopInventoryItemId): string {
    switch (itemId) {
      case ShopInventoryItemId.Shield:
        return 'SHIELD';
      case ShopInventoryItemId.BaseDefence:
        return 'BASE DEF';
      case ShopInventoryItemId.Freeze:
        return 'FREEZE';
      case ShopInventoryItemId.Speed:
        return 'SPEED';
      case ShopInventoryItemId.Upgrade:
        return 'STAR';
      case ShopInventoryItemId.ZoomOut:
        return 'ZOOM OUT';
      case ShopInventoryItemId.Wipeout:
        return 'WIPEOUT';
      case ShopInventoryItemId.ExtraLife:
        return 'EXTRA LIFE';
      default:
        return 'EMPTY';
    }
  }

  private getInventoryShortLabel(itemId: ShopInventoryItemId): string {
    switch (itemId) {
      case ShopInventoryItemId.BaseDefence:
        return 'BASE';
      case ShopInventoryItemId.Wipeout:
        return 'WIPE';
      case ShopInventoryItemId.ZoomOut:
        return 'ZOOM';
      case ShopInventoryItemId.ExtraLife:
        return 'LIFE';
      default:
        return this.getInventoryLabel(itemId);
    }
  }
}
