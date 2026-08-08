"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteFont = void 0;
const graphics_1 = require("../../graphics");
const Rect_1 = require("../../Rect");
const Vector_1 = require("../../Vector");
const DEFAULT_OPTIONS = {
    scale: 1,
};
class SpriteFont {
    constructor(config, image, options = {}) {
        this.config = config;
        this.image = image;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    buildCharacter(character, scale = new Vector_1.Vector(1, 1), offset = new Vector_1.Vector(0, 0)) {
        const characterIndex = this.config.characterSet.indexOf(character);
        if (characterIndex === -1) {
            throw new Error(`Font character "${character}" is not defined`);
        }
        const { characterWidth, characterHeight, columnCount, horizontalSpacing, verticalSpacing, offsetY, offsetX, } = this.config;
        const rowIndex = Math.floor(characterIndex / columnCount);
        const columnIndex = characterIndex % columnCount;
        const sourceX = offsetX + columnIndex * characterWidth + columnIndex * horizontalSpacing;
        const sourceY = offsetY + rowIndex * characterHeight + rowIndex * verticalSpacing;
        const sourceWidth = characterWidth;
        const sourceHeight = characterHeight;
        const sourceRect = new Rect_1.Rect(sourceX, sourceY, sourceWidth, sourceHeight);
        const destinationX = offset.x * scale.x;
        const destinationY = offset.y * scale.y;
        const destinationWidth = characterWidth * scale.x;
        const destinationHeight = characterHeight * scale.y;
        const destinationRect = new Rect_1.Rect(destinationX, destinationY, destinationWidth, destinationHeight);
        const sprite = new graphics_1.Sprite(this.image, sourceRect, destinationRect);
        return sprite;
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
    getImageSourceRect() {
        const { characterWidth, characterHeight, columnCount, rowCount, horizontalSpacing, verticalSpacing, offsetY, offsetX, } = this.config;
        const x = offsetX;
        const y = offsetY;
        const width = characterWidth * columnCount + horizontalSpacing * columnCount - 1;
        const height = characterHeight * rowCount + verticalSpacing * (rowCount - 1);
        const rect = new Rect_1.Rect(x, y, width, height);
        return rect;
    }
}
exports.SpriteFont = SpriteFont;
