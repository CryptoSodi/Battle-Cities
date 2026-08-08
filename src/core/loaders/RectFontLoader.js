"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RectFontLoader = void 0;
const text_1 = require("../text");
class RectFontLoader {
    constructor() {
        this.registeredItems = new Map();
        this.loadedFonts = new Map();
    }
    register(id, config, options = {}) {
        const item = { config, options };
        this.registeredItems.set(id, item);
    }
    load(id) {
        const item = this.registeredItems.get(id);
        if (item === undefined) {
            const error = new Error(`Rect font "${id} not registered`);
            throw error;
        }
        if (this.loadedFonts.has(id)) {
            return this.loadedFonts.get(id);
        }
        const { config, options: defaultOptions } = item;
        const font = new text_1.RectFont(config, defaultOptions);
        this.loadedFonts.set(id, font);
        return font;
    }
    preloadAll() {
        this.registeredItems.forEach((config, id) => {
            this.load(id);
        });
    }
}
exports.RectFontLoader = RectFontLoader;
