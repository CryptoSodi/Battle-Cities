import { SceneNavigator } from '../core';
import { GameStorage } from '../game';
import { InputManager, MenuInputContext } from '../input';
import { ShopManager } from '../shop';
import { GameSceneType } from '../scenes';
import { TankTier } from '../tank';
import { animateBackNavigation } from './navigationAnimation';

const tanks = [
  {
    tier: TankTier.A,
    name: 'VANGUARD',
    role: 'BALANCED CHASSIS',
    fuel: 1,
    image: '/data/graphics/TANKS/player-tank-primary-star1.png',
    stats: ['SINGLE', 'STANDARD', 'STANDARD'],
  },
  {
    tier: TankTier.B,
    name: 'STRIKER',
    role: 'HIGH VELOCITY',
    fuel: 2,
    image: '/data/graphics/TANKS/player-tank-primary-star2.png',
    stats: ['SINGLE', 'HIGH', 'STANDARD'],
  },
  {
    tier: TankTier.C,
    name: 'TWIN FANG',
    role: 'RAPID FIRE',
    fuel: 3,
    image: '/data/graphics/TANKS/player-tank-primary-star3.png',
    stats: ['TWIN', 'HIGH', 'STANDARD'],
  },
  {
    tier: TankTier.D,
    name: 'SIEGEBREAKER',
    role: 'HEAVY SHELLS',
    fuel: 4,
    image: '/data/graphics/TANKS/player-tank-primary-star4.png',
    stats: ['TWIN', 'HIGH', 'HEAVY'],
  },
  {
    tier: null,
    name: 'CLASSIFIED I',
    role: 'FUTURE CHASSIS',
    fuel: 0,
    image: null,
    stats: ['LOCKED', 'REDACTED', 'SOON'],
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED II',
    role: 'FUTURE CHASSIS',
    fuel: 0,
    image: null,
    stats: ['LOCKED', 'REDACTED', 'SOON'],
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED III',
    role: 'FUTURE CHASSIS',
    fuel: 0,
    image: null,
    stats: ['LOCKED', 'REDACTED', 'SOON'],
    locked: true,
  },
  {
    tier: null,
    name: 'CLASSIFIED IV',
    role: 'FUTURE CHASSIS',
    fuel: 0,
    image: null,
    stats: ['LOCKED', 'REDACTED', 'SOON'],
    locked: true,
  },
];
export class TankSelectWebUi {
  private readonly shop: ShopManager;
  private active = false;
  private host: HTMLElement = null;
  private abort: AbortController = null;
  private buttons: HTMLButtonElement[] = [];
  private selected = 0;
  private lastTankFocus = 0;

  public constructor(
    private readonly storage: GameStorage,
    private readonly navigator: SceneNavigator,
    private readonly input: InputManager,
    private readonly getParams: () => Record<string, unknown>,
  ) {
    this.shop = new ShopManager(storage);
  }

  public isActive(): boolean {
    return this.active;
  }

