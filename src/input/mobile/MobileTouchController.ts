import { Session } from '../../game';
import { ShopInventoryItemId } from '../../shop';
import { InputControl } from '../InputControl';
import { InputManager } from '../InputManager';

const MOBILE_LAYOUT_QUERY = '(pointer: coarse) and (max-width: 900px)';

const POWER_ICONS: Partial<Record<ShopInventoryItemId, string>> = {
  [ShopInventoryItemId.Shield]: 'data/graphics/powerup-helmet.png',
  [ShopInventoryItemId.BaseDefence]: 'data/graphics/powerup-shovel.png',
  [ShopInventoryItemId.Freeze]: 'data/graphics/powerup-clock.png',
  [ShopInventoryItemId.Speed]: 'data/graphics/powerup-speed.png',
  [ShopInventoryItemId.Upgrade]: 'data/graphics/powerup-star.png',
  [ShopInventoryItemId.ZoomOut]: 'data/graphics/powerup-zoomout.png',
  [ShopInventoryItemId.Wipeout]: 'data/graphics/powerup-grenade.png',
  [ShopInventoryItemId.ExtraLife]: 'data/graphics/TANKS/powerup-tank.png',
};

type ControlDefinition = {
  control: InputControl;
  label: string;
  className: string;
};

const MOVEMENT_CONTROLS: ControlDefinition[] = [
  { control: InputControl.Up, label: 'Move up', className: 'up' },
  { control: InputControl.Left, label: 'Move left', className: 'left' },
  { control: InputControl.Right, label: 'Move right', className: 'right' },
  { control: InputControl.Down, label: 'Move down', className: 'down' },
];

export function isMobileTouchLayout(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_LAYOUT_QUERY).matches
  );
}

export class MobileTouchController {
  private readonly inputManager: InputManager;
  private readonly session: Session;
  private readonly element: HTMLElement;
  private readonly powerButtons: HTMLButtonElement[];
  private lastPowerState = '__initial__';

  constructor(inputManager: InputManager, session: Session) {
    this.inputManager = inputManager;
    this.session = session;
    this.element = this.createElement();
    this.powerButtons = Array.from(
      this.element.querySelectorAll('[data-touch-power]'),
    ) as HTMLButtonElement[];

    document.body.appendChild(this.element);
    this.bindControls();
    this.update();
  }

  public update(): void {
    if (!isMobileTouchLayout()) {
      return;
    }

    const consumables = this.session.getRunConsumables();
    const state = consumables.powerupItems
      .map((item, index) => `${item}:${consumables.powerupCounts[index] || 0}`)
      .join('|');
    if (state === this.lastPowerState) {
      return;
    }

    this.lastPowerState = state;
    this.powerButtons.forEach((button, index) => {
      const itemId = consumables.powerupItems[index];
      const count = consumables.powerupCounts[index] || 0;
      const icon = button.querySelector('img') as HTMLImageElement;
      const countElement = button.querySelector(
        '[data-touch-power-count]',
      ) as HTMLElement;
      const iconPath = itemId === undefined ? undefined : POWER_ICONS[itemId];

      button.classList.toggle('is-equipped', iconPath !== undefined);
      button.setAttribute(
        'aria-label',
        iconPath === undefined
          ? `Power slot ${index + 1}, empty`
          : `Use ${itemId}, ${count} available`,
      );
      icon.hidden = iconPath === undefined;
      if (iconPath !== undefined) {
        icon.src = iconPath;
        icon.alt = '';
      }
      countElement.textContent = count > 1 ? `x${count}` : '';
    });
  }

  private createElement(): HTMLElement {
    const controller = document.createElement('section');
    controller.className = 'mobile-touch-controller';
    controller.setAttribute('aria-label', 'Game controls');
    controller.innerHTML = `
      <div class="mobile-touch-controller__powers" aria-label="Equipped powers">
        ${[1, 2, 3, 4]
          .map(
            (slot) => `
              <button class="mobile-touch-power" type="button" data-touch-power="${slot -
                1}">
                <span class="mobile-touch-power__key">${slot}</span>
                <img class="mobile-touch-power__icon" hidden />
                <span class="mobile-touch-power__count" data-touch-power-count></span>
              </button>`,
          )
          .join('')}
      </div>
      <div class="mobile-touch-controller__main">
        <div class="mobile-touch-dpad" aria-label="Movement pad">
          ${MOVEMENT_CONTROLS.map(
            ({ label, className }) => `
              <button class="mobile-touch-dpad__button mobile-touch-dpad__button--${className}"
                type="button" data-touch-direction="${className}" aria-label="${label}">
                <span aria-hidden="true"></span>
              </button>`,
          ).join('')}
          <div class="mobile-touch-dpad__center" aria-hidden="true"></div>
        </div>
        <div class="mobile-touch-fire" aria-label="Fire controls">
          <button class="mobile-touch-fire__button mobile-touch-fire__button--rapid"
            type="button" data-touch-control="${
              InputControl.SecondaryAction
            }" aria-label="Rapid fire">
            <span class="mobile-touch-fire__label">RAPID</span>
          </button>
          <button class="mobile-touch-fire__button mobile-touch-fire__button--normal"
            type="button" data-touch-control="${
              InputControl.PrimaryAction
            }" aria-label="Fire">
            <span class="mobile-touch-fire__label">FIRE</span>
          </button>
        </div>
      </div>`;
    return controller;
  }

  private bindControls(): void {
    MOVEMENT_CONTROLS.forEach(({ control, className }) => {
      const button = this.element.querySelector(
        `[data-touch-direction="${className}"]`,
      ) as HTMLButtonElement;
      this.bindHoldButton(button, control);
    });

    const fireButtons = Array.from(
      this.element.querySelectorAll('[data-touch-control]'),
    ) as HTMLButtonElement[];
    fireButtons.forEach((button) => {
      this.bindHoldButton(button, Number(button.dataset.touchControl));
    });

    const powerControls = [
      InputControl.PowerOne,
      InputControl.PowerTwo,
      InputControl.PowerThree,
      InputControl.PowerFour,
    ];
    this.powerButtons.forEach((button, index) => {
      this.bindHoldButton(button, powerControls[index]);
    });

    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.releaseAll();
      }
    });
  }

  private bindHoldButton(
    button: HTMLButtonElement,
    control: InputControl,
  ): void {
    const release = (): void => {
      this.inputManager.setTouchControl(control, false);
      button.classList.remove('is-pressed');
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.inputManager.setTouchControl(control, true);
      button.classList.add('is-pressed');
    });
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private releaseAll(): void {
    const controls = [
      ...MOVEMENT_CONTROLS.map((definition) => definition.control),
      InputControl.PrimaryAction,
      InputControl.SecondaryAction,
      InputControl.PowerOne,
      InputControl.PowerTwo,
      InputControl.PowerThree,
      InputControl.PowerFour,
    ];
    controls.forEach((control) =>
      this.inputManager.setTouchControl(control, false),
    );
    this.element
      .querySelectorAll('.is-pressed')
      .forEach((button) => button.classList.remove('is-pressed'));
  }
}
