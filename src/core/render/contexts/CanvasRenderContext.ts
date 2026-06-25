import { ImageSource } from '../../graphics';

import { Rect } from '../../Rect';
import { Vector } from '../../Vector';

import { RenderContext } from '../RenderContext';

export class CanvasRenderContext extends RenderContext {
  private context: NativeContext;
  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;

  public init(): void {
    this.context = this.canvas.getContext('2d');
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
  ): void {
    const s = this.viewScale;
    this.context.drawImage(
      imageSource.getElement(),
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      Math.round(destinationRect.x * s + this.viewOffsetX),
      Math.round(destinationRect.y * s + this.viewOffsetY),
      destinationRect.width * s,
      destinationRect.height * s,
    );
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
