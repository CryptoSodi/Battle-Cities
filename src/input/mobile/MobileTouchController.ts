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

const POWER_TYPE_ICONS: Record<string, string> = {
  shield: 'data/graphics/powerup-helmet.png',
  defence: 'data/graphics/powerup-shovel.png',
  freeze: 'data/graphics/powerup-clock.png',
  speed: 'data/graphics/powerup-speed.png',
  upgrade: 'data/graphics/powerup-star.png',
  zoomout: 'data/graphics/powerup-zoomout.png',
  wipeout: 'data/graphics/powerup-grenade.png',
  life: 'data/graphics/TANKS/powerup-tank.png',
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
  private wasGameplay = false;

  constructor(inputManager: InputManager, session: Session) {
    this.inputManager = inputManager;
    this.session = session;
    this.element = this.createElement();
    this.powerButtons = Array.from(
      this.element.querySelectorAll('[data-touch-power]'),
    ) as HTMLButtonElement[];

    document.body.appendChild(this.element);
    this.bindControls();
    this.update(false);
  }

  public update(isGameplay: boolean): void {
    if (!isMobileTouchLayout()) {
      return;
    }

    this.element.classList.toggle('is-gameplay', isGameplay);

    const consumables = this.session.getRunConsumables();
    const state = [
      consumables.powerupItems.join(','),
      consumables.powerups.join(','),
      consumables.powerupCounts.join(','),
    ].join('|');
    const enteredGameplay = isGameplay && !this.wasGameplay;
    this.wasGameplay = isGameplay;
    if (!enteredGameplay && state === this.lastPowerState) {
      return;
    }

    this.lastPowerState = state;
    this.powerButtons.forEach((button, index) => {
      const itemId = consumables.powerupItems[index];
      const powerupType = consumables.powerups[index];
      const count = consumables.powerupCounts[index] || 0;
      const icon = button.querySelector('img') as HTMLImageElement;
      const countElement = button.querySelector(
        '[data-touch-power-count]',
      ) as HTMLElement;
      const iconPath =
        (itemId === undefined ? undefined : POWER_ICONS[itemId]) ||
        POWER_TYPE_ICONS[powerupType];

      button.classList.toggle('is-equipped', iconPath !== undefined);
      button.setAttribute(
        'aria-label',
        iconPath === undefined
          ? `Power slot ${index + 1}, empty`
          : `Use ${itemId}, ${count} available`,
      );
      icon.hidden = iconPath === undefined;
      if (iconPath !== undefined) {
        icon.src = new URL(`/${iconPath}`, window.location.origin).href;
        icon.alt = '';
      } else {
        icon.removeAttribute('src');
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
        <button class="mobile-touch-stick" type="button" data-touch-stick
          aria-label="Movement joystick">
          <span class="mobile-touch-stick__cross" aria-hidden="true"></span>
          <span class="mobile-touch-stick__knob" data-touch-stick-knob aria-hidden="true"></span>
        </button>
        <div class="mobile-touch-fire" aria-label="Fire controls">
          <button class="mobile-touch-fire__button mobile-touch-fire__button--normal"
            type="button" data-touch-control="${
              InputControl.PrimaryAction
            }" aria-label="Fire">
            <span class="mobile-touch-fire__label">FIRE</span>
          </button>
          <button class="mobile-touch-fire__button mobile-touch-fire__button--rapid"
            type="button" data-touch-control="${
              InputControl.SecondaryAction
            }" aria-label="Rapid fire">
            <span class="mobile-touch-fire__label">RAPID</span>
          </button>
        </div>
      </div>`;
    return controller;
  }

  private bindControls(): void {
    this.bindMovementStick();

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

  private bindMovementStick(): void {
    const stick = this.element.querySelector(
      '[data-touch-stick]',
    ) as HTMLButtonElement;
    const knob = stick.querySelector('[data-touch-stick-knob]') as HTMLElement;
    let pointerId: number = null;

    const updateStick = (clientX: number, clientY: number): void => {
      const bounds = stick.getBoundingClientRect();
      const radius = bounds.width / 2;
      let x = (clientX - (bounds.left + radius)) / radius;
      let y = (clientY - (bounds.top + radius)) / radius;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }

      const threshold = 0.24;
      this.inputManager.setTouchControl(InputControl.Left, x < -threshold);
      this.inputManager.setTouchControl(InputControl.Right, x > threshold);
      this.inputManager.setTouchControl(InputControl.Up, y < -threshold);
      this.inputManager.setTouchControl(InputControl.Down, y > threshold);
      knob.style.setProperty('--stick-x', `${x * radius * 0.54}px`);
      knob.style.setProperty('--stick-y', `${y * radius * 0.54}px`);
      stick.classList.toggle('is-pressed', magnitude > threshold);
    };

    const release = (): void => {
      pointerId = null;
      MOVEMENT_CONTROLS.forEach(({ control }) => {
        this.inputManager.setTouchControl(control, false);
      });
      knob.style.setProperty('--stick-x', '0px');
      knob.style.setProperty('--stick-y', '0px');
      stick.classList.remove('is-pressed');
    };

    stick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerId = event.pointerId;
      stick.setPointerCapture(pointerId);
      updateStick(event.clientX, event.clientY);
    });
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId === pointerId) {
        updateStick(event.clientX, event.clientY);
      }
    });
    stick.addEventListener('pointerrawupdate', (event) => {
      const pointerEvent = event as PointerEvent;
      if (pointerEvent.pointerId === pointerId) {
        updateStick(pointerEvent.clientX, pointerEvent.clientY);
      }
    });
    stick.addEventListener('lostpointercapture', release);
    stick.addEventListener('pointercancel', release);
    stick.addEventListener('contextmenu', (event) => event.preventDefault());
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
    const knob = this.element.querySelector(
      '[data-touch-stick-knob]',
    ) as HTMLElement;
    knob.style.setProperty('--stick-x', '0px');
    knob.style.setProperty('--stick-y', '0px');
  }
}
