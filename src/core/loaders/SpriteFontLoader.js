"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteFontLoader = void 0;
const text_1 = require("../text");
class SpriteFontLoader {
    constructor(imageLoader) {
        this.registeredItems = new Map();
        this.loadedFonts = new Map();
        this.imageLoader = imageLoader;
    }
    register(id, config, options = {}) {
        const item = { config, options };
        this.registeredItems.set(id, item);
    }
    load(id) {
        const item = this.registeredItems.get(id);
        if (item === undefined) {
            throw new Error(`Sprite font "${id} not registered`);
        }
        if (this.loadedFonts.has(id)) {
            return this.loadedFonts.get(id);
        }
        const { config, options: defaultOptions } = item;
        const image = this.imageLoader.load(config.file);
        const font = new text_1.SpriteFont(config, image, defaultOptions);
        this.loadedFonts.set(id, font);
        return font;
    }
    async loadAsync(id) {
        return new Promise((resolve) => {
            const font = this.load(id);
            if (font.image.isLoaded()) {
                resolve(font);
            }
            else {
                font.image.loaded.addListenerOnce(() => {
                    resolve(font);
                });
            }
        });
    }
    preloadAll() {
        this.registeredItems.forEach((config, id) => {
            this.load(id);
        });
    }
    async preloadAllAsync() {
        await Promise.all(Array.from(this.registeredItems).map(([id]) => {
            return this.loadAsync(id);
        }));
    }
}
exports.SpriteFontLoader = SpriteFontLoader;
