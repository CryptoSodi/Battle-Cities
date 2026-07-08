/// <reference path="../types/Window.d.ts" />
import test from 'ava';

import { GameStorage } from '../game';
import * as config from '../config';

import { ShopManager } from './ShopManager';
import { ShopInventoryItemId } from './ShopTypes';

// Storage is purely in-memory unless load() is called, so a fixed namespace
// keeps tests isolated from each other and from the real game data. save() is
// stubbed out: jsdom's opaque-origin localStorage throws on any access.
function makeManager(): ShopManager {
  const storage = new GameStorage('test.shop');
  storage.save = (): void => undefined;
  return new ShopManager(storage);
}

// Guest (temp) accounts play with everything unlocked: unlimited fuel and a
// full, never-depleting stack of every shop item.
test('a guest account owns a full stack of every item', (t) => {
  const manager = makeManager();

  const inventory = manager.getInventory();
  Object.values(ShopInventoryItemId).forEach((itemId) => {
    t.is(
      inventory[itemId],
      config.SHOP_GUEST_INVENTORY_COUNT,
      `guest should own a full stack of ${itemId}`,
    );
  });
});

test('guest items and fuel never deplete when consumed', (t) => {
  const manager = makeManager();

  t.true(manager.consumeInventoryItem(ShopInventoryItemId.Shield));
  t.is(
    manager.getInventoryCount(ShopInventoryItemId.Shield),
    config.SHOP_GUEST_INVENTORY_COUNT,
  );

  t.true(manager.canStartRun());
  t.true(manager.consumeFuelForRun());
  t.is(manager.getFuelBalance(), config.SHOP_GUEST_FUEL_BALANCE);
});

// Connecting a wallet switches to the real, storage-backed economy: nothing
// owned until bought, and consumption actually fails on an empty inventory.
test('a connected wallet uses the real storage-backed inventory', (t) => {
  const manager = makeManager();
  manager.connectWallet();

  t.is(manager.getInventoryCount(ShopInventoryItemId.Shield), 0);
  t.false(manager.consumeInventoryItem(ShopInventoryItemId.Shield));
});
