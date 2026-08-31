import { SceneNavigator } from '../core';
import { GameStorage } from '../game';
import {
  ShopCatalogItem,
  ShopCurrency,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopManager,
} from '../shop';

interface ShopWebUiOptions {
  gameStorage: GameStorage;
  navigator: SceneNavigator;
}

type ShopTab = 'bact' | 'sol' | 'loadout';
type ShopFilter = 'all' | 'fuel' | 'powerups' | 'packs';

const inventoryIcons: Partial<Record<ShopInventoryItemId, string>> = {
  [ShopInventoryItemId.Shield]: '/data/graphics/powerup-helmet.png',
  [ShopInventoryItemId.BaseDefence]: '/data/graphics/powerup-shovel.png',
  [ShopInventoryItemId.Freeze]: '/data/graphics/powerup-clock.png',
  [ShopInventoryItemId.Speed]: '/data/graphics/powerup-speed.png',
  [ShopInventoryItemId.Upgrade]: '/data/graphics/powerup-star.png',
  [ShopInventoryItemId.ZoomOut]: '/data/graphics/powerup-zoomout.png',
  [ShopInventoryItemId.Wipeout]: '/data/graphics/powerup-grenade.png',
  [ShopInventoryItemId.ExtraLife]: '/data/graphics/TANKS/powerup-life.png',
};

const loadoutSlots = [
  ShopLoadoutSlot.ActiveOne,
  ShopLoadoutSlot.ActiveTwo,
  ShopLoadoutSlot.ActiveThree,
  ShopLoadoutSlot.ActiveFour,
];

export class ShopWebUi {
  private readonly options: ShopWebUiOptions;
  private readonly shopManager: ShopManager;
  private abortController: AbortController = null;
  private active = false;
  private filter: ShopFilter = 'all';
  private host: HTMLElement = null;
  private tab: ShopTab = 'bact';

  public constructor(options: ShopWebUiOptions) {
    this.options = options;
    this.shopManager = new ShopManager(options.gameStorage);
  }

