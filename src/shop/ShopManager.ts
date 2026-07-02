import { GameStorage } from '../game';
import * as config from '../config';

import {
  getPowerupTypeForInventoryItem,
  ShopCatalogItem,
  ShopCurrency,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopPurchaseResult,
  ShopRunConsumables,
} from './ShopTypes';

type ShopInventory = Partial<Record<ShopInventoryItemId, number>>;
type ShopLoadout = Partial<Record<ShopLoadoutSlot, ShopInventoryItemId>>;

const CATALOG: ShopCatalogItem[] = [
  {
    id: ShopItemId.FuelOne,
    name: 'FUEL X1',
    price: 10,
    solPrice: 0.01,
    reward: { fuel: 1 },
  },
  {
    id: ShopItemId.FuelFive,
    name: 'FUEL X5',
    price: 45,
    solPrice: 0.04,
    reward: { fuel: 5 },
  },
  {
    id: ShopItemId.FuelTwenty,
    name: 'FUEL X20',
    price: 160,
    solPrice: 0.12,
    reward: { fuel: 20 },
  },
  {
    id: ShopItemId.Shield,
    name: 'SHIELD',
    price: 25,
    solPrice: 0.02,
    reward: { inventory: { [ShopInventoryItemId.Shield]: 1 } },
  },
  {
    id: ShopItemId.BaseDefence,
    name: 'BASE DEFENCE',
    price: 30,
    solPrice: 0.025,
    reward: { inventory: { [ShopInventoryItemId.BaseDefence]: 1 } },
  },
  {
    id: ShopItemId.Freeze,
    name: 'FREEZE',
    price: 35,
    solPrice: 0.03,
    reward: { inventory: { [ShopInventoryItemId.Freeze]: 1 } },
  },
  {
    id: ShopItemId.Wipeout,
    name: 'WIPEOUT',
    price: 45,
    solPrice: 0.04,
    reward: { inventory: { [ShopInventoryItemId.Wipeout]: 1 } },
  },
  {
    id: ShopItemId.ExtraLife,
    name: 'EXTRA LIFE',
    price: 40,
    solPrice: 0.035,
    reward: { inventory: { [ShopInventoryItemId.ExtraLife]: 1 } },
  },
  {
    id: ShopItemId.StarterPack,
    name: 'STARTER PACK',
    price: 90,
    solPrice: 0.08,
    reward: {
      fuel: 5,
      inventory: {
        [ShopInventoryItemId.Shield]: 1,
        [ShopInventoryItemId.BaseDefence]: 1,
      },
    },
  },
];

const ACTIVE_ITEMS = [
  ShopInventoryItemId.Shield,
  ShopInventoryItemId.BaseDefence,
  ShopInventoryItemId.Freeze,
  ShopInventoryItemId.Wipeout,
];

const PASSIVE_ITEMS = [ShopInventoryItemId.ExtraLife];

const MAX_POWERUP_STACK = 2;

export class ShopManager {
  private storage: GameStorage;

  constructor(storage: GameStorage) {
    this.storage = storage;
  }

  public getCatalog(): ShopCatalogItem[] {
    return CATALOG;
  }

  public isWalletConnected(): boolean {
    return this.storage.getBoolean(
      config.STORAGE_KEY_SHOP_WALLET_CONNECTED,
      false,
    );
  }

  public connectWallet(): void {
    this.storage.setBoolean(config.STORAGE_KEY_SHOP_WALLET_CONNECTED, true);
    this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, '0XBATTLECITIES');

