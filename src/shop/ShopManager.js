'use strict';
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function() {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function(o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function(o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null)
      for (const k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ShopManager = void 0;
const config = __importStar(require('../config'));
const api_1 = require('../network/api');
const web3_js_1 = require('@solana/web3.js');
const PhantomProvider_1 = require('../wallet/PhantomProvider');
const ShopTypes_1 = require('./ShopTypes');
const CATALOG = [
  {
    id: ShopTypes_1.ShopItemId.FuelOne,
    name: 'FUEL X1',
    price: 150,
    solPrice: 0.01,
    reward: { fuel: 1 },
  },
  {
    id: ShopTypes_1.ShopItemId.FuelFive,
    name: 'FUEL X5',
    price: 600,
    solPrice: 0.04,
    reward: { fuel: 5 },
  },
  {
    id: ShopTypes_1.ShopItemId.FuelTwenty,
    name: 'FUEL X20',
    price: 1800,
    solPrice: 0.12,
    reward: { fuel: 20 },
  },
  {
    id: ShopTypes_1.ShopItemId.Shield,
    name: 'SHIELD',
    price: 300,
    solPrice: 0.02,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.Shield]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.BaseDefence,
    name: 'BASE DEFENCE',
    price: 375,
    solPrice: 0.025,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.BaseDefence]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.Freeze,
    name: 'FREEZE',
    price: 450,
    solPrice: 0.03,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.Freeze]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.Speed,
    name: 'SPEED',
    price: 450,
    solPrice: 0.03,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.Speed]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.Upgrade,
    name: 'STAR',
    price: 675,
    solPrice: 0.045,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.Upgrade]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.ZoomOut,
    name: 'ZOOM OUT',
    price: 375,
    solPrice: 0.025,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.ZoomOut]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.Wipeout,
    name: 'WIPEOUT',
    price: 600,
    solPrice: 0.04,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.Wipeout]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.ExtraLife,
    name: 'EXTRA LIFE',
    price: 525,
    solPrice: 0.035,
    reward: { inventory: { [ShopTypes_1.ShopInventoryItemId.ExtraLife]: 1 } },
  },
  {
    id: ShopTypes_1.ShopItemId.StarterPack,
    name: 'STARTER PACK',
    price: 1200,
    solPrice: 0.08,
    reward: {
      fuel: 5,
      inventory: {
        [ShopTypes_1.ShopInventoryItemId.Shield]: 1,
        [ShopTypes_1.ShopInventoryItemId.BaseDefence]: 1,
      },
    },
  },
];
const ACTIVE_ITEMS = [
  ShopTypes_1.ShopInventoryItemId.Shield,
  ShopTypes_1.ShopInventoryItemId.BaseDefence,
  ShopTypes_1.ShopInventoryItemId.Freeze,
  ShopTypes_1.ShopInventoryItemId.Speed,
  ShopTypes_1.ShopInventoryItemId.Upgrade,
  ShopTypes_1.ShopInventoryItemId.ZoomOut,
  ShopTypes_1.ShopInventoryItemId.Wipeout,
  ShopTypes_1.ShopInventoryItemId.ExtraLife,
];
const PASSIVE_ITEMS = [ShopTypes_1.ShopInventoryItemId.ExtraLife];
const MAX_POWERUP_STACK = 2;
const SHOP_RPC_URL = 'https://api.mainnet-beta.solana.com';
const BATC_TOKEN_MINT = new web3_js_1.PublicKey(
  'Hxs5gXuPHv3Jhm7PYQv9iFMQp5ZYL2Fk6bgWdvQz15bz',
);
const ACTIVE_LOADOUT_SLOTS = [
  ShopTypes_1.ShopLoadoutSlot.ActiveOne,
  ShopTypes_1.ShopLoadoutSlot.ActiveTwo,
  ShopTypes_1.ShopLoadoutSlot.ActiveThree,
  ShopTypes_1.ShopLoadoutSlot.ActiveFour,
];
class ShopManager {
  constructor(storage) {
    this.storage = storage;
  }
  getCatalog() {
    return CATALOG;
  }
  isWalletConnected() {
    const address =
      this.storage.get(config.STORAGE_KEY_SHOP_WALLET_ADDRESS) || '';
    return (
      this.storage.getBoolean(
        config.STORAGE_KEY_SHOP_WALLET_CONNECTED,
        false,
      ) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
    );
  }
  async connectWallet() {
    const provider = (0, PhantomProvider_1.getPhantomProvider)();
    if (provider === null) return false;
    try {
      const result = await provider.connect();
      const address = result.publicKey.toString();
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
      this.storage.setBoolean(config.STORAGE_KEY_SHOP_WALLET_CONNECTED, true);
      this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, address);
      this.storage.save();
      await this.refreshOnChainBalances(address);
      return true;
    } catch {
      return false;
    }
  }
  getWalletAddress() {
    return this.storage.get(config.STORAGE_KEY_SHOP_WALLET_ADDRESS) || 'NONE';
  }
  getTokenBalance() {
    return this.storage.getNumber(
      config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
      config.SHOP_STARTING_TOKEN_BALANCE,
    );
  }
  getSolBalance() {
    return this.storage.getNumber(
      config.STORAGE_KEY_SHOP_SOL_BALANCE,
      config.SHOP_STARTING_SOL_BALANCE,
    );
  }
  getFuelBalance() {
    if (!this.isWalletConnected()) {
      return config.SHOP_GUEST_FUEL_BALANCE;
    }
    return this.storage.getNumber(config.STORAGE_KEY_SHOP_FUEL_BALANCE, 0);
  }
  getInventory() {
    // Guest (temp) accounts play with everything unlocked: a full stack of
    // every item, mirroring the unlimited-fuel rule in getFuelBalance().
    // Built fresh on every call so callers that mutate the returned object
    // (the consume paths) can't corrupt a shared copy.
    if (!this.isWalletConnected()) {
      const inventory = {};
      for (const itemId of ACTIVE_ITEMS) {
        inventory[itemId] = config.SHOP_GUEST_INVENTORY_COUNT;
      }
      return inventory;
    }
    return this.getJson(config.STORAGE_KEY_SHOP_INVENTORY, {});
  }
  getInventoryCount(itemId) {
    return this.getInventory()[itemId] || 0;
  }
  getEquipped(slot) {
    const loadout = this.getLoadout();
    const normalizedLoadout = this.normalizeLoadout(loadout);
    return normalizedLoadout[slot] || null;
  }
  getEquippedStackCount(slot) {
    const itemId = this.getEquipped(slot);
    if (itemId === null) {
      return 0;
    }
    return Math.min(MAX_POWERUP_STACK, this.getInventoryCount(itemId));
  }
  async purchaseItem(itemId, currency = ShopTypes_1.ShopCurrency.Token) {
    const provider = (0, PhantomProvider_1.getPhantomProvider)();
    if (provider === null) {
      return { ok: false, statusText: 'CONNECT WALLET' };
    }
    const item = CATALOG.find((catalogItem) => catalogItem.id === itemId);
    if (item === undefined) {
      return { ok: false, statusText: 'ITEM NOT FOUND' };
    }
    try {
      const connectionResult = await provider.connect();
      const walletAddress = connectionResult.publicKey.toString();
      this.storage.setBoolean(config.STORAGE_KEY_SHOP_WALLET_CONNECTED, true);
      this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, walletAddress);
      this.storage.save();
      const quoteResponse = await (0, api_1.apiFetch)(
        '/api/economy/purchase/quote',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId, currency, walletAddress }),
        },
      );
      const quote = await quoteResponse.json();
      if (!quoteResponse.ok || quote?.ok !== true) {
        return { ok: false, statusText: quote?.statusText || 'QUOTE FAILED' };
      }
      const transaction = web3_js_1.Transaction.from(
        this.fromBase64(quote.transaction),
      );
      const signed = await provider.signTransaction(transaction);
      const connection = new web3_js_1.Connection(
        quote.rpcUrl || SHOP_RPC_URL,
        'confirmed',
      );
      const txHash = await connection.sendRawTransaction(signed.serialize());
      const confirmation = await connection.confirmTransaction(
        {
          signature: txHash,
          blockhash: quote.blockhash,
          lastValidBlockHeight: quote.lastValidBlockHeight,
        },
        'confirmed',
      );
      if (confirmation.value.err !== null) {
        return { ok: false, statusText: 'PAYMENT FAILED' };
      }
      const verifyResponse = await (0, api_1.apiFetch)(
        '/api/economy/purchase/verify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            quoteToken: quote.quoteToken,
            signature: txHash,
          }),
        },
      );
      const result = await verifyResponse.json();
      if (!verifyResponse.ok || result?.ok !== true) {
        return {
          ok: false,
          statusText: result?.statusText || 'PAYMENT VERIFICATION FAILED',
          txHash,
        };
      }
      if (result.account !== undefined)
        this.applyAccountSnapshot(result.account);
      await this.refreshOnChainBalances(walletAddress);
      return {
        ok: true,
        statusText: result.statusText || `BOUGHT ${item.name}`,
        txHash,
      };
    } catch (error) {
      return {
        ok: false,
        statusText:
          error instanceof Error && error.message
            ? error.message.toUpperCase()
            : 'PURCHASE CANCELLED',
      };
    }
  }
  equipNext(slot) {
    const items =
      slot === ShopTypes_1.ShopLoadoutSlot.Passive
        ? PASSIVE_ITEMS
        : ACTIVE_ITEMS;
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const currentItem = loadout[slot] || null;
    const equippedElsewhere = new Set();
    Object.keys(loadout).forEach((slotKey) => {
      const loadoutSlot = slotKey;
      const itemId = loadout[loadoutSlot];
      if (loadoutSlot !== slot && itemId !== undefined) {
        equippedElsewhere.add(itemId);
      }
    });
    const ownedItems = items.filter((itemId) => {
      return (
        this.getInventoryCount(itemId) > 0 && !equippedElsewhere.has(itemId)
      );
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
    void this.syncAccountSnapshot();
    return nextItem;
  }
  canStartRun(fuelCost = config.SHOP_RUN_FUEL_COST) {
    return this.getFuelBalance() >= this.normalizeFuelCost(fuelCost);
  }
  consumeFuelForRun(fuelCost = config.SHOP_RUN_FUEL_COST) {
    const normalizedFuelCost = this.normalizeFuelCost(fuelCost);
    if (!this.canStartRun(normalizedFuelCost)) {
      return false;
    }
    if (!this.isWalletConnected()) {
      return true;
    }
    this.storage.setNumber(
      config.STORAGE_KEY_SHOP_FUEL_BALANCE,
      this.getFuelBalance() - normalizedFuelCost,
    );
    this.storage.save();
    void this.syncAccountSnapshot();
    return true;
  }
  normalizeFuelCost(fuelCost) {
    const parsed = Number(fuelCost);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }
  getEquippedRunConsumables() {
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const inventory = this.getInventory();
    const consumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };
    ACTIVE_LOADOUT_SLOTS.forEach((slot) => {
      const itemId = loadout[slot];
      if (itemId === undefined || (inventory[itemId] || 0) <= 0) {
        return;
      }
      const powerupType = (0, ShopTypes_1.getPowerupTypeForInventoryItem)(
        itemId,
      );
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
  async syncAccount() {
    await this.syncAccountSnapshot();
  }
  consumeInventoryItem(itemId) {
    // Guest items never deplete (see getInventory) — report success without
    // persisting a decrement, like consumeFuelForRun does for guest fuel.
    if (!this.isWalletConnected()) {
      return true;
    }
    const inventory = this.getInventory();
    if ((inventory[itemId] || 0) <= 0) {
      return false;
    }
    inventory[itemId] -= 1;
    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey;
      if (loadout[slot] === itemId && (inventory[itemId] || 0) <= 0) {
        delete loadout[slot];
      }
    });
    this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
    this.storage.save();
    void this.syncAccountSnapshot();
    return true;
  }
  consumeEquippedItems() {
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    const inventory = this.getInventory();
    const consumables = {
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: 0,
    };
    // Guest items never deplete: hand out the equipped consumables but leave
    // both the inventory and the loadout untouched, so the guest's slots stay
    // equipped run after run.
    const isGuest = !this.isWalletConnected();
    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey;
      const itemId = loadout[slot];
      if (itemId === undefined || (inventory[itemId] || 0) <= 0) {
        delete loadout[slot];
        return;
      }
      if (!isGuest) {
        inventory[itemId] -= 1;
        delete loadout[slot];
      }
      if (itemId === ShopTypes_1.ShopInventoryItemId.ExtraLife) {
        consumables.extraLives += 1;
        return;
      }
      const powerupType = (0, ShopTypes_1.getPowerupTypeForInventoryItem)(
        itemId,
      );
      if (powerupType !== null) {
        consumables.powerupItems.push(itemId);
        consumables.powerups.push(powerupType);
        consumables.powerupCounts.push(1);
      }
    });
    if (!isGuest) {
      this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
      this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
      this.storage.save();
      void this.syncAccountSnapshot();
    }
    return consumables;
  }
  addFuel(fuel) {
    if (fuel <= 0) {
      return;
    }
    this.storage.setNumber(
      config.STORAGE_KEY_SHOP_FUEL_BALANCE,
      this.getFuelBalance() + fuel,
    );
  }
  addInventory(reward) {
    const inventory = this.getInventory();
    Object.keys(reward).forEach((key) => {
      const itemId = key;
      inventory[itemId] = (inventory[itemId] || 0) + reward[itemId];
    });
    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
  }
  getAccountSnapshot() {
    const loadout = this.getLoadout();
    this.normalizeLoadout(loadout);
    return {
      tokenBalance: this.getTokenBalance(),
      solBalance: this.getSolBalance(),
      fuelBalance: this.getFuelBalance(),
      inventory: this.getInventory(),
      loadout,
    };
  }
  applyAccountSnapshot(account) {
    if (typeof account !== 'object' || account === null) {
      return;
    }
    if (typeof account.tokenBalance === 'number') {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
        account.tokenBalance,
      );
    }
    if (typeof account.solBalance === 'number') {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_SOL_BALANCE,
        account.solBalance,
      );
    }
    if (typeof account.fuelBalance === 'number') {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_FUEL_BALANCE,
        account.fuelBalance,
      );
    }
    if (account.inventory !== undefined) {
      this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, account.inventory);
    }
    if (account.loadout !== undefined) {
      this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, account.loadout);
    }
    this.storage.save();
  }
  async syncAccountSnapshot() {
    try {
      const response = await (0, api_1.apiFetch)('/api/economy/account', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ account: this.getAccountSnapshot() }),
      });
      if (!response.ok) {
        return;
      }
      const body = await response.json();
      if (body?.authenticated === true && body?.account !== undefined) {
        this.applyAccountSnapshot(body.account);
      }
    } catch {
      // Best-effort sync only.
    }
  }
  async refreshOnChainBalances(walletAddress) {
    try {
      const connection = new web3_js_1.Connection(SHOP_RPC_URL, 'confirmed');
      const owner = new web3_js_1.PublicKey(walletAddress);
      const [lamports, tokenAccounts] = await Promise.all([
        connection.getBalance(owner, 'confirmed'),
        connection.getParsedTokenAccountsByOwner(owner, {
          mint: BATC_TOKEN_MINT,
        }),
      ]);
      const tokenBalance =
        tokenAccounts.value.reduce((total, account) => {
          const amount = account.account.data.parsed?.info?.tokenAmount?.amount;
          return total + (typeof amount === 'string' ? Number(amount) : 0);
        }, 0) / 1000000;
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_SOL_BALANCE,
        lamports / 1000000000,
      );
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
        tokenBalance,
      );
      this.storage.save();
    } catch {
      // Keep the last displayed balances when the public RPC is unavailable.
    }
  }
  getLoadout() {
    return this.getJson(config.STORAGE_KEY_SHOP_LOADOUT, {});
  }
  normalizeLoadout(loadout) {
    const equippedItems = new Set();
    if (
      loadout[ShopTypes_1.ShopLoadoutSlot.Passive] !== undefined &&
      loadout[ShopTypes_1.ShopLoadoutSlot.ActiveFour] === undefined
    ) {
      loadout[ShopTypes_1.ShopLoadoutSlot.ActiveFour] =
        loadout[ShopTypes_1.ShopLoadoutSlot.Passive];
    }
    delete loadout[ShopTypes_1.ShopLoadoutSlot.Passive];
    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey;
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
  fromBase64(value) {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  getJson(key, defaultValue) {
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
  setJson(key, value) {
    this.storage.set(key, JSON.stringify(value));
  }
}
exports.ShopManager = ShopManager;
