import { SceneNavigator } from '../core';
import { GameStorage } from '../game';
import { InputManager, MenuInputContext } from '../input';
import {
  ShopCatalogItem,
  ShopCurrency,
  ShopInventoryItemId,
  ShopItemId,
  ShopLoadoutSlot,
  ShopManager,
  PresaleQuote,
  PresaleState,
} from '../shop';
import { GameSceneType } from '../scenes';
import { animateBackNavigation } from './navigationAnimation';
import { isPsg1Ui } from './deviceUi';

interface ShopWebUiOptions {
  getBattleFuelCost: () => number;
  isBattleSetup: () => boolean;
  gameStorage: GameStorage;
  inputManager: InputManager;
  navigator: SceneNavigator;
  startBattle: () => Promise<void>;
}
type ShopTab = 'bact' | 'sol' | 'swap' | 'loadout';
type ShopFilter = 'all' | 'fuel' | 'powerups' | 'packs';
const icons: Partial<Record<ShopInventoryItemId, string>> = {
  [ShopInventoryItemId.Shield]: '/data/graphics/shop/owned/helmet.png',
  [ShopInventoryItemId.BaseDefence]: '/data/graphics/shop/owned/shovel.png',
  [ShopInventoryItemId.Freeze]: '/data/graphics/shop/owned/clock.png',
  [ShopInventoryItemId.Speed]: '/data/graphics/shop/owned/speed.png',
  [ShopInventoryItemId.Upgrade]: '/data/graphics/shop/owned/star.png',
  [ShopInventoryItemId.ZoomOut]: '/data/graphics/shop/owned/zoomout.png',
  [ShopInventoryItemId.Wipeout]: '/data/graphics/shop/owned/grenade.png',
  [ShopInventoryItemId.ExtraLife]: '/data/graphics/shop/owned/life.png',
};
const slots = [
  ShopLoadoutSlot.ActiveOne,
  ShopLoadoutSlot.ActiveTwo,
  ShopLoadoutSlot.ActiveThree,
  ShopLoadoutSlot.ActiveFour,
];

export class ShopWebUi {
  private readonly shop: ShopManager;
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private filter: ShopFilter = 'all';
  private host: HTMLElement = null;
  private battleStartPending = false;
  private tab: ShopTab = 'bact';
  private presaleState: PresaleState = null;
  private presaleQuote: PresaleQuote = null;
  private swapAmount = '';

