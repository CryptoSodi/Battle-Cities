"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RotationMap = void 0;
class RotationMap {
    constructor() {
        this.map = new Map();
    }
    set(rotation, value) {
        this.map.set(this.round(rotation), value);
        return this;
    }
    get(rotation) {
        return this.map.get(this.round(rotation));
    }
    forEach(callbackFn) {
        this.map.forEach(callbackFn);
        return this;
    }
    // Tries to round rotation value to one of possible map values, because
    // calculations might introduce some error.
    round(rotation) {
        return Math.round(rotation) % 360;
    }
}
exports.RotationMap = RotationMap;
