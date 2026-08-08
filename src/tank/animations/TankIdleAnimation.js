"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankIdleAnimation = void 0;
const core_1 = require("../../core");
const TankAnimationFrame_1 = require("../TankAnimationFrame");
class TankIdleAnimation extends core_1.Animation {
    constructor(spriteLoader, type, colors, rotation) {
        super([], { delay: 0.12, loop: true });
        this.regularFrames = [];
        this.regularFrames = [
            new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
        ];
        this.updateFrames();
    }
    // Kept for callers that refresh tank skin state after gameplay flags change.
    updateFrames() {
        this.resetWithFrames(this.regularFrames);
    }
}
exports.TankIdleAnimation = TankIdleAnimation;
