"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RectFont = void 0;
const Rect_1 = require("../../Rect");
const Vector_1 = require("../../Vector");
const DEFAULT_OPTIONS = {
    scale: 1,
};
class RectFont {
    constructor(config, options = {}) {
        this.config = config;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    buildCharacter(character, scale = new Vector_1.Vector(1, 1), offset = new Vector_1.Vector(0, 0)) {
        const characterIndex = this.config.characterSet.indexOf(character);
        if (characterIndex === -1) {
            throw new Error(`Font character "${character}" is not defined`);
        }
        const characterConfig = this.config.characters[characterIndex];
        const rects = [];
        characterConfig.forEach((row, rowIndex) => {
            Array.from(row).forEach((symbol, colIndex) => {
                if (symbol !== this.config.fillSymbol) {
                    return;
                }
                const x = colIndex * scale.x + offset.x * scale.x;
                const y = rowIndex * scale.y + offset.y * scale.y;
                const width = scale.x;
                const height = scale.y;
                const rect = new Rect_1.Rect(x, y, width, height);
                rects.push(rect);
            });
        });
        return rects;
    }
    getScale() {
        const { scale } = this.options;
        if (typeof scale === 'number') {
            return new Vector_1.Vector(scale, scale);
        }
        return scale;
    }
    getCharacterWidth() {
        return this.config.characterWidth;
    }
    getCharacterHeight() {
        return this.config.characterHeight;
    }
}
exports.RectFont = RectFont;