    if (this.storage.get(config.STORAGE_KEY_SHOP_TOKEN_BALANCE) === undefined) {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
        config.SHOP_STARTING_TOKEN_BALANCE,
      );
    }
    if (this.storage.get(config.STORAGE_KEY_SHOP_SOL_BALANCE) === undefined) {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_SOL_BALANCE,
        config.SHOP_STARTING_SOL_BALANCE,
      );
    }

    this.storage.save();
  }

  public getWalletAddress(): string {
    return this.storage.get(config.STORAGE_KEY_SHOP_WALLET_ADDRESS) || 'NONE';
  }

  public getTokenBalance(): number {
    return this.storage.getNumber(
      config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
      config.SHOP_STARTING_TOKEN_BALANCE,
    );
  }

  public getSolBalance(): number {
    return this.storage.getNumber(
      config.STORAGE_KEY_SHOP_SOL_BALANCE,
      config.SHOP_STARTING_SOL_BALANCE,
    );
  }

  public getFuelBalance(): number {
    return this.storage.getNumber(config.STORAGE_KEY_SHOP_FUEL_BALANCE, 0);
  }

  public getInventory(): ShopInventory {
    return this.getJson<ShopInventory>(config.STORAGE_KEY_SHOP_INVENTORY, {});
  }

  public getInventoryCount(itemId: ShopInventoryItemId): number {
    return this.getInventory()[itemId] || 0;
  }

  public getEquipped(slot: ShopLoadoutSlot): ShopInventoryItemId {
    const loadout = this.getLoadout();
    const normalizedLoadout = this.normalizeLoadout(loadout);
    return normalizedLoadout[slot] || null;
  }

  public getEquippedStackCount(slot: ShopLoadoutSlot): number {
    const itemId = this.getEquipped(slot);
    if (itemId === null) {
      return 0;
    }

    return Math.min(MAX_POWERUP_STACK, this.getInventoryCount(itemId));
  }

  public purchaseItem(
    itemId: ShopItemId,
    currency = ShopCurrency.Token,
  ): ShopPurchaseResult {
    if (!this.isWalletConnected()) {
      return { ok: false, statusText: 'CONNECT WALLET' };
    }

    const item = CATALOG.find((catalogItem) => catalogItem.id === itemId);
    if (item === undefined) {
      return { ok: false, statusText: 'ITEM NOT FOUND' };
    }

    if (currency === ShopCurrency.Sol) {
      const solBalance = this.getSolBalance();
      if (solBalance < item.solPrice) {
        return { ok: false, statusText: 'NEED MORE SOL' };
      }
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_SOL_BALANCE,
        Number((solBalance - item.solPrice).toFixed(4)),
      );
    } else {
      const tokenBalance = this.getTokenBalance();
      if (tokenBalance < item.price) {
        return { ok: false, statusText: 'NEED MORE BCT' };
      }
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
        tokenBalance - item.price,
      );
    }

    this.addFuel(item.reward.fuel || 0);
    this.addInventory(item.reward.inventory || {});

    const txHash = this.createMockTransactionHash();
    this.storage.save();

    return { ok: true, statusText: `BOUGHT ${item.name}`, txHash };
  }

  public equipNext(slot: ShopLoadoutSlot): ShopInventoryItemId {
    const items =
      slot === ShopLoadoutSlot.Passive ? PASSIVE_ITEMS : ACTIVE_ITEMS;
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const currentItem = loadout[slot] || null;
    const equippedElsewhere = new Set<ShopInventoryItemId>();
    Object.keys(loadout).forEach((slotKey) => {
      const loadoutSlot = slotKey as ShopLoadoutSlot;
      const itemId = loadout[loadoutSlot];
      if (loadoutSlot !== slot && itemId !== undefined) {
        equippedElsewhere.add(itemId);
      }
    });
    const ownedItems = items.filter((itemId) => {
      return this.getInventoryCount(itemId) > 0 && !equippedElsewhere.has(itemId);
    });
    const choices = [null, ...ownedItems];
    const currentIndex = choices.indexOf(currentItem);
    const nextIndex = currentIndex >= choices.length - 1 ? 0 : currentIndex + 1;
    const nextItem = choices[nextIndex];

    if (nextItem === null) {
      delete loadout[slot];
    } else {
      loadout[slot] = nextItem;
    }

    this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
    this.storage.save();

    return nextItem;
  }

  public canStartRun(): boolean {
    return this.isWalletConnected() && this.getFuelBalance() >= config.SHOP_RUN_FUEL_COST;
  }

  public consumeFuelForRun(): boolean {
    if (!this.canStartRun()) {
      return false;
    }

    this.storage.setNumber(
      config.STORAGE_KEY_SHOP_FUEL_BALANCE,
      this.getFuelBalance() - config.SHOP_RUN_FUEL_COST,
    );
    this.storage.save();

    return true;
  }

  public getEquippedRunConsumables(): ShopRunConsumables {
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const inventory = this.getInventory();
    const consumables: ShopRunConsumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };

    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey as ShopLoadoutSlot;
      const itemId = loadout[slot];
      if (itemId === undefined || (inventory[itemId] || 0) <= 0) {
        return;
      }

      const powerupType = getPowerupTypeForInventoryItem(itemId);
      if (powerupType !== null) {
        if (consumables.powerupItems.indexOf(itemId) !== -1) {
          return;
        }

        consumables.powerupItems.push(itemId);
        consumables.powerups.push(powerupType);
        consumables.powerupCounts.push(
          Math.min(MAX_POWERUP_STACK, inventory[itemId] || 0),
        );
      }
    });

    return consumables;
  }

  public consumeInventoryItem(itemId: ShopInventoryItemId): boolean {
    const inventory = this.getInventory();
    if ((inventory[itemId] || 0) <= 0) {
      return false;
    }

    inventory[itemId] -= 1;
    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);

    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey as ShopLoadoutSlot;
      if (loadout[slot] === itemId && (inventory[itemId] || 0) <= 0) {
        delete loadout[slot];
      }
    });
    this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
    this.storage.save();

    return true;
  }

  public consumeEquippedItems(): ShopRunConsumables {
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const inventory = this.getInventory();
    const consumables: ShopRunConsumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };

    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey as ShopLoadoutSlot;
      const itemId = loadout[slot];
      if (itemId === undefined || (inventory[itemId] || 0) <= 0) {
        delete loadout[slot];
        return;
      }

      inventory[itemId] -= 1;
      delete loadout[slot];

      if (itemId === ShopInventoryItemId.ExtraLife) {
        consumables.extraLives += 1;
        return;
      }

      const powerupType = getPowerupTypeForInventoryItem(itemId);
      if (powerupType !== null) {
        consumables.powerupItems.push(itemId);
        consumables.powerups.push(powerupType);
        consumables.powerupCounts.push(1);
      }
    });

    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
    this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
    this.storage.save();

    return consumables;
  }

  private addFuel(fuel: number): void {
    if (fuel <= 0) {
      return;
    }

    this.storage.setNumber(
      config.STORAGE_KEY_SHOP_FUEL_BALANCE,
      this.getFuelBalance() + fuel,
    );
  }

  private addInventory(reward: Partial<Record<ShopInventoryItemId, number>>): void {
    const inventory = this.getInventory();

    Object.keys(reward).forEach((key) => {
      const itemId = key as ShopInventoryItemId;
      inventory[itemId] = (inventory[itemId] || 0) + reward[itemId];
    });

    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
  }

  private getLoadout(): ShopLoadout {
    return this.getJson<ShopLoadout>(config.STORAGE_KEY_SHOP_LOADOUT, {});
  }

  private normalizeLoadout(loadout: ShopLoadout): ShopLoadout {
    const equippedItems = new Set<ShopInventoryItemId>();

    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey as ShopLoadoutSlot;
      const itemId = loadout[slot];
      if (itemId === undefined) {
        return;
      }

      if (equippedItems.has(itemId)) {
        delete loadout[slot];
        return;
      }

      equippedItems.add(itemId);
    });

    return loadout;
  }

  private createMockTransactionHash(): string {
    const nextIndex =
      this.storage.getNumber(config.STORAGE_KEY_SHOP_TX_INDEX, 0) + 1;
    this.storage.setNumber(config.STORAGE_KEY_SHOP_TX_INDEX, nextIndex);

    return `MOCKTX${nextIndex.toString().padStart(4, '0')}`;
  }

  private getJson<T>(key: string, defaultValue: T): T {
    const json = this.storage.get(key);
    if (json === undefined) {
      return defaultValue;
    }

    try {
      return JSON.parse(json);
    } catch (err) {
      return defaultValue;
    }
  }

  private setJson(key: string, value: object): void {
    this.storage.set(key, JSON.stringify(value));
  }
}
