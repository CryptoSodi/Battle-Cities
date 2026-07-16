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
  UI_TEXT_STROKE_COLOR,
  UI_TEXT_STROKE_WIDTH,
} from '../../core/text/UiTypography';
import { GameUpdateArgs } from '../../game';
import { MenuInputContext } from '../../input';
import {
  ShopCatalogItem,
  ShopCurrency,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopManager,
} from '../../shop';
import * as config from '../../config';

import { GameScene } from '../GameScene';

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

type ShopActionKind = 'view' | 'market' | 'category' | 'page' | 'catalog' | 'slot' | 'wallet' | 'back';
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

const COLOR_PAGE = '#05080a';
const COLOR_PANEL = '#0b1014';
const COLOR_PANEL_ALT = '#12181d';
const COLOR_PANEL_RAISED = '#182026';
const COLOR_PANEL_LINE = '#35414a';
const COLOR_PANEL_HIGHLIGHT = '#65717a';
const COLOR_CARD = '#0b1013';
const COLOR_CARD_FOCUS = '#18242b';
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
const ICON_SIZE = 82;
const SHOP_FONT = UI_FONT_FAMILY;

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

    const labelX = iconId === null ? 2 : 54;
    const labelWidth = iconId === null ? width - 4 : width - 58;

    if (iconId !== null) {
      const icon = new ShopIcon(iconId, 34, SpriteAlignment.AspectFit);
      icon.position.set(12, Math.round((height - 34) / 2));
      this.add(icon);
    }

    this.label = new ShopText(
      text,
      config.COLOR_WHITE,
      24,
      '700',
      labelWidth,
      iconId === null ? 'center' : 'left',
    );
    this.label.position.set(labelX, Math.max(5, Math.round((height - 24 * 1.18) / 2) - 1));
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
    } else if (this.variant === 'back') {
      this.background.fillColor = this.focused ? COLOR_RED_FOCUS : COLOR_RED;
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
  ) {
    super(width, height);
    const compact = height <= LOADOUT_SLOT_HEIGHT;
    const titleFontSize = compact ? 21 : 23;
    const detailFontSize = detailFontSizeOverride ?? (compact ? 16 : 24);
    const priceFontSize = compact ? 19 : 20;
    this.priceFontSize = priceFontSize;
    this.priceIconSize = footerVariant === 'purchase' ? 30 : 26;
    const footerInset = 11;
    const footerHeight = 38;
    const footerY = height - 47;
    const iconY = compact ? 34 : 42;
    const titleY = compact ? 12 : 16;
    const detailY = compact ? 42 : 78;
    const priceLineHeight = Math.ceil(priceFontSize * 1.18);
    const priceY = footerY + Math.floor((footerHeight - priceLineHeight) / 2);
    const detailMaxWidth =
      detailMaxWidthOverride ??
      (swapBodyLayout ? width - ICON_SIZE - 28 : width - ICON_SIZE - 48);
    const iconFrameX = swapBodyLayout ? 10 : width - ICON_SIZE - 14;
    const iconSize = Math.max(24, ICON_SIZE - iconPadding * 2);

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
        ICON_SIZE + 8,
        ICON_SIZE + 8,
        '#070a0c',
        COLOR_PANEL_HIGHLIGHT,
      );
      iconFrame.position.set(iconFrameX, iconY - 4);
      this.add(iconFrame);
    }

    this.icon = new ShopIcon(iconId, iconSize, iconAlignment);
    this.icon.position.set(iconFrameX + 4 + iconPadding, iconY + iconPadding);
    this.add(this.icon);

    this.title = new ShopText(
      '',
      COLOR_YELLOW,
      titleFontSize,
      '700',
      width - 36,
      'center',
    );
    this.title.position.set(18, titleY);
    this.add(this.title);

    this.detail = new ShopText('', COLOR_YELLOW, detailFontSize, '700', detailMaxWidth);
    this.detail.position.set(swapBodyLayout ? ICON_SIZE + 24 : 20, detailY);
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
    this.title.setColor(focused ? config.COLOR_WHITE : COLOR_YELLOW);
    this.detail.setColor(focused ? config.COLOR_WHITE : COLOR_YELLOW);
    this.footer.painter.fillColor = focused ? COLOR_YELLOW : COLOR_PRICE;
    this.footer.painter.strokeColor = focused
      ? COLOR_YELLOW_LIGHT
      : COLOR_PRICE_BORDER;
    this.price.setColor(focused ? config.COLOR_WHITE : COLOR_PRICE_TEXT);
    this.setNeedsPaint();
  }
}

export class MainShopScene extends GameScene {
  private shopManager: ShopManager;
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

