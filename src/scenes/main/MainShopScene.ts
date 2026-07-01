import { GameUpdateArgs } from '../../game';
import {
  MenuDescription,
  SceneMenu,
  SceneMenuTitle,
  TextMenuItem,
} from '../../gameObjects';
import {
  ShopCatalogItem,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopManager,
} from '../../shop';

import { GameScene } from '../GameScene';

const SHOP_MENU_Y = 286;

export class MainShopScene extends GameScene {
  private title: SceneMenuTitle;
  private description: MenuDescription;
  private menu: SceneMenu;
  private connectWalletItem: TextMenuItem;
  private catalogItems: TextMenuItem[] = [];
  private activeOneItem: TextMenuItem;
  private activeTwoItem: TextMenuItem;
  private passiveItem: TextMenuItem;
  private backItem: TextMenuItem;
  private shopManager: ShopManager;
  private statusText = 'CONNECT WALLET TO BUY';

  protected setup({ gameStorage }: GameUpdateArgs): void {
    this.shopManager = new ShopManager(gameStorage);

    this.title = new SceneMenuTitle('SHOP');
    this.root.add(this.title);

    this.description = new MenuDescription(this.getDescriptionText());
    this.description.position.set(16, 160);
    this.root.add(this.description);

    this.connectWalletItem = new TextMenuItem('CONNECT WALLET');
    this.connectWalletItem.selected.addListener(this.handleConnectWallet);

    this.catalogItems = this.shopManager.getCatalog().map((item) => {
      const menuItem = new TextMenuItem(this.getCatalogItemText(item));
      menuItem.selected.addListener(() => {
        this.handleCatalogItemSelected(item.id);
      });
      return menuItem;
    });

    this.activeOneItem = new TextMenuItem(this.getSlotText(ShopLoadoutSlot.ActiveOne));
    this.activeOneItem.selected.addListener(() => {
      this.handleSlotSelected(ShopLoadoutSlot.ActiveOne);
    });

    this.activeTwoItem = new TextMenuItem(this.getSlotText(ShopLoadoutSlot.ActiveTwo));
    this.activeTwoItem.selected.addListener(() => {
      this.handleSlotSelected(ShopLoadoutSlot.ActiveTwo);
    });

    this.passiveItem = new TextMenuItem(this.getSlotText(ShopLoadoutSlot.Passive));
    this.passiveItem.selected.addListener(() => {
      this.handleSlotSelected(ShopLoadoutSlot.Passive);
    });

    this.backItem = new TextMenuItem('BACK');
    this.backItem.selected.addListener(this.handleBackSelected);

    this.menu = new SceneMenu();
    this.menu.position.setY(SHOP_MENU_Y);
    this.menu.setItems([
      this.connectWalletItem,
      ...this.catalogItems,
      this.activeOneItem,
      this.activeTwoItem,
      this.passiveItem,
      this.backItem,
    ]);
    this.root.add(this.menu);

    this.refresh();
  }

  private handleConnectWallet = (): void => {
    this.shopManager.connectWallet();
    this.statusText = 'WALLET CONNECTED';
    this.refresh();
  };

  private handleCatalogItemSelected = (itemId: ShopItemId): void => {
    const result = this.shopManager.purchaseItem(itemId);
    this.statusText = result.statusText;
    this.refresh();
  };

  private handleSlotSelected = (slot: ShopLoadoutSlot): void => {
    const itemId = this.shopManager.equipNext(slot);
    this.statusText =
      itemId === null ? 'SLOT CLEARED' : `EQUIPPED ${this.getInventoryLabel(itemId)}`;
    this.refresh();
  };

  private handleBackSelected = (): void => {
    this.navigator.back();
  };

  private refresh(): void {
    this.description.setMessage(this.getDescriptionText());
    this.connectWalletItem.setText(
      this.shopManager.isWalletConnected() ? 'WALLET CONNECTED' : 'CONNECT WALLET',
    );
    this.shopManager.getCatalog().forEach((item, index) => {
      this.catalogItems[index].setText(this.getCatalogItemText(item));
    });
    this.activeOneItem.setText(this.getSlotText(ShopLoadoutSlot.ActiveOne));
    this.activeTwoItem.setText(this.getSlotText(ShopLoadoutSlot.ActiveTwo));
    this.passiveItem.setText(this.getSlotText(ShopLoadoutSlot.Passive));
  }

  private getDescriptionText(): string {
    const walletStatus = this.shopManager.isWalletConnected()
      ? this.shopManager.getWalletAddress()
      : 'NO WALLET';
    const tokenBalance = this.shopManager
      .getTokenBalance()
      .toString()
      .padStart(4, '0');
    const fuelBalance = this.shopManager
      .getFuelBalance()
      .toString()
      .padStart(3, '0');
    const inventory = [
      `SH ${this.getInventoryCountText(ShopInventoryItemId.Shield)}`,
      `BD ${this.getInventoryCountText(ShopInventoryItemId.BaseDefence)}`,
      `FR ${this.getInventoryCountText(ShopInventoryItemId.Freeze)}`,
      `WO ${this.getInventoryCountText(ShopInventoryItemId.Wipeout)}`,
      `LF ${this.getInventoryCountText(ShopInventoryItemId.ExtraLife)}`,
    ].join(' ');

    return [
      `WALLET ${walletStatus}`,
      `BCT ${tokenBalance} FUEL ${fuelBalance}`,
      inventory,
      this.statusText,
    ].join('\n');
  }

  private getCatalogItemText(item: ShopCatalogItem): string {
    return `${item.name} ${item.price} BCT`;
  }

  private getSlotText(slot: ShopLoadoutSlot): string {
    const itemId = this.shopManager.getEquipped(slot);
    const label = itemId === null ? 'EMPTY' : this.getInventoryLabel(itemId);

    switch (slot) {
      case ShopLoadoutSlot.ActiveOne:
        return `ACTIVE 1 ${label}`;
      case ShopLoadoutSlot.ActiveTwo:
        return `ACTIVE 2 ${label}`;
      default:
        return `PASSIVE ${label}`;
    }
  }

  private getInventoryCountText(itemId: ShopInventoryItemId): string {
    return this.shopManager.getInventoryCount(itemId).toString().padStart(2, '0');
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
}
