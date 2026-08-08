"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamepadInputDevice = void 0;
class GamepadInputDevice {
    constructor(deviceIndex) {
        this.isListening = false;
        this.downCodes = [];
        this.holdCodes = [];
        this.upCodes = [];
        this.deviceIndex = deviceIndex;
    }
    isConnected() {
        const gamepad = this.getGamepad();
        if (gamepad === null) {
            return false;
        }
        return true;
    }
    listen() {
        this.isListening = true;
    }
    unlisten() {
        this.isListening = false;
    }
    update() {
        if (!this.isListening) {
            return;
        }
        const gamepad = this.getGamepad();
        if (gamepad === null) {
            return;
        }
        // Extract buttons that are in pressed state
        const codes = [];
        const { buttons } = gamepad;
        for (let i = 0; i < buttons.length; i += 1) {
            const button = buttons[i];
            if (button.pressed === true) {
                codes.push(i);
            }
        }
        const downCodes = [];
        const holdCodes = [];
        for (const code of codes) {
            // Newly pressed key, which was not previously down or hold
            if (!this.downCodes.includes(code) && !this.holdCodes.includes(code)) {
                downCodes.push(code);
            }
            // Button that was down on previous frame is now considered hold, because
            // it is still down on current frame.
            // Hold continues to be hold.
            if (this.downCodes.includes(code) || this.holdCodes.includes(code)) {
                holdCodes.push(code);
            }
        }
        // Find buttons that were down or hold on previous frame, which means
        // that in current frame they are considered up
        const upCodes = [];
        for (const code of this.downCodes) {
            if (!codes.includes(code)) {
                upCodes.push(code);
            }
        }
        for (const code of this.holdCodes) {
            if (!codes.includes(code)) {
                upCodes.push(code);
            }
        }
        this.downCodes = downCodes;
        this.holdCodes = holdCodes;
        this.upCodes = upCodes;
    }
    reset() {
        this.downCodes = [];
        this.holdCodes = [];
        this.upCodes = [];
    }
    getDownCodes() {
        return this.downCodes;
    }
    getHoldCodes() {
        return this.holdCodes;
    }
    getUpCodes() {
        return this.upCodes;
    }
    getGamepad() {
        const gamepads = navigator.getGamepads();
        // Firefox will have empty array
        if (gamepads.length === 0) {
            return null;
        }
        const gamepad = gamepads[this.deviceIndex];
        // Chrome will have filled array of 4 elements with null values
        // Value will be null after device is connected or page is reloaded,
        // until user has pressed any button.
        if (gamepad === null) {
            return null;
        }
        return gamepad;
    }
}
exports.GamepadInputDevice = GamepadInputDevice;
