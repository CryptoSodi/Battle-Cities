"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameObject = void 0;
const RenderObject_1 = require("./RenderObject");
class GameObject extends RenderObject_1.RenderObject {
    constructor() {
        super(...arguments);
        this.collider = null;
        this.ignorePause = false;
        this.tags = [];
        this.needsSetup = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    invokeUpdate(...args) {
        if (this.needsSetup === true) {
            this.needsSetup = false;
            this.setup(...args);
            this.updateMatrix();
            this.updateWorldVisible(true);
            this.updateWorldZIndex(true);
        }
        this.update(...args);
    }
    invokeCollide(collision) {
        // Can't collide if not setup yet
        if (this.needsSetup === true) {
            return;
        }
        this.collide(collision);
    }
    hasBeenSetup() {
        return !this.needsSetup;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    setup(...args) {
        return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    update(...args) {
        return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collide(collision) {
        return undefined;
    }
    resetNeedsPaint() {
        // Don't reset paint status until setup
        if (this.needsSetup === true) {
            return;
        }
        super.resetNeedsPaint();
    }
}
exports.GameObject = GameObject;
