"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RectPainter = void 0;
const Painter_1 = require("../Painter");
class RectPainter extends Painter_1.Painter {
    constructor(fillColor = null, strokeColor = null) {
        super();
        this.fillColor = null;
        this.strokeColor = null;
        this.lineWidth = 1;
        this.fillColor = fillColor;
        this.strokeColor = strokeColor;
    }
    paint(context, renderObject) {
        const box = renderObject.getWorldBoundingBox();
        const rect = box.toRect();
        // Originally canvas draws border outside the rectangle.
        // Recalculate coordinates of the border to be inside rect - it will
        // simplify clearing rect during rendering.
        const x = rect.x + this.lineWidth;
        const y = rect.y + this.lineWidth;
        const width = rect.width - this.lineWidth * 2;
        const height = rect.height - this.lineWidth * 2;
        if (this.fillColor !== null) {
            context.fillRect(rect.x, rect.y, rect.width, rect.height, this.fillColor);
        }
        if (this.strokeColor !== null) {
            context.strokeRect(x, y, width, height, this.strokeColor, this.lineWidth);
        }
    }
}
exports.RectPainter = RectPainter;
