import { ImageSource } from '../graphics';

import { Rect } from '../Rect';
import { Vector } from '../Vector';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

export abstract class RenderContext {
  protected canvas: Canvas;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  abstract init(): void;
  abstract clear(): void;
  abstract clearRect(x: number, y: number, width: number, height: number): void;
  // `flash` in [0..1] tints the sprite toward white (per-sprite hit flash);
  // 0 (default) draws the image unmodified.
  abstract drawImage(
    imageSource: ImageSource,
    sourceRect: Rect,
    destinationRect: Rect,
    flash?: number,
  );
  abstract fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  );
  abstract getGlobalAlpha(): number;
  abstract setGlobalAlpha(alpha: number);
  // View transform applied to subsequent draws: screen = world * scale + offset.
  // Used for the gameplay camera zoom. Default scale 1, offset 0 (identity).
  abstract setView(scale: number, offsetX: number, offsetY: number);
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
