"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasRenderContext = void 0;
const CanvasText_1 = require("../../text/CanvasText");
const RenderContext_1 = require("../RenderContext");
class CanvasRenderContext extends RenderContext_1.RenderContext {
    constructor() {
        super(...arguments);
        this.logicalWidth = 1;
        this.logicalHeight = 1;
        this.viewScale = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;
        // Per-source-sheet white silhouettes, built lazily and reused, so the hit
        // flash costs one extra blit rather than a per-frame tint computation.
        this.maskCache = new Map();
    }
    init() {
        // TS 4.9's lib types widen getContext('2d') on the HTMLCanvasElement |
        // OffscreenCanvas union to include ImageBitmapRenderingContext; '2d'
        // always yields a 2D context at runtime, so narrow explicitly.
        this.context = this.canvas.getContext('2d');
        this.logicalWidth = this.canvas.width;
        this.logicalHeight = this.canvas.height;
    }
    resizeBackingStore(width, height) {
        const backingWidth = Math.max(1, Math.round(width));
        const backingHeight = Math.max(1, Math.round(height));
        if (this.canvas.width === backingWidth &&
            this.canvas.height === backingHeight) {
            return;
        }
        this.canvas.width = backingWidth;
        this.canvas.height = backingHeight;
        this.context.setTransform(backingWidth / this.logicalWidth, 0, 0, backingHeight / this.logicalHeight, 0, 0);
        this.context.imageSmoothingEnabled = false;
    }
    setView(scale, offsetX, offsetY) {
        this.viewScale = scale;
        this.viewOffsetX = offsetX;
        this.viewOffsetY = offsetY;
    }
    drawImage(imageSource, sourceRect, destinationRect, flash = 0, tintColor = null, tintAlpha = 0) {
        if (!imageSource.isLoaded()) {
            return;
        }
        const s = this.viewScale;
        const element = imageSource.getElement();
        const dx = Math.round(destinationRect.x * s + this.viewOffsetX);
        const dy = Math.round(destinationRect.y * s + this.viewOffsetY);
        const dw = destinationRect.width * s;
        const dh = destinationRect.height * s;
        this.context.drawImage(element, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, dx, dy, dw, dh);
        if (tintColor !== null && tintAlpha > 0) {
            const mask = this.getColorMask(element, tintColor);
            if (mask !== null) {
                const prevAlpha = this.context.globalAlpha;
                this.context.globalAlpha = prevAlpha * Math.min(1, tintAlpha);
                this.context.drawImage(mask, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, dx, dy, dw, dh);
                this.context.globalAlpha = prevAlpha;
            }
        }
        // Hit flash: overlay the white silhouette of the same sprite at `flash`
        // opacity. The silhouette shares the sprite's alpha, so only the sprite's
        // pixels lighten (not a white box).
        if (flash > 0) {
            const mask = this.getColorMask(element, 'rgb(255,255,255)');
            if (mask !== null) {
                const prevAlpha = this.context.globalAlpha;
                this.context.globalAlpha = prevAlpha * Math.min(1, flash);
                this.context.drawImage(mask, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, dx, dy, dw, dh);
                this.context.globalAlpha = prevAlpha;
            }
        }
    }
    // Returns (building once) a white silhouette of the given sheet: every opaque
    // texel painted white, preserving alpha. Used for the per-sprite hit flash.
    getColorMask(element, color) {
        let colorMasks = this.maskCache.get(element);
        if (colorMasks === undefined) {
            colorMasks = new Map();
            this.maskCache.set(element, colorMasks);
        }
        const cached = colorMasks.get(color);
        if (cached !== undefined) {
            return cached;
        }
        const width = element.naturalWidth ||
            element.width;
        const height = element.naturalHeight ||
            element.height;
        if (!width || !height) {
            return null;
        }
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskContext = maskCanvas.getContext('2d');
        if (maskContext === null) {
            return null;
        }
        maskContext.drawImage(element, 0, 0);
        // Keep the drawn alpha, replace all color with white.
        maskContext.globalCompositeOperation = 'source-atop';
        maskContext.fillStyle = color;
        maskContext.fillRect(0, 0, width, height);
        maskContext.globalCompositeOperation = 'source-over';
        colorMasks.set(color, maskCanvas);
        return maskCanvas;
    }
    clear() {
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.restore();
    }
    clearRect(x, y, width, height) {
        this.context.clearRect(x, y, width, height);
    }
    fillRect(x, y, width, height, color = '#000') {
        const s = this.viewScale;
        this.context.fillStyle = color;
        this.context.fillRect(x * s + this.viewOffsetX, y * s + this.viewOffsetY, width * s, height * s);
    }
    drawText(text, x, y, maxWidth, fontSize, fontFamily, fontWeight, color, align = 'left', strokeColor = null, strokeWidth = 0, letterSpacing = 1) {
        const s = this.viewScale;
        this.context.save();
        this.context.fillStyle = color;
        this.context.font = `${fontWeight} ${fontSize * s}px ${fontFamily}`;
        this.context.textAlign = align;
        this.context.textBaseline = 'top';
        const textX = (align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x) * s +
            this.viewOffsetX;
        const textY = y * s + this.viewOffsetY;
        if (strokeColor !== null && strokeWidth > 0) {
            this.context.strokeStyle = strokeColor;
            this.context.lineWidth = strokeWidth * s;
            this.context.lineJoin = 'round';
            (0, CanvasText_1.drawTrackedText)(this.context, text, textX, textY, maxWidth * s, align, letterSpacing * s, true);
        }
        (0, CanvasText_1.drawTrackedText)(this.context, text, textX, textY, maxWidth * s, align, letterSpacing * s);
        this.context.restore();
    }
    pushClip(x, y, width, height) {
        const s = this.viewScale;
        this.context.save();
        this.context.beginPath();
        this.context.rect(x * s + this.viewOffsetX, y * s + this.viewOffsetY, width * s, height * s);
        this.context.clip();
    }
    popClip() {
        this.context.restore();
    }
    getGlobalAlpha() {
        return this.context.globalAlpha;
    }
    setGlobalAlpha(alpha) {
        this.context.globalAlpha = alpha;
    }
    resetAlpha() {
        this.context.globalAlpha = 1;
    }
    strokePath(positions, color = '#000') {
        if (positions.length < 1) {
            return;
        }
        const s = this.viewScale;
        const [firstPosition, ...restPositions] = positions;
        this.context.beginPath();
        this.context.moveTo(firstPosition.x * s + this.viewOffsetX, firstPosition.y * s + this.viewOffsetY);
        for (const position of restPositions) {
            this.context.lineTo(position.x * s + this.viewOffsetX, position.y * s + this.viewOffsetY);
        }
        this.context.closePath();
        this.context.strokeStyle = color;
        this.context.stroke();
    }
    strokeRect(x, y, width, height, color = '#000', lineWidth = 1) {
        const s = this.viewScale;
        this.context.strokeStyle = color;
        this.context.lineWidth = lineWidth;
        this.context.strokeRect(x * s + this.viewOffsetX, y * s + this.viewOffsetY, width * s, height * s);
    }
}
exports.CanvasRenderContext = CanvasRenderContext;