  public isActive(): boolean {
    return this.active;
  }

  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement)) {
      throw new Error('Shop web UI host is missing.');
    }

    this.active = true;
    this.abortController = new AbortController();
    this.host = host;
    document.body.classList.add('web-ui-active', 'shop-web-active');
    host.hidden = false;
    this.preloadIcons();
    this.refresh();
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.abortController = null;
    this.host?.replaceChildren();
    if (this.host !== null) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'shop-web-active');
  }

  public update(): void {
    // The HTML controls handle pointer, touch, keyboard, and assistive input.
  }

  private refresh(status = ''): void {
    if (!this.active || this.host === null) return;
    this.host.innerHTML = this.render(status);
    this.bindActions();
  }

  private render(status: string): string {
    const connected = this.shopManager.isWalletConnected();
    const content =
      this.tab === 'loadout' ? this.renderLoadout() : this.renderCatalog();
    return `
      <main class="shop-web" aria-labelledby="shop-web-title">
        <header class="shop-web__header">
          <button class="shop-web__back" data-shop-back type="button">‹ <span>Back</span></button>
          <div><p class="shop-web__eyebrow">Battle Cities supply depot</p><h1 id="shop-web-title">Shop</h1></div>
          <button class="shop-web__wallet" data-shop-wallet type="button">${
            connected ? this.shortWallet() : 'Connect wallet'
          }</button>
        </header>
        <section class="shop-web__balances" aria-label="Wallet balances">
          <div><span>BACT</span><strong>${this.shopManager
            .getTokenBalance()
            .toLocaleString()}</strong></div>
          <div><span>SOL</span><strong>${this.shopManager
            .getSolBalance()
            .toFixed(3)}</strong></div>
          <div><span>FUEL</span><strong>${this.shopManager.getFuelBalance()}</strong></div>
        </section>
        <div class="shop-web__layout">
          <aside class="shop-web__inventory" aria-label="Inventory">
            <h2>Inventory</h2>
            ${this.renderInventory()}
          </aside>
          <section class="shop-web__panel" aria-live="polite">
            <nav class="shop-web__tabs" aria-label="Shop sections">
              ${this.renderTab('bact', 'Token shop')}
              ${this.renderTab('sol', 'SOL shop')}
              ${this.renderTab('loadout', 'Loadout')}
            </nav>
            ${this.tab !== 'loadout' ? this.renderFilters() : ''}
            <div class="shop-web__content">${content}</div>
            <p class="shop-web__status" data-shop-status>${status ||
              'Select an item to stock your loadout.'}</p>
          </section>
        </div>
      </main>`;
  }

  private renderTab(tab: ShopTab, label: string): string {
    return `<button class="shop-web__tab${
      this.tab === tab ? ' is-active' : ''
    }" data-shop-tab="${tab}" type="button">${label}</button>`;
  }

  private renderFilters(): string {
    return `<div class="shop-web__filters" aria-label="Catalog filters">${([
      'all',
      'fuel',
      'powerups',
      'packs',
    ] as ShopFilter[])
      .map(
        (filter) =>
          `<button class="shop-web__filter${
            this.filter === filter ? ' is-active' : ''
          }" data-shop-filter="${filter}" type="button">${filter}</button>`,
      )
      .join('')}</div>`;
  }

  private renderCatalog(): string {
    const currency = this.tab === 'sol' ? ShopCurrency.Sol : ShopCurrency.Token;
    const items = this.shopManager
      .getCatalog()
      .filter((item) => this.matchesFilter(item));
    return `<div class="shop-web__catalog">${items
      .map((item) => this.renderCard(item, currency))
      .join('')}</div>`;
  }

  private renderCard(item: ShopCatalogItem, currency: ShopCurrency): string {
    const icon = this.getCatalogIcon(item);
    const price =
      currency === ShopCurrency.Sol
        ? `${item.solPrice} SOL`
        : `${item.price} BACT`;
    return `<article class="shop-web__card"><div class="shop-web__card-icon">${
      icon ? `<img src="${icon}" alt="" draggable="false">` : '<span>+</span>'
    }</div><div class="shop-web__card-copy"><h2>${
      item.name
    }</h2><p>${this.rewardText(
      item,
    )}</p></div><button class="shop-web__buy" data-shop-buy="${
      item.id
    }" type="button">${price}</button></article>`;
  }

  private renderInventory(): string {
    const inventory = this.shopManager.getInventory();
    const items = Object.values(ShopInventoryItemId);
    return `<div class="shop-web__inventory-list">${items
      .map(
        (itemId) =>
          `<div class="shop-web__inventory-item"><img src="${
            inventoryIcons[itemId]
          }" alt=""><span>${this.inventoryLabel(
            itemId,
          )}</span><strong>×${inventory[itemId] || 0}</strong></div>`,
      )
      .join('')}</div>`;
  }

  private renderLoadout(): string {
    return `<div class="shop-web__loadout"><p>Choose a slot to cycle through the power-ups you own.</p>${loadoutSlots
      .map((slot, index) => {
        const itemId = this.shopManager.getEquipped(slot);
        const label =
          itemId === null ? 'Empty slot' : this.inventoryLabel(itemId);
        const icon =
          itemId === null ? '' : `<img src="${inventoryIcons[itemId]}" alt="">`;
        return `<button class="shop-web__loadout-slot" data-shop-slot="${slot}" type="button"><span>Slot ${index +
          1}</span><strong>${icon}${label}</strong><em>Change ›</em></button>`;
      })
      .join('')}</div>`;
  }

  private bindActions(): void {
    const signal = this.abortController.signal;
    this.host
      .querySelector('[data-shop-back]')
      ?.addEventListener('click', () => this.options.navigator.back(), {
        signal,
      });
    this.host.querySelector('[data-shop-wallet]')?.addEventListener(
      'click',
      () => {
        if (!this.shopManager.isWalletConnected())
          this.shopManager.connectWallet();
        this.refresh(
          this.shopManager.isWalletConnected()
            ? 'Wallet connected.'
            : 'Wallet unavailable.',
        );
      },
      { signal },
    );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-tab]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            this.tab = button.dataset.shopTab as ShopTab;
            this.refresh();
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-filter]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            this.filter = button.dataset.shopFilter as ShopFilter;
            this.refresh();
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-buy]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            const currency =
              this.tab === 'sol' ? ShopCurrency.Sol : ShopCurrency.Token;
            const result = this.shopManager.purchaseItem(
              button.dataset.shopBuy as ShopItemId,
              currency,
            );
            this.refresh(result.statusText);
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-slot]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            const itemId = this.shopManager.equipNext(
              button.dataset.shopSlot as ShopLoadoutSlot,
            );
            this.refresh(
              itemId === null
                ? 'Slot cleared.'
                : `${this.inventoryLabel(itemId)} equipped.`,
            );
          },
          { signal },
        ),
      );
  }

  private matchesFilter(item: ShopCatalogItem): boolean {
    if (this.filter === 'all') return true;
    if (this.filter === 'fuel')
      return (
        item.reward.fuel !== undefined && item.id !== ShopItemId.StarterPack
      );
    if (this.filter === 'packs') return item.id === ShopItemId.StarterPack;
    return (
      item.reward.inventory !== undefined && item.id !== ShopItemId.StarterPack
    );
  }

  private getCatalogIcon(item: ShopCatalogItem): string {
    const inventoryId = Object.keys(
      item.reward.inventory || {},
    )[0] as ShopInventoryItemId;
    return inventoryIcons[inventoryId] || '';
  }

  private rewardText(item: ShopCatalogItem): string {
    if (item.id === ShopItemId.StarterPack)
      return '5 fuel + base defence + shield';
    if (item.reward.fuel !== undefined)
      return `Add ${item.reward.fuel} fuel to your depot`;
    return 'Single-use battle power-up';
  }

  private inventoryLabel(itemId: ShopInventoryItemId): string {
    return itemId.replace(/-/g, ' ').toUpperCase();
  }

  private shortWallet(): string {
    const wallet = this.shopManager.getWalletAddress();
    return wallet.length > 12
      ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
      : wallet;
  }

  private preloadIcons(): void {
    Object.values(inventoryIcons).forEach((src) => {
      if (src === undefined) return;
      const image = new Image();
      image.src = src;
    });
  }
}
