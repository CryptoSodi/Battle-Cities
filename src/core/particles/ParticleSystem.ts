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

export interface ParticleSpawnOptions {
  // Position in field-local world coordinates (same space as tank.getCenter()).
  x: number;
  y: number;
  // Velocity in world units per second.
  vx: number;
  vy: number;
  // Lifetime in seconds.
  life: number;
  // Draw size in logical pixels.
  size: number;
  // CSS color string, e.g. 'rgb(255,200,80)'.
  color: string;
  // Downward acceleration (world units / s^2).
  gravity?: number;
  // Fraction of velocity shed per second (0 = none, 1 = fully damped in ~1s).
  drag?: number;
  // Shrink the particle toward 0 as it ages.
  shrink?: boolean;
}

export class ParticleSystem {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly capacity: number;

  private count = 0;

  private readonly posX: Float32Array;
  private readonly posY: Float32Array;
  private readonly velX: Float32Array;
  private readonly velY: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly shrink: Uint8Array;
  // Color strings kept out-of-band so render does no per-frame allocation.
  private readonly color: string[];

  // View transform mapping field-local coords to overlay (screen) pixels:
  // screen = local * scale + offset. Set each frame from the level camera.
  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;

  // Full-screen white flash [0..1], decays over FLASH_FADE_SECONDS. Impact pop.
  private flashAlpha = 0;
  private static readonly FLASH_FADE_SECONDS = 0.14;

  constructor(width: number, height: number, capacity = 2000) {
    this.capacity = capacity;

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
    this.color = new Array<string>(capacity).fill('rgb(255,255,255)');
  }

  public getDomElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public getCount(): number {
    return this.count;
  }

  // screen = local * scale + offset. The level scene feeds this from the
  // camera (zoom + field position) so particles stay anchored to the world.
  public setView(scale: number, offsetX: number, offsetY: number): void {
    this.viewScale = scale;
    this.viewOffsetX = offsetX;
    this.viewOffsetY = offsetY;
  }

  // Trigger a full-screen white flash (impact punch). Takes the strongest of
  // any overlapping requests. alpha in [0..1].
  public flash(alpha: number): void {
    const clamped = alpha > 1 ? 1 : alpha;
    if (clamped > this.flashAlpha) {
      this.flashAlpha = clamped;
    }
  }

  public spawn(options: ParticleSpawnOptions): void {
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

  public update(deltaTime: number): void {
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(
        0,
        this.flashAlpha - deltaTime / ParticleSystem.FLASH_FADE_SECONDS,
      );
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

  public render(): void {
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.count === 0 && this.flashAlpha <= 0) {
      return;
    }

    const scale = this.viewScale;

    for (let index = 0; index < this.count; index += 1) {
      const alpha = this.life[index] / this.maxLife[index];
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
      context.fillRect(
        screenX - drawSize / 2,
        screenY - drawSize / 2,
        drawSize,
        drawSize,
      );
    }

    context.globalAlpha = 1;

    // Full-screen white flash on top of the particles.
    if (this.flashAlpha > 0) {
      context.globalAlpha = this.flashAlpha;
      context.fillStyle = 'rgb(255,255,255)';
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      context.globalAlpha = 1;
    }
  }

  public clear(): void {
    this.count = 0;
    this.flashAlpha = 0;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private swapRemove(index: number): void {
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
