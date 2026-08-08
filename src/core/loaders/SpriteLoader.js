"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteLoader = void 0;
const graphics_1 = require("../graphics");
const Rect_1 = require("../Rect");
const DEFAULT_OPTIONS = {
    scale: 1,
};
class SpriteLoader {
    constructor(imageLoader, manifest, options = {}) {
        this.imageLoader = imageLoader;
        this.manifest = manifest;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    load(id, argDestinationRect) {
        const item = this.manifest[id];
        if (item === undefined) {
            throw new Error(`Invalid sprite id = "${id}"`);
        }
        const { file: filePath, rect: sourceRectValues, scale: itemScale = 1, } = item;
        const image = this.imageLoader.load(filePath);
        const sourceRect = new Rect_1.Rect(...sourceRectValues);
        // Source art may be authored larger than its logical size (HD detail);
        // itemScale divides it back down so the drawn footprint is unchanged.
        const drawScale = this.options.scale / itemScale;
        const defaultDestinationRect = new Rect_1.Rect(0, 0, sourceRect.width * drawScale, sourceRect.height * drawScale);
        const destinationRect = argDestinationRect ?? defaultDestinationRect;
        const sprite = new graphics_1.Sprite(image, sourceRect, destinationRect);
        return sprite;
    }
    async loadAsync(id, destinationRect = new Rect_1.Rect()) {
        return new Promise((resolve) => {
            const sprite = this.load(id, destinationRect);
            if (sprite.image.isLoaded()) {
                resolve(sprite);
            }
            else {
                sprite.image.loaded.addListenerOnce(() => {
                    resolve(sprite);
                });
            }
        });
    }
    loadList(ids) {
        const sprites = ids.map((id) => {
            const sprite = this.load(id);
            return sprite;
        });
        return sprites;
    }
    has(id) {
        return this.manifest[id] !== undefined;
    }
    // Loads a numbered animation sequence "<prefix>.1", "<prefix>.2", ... up to
    // however many consecutive frames exist in the manifest. This makes frame
    // count data-driven by the art: dropping in "<prefix>.3" extends the
    // animation with no code change. Returns frames in order.
    loadSequence(prefix) {
        const sprites = [];
        for (let index = 1;; index += 1) {
            const id = `${prefix}.${index}`;
            if (this.manifest[id] === undefined) {
                break;
            }
            sprites.push(this.load(id));
        }
        return sprites;
    }
    preloadAll() {
        Object.keys(this.manifest).forEach((id) => {
            this.load(id);
        });
    }
    async preloadAllAsync() {
        await this.preloadAsync(Object.keys(this.manifest));
    }
    async preloadAsync(ids) {
        const filePaths = this.getUniqueFilePaths(ids);
        await Promise.all(filePaths.map((filePath) => this.imageLoader.loadAsync(filePath)));
    }
    async preloadRequiredByPrefixAsync(prefix) {
        const ids = Object.keys(this.manifest).filter((id) => id.startsWith(prefix));
        if (ids.length === 0) {
            throw new Error(`No sprites found with prefix = "${prefix}"`);
        }
        const filePaths = this.getUniqueFilePaths(ids);
        while (true) {
            const images = await Promise.all(filePaths.map((filePath) => this.imageLoader.retryAsync(filePath)));
            if (images.every((image) => image.isLoaded())) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    async preloadAllInBatchesAsync(batchSize = 4) {
        const filePaths = this.getUniqueFilePaths(Object.keys(this.manifest));
        const safeBatchSize = Math.max(1, Math.floor(batchSize));
        for (let index = 0; index < filePaths.length; index += safeBatchSize) {
            const batch = filePaths.slice(index, index + safeBatchSize);
            await Promise.all(batch.map((filePath) => this.imageLoader.loadAsync(filePath)));
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    getUniqueFilePaths(ids) {
        const filePaths = new Set();
        ids.forEach((id) => {
            const item = this.manifest[id];
            if (item === undefined) {
                throw new Error(`Invalid sprite id = "${id}"`);
            }
            filePaths.add(item.file);
        });
        return Array.from(filePaths);
    }
}
exports.SpriteLoader = SpriteLoader;
