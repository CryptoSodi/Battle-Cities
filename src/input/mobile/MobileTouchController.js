"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileTouchController = exports.isMobileTouchLayout = void 0;
const shop_1 = require("../../shop");
const InputControl_1 = require("../InputControl");
const MOBILE_LAYOUT_QUERY = '(pointer: coarse) and (max-width: 900px)';
const POWER_ICONS = {
    [shop_1.ShopInventoryItemId.Shield]: 'data/graphics/powerup-helmet.png',
    [shop_1.ShopInventoryItemId.BaseDefence]: 'data/graphics/powerup-shovel.png',
    [shop_1.ShopInventoryItemId.Freeze]: 'data/graphics/powerup-clock.png',
    [shop_1.ShopInventoryItemId.Speed]: 'data/graphics/powerup-speed.png',
    [shop_1.ShopInventoryItemId.Upgrade]: 'data/graphics/powerup-star.png',
    [shop_1.ShopInventoryItemId.ZoomOut]: 'data/graphics/powerup-zoomout.png',
    [shop_1.ShopInventoryItemId.Wipeout]: 'data/graphics/powerup-grenade.png',
    [shop_1.ShopInventoryItemId.ExtraLife]: 'data/graphics/TANKS/powerup-life.png',
};
const POWER_TYPE_ICONS = {
    shield: 'data/graphics/powerup-helmet.png',
    defence: 'data/graphics/powerup-shovel.png',
    freeze: 'data/graphics/powerup-clock.png',
    speed: 'data/graphics/powerup-speed.png',
    upgrade: 'data/graphics/powerup-star.png',
    zoomout: 'data/graphics/powerup-zoomout.png',
    wipeout: 'data/graphics/powerup-grenade.png',
    life: 'data/graphics/TANKS/powerup-life.png',
};
const MOVEMENT_CONTROLS = [
    { control: InputControl_1.InputControl.Up, label: 'Move up', className: 'up' },
    { control: InputControl_1.InputControl.Left, label: 'Move left', className: 'left' },
    { control: InputControl_1.InputControl.Right, label: 'Move right', className: 'right' },
    { control: InputControl_1.InputControl.Down, label: 'Move down', className: 'down' },
];
function isMobileTouchLayout() {
    return (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(MOBILE_LAYOUT_QUERY).matches);
}
exports.isMobileTouchLayout = isMobileTouchLayout;
class MobileTouchController {
    constructor(inputManager, session) {
        this.lastPowerState = '__initial__';
        this.wasGameplay = false;
        this.inputManager = inputManager;
        this.session = session;
        this.element = this.createElement();
        this.powerButtons = Array.from(this.element.querySelectorAll('[data-touch-power]'));
        document.body.appendChild(this.element);
        this.bindControls();
        this.update(false);
    }
    update(isGameplay) {
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
            const icon = button.querySelector('img');
            const countElement = button.querySelector('[data-touch-power-count]');
            const iconPath = (itemId === undefined ? undefined : POWER_ICONS[itemId]) ||
                POWER_TYPE_ICONS[powerupType];
            button.classList.toggle('is-equipped', iconPath !== undefined);
            button.setAttribute('aria-label', iconPath === undefined
                ? `Power slot ${index + 1}, empty`
                : `Use ${itemId}, ${count} available`);
            icon.hidden = iconPath === undefined;
            if (iconPath !== undefined) {
                icon.src = new URL(`/${iconPath}`, window.location.origin).href;
                icon.alt = '';
            }
            else {
                icon.removeAttribute('src');
            }
            countElement.textContent = count > 1 ? `x${count}` : '';
        });
    }
    createElement() {
        const controller = document.createElement('section');
        controller.className = 'mobile-touch-controller';
        controller.setAttribute('aria-label', 'Game controls');
        controller.innerHTML = `
      <div class="mobile-touch-controller__powers" aria-label="Equipped powers">
        ${[1, 2, 3, 4]
            .map((slot) => `
              <button class="mobile-touch-power" type="button" data-touch-power="${slot -
            1}">
                <span class="mobile-touch-power__key">${slot}</span>
                <img class="mobile-touch-power__icon" hidden />
                <span class="mobile-touch-power__count" data-touch-power-count></span>
              </button>`)
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
            type="button" data-touch-control="${InputControl_1.InputControl.PrimaryAction}" aria-label="Fire">
            <span class="mobile-touch-fire__label">FIRE</span>
          </button>
          <button class="mobile-touch-fire__button mobile-touch-fire__button--rapid"
            type="button" data-touch-control="${InputControl_1.InputControl.SecondaryAction}" aria-label="Rapid fire">
            <span class="mobile-touch-fire__label">RAPID</span>
          </button>
        </div>
      </div>`;
        return controller;
    }
    bindControls() {
        this.bindMovementStick();
        const fireButtons = Array.from(this.element.querySelectorAll('[data-touch-control]'));
        fireButtons.forEach((button) => {
            this.bindHoldButton(button, Number(button.dataset.touchControl));
        });
        const powerControls = [
            InputControl_1.InputControl.PowerOne,
            InputControl_1.InputControl.PowerTwo,
            InputControl_1.InputControl.PowerThree,
            InputControl_1.InputControl.PowerFour,
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
    bindMovementStick() {
        const stick = this.element.querySelector('[data-touch-stick]');
        const knob = stick.querySelector('[data-touch-stick-knob]');
        let pointerId = null;
        const updateStick = (clientX, clientY) => {
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
            this.inputManager.setTouchControl(InputControl_1.InputControl.Left, x < -threshold);
            this.inputManager.setTouchControl(InputControl_1.InputControl.Right, x > threshold);
            this.inputManager.setTouchControl(InputControl_1.InputControl.Up, y < -threshold);
            this.inputManager.setTouchControl(InputControl_1.InputControl.Down, y > threshold);
            knob.style.setProperty('--stick-x', `${x * radius * 0.54}px`);
            knob.style.setProperty('--stick-y', `${y * radius * 0.54}px`);
            stick.classList.toggle('is-pressed', magnitude > threshold);
        };
        const release = () => {
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
            const pointerEvent = event;
            if (pointerEvent.pointerId === pointerId) {
                updateStick(pointerEvent.clientX, pointerEvent.clientY);
            }
        });
        stick.addEventListener('lostpointercapture', release);
        stick.addEventListener('pointercancel', release);
        stick.addEventListener('contextmenu', (event) => event.preventDefault());
    }
    bindHoldButton(button, control) {
        const release = () => {
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
    releaseAll() {
        const controls = [
            ...MOVEMENT_CONTROLS.map((definition) => definition.control),
            InputControl_1.InputControl.PrimaryAction,
            InputControl_1.InputControl.SecondaryAction,
            InputControl_1.InputControl.PowerOne,
            InputControl_1.InputControl.PowerTwo,
            InputControl_1.InputControl.PowerThree,
            InputControl_1.InputControl.PowerFour,
        ];
        controls.forEach((control) => this.inputManager.setTouchControl(control, false));
        this.element
            .querySelectorAll('.is-pressed')
            .forEach((button) => button.classList.remove('is-pressed'));
        const knob = this.element.querySelector('[data-touch-stick-knob]');
        knob.style.setProperty('--stick-x', '0px');
        knob.style.setProperty('--stick-y', '0px');
    }
}
exports.MobileTouchController = MobileTouchController;
