"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasImage = void 0;
const ImageSource_1 = require("../ImageSource");
class CanvasImage extends ImageSource_1.ImageSource {
    constructor(canvasElement) {
        super();
        this.canvasElement = canvasElement;
    }
    getElement() {
        return this.canvasElement;
    }
    getWidth() {
        return this.canvasElement.width;
    }
    getHeight() {
        return this.canvasElement.height;
    }
    isLoaded() {
        return true;
    }
}
exports.CanvasImage = CanvasImage;