  protected setup({ gameStorage }: GameUpdateArgs): void {
    this.shopManager = new ShopManager(gameStorage);
    this.renderShop();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager, pointerClick } = updateArgs;
    const inputMethod = inputManager.getActiveMethod();

    if (pointerClick !== null && this.handlePointer(pointerClick)) {
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
    this.addMarketTab(originX + 12, tabY, 'TOKEN SHOP', ShopMarket.Token);
    this.addMarketTab(originX + 230, tabY, 'SOL SHOP', ShopMarket.Sol);
    this.addViewTab(originX + 448, tabY, 'LOADOUT', ShopView.Loadout);

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

  private renderSidePanel(x: number, y: number): void {
    const panel = new ShopPanel(
      SIDE_WIDTH - 16,
      this.panelHeight - 32,
      COLOR_PAGE,
      COLOR_PANEL_LINE,
    );
    panel.position.set(x, y);
    panel.setZIndex(-1);
    this.root.add(panel);

    const heading = new ShopText('Inventory', config.COLOR_WHITE, 28, '700', SIDE_WIDTH - 56);
    heading.position.set(x + 28, y + 30);
    this.root.add(heading);

    this.addButton(
      x + 28,
      y + 68,
      SIDE_WIDTH - 56,
      44,
      this.shopManager.isWalletConnected() ? 'WALLET' : 'CONNECT',
      { key: 'wallet', kind: 'wallet' },
      this.shopManager.isWalletConnected(),
    );

    this.addResourceChip(
      x + 28,
      y + 124,
      'BACT',
      this.shopManager.getTokenBalance().toString(),
      'shop.tab.token',
    );
    this.addResourceChip(
      x + 28,
      y + 184,
      'SOL',
      this.formatSol(this.shopManager.getSolBalance()),
      'shop.tab.solana',
    );
    this.addResourceChip(
      x + 28,
      y + 244,
      'FUEL',
      this.shopManager.getFuelBalance().toString(),
      'shop.fuel',
    );

    if (this.view === ShopView.Loadout) {
      return;
    }

    const inventoryY = y + 324;
    const inventoryTitle = new ShopText('Owned Items', config.COLOR_WHITE, 24, '700', SIDE_WIDTH - 56);
    inventoryTitle.position.set(x + 28, inventoryY);
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
        x + 28 + col * (SIDE_OWNED_TILE_WIDTH + SIDE_OWNED_GAP_X),
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
        SIDE_WIDTH - 56,
      );
      status.position.set(x + 28, y + this.panelHeight - 76);
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
      'Use 1-4 in game to consume equipped powers',
      COLOR_MUTED,
      20,
      '700',
      620,
    );
    note.position.set(x, slotsY + 252);
    this.root.add(note);
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
  ): void {
    this.addButton(x, y, width, FILTER_HEIGHT, text, {
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

  private addResourceChip(
    x: number,
    y: number,
    label: string,
    value: string,
    iconId: string,
  ): void {
    const chip = new ShopPanel(
      SIDE_WIDTH - 56,
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
      this.renderShop(action.key);
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
      const itemId = this.shopManager.equipNext(action.slot);
      this.statusText =
        itemId === null ? 'SLOT CLEARED' : `EQUIPPED ${this.getInventoryLabel(itemId)}`;
      this.renderShop(action.key);
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
      this.focusChildLayer(currentAction, this.view === ShopView.Shop ? 'category' : 'items');
      return;
    }

    if (currentAction.navLayer === 'category') {
      if (dy < 0) {
        this.focusParentLayer('category', 'top', currentAction.navCol);
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

  private scrollCatalogToRow(row: number, navCol: number): boolean {
    const allItems = this.getVisibleCatalogItems();
    const totalRows = Math.max(1, Math.ceil(allItems.length / CARD_COLUMNS));
    const maxScrollRow = Math.max(0, totalRows - CATALOG_VISIBLE_ROWS);
    let nextScrollRow = this.catalogScrollRow;

    if (row < this.catalogScrollRow) {
      nextScrollRow = row;
    } else if (row >= this.catalogScrollRow + CATALOG_VISIBLE_ROWS) {
      nextScrollRow = row - CATALOG_VISIBLE_ROWS + 1;
    }

    nextScrollRow = Math.max(0, Math.min(nextScrollRow, maxScrollRow));
    if (nextScrollRow === this.catalogScrollRow) {
      return false;
    }

    const itemIndex = Math.min(allItems.length - 1, row * CARD_COLUMNS + navCol);
    this.catalogScrollRow = nextScrollRow;
    this.renderShop(`catalog:${allItems[itemIndex].id}`);
    return true;
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
    if (parentKey !== undefined && this.focusActionByKey(parentKey)) {
      return;
    }

    this.focusNearestColumn(parentLayer, fallbackColumn);
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
