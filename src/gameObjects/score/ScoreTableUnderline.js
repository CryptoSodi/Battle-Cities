"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreTableUnderline = void 0;
const core_1 = require("../../core");
class ScoreTableUnderline extends core_1.GameObject {
    constructor() {
        super(256, 8);
        this.painter = new core_1.RectPainter('#fff');
    }
}
exports.ScoreTableUnderline = ScoreTableUnderline;
