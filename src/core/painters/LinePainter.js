"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinePainter = void 0;
const Painter_1 = require("../Painter");
class LinePainter extends Painter_1.Painter {
    constructor() {
        super(...arguments);
        this.positions = [];
        this.strokeColor = '#000';
    }
    paint(context, renderObject) {
        if (this.positions.length === 0) {
            return;
        }
        const { min } = renderObject.getWorldBoundingBox();
        const worldPositions = this.positions.map((position) => {
            return position.clone().add(min);
        });
        context.strokePath(worldPositions, this.strokeColor);
    }
}
exports.LinePainter = LinePainter;
