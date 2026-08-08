"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileGamepadInputDevice = void 0;
const codes_1 = require("../codes");
const AXIS_DEAD_ZONE = 0.22;
class MobileGamepadInputDevice {
    constructor(host, deviceIndex) {
        this.isListening = false;
        this.downCodes = [];
        this.holdCodes = [];
        this.upCodes = [];
        this.host = host;
        this.deviceIndex = deviceIndex;
    }
    isConnected() {
        const gamepad = this.getGamepad();
        return gamepad !== null && gamepad.connected === true;
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
        const codes = gamepad === null ? [] : this.getPressedCodes(gamepad);
        const downCodes = [];
        const holdCodes = [];
        for (const code of codes) {
            if (!this.downCodes.includes(code) && !this.holdCodes.includes(code)) {
                downCodes.push(code);
            }
            if (this.downCodes.includes(code) || this.holdCodes.includes(code)) {
                holdCodes.push(code);
            }
        }
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
        const gamepad = this.host.getGamepad(this.deviceIndex);
        if (gamepad === null || gamepad.connected !== true) {
            return null;
        }
        return gamepad;
    }
    getPressedCodes(gamepad) {
        const codes = [];
        gamepad.buttons.forEach((button, index) => {
            if (button.pressed === true) {
                codes.push(index);
            }
        });
        const horizontalAxis = gamepad.axes[0] || 0;
        const verticalAxis = gamepad.axes[1] || 0;
        if (verticalAxis < -AXIS_DEAD_ZONE) {
            codes.push(codes_1.GamepadButtonCode.Up);
        }
        if (verticalAxis > AXIS_DEAD_ZONE) {
            codes.push(codes_1.GamepadButtonCode.Down);
        }
        if (horizontalAxis < -AXIS_DEAD_ZONE) {
            codes.push(codes_1.GamepadButtonCode.Left);
        }
        if (horizontalAxis > AXIS_DEAD_ZONE) {
            codes.push(codes_1.GamepadButtonCode.Right);
        }
        return codes;
    }
}
exports.MobileGamepadInputDevice = MobileGamepadInputDevice;
