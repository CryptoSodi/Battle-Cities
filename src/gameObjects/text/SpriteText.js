"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteText = void 0;
const core_1 = require("../../core");
const Painter_1 = require("../../core/Painter");
const config = __importStar(require("../../config"));
const UiTypography_1 = require("../../core/text/UiTypography");
const CanvasText_1 = require("../../core/text/CanvasText");
const DEFAULT_OPTIONS = {
    alignment: core_1.TextAlignment.Left,
    color: config.COLOR_BLACK,
    fontFamily: UiTypography_1.UI_FONT_FAMILY,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: UiTypography_1.UI_TEXT_LETTER_SPACING,
    lineSpacing: 8,
    opacity: 1,
    strokeColor: UiTypography_1.UI_TEXT_STROKE_COLOR,
    strokeWidth: UiTypography_1.UI_TEXT_STROKE_WIDTH,
};
class NativeSpriteTextPainter extends Painter_1.Painter {
    constructor() {
        super(...arguments);
        this.text = '';
        this.color = config.COLOR_BLACK;
        this.opacity = 1;
        this.fontFamily = UiTypography_1.UI_FONT_FAMILY;
        this.fontSize = 24;
        this.fontWeight = '700';
        this.lineSpacing = 8;
        this.letterSpacing = UiTypography_1.UI_TEXT_LETTER_SPACING;
        this.maxWidth = 1;
        this.alignment = core_1.TextAlignment.Left;
        this.strokeColor = UiTypography_1.UI_TEXT_STROKE_COLOR;
        this.strokeWidth = UiTypography_1.UI_TEXT_STROKE_WIDTH;
    }
    paint(context, renderObject) {
        const { min } = renderObject.getWorldBoundingBox();
        const previousAlpha = context.getGlobalAlpha();
        const lineHeight = Math.ceil(this.fontSize * 1.18);
        const align = this.getCanvasAlignment();
        if (this.opacity !== 1) {
            context.setGlobalAlpha(previousAlpha * this.opacity);
        }
        this.text.split('\n').forEach((line, index) => {
            context.drawText(line, min.x, min.y + index * (lineHeight + this.lineSpacing), this.maxWidth, this.fontSize, this.fontFamily, this.fontWeight, this.color, align, this.strokeColor, this.strokeWidth, this.letterSpacing);
        });
        if (this.opacity !== 1) {
            context.setGlobalAlpha(previousAlpha);
        }
    }
    getCanvasAlignment() {
        if (this.alignment === core_1.TextAlignment.Center) {
            return 'center';
        }
        if (this.alignment === core_1.TextAlignment.Right) {
            return 'right';
        }
        return 'left';
    }
}
class SpriteText extends core_1.GameObject {
    constructor(text = '', options = {}) {
        super();
        this.painter = new NativeSpriteTextPainter();
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.text = text;
        this.painter.text = text;
        this.painter.color = this.options.color;
        this.painter.opacity = this.options.opacity;
        this.painter.fontFamily = this.options.fontFamily;
        this.painter.fontSize = this.options.fontSize;
        this.painter.fontWeight = this.options.fontWeight;
        this.painter.lineSpacing = this.options.lineSpacing;
        this.painter.letterSpacing = this.options.letterSpacing;
        this.painter.alignment = this.options.alignment;
        this.painter.strokeColor = this.options.strokeColor;
        this.painter.strokeWidth = this.options.strokeWidth;
        this.updateTextSize();
    }
    setColor(color) {
        this.painter.color = color;
        this.setNeedsPaint();
    }
    setText(text) {
        this.dirtyPaintBox();
        this.text = text;
        this.painter.text = text;
        this.updateTextSize();
        this.updateMatrix();
        this.setNeedsPaint();
    }
    getTextSize() {
        return new core_1.Size(this.size.width, this.size.height);
    }
    updateTextSize() {
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
                ? line.length * fontSize * 0.56 +
                    Math.max(0, Array.from(line).length - 1) * letterSpacing
                : (0, CanvasText_1.measureTrackedTextWidth)(context, line, letterSpacing);
            width = Math.max(width, measuredWidth);
        });
        const height = lines.length * lineHeight + Math.max(0, lines.length - 1) * lineSpacing;
        this.size.set(Math.ceil(width + this.options.strokeWidth * 2), height);
        this.painter.maxWidth = this.size.width;
    }
    getMeasureContext() {
        if (typeof document === 'undefined') {
            return null;
        }
        const canvas = document.createElement('canvas');
        return canvas.getContext('2d');
    }
}
exports.SpriteText = SpriteText;
