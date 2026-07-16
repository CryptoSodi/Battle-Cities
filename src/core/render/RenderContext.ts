import { ImageSource } from '../graphics';

import { Rect } from '../Rect';
import { Vector } from '../Vector';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

export interface WorldCullBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export abstract class RenderContext {
  protected canvas: Canvas;
  private worldCullEnabled = false;
  private readonly worldCullBounds: WorldCullBounds = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  };

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  abstract init(): void;
  abstract clear(): void;
  // Submit any pending batched work to the GPU. Called by the frame driver at
  // the end of each frame. No-op for backends that draw immediately.
  public flush(): void {
    return undefined;
  }
  abstract clearRect(x: number, y: number, width: number, height: number): void;
  // `flash` in [0..1] tints the sprite toward white (per-sprite hit flash);
  // 0 (default) draws the image unmodified.
  abstract drawImage(
    imageSource: ImageSource,
    sourceRect: Rect,
    destinationRect: Rect,
    flash?: number,
    tintColor?: string,
    tintAlpha?: number,
  );
  abstract fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  );
  abstract drawText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    color: string,
    align?: CanvasTextAlign,
    strokeColor?: string,
    strokeWidth?: number,
  );
  abstract pushClip(x: number, y: number, width: number, height: number): void;
  abstract popClip(): void;
  abstract getGlobalAlpha(): number;
  abstract setGlobalAlpha(alpha: number);
  // View transform applied to subsequent draws: screen = world * scale + offset.
  // Used for the gameplay camera zoom. Default scale 1, offset 0 (identity).
  abstract setView(scale: number, offsetX: number, offsetY: number);
  public setWorldCullBounds(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    this.worldCullEnabled = true;
    this.worldCullBounds.minX = minX;
    this.worldCullBounds.minY = minY;
    this.worldCullBounds.maxX = maxX;
    this.worldCullBounds.maxY = maxY;
  }
  public clearWorldCullBounds(): void {
    this.worldCullEnabled = false;
  }
  public getWorldCullBounds(): WorldCullBounds | null {
    return this.worldCullEnabled ? this.worldCullBounds : null;
  }
  public intersectsWorldCullBounds(
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    if (!this.worldCullEnabled) {
      return true;
    }
    return (
      x < this.worldCullBounds.maxX &&
      x + width > this.worldCullBounds.minX &&
      y < this.worldCullBounds.maxY &&
      y + height > this.worldCullBounds.minY
    );
  }
  abstract strokePath(positions: Vector[], color: string);
  abstract strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color?: string,
    lineWidth?: number,
  );
}
