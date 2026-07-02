import {
  GameObject,
  RectPainter,
  SpriteAlignment,
  SpritePainter,
  Vector,
} from '../../core';
import { GameUpdateArgs } from '../../game';
import { SpriteText } from '../../gameObjects';
import { MenuInputContext } from '../../input';
import {
  ShopCatalogItem,
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

type ShopActionKind = 'view' | 'category' | 'page' | 'catalog' | 'slot' | 'wallet' | 'back';

interface ShopAction {
  key: string;
  kind: ShopActionKind;
  target: ShopButton | ShopCard;
  view?: ShopView;
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
const ICON_SIZE = 82;

class ShopText extends SpriteText {
  constructor(text = '', color = config.COLOR_WHITE) {
    super(text, { color, letterSpacing: 0, lineSpacing: 18 });
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

    this.label = new ShopText(text, config.COLOR_WHITE);
    this.label.position.set(16, 14);
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

    this.title = new ShopText('', COLOR_YELLOW);
    this.title.position.set(18, 16);
    this.add(this.title);

    this.detail = new ShopText('', config.COLOR_WHITE);
    this.detail.position.set(20, 84);
    this.add(this.detail);

    this.price = new ShopText('', config.COLOR_BLACK);
    this.price.position.set(18, height - 31);
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
  private category = ShopCategory.All;
  private catalogPage = 0;
  private statusText = 'CONNECT WALLET TO BUY ITEMS';
  private actions: ShopAction[] = [];
  private focusedActionIndex = 0;
  private pendingActionIndex: number = null;

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

    super.update(updateArgs);

    this.activatePendingAction();
  }

  private renderShop(preferredFocusKey: string = null): void {
    this.root.removeAllChildren();
    this.actions = [];

    const background = new ShopPanel(this.root.size.width, this.root.size.height, COLOR_PAGE);
    background.setZIndex(-10);
    this.root.add(background);

    const originX = Math.max(24, Math.round((this.root.size.width - SHOP_WIDTH) / 2));
    const originY = Math.max(24, TOP_Y);

    const title = new ShopText('GAME SHOP', COLOR_YELLOW);
    title.position.set(originX + 16, originY - 70);
    this.root.add(title);

    const helper = new ShopText('BCT  /  ITEMS  /  FUEL  /  LOADOUT', COLOR_MUTED);
    helper.position.set(originX + 18, originY - 36);
    this.root.add(helper);

    this.addViewTab(originX + 16, originY, 'BCT SHOP', ShopView.Shop);
    this.addViewTab(originX + 242, originY, 'LOADOUT', ShopView.Loadout);

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

    const heading = new ShopText('INVENTORY', COLOR_MUTED);
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
      y + 132,
      'BCT',
      this.shopManager.getTokenBalance().toString(),
      'shop.coin',
    );
    this.addResourceChip(
      x + 28,
      y + 202,
      'FUEL',
      this.shopManager.getFuelBalance().toString(),
      'shop.fuel',
    );

    const inventoryY = y + 292;
    const inventoryTitle = new ShopText('OWNED', COLOR_MUTED);
    inventoryTitle.position.set(x + 28, inventoryY);
    this.root.add(inventoryTitle);

    this.addInventoryTile(x + 28, inventoryY + 42, ShopInventoryItemId.Shield);
    this.addInventoryTile(x + 160, inventoryY + 42, ShopInventoryItemId.BaseDefence);
    this.addInventoryTile(x + 28, inventoryY + 122, ShopInventoryItemId.Freeze);
    this.addInventoryTile(x + 160, inventoryY + 122, ShopInventoryItemId.Wipeout);
    this.addInventoryTile(x + 28, inventoryY + 202, ShopInventoryItemId.ExtraLife);

    const loadoutY = y + 586;
    const loadoutTitle = new ShopText('EQUIPPED', COLOR_MUTED);
    loadoutTitle.position.set(x + 28, loadoutY);
    this.root.add(loadoutTitle);

    this.addLoadoutRow(x + 28, loadoutY + 38, 'A1', this.getSlotLabel(ShopLoadoutSlot.ActiveOne));
    this.addLoadoutRow(x + 28, loadoutY + 76, 'A2', this.getSlotLabel(ShopLoadoutSlot.ActiveTwo));
    this.addLoadoutRow(x + 28, loadoutY + 114, 'P', this.getSlotLabel(ShopLoadoutSlot.Passive));

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
    this.addCategoryButton(x + 142, y, 'FUEL', ShopCategory.Fuel);
    this.addCategoryButton(x + 300, y, 'POWER', ShopCategory.Powerups);
    this.addCategoryButton(x + 490, y, 'PACKS', ShopCategory.Packs);

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
      this.addButton(x + 674, y, 76, FILTER_HEIGHT, 'PREV', {
        key: 'page:prev',
        kind: 'page',
        pageDelta: -1,
      }, false);
      this.addButton(x + 758, y, 76, FILTER_HEIGHT, 'NEXT', {
        key: 'page:next',
        kind: 'page',
        pageDelta: 1,
      }, false);
    }

    if (items.length === 0) {
      const empty = new ShopText('NO ITEMS IN THIS CATEGORY', COLOR_MUTED);
      empty.position.set(x, y + 110);
      this.root.add(empty);
      return;
    }

    if (this.category === ShopCategory.All) {
      const sectionText = new ShopText(`ALL ITEMS ${this.catalogPage + 1}/${pageCount}`, config.COLOR_WHITE);
      sectionText.position.set(x, y + 84);
      this.root.add(sectionText);

      items.forEach((item, index) => {
        const cardX = x + (index % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
        const cardY =
          y + 124 + Math.floor(index / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
        this.addCatalogCard(cardX, cardY, item);
      });
      return;
    }

    let currentSection = null;
    let sectionY = y + 84;
    let cardIndex = 0;

    items.forEach((item) => {
      const section = this.getItemSection(item.id);
      if (section !== currentSection) {
        currentSection = section;
        const sectionText = new ShopText(section, config.COLOR_WHITE);
        sectionText.position.set(x, sectionY);
        this.root.add(sectionText);
        sectionY += 44;
        cardIndex = 0;
      }

      const cardX = x + (cardIndex % CARD_COLUMNS) * (CARD_WIDTH + CARD_GAP_X);
      const cardY = sectionY + Math.floor(cardIndex / CARD_COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y);
      this.addCatalogCard(cardX, cardY, item);
      cardIndex += 1;

      if (cardIndex % CARD_COLUMNS === 0 || item === items[items.length - 1]) {
        const rows = Math.ceil(cardIndex / CARD_COLUMNS);
        sectionY += rows * (CARD_HEIGHT + CARD_GAP_Y) + 32;
        cardIndex = 0;
      }
    });
  }

  private renderLoadoutContent(x: number, y: number): void {
    const title = new ShopText('LOADOUT', config.COLOR_WHITE);
    title.position.set(x, y);
    this.root.add(title);

    const helper = new ShopText('SELECT A SLOT TO CYCLE OWNED ITEMS', COLOR_MUTED);
    helper.position.set(x, y + 34);
    this.root.add(helper);

    this.addSlotCard(x, y + 90, ShopLoadoutSlot.ActiveOne, 'ACTIVE 1');
    this.addSlotCard(x + CARD_WIDTH + CARD_GAP_X, y + 90, ShopLoadoutSlot.ActiveTwo, 'ACTIVE 2');
    this.addSlotCard(x + (CARD_WIDTH + CARD_GAP_X) * 2, y + 90, ShopLoadoutSlot.Passive, 'PASSIVE');

    const ownedTitle = new ShopText('OWNED CONSUMABLES', config.COLOR_WHITE);
    ownedTitle.position.set(x, y + 288);
    this.root.add(ownedTitle);

    this.addTextBlock(x, y + 328, [
      ['SHIELD', `${this.getInventoryCountText(ShopInventoryItemId.Shield)} READY`, COLOR_GREEN],
      ['BASE DEF', `${this.getInventoryCountText(ShopInventoryItemId.BaseDefence)} READY`, COLOR_GREEN],
      ['FREEZE', `${this.getInventoryCountText(ShopInventoryItemId.Freeze)} READY`, COLOR_PURPLE],
      ['WIPEOUT', `${this.getInventoryCountText(ShopInventoryItemId.Wipeout)} READY`, COLOR_ORANGE],
      ['EXTRA LIFE', `${this.getInventoryCountText(ShopInventoryItemId.ExtraLife)} READY`, COLOR_YELLOW],
    ]);

    const note = new ShopText(
      'BOUGHT ITEMS ARE CONSUMED WHEN A RUN STARTS',
      COLOR_MUTED,
    );
    note.position.set(x, y + 532);
    this.root.add(note);
  }

  private addViewTab(
    x: number,
    y: number,
    text: string,
    view: ShopView,
  ): void {
    this.addButton(x, y, 214, TAB_HEIGHT, text, {
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
    const width = text === 'POWER' || text === 'PACKS' ? 166 : 122;
    this.addButton(x, y, width, FILTER_HEIGHT, text, {
      key: `category:${category}`,
      kind: 'category',
      category,
    }, this.category === category);
  }

  private addCatalogCard(x: number, y: number, item: ShopCatalogItem): void {
    const card = new ShopCard(CARD_WIDTH, CARD_HEIGHT, this.getItemIconId(item.id));
    card.position.set(x, y);
    card.setContent(
      this.getItemTitle(item.id),
      this.getRewardText(item),
      `${item.price} BCT`,
    );
    this.root.add(card);

    this.actions.push({
      key: `catalog:${item.id}`,
      kind: 'catalog',
      itemId: item.id,
      target: card,
    });
  }

  private addSlotCard(
    x: number,
    y: number,
    slot: ShopLoadoutSlot,
    title: string,
  ): void {
    const card = new ShopCard(
      CARD_WIDTH,
      CARD_HEIGHT,
      slot === ShopLoadoutSlot.Passive ? 'powerup.tank' : 'powerup.helmet',
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
    });
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

    this.actions.push(Object.assign({}, action, { target: button }));

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

    if (action.kind === 'view') {
      this.view = action.view;
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
      const result = this.shopManager.purchaseItem(action.itemId);
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

  private focusActionByKey(preferredFocusKey: string): void {
    const index = this.actions.findIndex((action) => {
      return action.key === preferredFocusKey;
    });

    this.setFocusedAction(index === -1 ? 0 : index);
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
    return itemId === null ? 'EMPTY' : this.getInventoryLabel(itemId);
  }

  private getCompactSlotLabel(label: string): string {
    switch (label) {
      case 'BASE DEF':
        return 'BASE';
      case 'WIPEOUT':
        return 'WIPE';
      case 'EXTRA LIFE':
        return 'LIFE';
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
      case ShopInventoryItemId.ExtraLife:
        return 'LIFE';
      default:
        return this.getInventoryLabel(itemId);
    }
  }
}
