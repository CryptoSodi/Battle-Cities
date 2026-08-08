"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Image = void 0;
const ImageSource_1 = require("../ImageSource");
/**
 * Image represents entire image file, which might also be a spritesheet.
 * In case with spritesheets - one image may be reused a number of times.
 * Should be used to create Sprites.
 */
class Image extends ImageSource_1.ImageSource {
    constructor(imageElement) {
        super();
        this.failed = false;
        this.handleLoaded = () => {
            this.loaded.notify(null);
            this.removeLoadListeners();
        };
        this.handleFailed = () => {
            this.failed = true;
            this.removeLoadListeners();
        };
        this.imageElement = imageElement;
        this.imageElement.addEventListener('load', this.handleLoaded);
        this.imageElement.addEventListener('error', this.handleFailed);
    }
    getElement() {
        return this.imageElement;
    }
    getWidth() {
        return this.imageElement.naturalWidth;
    }
    getHeight() {
        return this.imageElement.naturalHeight;
    }
    isLoaded() {
        return this.imageElement.complete && this.imageElement.naturalWidth > 0;
    }
    hasFailed() {
        return this.failed;
    }
    removeLoadListeners() {
        this.imageElement.removeEventListener('load', this.handleLoaded);
        this.imageElement.removeEventListener('error', this.handleFailed);
    }
}
exports.Image = Image;
