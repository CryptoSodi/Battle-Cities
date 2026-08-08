"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageLoader = void 0;
const graphics_1 = require("../graphics");
const Logger_1 = require("../Logger");
class ImageLoader {
    constructor() {
        this.log = new Logger_1.Logger(ImageLoader.name, Logger_1.Logger.Level.None);
        this.images = new Map();
    }
    load(filePath) {
        if (this.images.has(filePath)) {
            return this.images.get(filePath);
        }
        const imageElement = new window.Image();
        const image = new graphics_1.Image(imageElement);
        image.loaded.addListenerOnce(() => {
            this.log.debug('Loaded "%s"', filePath);
        });
        imageElement.src = filePath;
        this.images.set(filePath, image);
        return image;
    }
    async loadAsync(path) {
        return new Promise((resolve) => {
            const image = this.load(path);
            if (image.isLoaded() || image.hasFailed()) {
                resolve(image);
            }
            else {
                const imageElement = image.getElement();
                let unsubscribeLoaded = () => undefined;
                const finish = () => {
                    unsubscribeLoaded();
                    imageElement.removeEventListener('error', finish);
                    resolve(image);
                };
                unsubscribeLoaded = image.loaded.addListenerOnce(finish);
                imageElement.addEventListener('error', finish, { once: true });
            }
        });
    }
    async retryAsync(path) {
        const cachedImage = this.images.get(path);
        if (cachedImage !== undefined && cachedImage.hasFailed()) {
            this.images.delete(path);
        }
        return this.loadAsync(path);
    }
}
exports.ImageLoader = ImageLoader;
