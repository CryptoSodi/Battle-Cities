"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderContext = void 0;
class RenderContext {
    constructor(canvas) {
        this.worldCullEnabled = false;
        this.worldCullBounds = {
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0,
        };
        this.canvas = canvas;
    }
    // Submit any pending batched work to the GPU. Called by the frame driver at
    // the end of each frame. No-op for backends that draw immediately.
    flush() {
        return undefined;
    }
    setWorldCullBounds(minX, minY, maxX, maxY) {
        this.worldCullEnabled = true;
        this.worldCullBounds.minX = minX;
        this.worldCullBounds.minY = minY;
        this.worldCullBounds.maxX = maxX;
        this.worldCullBounds.maxY = maxY;
    }
    clearWorldCullBounds() {
        this.worldCullEnabled = false;
    }
    getWorldCullBounds() {
        return this.worldCullEnabled ? this.worldCullBounds : null;
    }
    intersectsWorldCullBounds(x, y, width, height) {
        if (!this.worldCullEnabled) {
            return true;
        }
        return (x < this.worldCullBounds.maxX &&
            x + width > this.worldCullBounds.minX &&
            y < this.worldCullBounds.maxY &&
            y + height > this.worldCullBounds.minY);
    }
}
exports.RenderContext = RenderContext;
