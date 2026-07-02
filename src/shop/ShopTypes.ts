import { PowerupType } from '../powerup';

export enum ShopItemId {
  FuelOne = 'fuel-one',
  FuelFive = 'fuel-five',
  FuelTwenty = 'fuel-twenty',
  Shield = 'shield',
  BaseDefence = 'base-defence',
  Freeze = 'freeze',
  Wipeout = 'wipeout',
  ExtraLife = 'extra-life',
  StarterPack = 'starter-pack',
}

export enum ShopInventoryItemId {
  Shield = 'shield',
  BaseDefence = 'base-defence',
  Freeze = 'freeze',
  Wipeout = 'wipeout',
  ExtraLife = 'extra-life',
}

export enum ShopLoadoutSlot {
  ActiveOne = 'active-one',
  ActiveTwo = 'active-two',
  Passive = 'passive',
}

export enum ShopCurrency {
  Token = 'token',
  Sol = 'sol',
}

export interface ShopCatalogReward {
  fuel?: number;
  inventory?: Partial<Record<ShopInventoryItemId, number>>;
}

export interface ShopCatalogItem {
  id: ShopItemId;
  name: string;
  price: number;
  solPrice: number;
  reward: ShopCatalogReward;
}

export interface ShopPurchaseResult {
  ok: boolean;
  statusText: string;
  txHash?: string;
}

export interface ShopRunConsumables {
  powerups: PowerupType[];
  powerupItems: ShopInventoryItemId[];
  extraLives: number;
}

export function getPowerupTypeForInventoryItem(
  itemId: ShopInventoryItemId,
): PowerupType | null {
  switch (itemId) {
    case ShopInventoryItemId.Shield:
      return PowerupType.Shield;
    case ShopInventoryItemId.BaseDefence:
      return PowerupType.BaseDefence;
    case ShopInventoryItemId.Freeze:
      return PowerupType.Freeze;
    case ShopInventoryItemId.Wipeout:
      return PowerupType.Wipeout;
    case ShopInventoryItemId.ExtraLife:
      return PowerupType.Life;
    default:
      return null;
  }
}
