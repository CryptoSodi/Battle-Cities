"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyboardInputDevice = void 0;
class KeyboardInputDevice {
    constructor() {
        this.listenedDownCodes = [];
        this.downCodes = [];
        this.holdCodes = [];
        this.upCodes = [];
        this.handleWindowKeyDown = (ev) => {
            const { keyCode } = ev;
            if (!this.listenedDownCodes.includes(keyCode)) {
                this.listenedDownCodes.push(keyCode);
            }
        };
        this.handleWindowKeyUp = (ev) => {
            const { keyCode } = ev;
            const index = this.listenedDownCodes.indexOf(keyCode);
            if (index !== -1) {
                this.listenedDownCodes.splice(index, 1);
            }
        };
        // If we press a key and game window becomes unfocused (for example,
        // file dialog) and then the key is released, it's release won't be
        // captured by the game window, because something else is in focus now
        // (like file dialog). When we come back to game window, it's state
        // has only captured key down event, but not key up, so it becomes
        // stuck until same key goes full cycle once again. Reset the state
        // when game window loses focus.
        this.handleWindowBlur = () => {
            this.listenedDownCodes = [];
        };
    }
    isConnected() {
        return true;
    }
    listen() {
        document.addEventListener('keydown', this.handleWindowKeyDown);
        document.addEventListener('keyup', this.handleWindowKeyUp);
        window.addEventListener('blur', this.handleWindowBlur);
    }
    unlisten() {
        document.removeEventListener('keydown', this.handleWindowKeyDown);
        document.removeEventListener('keyup', this.handleWindowKeyUp);
        window.removeEventListener('blur', this.handleWindowBlur);
    }
    update() {
        const codes = this.listenedDownCodes;
        const downCodes = [];
        const holdCodes = [];
        for (const code of codes) {
            // Newly pressed key, which was not previously down or hold
            if (!this.downCodes.includes(code) && !this.holdCodes.includes(code)) {
                downCodes.push(code);
            }
            // Key that was down on previous frame is now considered hold, because
            // it is still down on current frame.
            // Hold key continues to be hold.
            if (this.downCodes.includes(code) || this.holdCodes.includes(code)) {
                holdCodes.push(code);
            }
        }
        // Find keycodes that were down or hold on previous frame, which means
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
        this.listenedDownCodes = [];
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
    setCodePressed(code, pressed) {
        const index = this.listenedDownCodes.indexOf(code);
        if (pressed && index === -1) {
            this.listenedDownCodes.push(code);
        }
        else if (!pressed && index !== -1) {
            this.listenedDownCodes.splice(index, 1);
        }
    }
}
exports.KeyboardInputDevice = KeyboardInputDevice;
