import {
  GameObject,
  RectPainter,
  SpriteAlignment,
  SpritePainter,
  Vector,
} from '../../core';
import { Painter } from '../../core/Painter';
import { RenderContext } from '../../core/render';
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
  pageDelta?: number;
  itemId?: ShopItemId;
  slot?: ShopLoadoutSlot;
}

const COLOR_PAGE = '#080806';
const COLOR_PANEL = '#171611';
const COLOR_PANEL_ALT = '#211f18';
const COLOR_CARD = '#2b2605';
const COLOR_CARD_ALT = '#3b3511';
const COLOR_CARD_FOCUS = '#4a3f0b';
const COLOR_YELLOW = config.COLOR_YELLOW;
const COLOR_YELLOW_DARK = '#8a6b00';
const COLOR_MUTED = config.COLOR_GRAY;
const COLOR_GREEN = config.COLOR_WHITE;
const COLOR_PURPLE = config.COLOR_RED;
const COLOR_ORANGE = config.COLOR_YELLOW;

const SHOP_WIDTH = 1240;
const SHOP_HEIGHT = 720;
const SIDE_WIDTH = 314;
const TOP_Y = 96;
const TAB_HEIGHT = 52;
const FILTER_HEIGHT = 48;
const CARD_COLUMNS = 3;
const CARD_PAGE_SIZE = 6;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 176;
const CARD_GAP_X = 24;
const CARD_GAP_Y = 22;
const LOADOUT_SLOT_WIDTH = 192;
const LOADOUT_SLOT_HEIGHT = 132;
const LOADOUT_SLOT_GAP_X = 22;
const LOADOUT_OWNED_TILE_WIDTH = 192;
const LOADOUT_OWNED_TILE_GAP_X = 22;
const ICON_SIZE = 82;
const BUTTON_LABEL_INSET = 10;
const SHOP_FONT = 'Inter, Segoe UI, Arial, sans-serif';

class NativeTextPainter extends Painter {
  public text: string;
  public color: string;
  public fontSize: number;
  public fontWeight: string;
  public maxWidth: number;

  constructor(
    text: string,
    color: string,
    fontSize: number,
    fontWeight: string,
    maxWidth: number,
  ) {
    super();
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.fontWeight = fontWeight;
    this.maxWidth = maxWidth;
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
  ) {
    const width = maxWidth ?? Math.max(24, Math.ceil(text.length * fontSize * 0.62));
    super(width, Math.ceil(fontSize * 1.35));
    this.painter = new NativeTextPainter(text, color, fontSize, fontWeight, width);
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
  private label: ShopText;
  private active = false;
  private focused = false;

  constructor(width: number, height: number, text: string) {
    super(width, height);

    this.background = new RectPainter(COLOR_PANEL_ALT, COLOR_YELLOW_DARK);
    this.background.lineWidth = 2;
    this.painter = this.background;

    this.label = new ShopText(
      text,
      config.COLOR_WHITE,
      26,
      '800',
      width - BUTTON_LABEL_INSET * 2,
    );
    this.label.position.set(BUTTON_LABEL_INSET, Math.max(8, Math.round((height - 34) / 2)));
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
    this.background.fillColor = this.active ? COLOR_YELLOW : COLOR_PANEL_ALT;
    this.background.strokeColor = this.focused ? config.COLOR_WHITE : COLOR_YELLOW_DARK;
    this.background.lineWidth = this.focused ? 4 : 2;
    this.label.setColor(this.active ? config.COLOR_BLACK : config.COLOR_WHITE);
    this.setNeedsPaint();
  }
}

class ShopIcon extends GameObject {
  public painter: SpritePainter = null;
  private readonly spriteId: string;

  constructor(spriteId: string, size = ICON_SIZE) {
    super(size, size);
    this.spriteId = spriteId;
  }

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    this.painter = new SpritePainter(
      spriteLoader.load(this.spriteId),
      SpriteAlignment.Stretch,
    );
  }
}

