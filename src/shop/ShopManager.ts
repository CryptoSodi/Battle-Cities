import { GameStorage } from '../game';
import * as config from '../config';
import { apiFetch } from '../network/api';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getPhantomProvider } from '../wallet/PhantomProvider';

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

function createPowerupConsumptionRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `powerup:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

const CATALOG: ShopCatalogItem[] = [
  {
    id: ShopItemId.FuelOne,
    name: 'FUEL X1',
    price: 150,
    solPrice: 0.01,
    reward: { fuel: 1 },
  },
  {
    id: ShopItemId.FuelFive,
    name: 'FUEL X5',
    price: 600,
    solPrice: 0.04,
    reward: { fuel: 5 },
  },
  {
    id: ShopItemId.FuelTwenty,
    name: 'FUEL X20',
    price: 1800,
    solPrice: 0.12,
    reward: { fuel: 20 },
  },
  {
    id: ShopItemId.Shield,
    name: 'SHIELD',
    price: 300,
    solPrice: 0.02,
    reward: { inventory: { [ShopInventoryItemId.Shield]: 1 } },
  },
  {
    id: ShopItemId.BaseDefence,
    name: 'BASE DEFENCE',
    price: 375,
    solPrice: 0.025,
    reward: { inventory: { [ShopInventoryItemId.BaseDefence]: 1 } },
  },
  {
    id: ShopItemId.Freeze,
    name: 'FREEZE',
    price: 450,
    solPrice: 0.03,
    reward: { inventory: { [ShopInventoryItemId.Freeze]: 1 } },
  },
  {
    id: ShopItemId.Speed,
    name: 'SPEED',
    price: 450,
    solPrice: 0.03,
    reward: { inventory: { [ShopInventoryItemId.Speed]: 1 } },
  },
  {
    id: ShopItemId.Upgrade,
    name: 'STAR',
    price: 675,
    solPrice: 0.045,
    reward: { inventory: { [ShopInventoryItemId.Upgrade]: 1 } },
  },
  {
    id: ShopItemId.ZoomOut,
    name: 'ZOOM OUT',
    price: 375,
    solPrice: 0.025,
    reward: { inventory: { [ShopInventoryItemId.ZoomOut]: 1 } },
  },
  {
    id: ShopItemId.Wipeout,
    name: 'WIPEOUT',
    price: 600,
    solPrice: 0.04,
    reward: { inventory: { [ShopInventoryItemId.Wipeout]: 1 } },
  },
  {
    id: ShopItemId.ExtraLife,
    name: 'EXTRA LIFE',
    price: 525,
    solPrice: 0.035,
    reward: { inventory: { [ShopInventoryItemId.ExtraLife]: 1 } },
  },
  {
    id: ShopItemId.StarterPack,
    name: 'STARTER PACK',
    price: 1200,
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
  ShopInventoryItemId.Speed,
  ShopInventoryItemId.Upgrade,
  ShopInventoryItemId.ZoomOut,
  ShopInventoryItemId.Wipeout,
  ShopInventoryItemId.ExtraLife,
];

const PASSIVE_ITEMS = [ShopInventoryItemId.ExtraLife];

const MAX_POWERUP_STACK = 2;
const SHOP_RPC_URL = 'https://api.mainnet-beta.solana.com';
const BATC_TOKEN_MINT = new PublicKey(
  'Hxs5gXuPHv3Jhm7PYQv9iFMQp5ZYL2Fk6bgWdvQz15bz',
);
const ACTIVE_LOADOUT_SLOTS = [
  ShopLoadoutSlot.ActiveOne,
  ShopLoadoutSlot.ActiveTwo,
  ShopLoadoutSlot.ActiveThree,
  ShopLoadoutSlot.ActiveFour,
];

export interface PresaleStage {
  id: number;
  label: string;
  priceSol: string;
  allocationBatc: string;
  soldBatc: string;
  status: 'active' | 'upcoming' | 'sold-out';
}

export interface PresaleState {
  configured: boolean;
  network: string;
  ended: boolean;
  currentStageId: number | null;
  currentPriceSol: string | null;
  maxPaySol: string | null;
  participants: number;
  stages: PresaleStage[];
}

export interface PresaleQuote {
  quoteToken: string;
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
  stageLabel: string;
  method: 'SOL';
  payAmount: string;
  batcAmount: string;
  tokenPriceSol: string;
  treasury: string;
  network: string;
}

export class ShopManager {
  private storage: GameStorage;

  constructor(storage: GameStorage) {
    this.storage = storage;
  }

  public getCatalog(): ShopCatalogItem[] {
    return CATALOG;
  }

  public isWalletConnected(): boolean {
    const address =
      this.storage.get(config.STORAGE_KEY_SHOP_WALLET_ADDRESS) || '';
    return (
      this.storage.getBoolean(
        config.STORAGE_KEY_SHOP_WALLET_CONNECTED,
        false,
      ) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
      && this.getAccountProvider() !== 'google'
    );
  }

  public getAccountProvider(): 'wallet' | 'google' | null {
    const provider = this.storage.get(config.STORAGE_KEY_SHOP_ACCOUNT_PROVIDER);
    return provider === 'wallet' || provider === 'google' ? provider : null;
  }

  public isVirtualEconomyAccount(): boolean {
    return this.getAccountProvider() === 'google';
  }

  public isShopAccountConnected(): boolean {
    return this.getAccountProvider() !== null || this.isWalletConnected();
  }

  public async connectWallet(): Promise<boolean> {
    const provider = getPhantomProvider();
    if (provider === null) return false;
    try {
      const result = await provider.connect();
      const address = result.publicKey.toString();
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
      this.storage.setBoolean(config.STORAGE_KEY_SHOP_WALLET_CONNECTED, true);
      this.storage.set(config.STORAGE_KEY_SHOP_ACCOUNT_PROVIDER, 'wallet');
      this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, address);
      this.storage.save();
      await this.refreshWalletBalances(address);
      return true;
    } catch {
      return false;
    }
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
    if (!this.isShopAccountConnected()) {
      return config.SHOP_GUEST_FUEL_BALANCE;
    }

    return this.storage.getNumber(config.STORAGE_KEY_SHOP_FUEL_BALANCE, 0);
  }

  public getInventory(): ShopInventory {
    // Guest (temp) accounts play with everything unlocked: a full stack of
    // every item, mirroring the unlimited-fuel rule in getFuelBalance().
    // Built fresh on every call so callers that mutate the returned object
    // (the consume paths) can't corrupt a shared copy.
    if (!this.isShopAccountConnected()) {
      const inventory: ShopInventory = {};
      for (const itemId of ACTIVE_ITEMS) {
        inventory[itemId] = config.SHOP_GUEST_INVENTORY_COUNT;
      }
      return inventory;
    }

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

  public async purchaseItem(
    itemId: ShopItemId,
    currency = ShopCurrency.Token,
  ): Promise<ShopPurchaseResult> {
    if (this.isVirtualEconomyAccount()) {
      return this.purchaseVirtualItem(itemId, currency);
    }

    const provider = getPhantomProvider();
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
      this.storage.set(config.STORAGE_KEY_SHOP_ACCOUNT_PROVIDER, 'wallet');
      this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, walletAddress);
      this.storage.save();

      const quoteResponse = await apiFetch('/api/economy/purchase/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, currency, walletAddress }),
      });
      const quote = await quoteResponse.json();
      if (!quoteResponse.ok || quote?.ok !== true) {
        return { ok: false, statusText: quote?.statusText || 'QUOTE FAILED' };
      }

      const transaction = Transaction.from(this.fromBase64(quote.transaction));
      const signed = await provider.signTransaction(transaction);
      const connection = new Connection(
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

      const verifyResponse = await apiFetch('/api/economy/purchase/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quoteToken: quote.quoteToken,
          signature: txHash,
        }),
      });
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
      await this.refreshWalletBalances(walletAddress);
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

  public async getPresaleState(): Promise<PresaleState> {
    const response = await apiFetch('/api/presale/state', {
      cache: 'no-store',
    });
    const state = await response.json();
    if (!response.ok || typeof state !== 'object' || state === null) {
      throw new Error('LIVE PRESALE DATA IS UNAVAILABLE');
    }
    return state as PresaleState;
  }

  public async getPresaleWalletBalance(): Promise<number> {
    const walletAddress = this.getWalletAddress();
    if (!this.isWalletConnected()) {
      throw new Error('CONNECT WALLET FIRST');
    }
    const response = await apiFetch(
      `/api/presale/balance?wallet=${encodeURIComponent(walletAddress)}`,
      { cache: 'no-store' },
    );
    const balance = await response.json();
    if (!response.ok || !/^\d+$/.test(String(balance?.lamports || ''))) {
      throw new Error(balance?.error || 'WALLET BALANCE IS UNAVAILABLE');
    }
    return Number(balance.lamports) / 1_000_000_000;
  }

  public async createPresaleQuote(
    payAmount: string,
    replaceQuoteToken?: string,
  ): Promise<PresaleQuote> {
    if (this.isVirtualEconomyAccount()) {
      throw new Error('CONNECT A SOLANA WALLET TO SWAP');
    }
    const provider = getPhantomProvider();
    if (provider === null) {
      throw new Error('CONNECT A SOLANA WALLET TO SWAP');
    }

    const connection = await provider.connect();
    const walletAddress = connection.publicKey.toString();
    this.storage.setBoolean(config.STORAGE_KEY_SHOP_WALLET_CONNECTED, true);
    this.storage.set(config.STORAGE_KEY_SHOP_ACCOUNT_PROVIDER, 'wallet');
    this.storage.set(config.STORAGE_KEY_SHOP_WALLET_ADDRESS, walletAddress);
    this.storage.save();

    const response = await apiFetch('/api/presale/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wallet: walletAddress,
        method: 'SOL',
        payAmount,
        replaceQuoteToken,
      }),
    });
    const quote = await response.json();
    if (!response.ok || typeof quote?.quoteToken !== 'string') {
      throw new Error(quote?.error || 'QUOTE FAILED');
    }
    return quote as PresaleQuote;
  }

  public async submitPresaleQuote(
    quote: PresaleQuote,
  ): Promise<ShopPurchaseResult> {
    const provider = getPhantomProvider();
    if (provider === null) {
      return { ok: false, statusText: 'CONNECT WALLET' };
    }
    try {
      const transaction = Transaction.from(this.fromBase64(quote.transaction));
      const signed = await provider.signTransaction(transaction);
      const rpcUrl =
        quote.network === 'devnet'
          ? 'https://api.devnet.solana.com'
          : SHOP_RPC_URL;
      const connection = new Connection(rpcUrl, 'confirmed');
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
        return { ok: false, statusText: 'PAYMENT FAILED', txHash };
      }

      let verified = false;
      let lastError = 'PAYMENT VERIFICATION FAILED';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await apiFetch('/api/presale/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ quoteToken: quote.quoteToken, signature: txHash }),
        });
        const result = await response.json();
        if (response.ok) {
          verified = true;
          break;
        }
        lastError = result?.error || lastError;
        if (!/not confirmed/i.test(lastError) || attempt === 4) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
      if (!verified) {
        return { ok: false, statusText: lastError.toUpperCase(), txHash };
      }
      await this.refreshWalletBalances();
      return { ok: true, statusText: 'SWAP CONFIRMED - BATC DELIVERED', txHash };
    } catch (error) {
      return {
        ok: false,
        statusText:
          error instanceof Error && error.message
            ? error.message.toUpperCase()
            : 'SWAP CANCELLED',
      };
    }
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

  public canStartRun(fuelCost = config.SHOP_RUN_FUEL_COST): boolean {
    return this.getFuelBalance() >= this.normalizeFuelCost(fuelCost);
  }

  public consumeFuelForRun(fuelCost = config.SHOP_RUN_FUEL_COST): boolean {
    const normalizedFuelCost = this.normalizeFuelCost(fuelCost);
    if (!this.canStartRun(normalizedFuelCost)) {
      return false;
    }

    if (!this.isShopAccountConnected()) {
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

  private normalizeFuelCost(fuelCost: number): number {
    const parsed = Number(fuelCost);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
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

    ACTIVE_LOADOUT_SLOTS.forEach((slot) => {
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

  public async syncAccount(): Promise<void> {
    await this.syncAccountSnapshot();
  }

  public async consumeInventoryItem(
    itemId: ShopInventoryItemId,
  ): Promise<boolean> {
    // Guest items never deplete (see getInventory) — report success without
    // persisting a decrement, like consumeFuelForRun does for guest fuel.
    if (!this.isShopAccountConnected()) {
      return true;
    }

    if (this.getInventoryCount(itemId) <= 0) {
      return false;
    }

    const powerupType = getPowerupTypeForInventoryItem(itemId);
    if (powerupType === null || itemId === ShopInventoryItemId.ExtraLife) {
      return false;
    }

    try {
      const response = await apiFetch('/api/economy/powerups/consume', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          powerupType,
          requestId: createPowerupConsumptionRequestId(),
        }),
      });
      const body = await response.json();
      if (body?.account !== undefined) {
        this.applyAccountSnapshot(body.account);
      }

      return (
        response.ok && body?.ok === true && body?.powerupType === powerupType
      );
    } catch {
      // Fail closed: a live consumable is never activated without API approval.
      return false;
    }
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

    // Guest items never deplete: hand out the equipped consumables but leave
    // both the inventory and the loadout untouched, so the guest's slots stay
    // equipped run after run.
    const isGuest = !this.isShopAccountConnected();

    Object.keys(loadout).forEach((slotKey) => {
      const slot = slotKey as ShopLoadoutSlot;
      const itemId = loadout[slot];
      if (itemId === undefined || (inventory[itemId] || 0) <= 0) {
        delete loadout[slot];
        return;
      }

      if (!isGuest) {
        inventory[itemId] -= 1;
        delete loadout[slot];
      }

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

    if (!isGuest) {
      this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
      this.setJson(config.STORAGE_KEY_SHOP_LOADOUT, loadout);
      this.storage.save();
      void this.syncAccountSnapshot();
    }

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

  private addInventory(
    reward: Partial<Record<ShopInventoryItemId, number>>,
  ): void {
    const inventory = this.getInventory();

    Object.keys(reward).forEach((key) => {
      const itemId = key as ShopInventoryItemId;
      inventory[itemId] = (inventory[itemId] || 0) + reward[itemId];
    });

    this.setJson(config.STORAGE_KEY_SHOP_INVENTORY, inventory);
  }

  private getAccountSnapshot(): {
    tokenBalance: number;
    solBalance: number;
    fuelBalance: number;
    inventory: ShopInventory;
    loadout: ShopLoadout;
  } {
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

  private applyAccountSnapshot(account: {
    tokenBalance?: number;
    solBalance?: number;
    fuelBalance?: number;
    inventory?: ShopInventory;
    loadout?: ShopLoadout;
  }): void {
    if (typeof account !== 'object' || account === null) {
      return;
    }

    if (!this.isWalletConnected() && typeof account.tokenBalance === 'number') {
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
        account.tokenBalance,
      );
    }
    if (!this.isWalletConnected() && typeof account.solBalance === 'number') {
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

  private async syncAccountSnapshot(): Promise<void> {
    try {
      const response = await apiFetch('/api/economy/account', {
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

  public async refreshWalletBalances(
    walletAddress = this.getWalletAddress(),
  ): Promise<void> {
    if (!this.isWalletConnected()) return;
    try {
      const connection = new Connection(SHOP_RPC_URL, 'confirmed');
      const owner = new PublicKey(walletAddress);
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
        }, 0) / 1_000_000;
      this.storage.setNumber(
        config.STORAGE_KEY_SHOP_SOL_BALANCE,
        lamports / 1_000_000_000,
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

  private async purchaseVirtualItem(
    itemId: ShopItemId,
    currency: ShopCurrency,
  ): Promise<ShopPurchaseResult> {
    try {
      const response = await apiFetch('/api/economy/purchase', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, currency }),
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) {
        return { ok: false, statusText: result?.statusText || 'PURCHASE FAILED' };
      }
      if (result.account !== undefined) this.applyAccountSnapshot(result.account);
      return { ok: true, statusText: result.statusText || `BOUGHT ${itemId.toUpperCase()}` };
    } catch {
      return { ok: false, statusText: 'PURCHASE FAILED' };
    }
  }

  private getLoadout(): ShopLoadout {
    return this.getJson<ShopLoadout>(config.STORAGE_KEY_SHOP_LOADOUT, {});
  }

  private normalizeLoadout(loadout: ShopLoadout): ShopLoadout {
    const equippedItems = new Set<ShopInventoryItemId>();

    if (
      loadout[ShopLoadoutSlot.Passive] !== undefined &&
      loadout[ShopLoadoutSlot.ActiveFour] === undefined
    ) {
      loadout[ShopLoadoutSlot.ActiveFour] = loadout[ShopLoadoutSlot.Passive];
    }
    delete loadout[ShopLoadoutSlot.Passive];

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

  private fromBase64(value: string): Uint8Array {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
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
