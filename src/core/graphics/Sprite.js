"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sprite = void 0;
const Rect_1 = require("../Rect");
/**
 * Represents a specific fragment of an image by the coordinates.
 * The coordinates will be used by renderer to render the fragment.
 */
class Sprite {
    constructor(image, sourceRect = new Rect_1.Rect(), destinationRect = new Rect_1.Rect()) {
        this.image = image;
        this.sourceRect = sourceRect;
        this.destinationRect = destinationRect;
    }
    isImageLoaded() {
        return this.image.isLoaded();
    }
}
exports.Sprite = Sprite;
