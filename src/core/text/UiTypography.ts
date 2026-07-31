const USE_MOBILE_READABLE_FONT =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;

export const UI_FONT_FAMILY = USE_MOBILE_READABLE_FONT
  ? 'Roboto, Arial, Helvetica, sans-serif'
  : '"Battle Cities UI", "Arial Narrow", "Segoe UI", Arial, sans-serif';

export const UI_TEXT_STROKE_COLOR = '#030506';
export const UI_TEXT_STROKE_WIDTH = USE_MOBILE_READABLE_FONT ? 0.3 : 0.65;
export const UI_TEXT_LETTER_SPACING = 1;
