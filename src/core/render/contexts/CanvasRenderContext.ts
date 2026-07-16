import { ImageSource } from '../../graphics';

import { Rect } from '../../Rect';
import { Vector } from '../../Vector';
import { drawTrackedText } from '../../text/CanvasText';

import { RenderContext } from '../RenderContext';

export class CanvasRenderContext extends RenderContext {
  private context: NativeContext;
  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;
  // Per-source-sheet white silhouettes, built lazily and reused, so the hit
  // flash costs one extra blit rather than a per-frame tint computation.
  private maskCache = new Map<CanvasImageSource, Map<string, HTMLCanvasElement>>();

  public init(): void {
    // TS 4.9's lib types widen getContext('2d') on the HTMLCanvasElement |
    // OffscreenCanvas union to include ImageBitmapRenderingContext; '2d'
    // always yields a 2D context at runtime, so narrow explicitly.
    this.context = this.canvas.getContext('2d') as NativeContext;
  }

  public setView(scale: number, offsetX: number, offsetY: number): void {
    this.viewScale = scale;
    this.viewOffsetX = offsetX;
    this.viewOffsetY = offsetY;
  }

  public drawImage(
    imageSource: ImageSource,
    sourceRect: Rect,
    destinationRect: Rect,
    flash = 0,
    tintColor: string = null,
    tintAlpha = 0,
  ): void {
    if (!imageSource.isLoaded()) {
      return;
    }

    const s = this.viewScale;
    const element = imageSource.getElement();
    const dx = Math.round(destinationRect.x * s + this.viewOffsetX);
    const dy = Math.round(destinationRect.y * s + this.viewOffsetY);
    const dw = destinationRect.width * s;
    const dh = destinationRect.height * s;

    this.context.drawImage(
      element,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      dx,
      dy,
      dw,
      dh,
    );

    if (tintColor !== null && tintAlpha > 0) {
      const mask = this.getColorMask(element, tintColor);
      if (mask !== null) {
        const prevAlpha = this.context.globalAlpha;
        this.context.globalAlpha = prevAlpha * Math.min(1, tintAlpha);
        this.context.drawImage(
          mask,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          dx,
          dy,
          dw,
          dh,
        );
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
        this.context.drawImage(
          mask,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          dx,
          dy,
          dw,
          dh,
        );
        this.context.globalAlpha = prevAlpha;
      }
    }
  }

  // Returns (building once) a white silhouette of the given sheet: every opaque
  // texel painted white, preserving alpha. Used for the per-sprite hit flash.
  private getColorMask(
    element: CanvasImageSource,
    color: string,
  ): HTMLCanvasElement | null {
    let colorMasks = this.maskCache.get(element);
    if (colorMasks === undefined) {
      colorMasks = new Map<string, HTMLCanvasElement>();
      this.maskCache.set(element, colorMasks);
    }

    const cached = colorMasks.get(color);
    if (cached !== undefined) {
      return cached;
    }

    const width =
      (element as HTMLImageElement).naturalWidth ||
      (element as HTMLCanvasElement).width;
    const height =
      (element as HTMLImageElement).naturalHeight ||
      (element as HTMLCanvasElement).height;
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

  public clear(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public clearRect(x: number, y: number, width: number, height: number): void {
    this.context.clearRect(x, y, width, height);
  }

  public fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#000',
  ): void {
    const s = this.viewScale;
    this.context.fillStyle = color;
    this.context.fillRect(
      x * s + this.viewOffsetX,
      y * s + this.viewOffsetY,
      width * s,
      height * s,
    );
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    color: string,
    align: CanvasTextAlign = 'left',
    strokeColor: string = null,
    strokeWidth = 0,
    letterSpacing = 1,
  ): void {
    const s = this.viewScale;
    this.context.save();
    this.context.fillStyle = color;
    this.context.font = `${fontWeight} ${fontSize * s}px ${fontFamily}`;
    this.context.textAlign = align;
    this.context.textBaseline = 'top';
    const textX =
      (align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x) * s +
      this.viewOffsetX;
    const textY = y * s + this.viewOffsetY;
    if (strokeColor !== null && strokeWidth > 0) {
      this.context.strokeStyle = strokeColor;
      this.context.lineWidth = strokeWidth * s;
      this.context.lineJoin = 'round';
      drawTrackedText(
        this.context,
        text,
        textX,
        textY,
        maxWidth * s,
        align,
        letterSpacing * s,
        true,
      );
    }
    drawTrackedText(
      this.context,
      text,
      textX,
      textY,
      maxWidth * s,
      align,
      letterSpacing * s,
    );
    this.context.restore();
  }

  public pushClip(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const s = this.viewScale;
    this.context.save();
    this.context.beginPath();
    this.context.rect(
      x * s + this.viewOffsetX,
      y * s + this.viewOffsetY,
      width * s,
      height * s,
    );
    this.context.clip();
  }

  public popClip(): void {
    this.context.restore();
  }

  public getGlobalAlpha(): number {
    return this.context.globalAlpha;
  }

  public setGlobalAlpha(alpha: number): void {
    this.context.globalAlpha = alpha;
  }

  public resetAlpha(): void {
    this.context.globalAlpha = 1;
  }

  public strokePath(positions: Vector[], color = '#000'): void {
    if (positions.length < 1) {
      return;
    }

    const s = this.viewScale;
    const [firstPosition, ...restPositions] = positions;

    this.context.beginPath();
    this.context.moveTo(
      firstPosition.x * s + this.viewOffsetX,
      firstPosition.y * s + this.viewOffsetY,
    );

    for (const position of restPositions) {
      this.context.lineTo(
        position.x * s + this.viewOffsetX,
        position.y * s + this.viewOffsetY,
      );
    }

    this.context.closePath();

    this.context.strokeStyle = color;
    this.context.stroke();
  }

  public strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color = '#000',
    lineWidth = 1,
  ): void {
    const s = this.viewScale;
    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.strokeRect(
      x * s + this.viewOffsetX,
      y * s + this.viewOffsetY,
      width * s,
      height * s,
    );
  }
}