class ShopCard extends GameObject {
  private background: RectPainter;
  private footer: ShopPanel;
  private title: ShopText;
  private detail: ShopText;
  private price: ShopText;
  private icon: ShopIcon;
  private focused = false;

  constructor(width: number, height: number, iconId: string) {
    super(width, height);

    this.background = new RectPainter(COLOR_CARD, COLOR_YELLOW_DARK);
    this.background.lineWidth = 2;
    this.painter = this.background;

    const glow = new ShopPanel(width - 34, height - 58, '#332d08', null);
    glow.position.set(17, 34);
    glow.setZIndex(-1);
    this.add(glow);

    this.footer = new ShopPanel(width, 40, COLOR_YELLOW, null);
    this.footer.position.set(0, height - 40);
    this.add(this.footer);

    this.icon = new ShopIcon(iconId);
    this.icon.position.set(width - ICON_SIZE - 16, 48);
    this.add(this.icon);

    this.title = new ShopText('', COLOR_YELLOW, 24, '800', width - 36);
    this.title.position.set(18, 16);
    this.add(this.title);

    this.detail = new ShopText('', config.COLOR_WHITE, 28, '800', width - ICON_SIZE - 50);
    this.detail.position.set(20, 84);
    this.add(this.detail);

    this.price = new ShopText('', config.COLOR_BLACK, 26, '900', width - 36);
    this.price.position.set(18, height - 34);
    this.add(this.price);
  }

  public setContent(
    title: string,
    detail: string,
    price: string,
  ): void {
    this.title.setText(title);
    this.detail.setText(detail);
    this.price.setText(price);
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.background.fillColor = focused ? COLOR_CARD_FOCUS : COLOR_CARD;
    this.background.strokeColor = focused ? config.COLOR_WHITE : COLOR_YELLOW_DARK;
    this.background.lineWidth = focused ? 4 : 2;
    this.footer.painter.fillColor = focused ? config.COLOR_WHITE : COLOR_YELLOW;
    this.setNeedsPaint();
  }
}

export class MainShopScene extends GameScene {
  private shopManager: ShopManager;
  private view = ShopView.Shop;
  private market = ShopMarket.Token;
  private category = ShopCategory.All;
  private catalogPage = 0;
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

    const background = new ShopPanel(this.root.size.width, this.root.size.height, COLOR_PAGE);
    background.setZIndex(-10);
    this.root.add(background);

    const originX = Math.max(24, Math.round((this.root.size.width - SHOP_WIDTH) / 2));
    const originY = Math.max(24, TOP_Y);

    const title = new ShopText('Game Shop', COLOR_YELLOW, 54, '900', 360);
    title.position.set(originX + 16, originY - 70);
    this.root.add(title);

    this.addMarketTab(originX + 16, originY, 'TOKEN SHOP', ShopMarket.Token);
    this.addMarketTab(originX + 246, originY, 'SOL SHOP', ShopMarket.Sol);
    this.addViewTab(originX + 476, originY, 'LOADOUT', ShopView.Loadout);

    const shell = new ShopPanel(SHOP_WIDTH, SHOP_HEIGHT, COLOR_PANEL);
    shell.position.set(originX, originY + TAB_HEIGHT - 2);
    this.root.add(shell);

    this.renderSidePanel(originX, originY + TAB_HEIGHT - 2);
    this.renderContent(originX + SIDE_WIDTH + 32, originY + TAB_HEIGHT + 30);

    this.addButton(originX + SHOP_WIDTH - 142, originY - 4, 120, 44, 'BACK', {
      key: 'back',
      kind: 'back',
    });

