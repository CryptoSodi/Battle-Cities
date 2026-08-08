"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collider = void 0;
const Subject_1 = require("../Subject");
class Collider {
    constructor(object, dynamic = false) {
        this.unregisterRequested = new Subject_1.Subject();
        this.object = object;
        this.dynamic = dynamic;
    }
    isInitialized() {
        return this.getCurrentBox() !== undefined;
    }
    unregister() {
        this.unregisterRequested.notify(null);
    }
}
exports.Collider = Collider;
