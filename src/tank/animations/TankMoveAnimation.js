"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankMoveAnimation = void 0;
const core_1 = require("../../core");
const TankAnimationFrame_1 = require("../TankAnimationFrame");
const TankSpriteId_1 = require("../TankSpriteId");
class TankMoveAnimation extends core_1.Animation {
    constructor(spriteLoader, type, colors, rotation) {
        super([], { delay: 0.02, loop: true });
        this.regularFrames = [];
        this.regularFrames = this.createRegularFrames(spriteLoader, type, colors, rotation);
        this.updateFrames();
    }
    // Kept for callers that refresh tank skin state after gameplay flags change.
    updateFrames() {
        this.resetWithFrames(this.regularFrames);
    }
    createRegularFrames(spriteLoader, type, colors, rotation) {
        const numberedMoveFrames = this.createNumberedMoveFrames(spriteLoader, type, colors, rotation);
        if (numberedMoveFrames.length > 1) {
            return numberedMoveFrames;
        }
        return [
            new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
            new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, 2),
            new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
            new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, 2),
        ];
    }
    createNumberedMoveFrames(spriteLoader, type, colors, rotation) {
        const frames = [];
        for (let frameNumber = 2;; frameNumber += 1) {
            const spriteId = TankSpriteId_1.TankSpriteId.create(type, colors[0], rotation, frameNumber);
            if (!spriteLoader.has(spriteId)) {
                break;
            }
            frames.push(new TankAnimationFrame_1.TankAnimationFrame(spriteLoader, type, colors, rotation, frameNumber));
        }
        return frames;
    }
}
exports.TankMoveAnimation = TankMoveAnimation;