    this.focusActionByKey(preferredFocusKey);
  }

  private renderSidePanel(x: number, y: number): void {
    const panel = new ShopPanel(SIDE_WIDTH, SHOP_HEIGHT, '#14130f', '#2c2a22');
    panel.position.set(x, y);
    this.root.add(panel);

    const heading = new ShopText('Inventory', COLOR_MUTED, 28, '800', SIDE_WIDTH - 56);
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
      'BCT',
      this.shopManager.getTokenBalance().toString(),
      'shop.coin',
    );
    this.addResourceChip(
      x + 28,
      y + 184,
      'SOL',
      this.formatSol(this.shopManager.getSolBalance()),
      'shop.coin',
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
    const inventoryTitle = new ShopText('Owned', COLOR_MUTED, 24, '800', SIDE_WIDTH - 56);
    inventoryTitle.position.set(x + 28, inventoryY);
    this.root.add(inventoryTitle);

    this.addInventoryTile(x + 28, inventoryY + 42, ShopInventoryItemId.Shield);
    this.addInventoryTile(x + 160, inventoryY + 42, ShopInventoryItemId.BaseDefence);
    this.addInventoryTile(x + 28, inventoryY + 114, ShopInventoryItemId.Freeze);
    this.addInventoryTile(x + 160, inventoryY + 114, ShopInventoryItemId.Speed);
    this.addInventoryTile(x + 28, inventoryY + 186, ShopInventoryItemId.Upgrade);
    this.addInventoryTile(x + 160, inventoryY + 186, ShopInventoryItemId.ZoomOut);
    this.addInventoryTile(x + 28, inventoryY + 258, ShopInventoryItemId.Wipeout);
    this.addInventoryTile(x + 160, inventoryY + 258, ShopInventoryItemId.ExtraLife);
  }

  private renderContent(x: number, y: number): void {
    if (this.view === ShopView.Shop) {
      this.renderShopContent(x, y);
      return;
    }

    this.renderLoadoutContent(x, y);
  }

  private renderShopContent(x: number, y: number): void {
    this.addCategoryButton(x, y, 'ALL', ShopCategory.All);
    this.addCategoryButton(x + 160, y, 'FUEL', ShopCategory.Fuel);
    this.addCategoryButton(x + 340, y, 'POWER', ShopCategory.Powerups);
    this.addCategoryButton(x + 560, y, 'PACKS', ShopCategory.Packs);

    const line = new ShopPanel(SHOP_WIDTH - SIDE_WIDTH - 92, 2, '#2c2a22');
    line.position.set(x, y + FILTER_HEIGHT + 14);
    this.root.add(line);

    const allItems = this.getVisibleCatalogItems();
    const pageCount = Math.max(1, Math.ceil(allItems.length / CARD_PAGE_SIZE));
    this.catalogPage = Math.max(0, Math.min(this.catalogPage, pageCount - 1));
    const items = allItems.slice(
      this.catalogPage * CARD_PAGE_SIZE,
      this.catalogPage * CARD_PAGE_SIZE + CARD_PAGE_SIZE,
    );

    if (pageCount > 1) {
      this.addButton(x + 704, y, 72, FILTER_HEIGHT, 'P-', {
        key: 'page:prev',
        kind: 'page',
        pageDelta: -1,
      }, false);
      this.addButton(x + 790, y, 72, FILTER_HEIGHT, 'P+', {
        key: 'page:next',
        kind: 'page',
        pageDelta: 1,
      }, false);
    }

    if (items.length === 0) {
      const empty = new ShopText('No items in this category', COLOR_MUTED, 26, '700', 520);
      empty.position.set(x, y + 110);
      this.root.add(empty);
      return;
    }

    if (this.category === ShopCategory.All) {
      const sectionText = new ShopText(`All Items ${this.catalogPage + 1}/${pageCount}`, config.COLOR_WHITE, 30, '900', 360);
      sectionText.position.set(x, y + 84);
      this.root.add(sectionText);

      items.forEach((item, index) => {
        const cardX = x + (index % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
        const cardY =
          y + 124 + Math.floor(index / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
        this.addCatalogCard(
          cardX,
          cardY,
          item,
          Math.floor(index / CARD_COLUMNS),
          index % CARD_COLUMNS,
        );
      });
      return;
    }

    let currentSection = null;
    let sectionY = y + 84;
    let cardIndex = 0;
    let visibleCardIndex = 0;

    items.forEach((item) => {
      const section = this.getItemSection(item.id);
      if (section !== currentSection) {
        currentSection = section;
        const sectionText = new ShopText(section, config.COLOR_WHITE, 28, '900', 360);
        sectionText.position.set(x, sectionY);
        this.root.add(sectionText);
        sectionY += 44;
        cardIndex = 0;
      }

      const cardX = x + (cardIndex % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
      const cardY = sectionY + Math.floor(cardIndex / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
      this.addCatalogCard(
        cardX,
        cardY,
        item,
        Math.floor(visibleCardIndex / CARD_COLUMNS),
        visibleCardIndex % CARD_COLUMNS,
      );
      cardIndex += 1;
      visibleCardIndex += 1;

      if (cardIndex % CARD_COLUMNS === 0 || item === items[items.length - 1]) {
        const rows = Math.ceil(cardIndex / CARD_COLUMNS);
        sectionY += rows * (CARD_HEIGHT + CARD_GAP_Y) + 32;
        cardIndex = 0;
      }
    });
  }

  private renderLoadoutContent(x: number, y: number): void {
    const title = new ShopText('Loadout', config.COLOR_WHITE, 34, '900', 360);
    title.position.set(x, y);
    this.root.add(title);

    const helper = new ShopText('Select a slot to cycle owned items', COLOR_MUTED, 20, '700', 520);
    helper.position.set(x, y + 34);
    this.root.add(helper);

    const ownedTitle = new ShopText('Owned Consumables', config.COLOR_WHITE, 28, '900', 420);
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
    const slotsTitle = new ShopText('Equipped Slots', config.COLOR_WHITE, 28, '900', 420);
    slotsTitle.position.set(x, slotsY);
    this.root.add(slotsTitle);

    this.addCompactSlotCard(x, slotsY + 44, ShopLoadoutSlot.ActiveOne, 'SLOT 1', 0, 0);
    this.addCompactSlotCard(
      x + LOADOUT_SLOT_WIDTH + LOADOUT_SLOT_GAP_X,
      slotsY + 44,
      ShopLoadoutSlot.ActiveTwo,
      'SLOT 2',
      0,
      1,
    );
    this.addCompactSlotCard(
      x + (LOADOUT_SLOT_WIDTH + LOADOUT_SLOT_GAP_X) * 2,
      slotsY + 44,
      ShopLoadoutSlot.ActiveThree,
      'SLOT 3',
      0,
      2,
    );
    this.addCompactSlotCard(
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
    note.position.set(x, slotsY + 194);
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
    }, this.view === ShopView.Shop && this.market === market);
  }

  private addViewTab(
    x: number,
    y: number,
    text: string,
    view: ShopView,
  ): void {
    this.addButton(x, y, 190, TAB_HEIGHT, text, {
      key: `view:${view}`,
      kind: 'view',
      view,
    }, this.view === view);
  }

  private addCategoryButton(
    x: number,
    y: number,
    text: string,
    category: ShopCategory,
  ): void {
    const width = text === 'POWER' || text === 'PACKS' ? 186 : 140;
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
  ): void {
    const card = new ShopCard(CARD_WIDTH, CARD_HEIGHT, this.getItemIconId(item.id));
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
      itemId === null ? 'shop.bundle' : this.getInventoryIconId(itemId),
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
      itemId === null ? 'shop.bundle' : this.getInventoryIconId(itemId),
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
    const tile = new ShopPanel(LOADOUT_OWNED_TILE_WIDTH, 82, COLOR_PANEL_ALT, '#2c2a22');
    tile.position.set(x, y);
    this.root.add(tile);

    const icon = new ShopIcon(this.getInventoryIconId(itemId), 48);
    icon.position.set(x + 14, y + 16);
    this.root.add(icon);

    const label = new ShopText(this.getInventoryLabel(itemId), config.COLOR_WHITE, 16, '900', 112);
    label.position.set(x + 76, y + 14);
    this.root.add(label);

    const count = new ShopText(`${this.getInventoryCountText(itemId)} OWNED`, COLOR_YELLOW, 16, '900', 112);
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
  ): ShopButton {
    const button = new ShopButton(width, height, text);
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
    const chip = new ShopPanel(SIDE_WIDTH - 56, 58, COLOR_PANEL_ALT, '#2c2a22');
    chip.position.set(x, y);
    this.root.add(chip);

    const icon = new ShopIcon(iconId, 42);
    icon.position.set(x + 12, y + 8);
    this.root.add(icon);

    const text = new ShopText(`${label} ${value}`, label === 'BCT' ? COLOR_YELLOW : config.COLOR_WHITE);
    text.position.set(x + 68, y + 18);
    this.root.add(text);
  }

  private addInventoryTile(
    x: number,
    y: number,
    itemId: ShopInventoryItemId,
  ): void {
    const tile = new ShopPanel(118, 68, COLOR_PANEL_ALT, '#2c2a22');
    tile.position.set(x, y);
    this.root.add(tile);

    const icon = new ShopIcon(this.getInventoryIconId(itemId), 42);
    icon.position.set(x + 10, y + 12);
    this.root.add(icon);

    const count = new ShopText(this.getInventoryCountText(itemId), COLOR_YELLOW);
    count.position.set(x + 64, y + 18);
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
      this.catalogPage = 0;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'category') {
      this.category = action.category;
      this.catalogPage = 0;
      this.renderShop(action.key);
      return;
    }

    if (action.kind === 'page') {
      const items = this.getVisibleCatalogItems();
      const pageCount = Math.max(1, Math.ceil(items.length / CARD_PAGE_SIZE));
      this.catalogPage += action.pageDelta;
      if (this.catalogPage < 0) {
        this.catalogPage = pageCount - 1;
      } else if (this.catalogPage >= pageCount) {
        this.catalogPage = 0;
      }
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

      const rowActions = this.getNavActions('items', nextRow);
      const nextAction = this.findClosestNavColumn(rowActions, currentAction.navCol);
      if (nextAction !== null) {
        this.setFocusedAction(this.actions.indexOf(nextAction));
      }
    }
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
    if (kind === 'category' || kind === 'page') {
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
        return 'powerup.helmet';
      case ShopItemId.BaseDefence:
        return 'powerup.shovel';
      case ShopItemId.Freeze:
        return 'powerup.clock';
      case ShopItemId.Speed:
        return 'powerup.speed';
      case ShopItemId.Upgrade:
        return 'powerup.star';
      case ShopItemId.ZoomOut:
        return 'powerup.zoomout';
      case ShopItemId.Wipeout:
        return 'powerup.grenade';
      case ShopItemId.ExtraLife:
        return 'powerup.tank';
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
    return `${item.price} BCT`;
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
        return 'powerup.tank';
      default:
        return 'shop.bundle';
    }
  }

  private getSlotLabel(slot: ShopLoadoutSlot): string {
    const itemId = this.shopManager.getEquipped(slot);
    if (itemId === null) {
      return 'EMPTY';
    }

    const stackCount = this.shopManager.getEquippedStackCount(slot);
    const stackLabel = stackCount > 1 ? ` x${stackCount}` : '';
    return `${this.getInventoryLabel(itemId)}${stackLabel}`;
  }

  private getCompactSlotLabel(label: string): string {
    const [name, stackLabel = ''] = label.split(' x');
    const suffix = stackLabel === '' ? '' : ` x${stackLabel}`;

    switch (name) {
      case 'BASE DEF':
        return `BASE${suffix}`;
      case 'WIPEOUT':
        return `WIPE${suffix}`;
      case 'EXTRA LIFE':
        return `LIFE${suffix}`;
      case 'ZOOM OUT':
        return `ZOOM${suffix}`;
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
