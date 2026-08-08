"use strict";
// Cosmetic particle overlay.
//
// Particles render on their OWN canvas, composited over the main game canvas,
// and are cleared+redrawn every frame — deliberately NOT routed through the
// full-frame game renderer. They are purely presentational: they never touch
// the simulation, use unseeded randomness at the call site, and are safe to
// scale down or skip for reduced-motion / low-end without affecting gameplay.
//
// Storage is a fixed-capacity pool backed by parallel typed arrays (Struct of
// Arrays) with swap-remove compaction, so there is no per-particle allocation
// or GC churn while emitting thousands of short-lived particles.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParticleSystem = void 0;
class ParticleSystem {
    constructor(width, height, capacity = 2000) {
        this.count = 0;
        // View transform mapping field-local coords to overlay (screen) pixels:
        // screen = local * scale + offset. Set each frame from the level camera.
        this.viewScale = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;
        this.cullScale = 1;
        this.cullOffsetX = 0;
        this.cullOffsetY = 0;
        // Full-screen white flash [0..1], decays over FLASH_FADE_SECONDS. Impact pop.
        this.flashAlpha = 0;
        this.capacity = capacity;
        this.logicalWidth = width;
        this.logicalHeight = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.className = 'particle-overlay';
        this.context = this.canvas.getContext('2d');
        this.posX = new Float32Array(capacity);
        this.posY = new Float32Array(capacity);
        this.velX = new Float32Array(capacity);
        this.velY = new Float32Array(capacity);
        this.life = new Float32Array(capacity);
        this.maxLife = new Float32Array(capacity);
        this.size = new Float32Array(capacity);
        this.gravity = new Float32Array(capacity);
        this.drag = new Float32Array(capacity);
        this.shrink = new Uint8Array(capacity);
        this.color = new Array(capacity).fill('rgb(255,255,255)');
    }
    getDomElement() {
        return this.canvas;
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
    getCount() {
        return this.count;
    }
    // screen = local * scale + offset. The level scene feeds this from the
    // camera (zoom + field position) so particles stay anchored to the world.
    setView(scale, offsetX, offsetY) {
        this.viewScale = scale;
        this.viewOffsetX = offsetX;
        this.viewOffsetY = offsetY;
    }
    setCullView(scale, offsetX, offsetY) {
        this.cullScale = scale;
        this.cullOffsetX = offsetX;
        this.cullOffsetY = offsetY;
    }
    // Trigger a full-screen white flash (impact punch). Takes the strongest of
    // any overlapping requests. alpha in [0..1].
    flash(alpha) {
        const clamped = alpha > 1 ? 1 : alpha;
        if (clamped > this.flashAlpha) {
            this.flashAlpha = clamped;
        }
    }
    spawn(options) {
        if (this.count >= this.capacity) {
            // Pool full — drop the request rather than allocate. Cosmetic, so fine.
            return;
        }
        const index = this.count;
        this.count += 1;
        this.posX[index] = options.x;
        this.posY[index] = options.y;
        this.velX[index] = options.vx;
        this.velY[index] = options.vy;
        this.life[index] = options.life;
        this.maxLife[index] = options.life;
        this.size[index] = options.size;
        this.gravity[index] = options.gravity ?? 0;
        this.drag[index] = options.drag ?? 0;
        this.shrink[index] = options.shrink ? 1 : 0;
        this.color[index] = options.color;
    }
    update(deltaTime) {
        if (this.flashAlpha > 0) {
            this.flashAlpha = Math.max(0, this.flashAlpha - deltaTime / ParticleSystem.FLASH_FADE_SECONDS);
        }
        let index = 0;
        while (index < this.count) {
            const nextLife = this.life[index] - deltaTime;
            if (nextLife <= 0) {
                this.swapRemove(index);
                // Do not advance index; a live particle was swapped into this slot.
                continue;
            }
            this.life[index] = nextLife;
            let vx = this.velX[index];
            let vy = this.velY[index] + this.gravity[index] * deltaTime;
            const damping = 1 - this.drag[index] * deltaTime;
            if (damping < 1) {
                vx *= damping;
                vy *= damping;
            }
            this.velX[index] = vx;
            this.velY[index] = vy;
            this.posX[index] += vx * deltaTime;
            this.posY[index] += vy * deltaTime;
            index += 1;
        }
    }
    render() {
        const context = this.context;
        context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        if (this.count === 0 && this.flashAlpha <= 0) {
            return;
        }
        const scale = this.viewScale;
        const cullScale = this.cullScale;
        const canvasWidth = this.logicalWidth;
        const canvasHeight = this.logicalHeight;
        for (let index = 0; index < this.count; index += 1) {
            const alpha = this.life[index] / this.maxLife[index];
            const cullX = this.posX[index] * cullScale + this.cullOffsetX;
            const cullY = this.posY[index] * cullScale + this.cullOffsetY;
            const cullSize = this.size[index] * cullScale;
            if (cullX + cullSize < 0 ||
                cullX - cullSize > canvasWidth ||
                cullY + cullSize < 0 ||
                cullY - cullSize > canvasHeight) {
                continue;
            }
            const screenX = this.posX[index] * scale + this.viewOffsetX;
            const screenY = this.posY[index] * scale + this.viewOffsetY;
            let drawSize = this.size[index] * scale;
            if (this.shrink[index] === 1) {
                drawSize *= alpha;
            }
            if (drawSize < 1) {
                drawSize = 1;
            }
            context.globalAlpha = alpha < 0 ? 0 : alpha;
            context.fillStyle = this.color[index];
            context.fillRect(screenX - drawSize / 2, screenY - drawSize / 2, drawSize, drawSize);
        }
        context.globalAlpha = 1;
        // Full-screen white flash on top of the particles.
        if (this.flashAlpha > 0) {
            context.globalAlpha = this.flashAlpha;
            context.fillStyle = 'rgb(255,255,255)';
            context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
            context.globalAlpha = 1;
        }
    }
    clear() {
        this.count = 0;
        this.flashAlpha = 0;
        this.context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
    swapRemove(index) {
        const last = this.count - 1;
        if (index !== last) {
            this.posX[index] = this.posX[last];
            this.posY[index] = this.posY[last];
            this.velX[index] = this.velX[last];
            this.velY[index] = this.velY[last];
            this.life[index] = this.life[last];
            this.maxLife[index] = this.maxLife[last];
            this.size[index] = this.size[last];
            this.gravity[index] = this.gravity[last];
            this.drag[index] = this.drag[last];
            this.shrink[index] = this.shrink[last];
            this.color[index] = this.color[last];
        }
        this.count = last;
    }
}
exports.ParticleSystem = ParticleSystem;
ParticleSystem.FLASH_FADE_SECONDS = 0.14;