  public mount(): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement))
      throw new Error('Tank select web UI host is missing.');
    this.active = true;
    this.host = host;
    this.abort = new AbortController();
    document.body.classList.add('web-ui-active', 'tank-select-web-active');
    host.hidden = false;
    [
      ...tanks.map((tank) => tank.image).filter(Boolean),
      '/data/graphics/shop/icons/fuel.png',
    ].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
    this.render();
    this.buttons
      .find((button) => button.dataset.tank === String(this.selected))
      ?.focus({ preventScroll: true });
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.abort?.abort();
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    document.body.classList.remove('web-ui-active', 'tank-select-web-active');
  }

  public update(): void {
    if (!this.active) return;
    const input = this.input.getActiveMethod();
    if (input.isDownAny(MenuInputContext.HorizontalPrev)) this.moveFocus(-1, 0);
    else if (input.isDownAny(MenuInputContext.HorizontalNext))
      this.moveFocus(1, 0);
    else if (input.isDownAny(MenuInputContext.VerticalPrev))
      this.moveFocus(0, -1);
    else if (input.isDownAny(MenuInputContext.VerticalNext))
      this.moveFocus(0, 1);
    else if (input.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }

  private render(status = ''): void {
    const tank = tanks[this.selected];
    this.host.innerHTML = `<main class="tank-select-web"><header class="tank-select-web__header"><div><h1>SELECT TANK</h1></div><button class="tank-select-web__back" data-tank-back><i aria-hidden="true"></i>BACK</button></header><section class="tank-select-web__shell"><div class="tank-select-web__fuel"><div><img src="/data/graphics/shop/icons/fuel.png" alt=""><span>FUEL AVAILABLE <strong>${this.shop.getFuelBalance()}</strong></span></div><b><small>DEPLOYMENT COST</small>${
      tank.name
    } / ${
      tank.fuel
    } FUEL</b></div><div class="tank-select-web__section-heading"><p class="tank-select-web__count">TANK ROSTER <strong>${
      tanks.length
    } CHASSIS</strong></p><span>SELECT A CHASSIS TO PREPARE DEPLOYMENT</span></div><section class="tank-select-web__grid">${tanks
      .map(
        (item, index) =>
          `<button data-tank="${index}" ${
            item.locked ? 'disabled aria-disabled="true"' : ''
          } class="tank-select-web__card ${
            index === this.selected ? 'is-active' : ''
          } ${
            item.locked ? 'is-locked' : ''
          }"><span class="tank-select-web__card-index">CHASSIS 0${index +
            1}</span><h2>${item.name}</h2><p>${item.role}</p>${
            item.image
              ? `<span class="tank-select-web__tank-sprite" style="background-image:url('${item.image}')" role="img" aria-label="${item.name}"></span>`
              : '<span class="tank-select-web__lock" aria-hidden="true"><i></i></span>'
          }<dl><div><dt>ROUNDS</dt><dd>${
            item.stats[0]
          }</dd></div><div><dt>VELOCITY</dt><dd>${
            item.stats[1]
          }</dd></div><div><dt>WALL DAMAGE</dt><dd>${
            item.stats[2]
          }</dd></div></dl><strong>${
            item.locked
              ? 'LOCKED'
              : `<img src="/data/graphics/shop/icons/fuel.png" alt="">${item.fuel} FUEL`
          }</strong></button>`,
      )
      .join(
        '',
      )}</section><div class="tank-select-web__actions"><button class="tank-select-web__continue" data-tank-continue>CONTINUE</button><p class="tank-select-web__status">${status}</p></div></section></main>`;
    this.bind();
  }

  private bind(): void {
    const signal = this.abort.signal;
    this.buttons = Array.from(this.host.querySelectorAll('button'));
    this.buttons.forEach((button) =>
      button.addEventListener(
        'focus',
        () => {
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
          if (button.dataset.tank !== undefined)
            this.lastTankFocus = Number(button.dataset.tank);
        },
        { signal },
      ),
    );
    this.host
      .querySelector('[data-tank-back]')
      ?.addEventListener(
        'click',
        () => animateBackNavigation(this.host, this.navigator),
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-tank]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            const index = Number(button.dataset.tank);
            if (tanks[index]?.locked) {
              this.render('THIS CHASSIS IS NOT YET AVAILABLE');
              this.buttons
                .find((candidate) => candidate.dataset.tank === String(index))
                ?.focus({ preventScroll: true });
              return;
            }
            this.selected = index;
            this.render();
            this.buttons
              .find(
                (candidate) => candidate.dataset.tank === String(this.selected),
              )
              ?.focus({ preventScroll: true });
          },
          { signal },
        ),
      );
    this.host
      .querySelector('[data-tank-continue]')
      ?.addEventListener('click', () => this.continue(), { signal });
  }
  private continue(): void {
    const tank = tanks[this.selected];
    if (!this.shop.canStartRun(tank.fuel)) {
      this.render(`NEED ${tank.fuel} FUEL - VISIT THE SHOP`);
      return;
    }
    const params = this.getParams();
    this.navigator.push(GameSceneType.MainShop, {
      battleSetup: true,
      multiplayer: params.multiplayer === true,
      stage: params.stage,
      matchId: params.matchId,
      playerSlot: params.playerSlot,
      stageRejoin: params.stageRejoin,
      transitionDeadline: params.transitionDeadline,
      tankTier: tank.tier,
      fuelCost: tank.fuel,
    });
  }

  private focused(): HTMLButtonElement | null {
    return document.activeElement instanceof HTMLButtonElement &&
      this.buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
  }

  private moveFocus(horizontal: number, vertical: number): void {
    const current =
      this.focused() ??
      this.buttons.find(
        (button) => button.dataset.tank === String(this.selected),
      );
    if (!current) return;
    const focusedTank = this.buttons.find(
      (button) => button.dataset.tank === String(this.lastTankFocus),
    );
    if (vertical < 0 && current.hasAttribute('data-tank-continue')) {
      focusedTank?.focus({ preventScroll: true });
      return;
    }
    if (vertical > 0 && current.hasAttribute('data-tank-back')) {
      focusedTank?.focus({ preventScroll: true });
      return;
    }
    const currentRect = current.getBoundingClientRect();
    const candidates = this.buttons
      .filter((button) => button !== current && !button.disabled)
      .map((button) => ({ button, rect: button.getBoundingClientRect() }))
      .filter(({ rect }) =>
        horizontal > 0
          ? rect.left >= currentRect.right - 2
          : horizontal < 0
          ? rect.right <= currentRect.left + 2
          : vertical > 0
          ? rect.top >= currentRect.bottom - 2
          : rect.bottom <= currentRect.top + 2,
      );
    const candidate = candidates.sort((left, right) => {
      const leftPrimary = horizontal
        ? Math.abs(left.rect.left - currentRect.left)
        : Math.abs(left.rect.top - currentRect.top);
      const rightPrimary = horizontal
        ? Math.abs(right.rect.left - currentRect.left)
        : Math.abs(right.rect.top - currentRect.top);
      const leftCross = horizontal
        ? Math.abs(
            (left.rect.top + left.rect.bottom) / 2 -
              (currentRect.top + currentRect.bottom) / 2,
          )
        : Math.abs(
            (left.rect.left + left.rect.right) / 2 -
              (currentRect.left + currentRect.right) / 2,
          );
      const rightCross = horizontal
        ? Math.abs(
            (right.rect.top + right.rect.bottom) / 2 -
              (currentRect.top + currentRect.bottom) / 2,
          )
        : Math.abs(
            (right.rect.left + right.rect.right) / 2 -
              (currentRect.left + currentRect.right) / 2,
          );
      return leftPrimary * 4 + leftCross - (rightPrimary * 4 + rightCross);
    })[0];
    candidate?.button.focus({ preventScroll: true });
  }
}
