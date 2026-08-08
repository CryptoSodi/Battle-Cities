"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteTextPainter = void 0;
const Painter_1 = require("../Painter");
const Rect_1 = require("../Rect");
class SpriteTextPainter extends Painter_1.Painter {
    constructor(text = null, color = null) {
        super();
        this.text = null;
        this.color = null;
        this.opacity = 1;
        this.text = text;
        this.color = color;
    }
    paint(context, renderObject) {
        if (this.text === null) {
            return;
        }
        const { min: worldPosition } = renderObject.getWorldBoundingBox();
        const sprites = this.text.build();
        const tmpGlobalAlpha = context.getGlobalAlpha();
        if (this.opacity !== 1) {
            context.setGlobalAlpha(this.opacity);
        }
        sprites.forEach((sprite) => {
            const destinationRect = new Rect_1.Rect(worldPosition.x + sprite.destinationRect.x, worldPosition.y + sprite.destinationRect.y, sprite.destinationRect.width, sprite.destinationRect.height);
            context.drawImage(sprite.image, sprite.sourceRect, destinationRect);
        });
        if (this.opacity !== 1) {
            context.setGlobalAlpha(tmpGlobalAlpha);
        }
    }
}
exports.SpriteTextPainter = SpriteTextPainter;
