import {
  GameObject,
  Size,
  TextAlignment,
  TextOptions,
} from '../../core';
import { Painter } from '../../core/Painter';
import { RenderObject } from '../../core/RenderObject';
import { RenderContext } from '../../core/render';
import * as config from '../../config';
import {
  UI_FONT_FAMILY,
  UI_TEXT_STROKE_COLOR,
  UI_TEXT_STROKE_WIDTH,
} from '../../core/text/UiTypography';

export interface SpriteTextOptions extends TextOptions {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

const DEFAULT_OPTIONS: SpriteTextOptions = {
  alignment: TextAlignment.Left,
  color: config.COLOR_BLACK,
  fontFamily: UI_FONT_FAMILY,
  fontSize: 24,
  fontWeight: '700',
  letterSpacing: 0,
  lineSpacing: 8,
  opacity: 1,
  strokeColor: UI_TEXT_STROKE_COLOR,
  strokeWidth: UI_TEXT_STROKE_WIDTH,
};

class NativeSpriteTextPainter extends Painter {
  public text = '';
  public color = config.COLOR_BLACK;
  public opacity = 1;
  public fontFamily = UI_FONT_FAMILY;
  public fontSize = 24;
  public fontWeight = '700';
  public lineSpacing = 8;
  public maxWidth = 1;
  public alignment = TextAlignment.Left;
  public strokeColor = UI_TEXT_STROKE_COLOR;
  public strokeWidth = UI_TEXT_STROKE_WIDTH;

  public paint(context: RenderContext, renderObject: RenderObject): void {
    const { min } = renderObject.getWorldBoundingBox();
    const previousAlpha = context.getGlobalAlpha();
    const lineHeight = Math.ceil(this.fontSize * 1.18);
    const align = this.getCanvasAlignment();

    if (this.opacity !== 1) {
      context.setGlobalAlpha(previousAlpha * this.opacity);
    }

    this.text.split('\n').forEach((line, index) => {
      context.drawText(
        line,
        min.x,
        min.y + index * (lineHeight + this.lineSpacing),
        this.maxWidth,
        this.fontSize,
        this.fontFamily,
        this.fontWeight,
        this.color,
        align,
        this.strokeColor,
        this.strokeWidth,
      );
    });

    if (this.opacity !== 1) {
      context.setGlobalAlpha(previousAlpha);
    }
  }

  private getCanvasAlignment(): CanvasTextAlign {
    if (this.alignment === TextAlignment.Center) {
      return 'center';
    }
    if (this.alignment === TextAlignment.Right) {
      return 'right';
    }
    return 'left';
  }
}

export class SpriteText extends GameObject {
  public painter = new NativeSpriteTextPainter();
  private text: string;
  private readonly options: SpriteTextOptions;

  constructor(text = '', options: SpriteTextOptions = {}) {
    super();

    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.text = text;

    this.painter.text = text;
    this.painter.color = this.options.color;
    this.painter.opacity = this.options.opacity;
    this.painter.fontFamily = this.options.fontFamily;
    this.painter.fontSize = this.options.fontSize;
    this.painter.fontWeight = this.options.fontWeight;
    this.painter.lineSpacing = this.options.lineSpacing;
    this.painter.alignment = this.options.alignment;
    this.painter.strokeColor = this.options.strokeColor;
    this.painter.strokeWidth = this.options.strokeWidth;

    this.updateTextSize();
  }

  public setColor(color: string): void {
    this.painter.color = color;
    this.setNeedsPaint();
  }

  public setText(text: string): void {
    this.dirtyPaintBox();
    this.text = text;
    this.painter.text = text;
    this.updateTextSize();
    this.updateMatrix();
    this.setNeedsPaint();
  }

  public getTextSize(): Size {
    return new Size(this.size.width, this.size.height);
  }

  private updateTextSize(): void {
    const lines = this.text.split('\n');
    const fontSize = this.options.fontSize;
    const letterSpacing = this.options.letterSpacing;
    const lineHeight = Math.ceil(fontSize * 1.18);
    const lineSpacing = this.options.lineSpacing;
    const context = this.getMeasureContext();
    let width = 1;

    if (context !== null) {
      context.font = `${this.options.fontWeight} ${fontSize}px ${this.options.fontFamily}`;
    }

    lines.forEach((line) => {
      const measuredWidth = context === null
        ? line.length * fontSize * 0.56
        : context.measureText(line).width;
      width = Math.max(
        width,
        measuredWidth + Math.max(0, line.length - 1) * letterSpacing,
      );
    });

    const height =
      lines.length * lineHeight + Math.max(0, lines.length - 1) * lineSpacing;
    this.size.set(Math.ceil(width + this.options.strokeWidth * 2), height);
    this.painter.maxWidth = this.size.width;
  }

  private getMeasureContext(): CanvasRenderingContext2D {
    if (typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    return canvas.getContext('2d');
  }
}