  public constructor(private readonly options: ShopWebUiOptions) {
    this.shop = new ShopManager(options.gameStorage);
  }
  public isActive(): boolean {
    return this.active;
  }
  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement))
      throw new Error('Shop web UI host is missing.');
    this.active = true;
    if (this.options.isBattleSetup()) this.tab = 'loadout';
    this.abortController = new AbortController();
    this.host = host;
    document.body.classList.add('web-ui-active', 'shop-web-active');
    host.hidden = false;
    window.addEventListener('battlecities:ui-device', () => this.refresh(), {
      signal: this.abortController.signal,
    });
    window
      .matchMedia('(min-width: 900px)')
      .addEventListener('change', () => this.refresh(), {
        signal: this.abortController.signal,
      });
    Object.values(icons).forEach((src) => {
      const image = new Image();
      image.src = src;
    });
    this.refresh();
    if (this.tab === 'swap') void this.loadPresaleState();
    this.buttons[0]?.focus({ preventScroll: true });
  }
  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abortController?.abort();
    this.abortController = null;
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'shop-web-active');
  }
  public update(): void {
    if (!this.active) return;
    const input = this.options.inputManager.getActiveMethod();
    const openDialog = this.host.querySelector<HTMLDialogElement>(
      '[data-shop-controls-dialog][open], [data-shop-swap-dialog][open]',
    );
    if (openDialog instanceof HTMLDialogElement) {
      if (input.isDownAny(MenuInputContext.Select)) {
        openDialog
          .querySelector<HTMLButtonElement>(
            '[data-shop-controls-confirm], [data-shop-swap-confirm]',
          )
          ?.click();
      } else if (input.isDownAny(MenuInputContext.Back)) {
        openDialog.close();
        const focusTarget = openDialog.hasAttribute('data-shop-swap-dialog')
          ? '[data-shop-swap-review]'
          : '[data-shop-start]';
        this.host
          .querySelector<HTMLButtonElement>(focusTarget)
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext))
      this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev))
      this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext))
      this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
    else if (input.isDownAny(MenuInputContext.Back))
      this.host.querySelector<HTMLButtonElement>('[data-ui-back]')?.click();
  }
  private refresh(status = '', restoreSelector = this.focusSelector()): void {
    if (!this.active || !this.host) return;
    this.host.innerHTML = this.render(status);
    this.bind();
    if (!restoreSelector) return;
    const selected = this.host.querySelector(restoreSelector);
    if (selected instanceof HTMLButtonElement) {
      selected.focus({ preventScroll: true });
      selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  private render(status: string): string {
    if (isPsg1Ui() || window.matchMedia('(min-width: 900px)').matches) {
      return this.renderDesktop(status);
    }
    const currency = this.tab === 'sol' ? ShopCurrency.Sol : ShopCurrency.Token;
    const content = this.shopContent(currency);
    return `<main class="shop-container shop-web" data-ui-page aria-labelledby="shop-title"><h1 id="shop-title" hidden>Battle Cities shop</h1>
      <nav class="shop-web__tabs" data-ui-nav aria-label="Shop views">${this.tabButton(
        'bact',
        'TOKEN SHOP',
      )}${this.tabButton('sol', 'SOL SHOP')}${this.tabButton(
      'swap',
      'SWAP',
    )}${this.tabButton('loadout', 'LOADOUT')}<button class="shop-web__back" data-ui-back data-shop-back type="button">◀ BACK</button></nav>
      <section class="shop-web__shell"><section class="shop-web__summary"><button class="shop-web__connect${
        this.shop.isWalletConnected() ? ' is-connected' : ''
      }" data-shop-wallet type="button"${
        this.shop.isVirtualEconomyAccount() ? ' disabled' : ''
      }>${
      this.shop.isWalletConnected()
        ? '<i aria-hidden="true"></i>CONNECTED'
        : this.shop.isVirtualEconomyAccount() ? 'GOOGLE ACCOUNT' : 'CONNECT'
    }</button>${this.resource(
      'BATC',
      this.shop.getTokenBalance().toString(),
    )}${this.resource(
      'SOL',
      this.shop.getSolBalance().toFixed(3),
    )}${this.resource('FUEL', this.shop.getFuelBalance().toString())}</section>
      ${
        this.tab === 'swap'
          ? this.presaleLegend()
          : `<section class="shop-web__owned"><h2>OWNED ITEMS</h2><div>${this.inventoryTiles()}</div></section>`
      }
      <section class="shop-web__content">${content}</section><p class="shop-web__status" aria-live="polite">${status ||
      (this.tab === 'loadout'
        ? 'USE 1-4 IN GAME TO CONSUME EQUIPPED POWERS'
        : this.tab === 'swap'
        ? 'LIVE BATC PRESALE'
        : 'ALL ITEMS LOADED')}</p></section>${this.swapDialog()}</main>`;
  }
  private renderDesktop(status: string): string {
    const loadoutHint = isPsg1Ui()
      ? 'CHOOSE UP TO FOUR POWERS FOR YOUR LOADOUT'
      : 'USE 1-4 IN GAME TO CONSUME EQUIPPED POWERS';
    const currency = this.tab === 'sol' ? ShopCurrency.Sol : ShopCurrency.Token;
    const controlsDialog = `<dialog class="shop-web__controls-dialog" data-shop-controls-dialog aria-labelledby="shop-controls-title"><h2 id="shop-controls-title">BATTLE CONTROLS</h2>${
      isPsg1Ui()
        ? '<dl><div><dt>MOVE</dt><dd>LEFT D-PAD / STICK</dd></div><div><dt>FIRE</dt><dd>A</dd></div><div><dt>RAPID FIRE / BACK</dt><dd>B</dd></div><div><dt>POWER 1</dt><dd>RIGHT STICK &rarr;</dd></div><div><dt>POWER 2</dt><dd>RIGHT STICK &uarr;</dd></div><div><dt>POWER 3</dt><dd>RIGHT STICK &darr;</dd></div><div><dt>POWER 4</dt><dd>RIGHT STICK &larr;</dd></div><div><dt>PAUSE</dt><dd>START</dd></div></dl><button class="shop-web__controls-confirm" data-shop-controls-confirm type="button">A: START BATTLE</button>'
        : '<dl><div><dt>MOVE</dt><dd><kbd>ARROW KEYS</kbd></dd></div><div><dt>FIRE</dt><dd><kbd>Z</kbd></dd></div><div><dt>RAPID FIRE</dt><dd><kbd>X</kbd></dd></div></dl><button class="shop-web__controls-confirm" data-shop-controls-confirm type="button">CONFIRM / START BATTLE</button>'
    }</dialog>`;
    return `<main class="shop-container shop-web shop-web--desktop" data-ui-page aria-labelledby="shop-title"><h1 id="shop-title" hidden>Battle Cities shop</h1>
      <nav class="shop-web__tabs" data-ui-nav aria-label="Shop views">${this.tabButton(
        'bact',
        'TOKEN SHOP',
      )}${this.tabButton('sol', 'SOL SHOP')}${this.tabButton(
      'swap',
      'SWAP',
    )}${this.tabButton('loadout', 'LOADOUT')}<span class="shop-web__tab-spacer" data-ui-spacer aria-hidden="true"></span><button class="shop-web__back" data-ui-back data-shop-back type="button">◀ BACK</button></nav>
      <section class="shop-web__desktop-shell${
        this.tab === 'swap' ? ' shop-web__desktop-shell--swap' : ''
      }"><aside class="shop-web__desktop-side">${this.desktopSidebar()}</aside>
      <section class="shop-web__desktop-content"><div class="shop-web__content">${this.shopContent(
        currency,
      )}</div><p class="shop-web__status" aria-live="polite">${status ||
      (this.tab === 'loadout'
        ? loadoutHint
        : this.tab === 'swap'
        ? 'LIVE BATC PRESALE'
        : 'ALL ITEMS LOADED')}</p></section></section>${controlsDialog}${this.swapDialog()}</main>`;
  }
  private shopContent(currency: ShopCurrency): string {
    return this.tab === 'loadout'
      ? this.loadout()
      : this.tab === 'swap'
      ? this.swap()
      : `${this.filters()}<h2 class="shop-web__label">${this.categoryTitle()}</h2><div class="shop-web__cards">${this.cards(
          currency,
        )}</div>`;
  }
  private filters(): string {
    return `<nav class="shop-web__filters" aria-label="Item categories">${([
      ['all', 'ALL'],
      ['fuel', 'FUEL'],
      ['powerups', 'POWER'],
      ['packs', 'PACKS'],
    ] as Array<[ShopFilter, string]>)
      .map(
        ([key, label]) =>
          `<button class="${
            this.filter === key ? 'is-active' : ''
          }" data-shop-filter="${key}" type="button">${label}</button>`,
      )
      .join('')}</nav>`;
  }
  private inventoryTiles(): string {
    return Object.values(ShopInventoryItemId)
      .map(
        (id) =>
          `<div class="shop-web__owned-tile" title="${this.name(
            id,
          )}"><img src="${icons[id]}" alt=""><strong aria-label="${this.name(
            id,
          )} quantity">${this.count(id)}</strong></div>`,
      )
      .join('');
  }
  private desktopSidebar(): string {
    const wallet = `<h2>${this.tab === 'swap' ? 'WALLET' : 'INVENTORY'}</h2><button class="shop-web__connect${
      this.shop.isWalletConnected() ? ' is-connected' : ''
    }" data-shop-wallet type="button"${
      this.shop.isVirtualEconomyAccount() ? ' disabled' : ''
    }>${
      this.shop.isWalletConnected()
        ? '<i aria-hidden="true"></i>CONNECTED'
        : this.shop.isVirtualEconomyAccount()
        ? 'GOOGLE ACCOUNT'
        : 'CONNECT'
    }</button>${this.resource(
      'BATC',
      this.shop.getTokenBalance().toString(),
    )}${this.resource('SOL', this.shop.getSolBalance().toFixed(3))}`;
    return this.tab === 'swap'
      ? `${wallet}${this.presaleLegend(true)}`
      : `${wallet}${this.resource(
          'FUEL',
          this.shop.getFuelBalance().toString(),
        )}<h3>OWNED ITEMS</h3><div class="shop-web__desktop-owned">${this.inventoryTiles()}</div>`;
  }
  private presaleLegend(desktop = false): string {
    const state = this.presaleState;
    const stages = state?.stages || [];
    const activeStage = stages.find(
      (stage) => stage.id === state?.currentStageId,
    );
    const allocation = Number(activeStage?.allocationBatc || 0);
    const sold = Number(activeStage?.soldBatc || 0);
    const available = Math.max(0, allocation - sold);
    const soldPercent = allocation > 0 ? Math.min(100, (sold / allocation) * 100) : 0;
    const totalSold = stages.reduce(
      (total, stage) => total + Number(stage.soldBatc || 0),
      0,
    );
    const totalAllocation = stages.reduce(
      (total, stage) => total + Number(stage.allocationBatc || 0),
      0,
    );
    const rows = stages
      .map((stage) => {
        const stageSold = Number(stage.soldBatc || 0);
        const remaining = Math.max(
          0,
          Number(stage.allocationBatc || 0) - stageSold,
        );
        return `<div class="shop-web__presale-row${
          stage.status === 'active' ? ' is-active' : ''
        }"><span>${stage.label}</span><span>${this.formatSwapNumber(
          Number(stage.priceSol || 0),
          9,
        )} SOL</span><span>${this.formatSwapNumber(stageSold)}</span><span>${this.formatSwapNumber(
          remaining,
        )}</span></div>`;
      })
      .join('');
    return `<section class="shop-web__presale-legend${
      desktop ? ' shop-web__presale-legend--desktop' : ''
    }" aria-label="Live presale status"><header><h3>PRESALE LEGEND</h3><span>LIVE</span></header><div class="shop-web__presale-available"><strong>${
      state ? this.formatSwapNumber(available) : '--'
    } BATC</strong><span>AVAILABLE IN THIS STAGE</span><small>${
      activeStage
        ? `${activeStage.label} allocation: ${this.formatSwapNumber(allocation)} BATC`
        : 'Loading stage allocation'
    }</small></div><div class="shop-web__presale-progress" style="--presale-progress:${soldPercent.toFixed(
      2,
    )}%"><i></i></div><div class="shop-web__presale-meta"><span>${this.formatSwapNumber(
      soldPercent,
    )}% SOLD</span><span>${this.formatSwapNumber(
      Number(state?.participants || 0),
      0,
    )} PARTICIPANTS</span></div><div class="shop-web__presale-table"><div class="shop-web__presale-row shop-web__presale-row--head"><span>STAGE</span><span>PRICE</span><span>SOLD</span><span>LEFT</span></div>${rows}<div class="shop-web__presale-row"><span>DEX LAUNCH</span><span>TBA</span><span>—</span><span>—</span></div><div class="shop-web__presale-row shop-web__presale-row--total"><span>TOTAL</span><span></span><span>${this.formatSwapNumber(
      totalSold,
    )}</span><span>${this.formatSwapNumber(
      Math.max(0, totalAllocation - totalSold),
    )}</span></div></div></section>`;
  }
  private tabButton(tab: ShopTab, label: string): string {
    const icon = {
      bact: '/data/graphics/shop/icons/token-bact.png',
      sol: '/data/graphics/shop/icons/solana.png',
      swap: '/assets/headquarters/trading-arrows.png',
      loadout: '/data/graphics/shop/icons/loadout.png',
    }[tab];
    return `<button class="shop-web__tab${
      this.tab === tab ? ' is-active' : ''
    }" data-ui-tab data-shop-tab="${tab}" type="button"><img src="${icon}" alt=""><span>${label}</span></button>`;
  }
  private resource(label: string, value: string): string {
    const icon = {
      BATC: '/data/graphics/shop/icons/token-bact.png',
      SOL: '/data/graphics/shop/icons/solana.png',
      FUEL: '/data/graphics/shop/icons/fuel.png',
    }[label];
    return `<div class="shop-web__resource"><img src="${icon}" alt=""><div><span>${label}</span><strong>${value}</strong></div></div>`;
  }
  private cards(currency: ShopCurrency): string {
    return this.shop
      .getCatalog()
      .filter((item) => this.matches(item))
      .map((item) => {
        const icon =
          icons[
            Object.keys(item.reward.inventory || {})[0] as ShopInventoryItemId
          ];
        const itemIcon =
          item.id === ShopItemId.StarterPack
            ? '/data/graphics/shop/icons/kit.png'
            : icon || '/data/graphics/shop/icons/fuel.png';
        const price =
          currency === ShopCurrency.Sol
            ? `${item.solPrice} SOL`
            : `${item.price} BATC`;
        const currencyIcon =
          currency === ShopCurrency.Sol
            ? '/data/graphics/shop/icons/solana.png'
            : '/data/graphics/shop/icons/token-bact.png';
        return `<article class="shop-web__card${
          item.id === ShopItemId.StarterPack
            ? ' shop-web__card--starter-pack'
            : ''
        }"><div class="shop-web__card-icon"><img src="${itemIcon}" alt=""></div><h2>${
          item.name
        }</h2><p>${
          item.id === ShopItemId.StarterPack
            ? '5 FUEL + 2<br>POWER-UPS'
            : item.reward.fuel
            ? `+${item.reward.fuel}`
            : `+${Object.values(item.reward.inventory || {})[0] || 1}`
        }</p><button data-shop-buy="${
          item.id
        }" type="button"><img src="${currencyIcon}" alt=""><span>${price}</span></button></article>`;
      })
      .join('');
  }
  private loadout(): string {
    const battleAction = this.options.isBattleSetup()
      ? '<button class="shop-web__start-battle" data-shop-start type="button"><strong>START BATTLE</strong></button>'
      : '';
    return `<section class="shop-web__loadout"><h2>EQUIPPED SLOTS</h2><p>SELECT A SLOT TO CYCLE OWNED ITEMS</p><div>${slots
      .map((slot, index) => {
        const item = this.shop.getEquipped(slot);
        return `<button class="shop-web__loadout-slot" data-shop-slot="${slot}" type="button"><span class="shop-web__slot-index">SLOT 0${index +
          1}</span><strong class="shop-web__slot-item">${
          item
            ? `<img src="${icons[item]}" alt="">${this.name(item)}`
            : '<img class="shop-web__empty-slot" src="/data/graphics/shop/icons/empty-slot.png" alt=""><b>EMPTY</b>'
        }</strong><em class="shop-web__slot-action">CHANGE</em></button>`;
      })
      .join('')}</div>${battleAction}</section>`;
  }
  private swap(): string {
    const state = this.presaleState;
    const price = Number(state?.currentPriceSol || 0);
    const payAmount = Number(this.swapAmount);
    const receiveAmount =
      price > 0 && Number.isFinite(payAmount) && payAmount > 0
        ? payAmount / price
        : 0;
    const rate = price > 0 ? 1 / price : 0;
    const canSwap = state?.configured === true && state.ended !== true;
    const sanitizedAmount = this.swapAmount.replace(/[^0-9.]/g, '');
    const network =
      state?.network?.toUpperCase() === 'MAINNET-BETA'
        ? 'MAINNET'
        : state?.network?.toUpperCase() || 'LOADING';
    return `<section class="shop-web__swap" aria-labelledby="shop-swap-title"><header class="shop-web__swap-header"><div><p class="shop-web__swap-eyebrow">BATC PRESALE · ${network}</p><h2 id="shop-swap-title">SOL <span aria-hidden="true">→</span> BATC</h2></div><p>Enter SOL, review the quote, then confirm in your wallet.</p></header><div class="shop-web__swap-body"><section class="shop-web__swap-form" aria-label="Swap amount"><label for="shop-swap-amount">YOU PAY</label><div class="shop-web__swap-input"><input id="shop-swap-amount" data-shop-swap-amount type="number" min="0" step="any" inputmode="decimal" autocomplete="off" placeholder="0.0" value="${sanitizedAmount}"><span>SOL</span></div><div class="shop-web__swap-presets"><button data-shop-swap-preset="0.5" type="button">0.5 SOL</button><button data-shop-swap-preset="1" type="button">1 SOL</button><button data-shop-swap-preset="max" type="button">MAX</button></div><span class="shop-web__swap-arrow" aria-hidden="true">↓</span><label>YOU RECEIVE</label><output class="shop-web__swap-input shop-web__swap-output" data-shop-swap-receive>${this.formatSwapNumber(receiveAmount)} <span>BATC</span></output></section><aside class="shop-web__swap-summary" aria-label="Live exchange details"><dl><div><dt>CURRENT RATE</dt><dd data-shop-swap-rate>${rate > 0 ? `1 SOL = ${this.formatSwapNumber(rate)} BATC` : 'LOADING'}</dd></div><div><dt>PRICE PER TOKEN</dt><dd>${price > 0 ? `${this.formatSwapNumber(price, 9)} SOL` : 'LOADING'}</dd></div></dl><p>${network} · The exact amount and network appear again before signing.</p><button class="shop-web__swap-review" data-shop-swap-review type="button"${canSwap ? '' : ' disabled'}>${this.shop.isWalletConnected() ? 'REVIEW SWAP' : 'CONNECT WALLET'}</button></aside></div></section>`;
  }
  private swapDialog(): string {
    const quote = this.presaleQuote;
    return `<dialog class="shop-web__swap-dialog" data-shop-swap-dialog aria-labelledby="shop-swap-dialog-title"><p class="shop-web__swap-eyebrow">VERIFY TRANSACTION</p><h2 id="shop-swap-dialog-title">REVIEW SWAP</h2><dl><div><dt>YOU PAY</dt><dd>${quote ? `${quote.payAmount} SOL` : '--'}</dd></div><div><dt>YOU RECEIVE</dt><dd>${quote ? `${this.formatSwapNumber(Number(quote.batcAmount))} BATC` : '--'}</dd></div><div><dt>PRICE</dt><dd>${quote ? `${quote.tokenPriceSol} SOL` : '--'}</dd></div><div><dt>STAGE / NETWORK</dt><dd>${quote ? `${quote.stageLabel} · ${quote.network.toUpperCase()}` : '--'}</dd></div></dl><p>Confirm only after checking the amount and network in your wallet.</p><div class="shop-web__swap-dialog-actions"><button data-shop-swap-cancel type="button">CANCEL</button><button data-shop-swap-confirm type="button">CONFIRM IN WALLET</button></div></dialog>`;
  }
  private async loadPresaleState(status = ''): Promise<void> {
    try {
      const state = await this.shop.getPresaleState();
      if (!this.active || this.tab !== 'swap') return;
      this.presaleState = state;
      this.refresh(
        status ||
          (state.configured && !state.ended
            ? `LIVE ${state.network.toUpperCase()} DATA LOADED`
            : 'PRESALE IS NOT AVAILABLE'),
        '[data-shop-tab="swap"]',
      );
    } catch (error) {
      if (!this.active || this.tab !== 'swap') return;
      this.refresh(
        error instanceof Error ? error.message : 'LIVE PRESALE DATA IS UNAVAILABLE',
        '[data-shop-tab="swap"]',
      );
    }
  }
  private updateSwapPreview(): void {
    const price = Number(this.presaleState?.currentPriceSol || 0);
    const payAmount = Number(this.swapAmount);
    const receiveAmount = price > 0 && payAmount > 0 ? payAmount / price : 0;
    const output = this.host.querySelector<HTMLOutputElement>(
      '[data-shop-swap-receive]',
    );
    if (output) {
      output.innerHTML = `${this.formatSwapNumber(receiveAmount)} <span>BATC</span>`;
    }
  }
  private async setSwapPreset(preset: string): Promise<void> {
    try {
      if (preset === 'max') {
        const balance = await this.shop.getPresaleWalletBalance();
        const reserve = 0.01;
        const stageMax = Number(this.presaleState?.maxPaySol || 0);
        const amount = Math.max(
          0,
          Math.min(balance - reserve, stageMax || Number.POSITIVE_INFINITY),
        );
        this.swapAmount = amount.toFixed(9).replace(/\.?0+$/, '');
      } else {
        this.swapAmount = preset;
      }
      const input = this.host.querySelector<HTMLInputElement>('[data-shop-swap-amount]');
      if (input) input.value = this.swapAmount;
      this.updateSwapPreview();
    } catch (error) {
      this.refresh(
        error instanceof Error ? error.message : 'WALLET BALANCE IS UNAVAILABLE',
        '[data-shop-swap-review]',
      );
    }
  }
  private async reviewSwap(): Promise<void> {
    if (this.presaleState?.configured !== true || this.presaleState.ended) {
      this.refresh('PRESALE IS NOT AVAILABLE', '[data-shop-swap-review]');
      return;
    }
    if (!(Number(this.swapAmount) > 0)) {
      this.refresh('ENTER A SOL AMOUNT', '[data-shop-swap-review]');
      this.host.querySelector<HTMLInputElement>('[data-shop-swap-amount]')?.focus();
      return;
    }
    try {
      this.presaleQuote = await this.shop.createPresaleQuote(
        this.swapAmount,
        this.presaleQuote?.quoteToken,
      );
      this.refresh('REVIEW THE EXACT WALLET TRANSACTION', '[data-shop-swap-review]');
      const dialog = this.host.querySelector<HTMLDialogElement>(
        '[data-shop-swap-dialog]',
      );
      dialog?.showModal();
      dialog
        ?.querySelector<HTMLButtonElement>('[data-shop-swap-confirm]')
        ?.focus({ preventScroll: true });
    } catch (error) {
      this.refresh(
        error instanceof Error ? error.message.toUpperCase() : 'QUOTE FAILED',
        '[data-shop-swap-review]',
      );
    }
  }
  private async submitSwap(): Promise<void> {
    if (this.presaleQuote === null) return;
    const confirm = this.host.querySelector<HTMLButtonElement>(
      '[data-shop-swap-confirm]',
    );
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = 'WAITING FOR WALLET';
    }
    const result = await this.shop.submitPresaleQuote(this.presaleQuote);
    if (result.ok) {
      this.swapAmount = '';
      this.presaleQuote = null;
      await this.loadPresaleState(result.statusText);
      return;
    }
    this.closeSwapDialog();
    this.refresh(result.statusText, '[data-shop-swap-review]');
  }
  private closeSwapDialog(): void {
    const dialog = this.host.querySelector<HTMLDialogElement>(
      '[data-shop-swap-dialog]',
    );
    if (dialog?.open) dialog.close();
    this.host
      .querySelector<HTMLButtonElement>('[data-shop-swap-review]')
      ?.focus({ preventScroll: true });
  }
  private formatSwapNumber(value: number, maximumFractionDigits = 2): string {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return value.toLocaleString('en-US', { maximumFractionDigits });
  }
  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) => {
      button.addEventListener(
        'pointerdown',
        () => button.focus({ preventScroll: true }),
        { signal },
      );
      button.addEventListener(
        'focus',
        () => {
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
        },
        { signal },
      );
    });
    this.host
      .querySelector('[data-shop-back]')
      ?.addEventListener(
        'click',
        () => animateBackNavigation(this.host, this.options.navigator),
        {
          signal,
        },
      );
    this.host.querySelector('[data-shop-wallet]')?.addEventListener(
      'click',
      async () => {
        const connected = await this.shop.connectWallet();
        this.refresh(
          connected ? 'WALLET CONNECTED' : 'WALLET CONNECTION CANCELLED',
          '[data-shop-wallet]',
        );
      },
      { signal },
    );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-tab]')
      .forEach((b) =>
        b.addEventListener(
          'click',
          () => {
            this.tab = b.dataset.shopTab as ShopTab;
            this.refresh('', `[data-shop-tab="${b.dataset.shopTab}"]`);
            if (this.tab === 'swap') void this.loadPresaleState();
          },
          { signal },
        ),
      );
    this.host
      .querySelector<HTMLInputElement>('[data-shop-swap-amount]')
      ?.addEventListener(
        'input',
        (event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement)) return;
          this.swapAmount = input.value.replace(/[^0-9.]/g, '');
          this.updateSwapPreview();
        },
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-swap-preset]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => void this.setSwapPreset(button.dataset.shopSwapPreset || ''),
          { signal },
        ),
      );
    this.host
      .querySelector<HTMLButtonElement>('[data-shop-swap-review]')
      ?.addEventListener('click', () => void this.reviewSwap(), { signal });
    this.host
      .querySelector<HTMLButtonElement>('[data-shop-swap-confirm]')
      ?.addEventListener('click', () => void this.submitSwap(), { signal });
    this.host
      .querySelector<HTMLButtonElement>('[data-shop-swap-cancel]')
      ?.addEventListener('click', () => this.closeSwapDialog(), { signal });
    this.host
      .querySelector<HTMLDialogElement>('[data-shop-swap-dialog]')
      ?.addEventListener(
        'click',
        (event) => {
          if (event.target === event.currentTarget) this.closeSwapDialog();
        },
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-filter]')
      .forEach((b) =>
        b.addEventListener(
          'click',
          () => {
            this.filter = b.dataset.shopFilter as ShopFilter;
            this.refresh('', `[data-shop-filter="${b.dataset.shopFilter}"]`);
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-buy]')
      .forEach((b) =>
        b.addEventListener(
          'click',
          async () => {
            const itemId = b.dataset.shopBuy as ShopItemId;
            b.disabled = true;
            b.setAttribute('aria-busy', 'true');
            const result = await this.shop.purchaseItem(
              itemId,
              this.tab === 'sol' ? ShopCurrency.Sol : ShopCurrency.Token,
            );
            this.refresh(result.statusText, `[data-shop-buy="${itemId}"]`);
          },
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-shop-slot]')
      .forEach((b) =>
        b.addEventListener(
          'click',
          () => {
            const item = this.shop.equipNext(
              b.dataset.shopSlot as ShopLoadoutSlot,
            );
            this.refresh(
              item ? `${this.name(item)} EQUIPPED` : 'SLOT CLEARED',
              `[data-shop-slot="${b.dataset.shopSlot}"]`,
            );
          },
          { signal },
        ),
      );
    this.host.querySelector('[data-shop-start]')?.addEventListener(
      'click',
      () => {
        if (!this.options.isBattleSetup()) {
          this.options.navigator.push(GameSceneType.MainTankSelect);
          return;
        }
        const fuelCost = this.options.getBattleFuelCost();
        if (!this.shop.canStartRun(fuelCost)) {
          this.refresh(
            `NEED ${fuelCost} FUEL - VISIT THE SHOP`,
            '[data-shop-start]',
          );
          return;
        }
        if (this.shouldShowControlsBriefing()) {
          this.openControlsDialog();
          return;
        }
        void this.startBattle();
      },
      { signal },
    );
    this.host
      .querySelector<HTMLButtonElement>('[data-shop-controls-confirm]')
      ?.addEventListener(
        'click',
        () => {
          const dialog = this.host.querySelector('[data-shop-controls-dialog]');
          if (dialog instanceof HTMLDialogElement) dialog.close();
          void this.startBattle();
        },
        { signal },
      );
    this.host
      .querySelector<HTMLDialogElement>('[data-shop-controls-dialog]')
      ?.addEventListener(
        'click',
        (event) => {
          if (event.target === event.currentTarget) {
            this.closeControlsDialog();
          }
        },
        { signal },
      );
  }
  private shouldShowControlsBriefing(): boolean {
    return isPsg1Ui() || window.matchMedia('(min-width: 900px)').matches;
  }
  private openControlsDialog(): void {
    const dialog = this.host.querySelector('[data-shop-controls-dialog]');
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
    dialog.showModal();
    dialog
      .querySelector<HTMLButtonElement>('[data-shop-controls-confirm]')
      ?.focus({ preventScroll: true });
  }
  private closeControlsDialog(): void {
    const dialog = this.host.querySelector('[data-shop-controls-dialog]');
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
    this.host.querySelector<HTMLButtonElement>('[data-shop-start]')?.focus({
      preventScroll: true,
    });
  }
  private async startBattle(): Promise<void> {
    if (this.battleStartPending) return;
    this.battleStartPending = true;
    try {
      await this.options.startBattle();
    } catch {
      if (this.active) {
        this.refresh('START FAILED - TRY AGAIN', '[data-shop-start]');
      }
    } finally {
      this.battleStartPending = false;
    }
  }
  private moveFocus(x: -1 | 0 | 1, y: -1 | 0 | 1): void {
    const current = this.focused() || this.buttons[0];
    if (!current) return;
    const a = current.getBoundingClientRect();
    const candidates = this.buttons
      .filter((b) => b !== current)
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) =>
        x < 0
          ? r.right <= a.left + 2
          : x > 0
          ? r.left >= a.right - 2
          : y < 0
          ? r.bottom <= a.top + 2
          : r.top >= a.bottom - 2,
      )
      .sort((one, two) => {
        const axis = (r: DOMRect) =>
          x ? Math.abs(r.left - a.left) : Math.abs(r.top - a.top);
        const cross = (r: DOMRect) =>
          x
            ? Math.abs(r.top + r.height / 2 - a.top - a.height / 2)
            : Math.abs(r.left + r.width / 2 - a.left - a.width / 2);
        return axis(one.r) * 2 + cross(one.r) - axis(two.r) * 2 - cross(two.r);
      });
    candidates[0]?.b.focus({ preventScroll: true });
    candidates[0]?.b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  private focused(): HTMLButtonElement | null {
    return document.activeElement instanceof HTMLButtonElement &&
      this.buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
  }
  private focusSelector(): string {
    const button = this.focused();
    if (!button) return '';
    const valuedAttributes = [
      'data-shop-tab',
      'data-shop-filter',
      'data-shop-buy',
      'data-shop-slot',
    ];
    for (const attribute of valuedAttributes) {
      const value = button.getAttribute(attribute);
      if (value !== null) return `[${attribute}="${value}"]`;
    }
    for (const attribute of [
      'data-shop-wallet',
      'data-shop-start',
      'data-shop-back',
    ]) {
      if (button.hasAttribute(attribute)) return `[${attribute}]`;
    }
    return '';
  }
  private matches(item: ShopCatalogItem): boolean {
    return (
      this.filter === 'all' ||
      (this.filter === 'fuel' &&
        item.reward.fuel !== undefined &&
        item.id !== ShopItemId.StarterPack) ||
      (this.filter === 'packs' && item.id === ShopItemId.StarterPack) ||
      (this.filter === 'powerups' &&
        item.reward.inventory !== undefined &&
        item.id !== ShopItemId.StarterPack)
    );
  }
  private categoryTitle(): string {
    const count = this.shop.getCatalog().filter((item) => this.matches(item))
      .length;
    return `${
      { all: 'ALL ITEMS', fuel: 'FUEL', powerups: 'POWERUPS', packs: 'PACKS' }[
        this.filter
      ]
    } 1-${count}/${count}`;
  }
  private count(item: ShopInventoryItemId): string {
    const count = this.shop.getInventoryCount(item);
    return count >= 999 ? '∞' : count.toString().padStart(2, '0');
  }
  private name(item: ShopInventoryItemId): string {
    return item.replace(/-/g, ' ').toUpperCase();
  }
}
