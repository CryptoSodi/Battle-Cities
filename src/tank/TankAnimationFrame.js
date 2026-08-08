"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankAnimationFrame = void 0;
const TankSpriteId_1 = require("./TankSpriteId");
class TankAnimationFrame {
    constructor(spriteLoader, type, colors, rotation, frameNumber = 1) {
        this.sprites = colors.map((color) => {
            const spriteId = TankSpriteId_1.TankSpriteId.create(type, color, rotation, frameNumber);
            const sprite = spriteLoader.load(spriteId);
            return sprite;
        });
    }
    getSprite(index) {
        const sprite = this.sprites[index];
        if (sprite === undefined) {
            return null;
        }
        return sprite;
    }
}
exports.TankAnimationFrame = TankAnimationFrame;
