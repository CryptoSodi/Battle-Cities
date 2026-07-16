type CanvasTextContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export function measureTrackedTextWidth(
  context: CanvasTextContext,
  text: string,
  letterSpacing: number,
): number {
  const glyphs = Array.from(text);
  const glyphWidth = glyphs.reduce((width, glyph) => {
    return width + context.measureText(glyph).width;
  }, 0);

  return glyphWidth + Math.max(0, glyphs.length - 1) * letterSpacing;
}

export function drawTrackedText(
  context: CanvasTextContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign,
  letterSpacing: number,
  stroke = false,
): void {
  const glyphs = Array.from(text);
  if (glyphs.length < 2 || letterSpacing <= 0) {
    context.textAlign = align;
    if (stroke) {
      context.strokeText(text, x, y, maxWidth);
    } else {
      context.fillText(text, x, y, maxWidth);
    }
    return;
  }

  const glyphWidths = glyphs.map((glyph) => context.measureText(glyph).width);
  const glyphWidth = glyphWidths.reduce((total, width) => total + width, 0);
  if (glyphWidth >= maxWidth) {
    context.textAlign = align;
    if (stroke) {
      context.strokeText(text, x, y, maxWidth);
    } else {
      context.fillText(text, x, y, maxWidth);
    }
    return;
  }

  const spacing = Math.min(
    letterSpacing,
    (maxWidth - glyphWidth) / (glyphs.length - 1),
  );
  const textWidth = glyphWidth + spacing * (glyphs.length - 1);
  let cursorX = x;
  if (align === 'center') {
    cursorX -= textWidth / 2;
  } else if (align === 'right' || align === 'end') {
    cursorX -= textWidth;
  }

  context.textAlign = 'left';
  glyphs.forEach((glyph, index) => {
    if (stroke) {
      context.strokeText(glyph, cursorX, y);
    } else {
      context.fillText(glyph, cursorX, y);
    }
    cursorX += glyphWidths[index] + spacing;
  });
}
