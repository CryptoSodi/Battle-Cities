"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullInputDevice = void 0;
class NullInputDevice {
    isConnected() {
        return false;
    }
    listen() {
        // Do nothing
    }
    unlisten() {
        // Do nothing
    }
    update() {
        // Do nothing
    }
    reset() {
        // Do nothing
    }
    getDownCodes() {
        return [];
    }
    getHoldCodes() {
        return [];
    }
    getUpCodes() {
        return [];
    }
}
exports.NullInputDevice = NullInputDevice;
