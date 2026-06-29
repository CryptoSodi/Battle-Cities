export const IS_DEV = process.env.NODE_ENV === 'development';
export const IS_PROD = process.env.NODE_ENV === 'production';

export const TILE_SIZE_SMALL = 16;
export const TILE_SIZE_MEDIUM = 32;
export const TILE_SIZE_LARGE = 64;

export const LEGACY_FIELD_TILE_COUNT = 13;
export const FIELD_TILE_COUNT = 20;
export const FIELD_TILE_COUNT_WIDTH = FIELD_TILE_COUNT;
export const FIELD_TILE_COUNT_HEIGHT = FIELD_TILE_COUNT;
export const VIEWPORT_FIELD_TILE_COUNT = 16;
export const LEGACY_FIELD_SIZE = LEGACY_FIELD_TILE_COUNT * TILE_SIZE_LARGE;
export const FIELD_SIZE = FIELD_TILE_COUNT * TILE_SIZE_LARGE;
export const VIEWPORT_FIELD_SIZE =
  VIEWPORT_FIELD_TILE_COUNT * TILE_SIZE_LARGE;
export const FIELD_CONTENT_OFFSET_X = 0;
export const FIELD_CONTENT_OFFSET_Y = FIELD_SIZE - LEGACY_FIELD_SIZE;

export const BORDER_LEFT_WIDTH = 32;
export const BORDER_RIGHT_WIDTH = 32;
export const BORDER_TOP_BOTTOM_HEIGHT = 32;
export const LEVEL_INFO_HEIGHT = 64;
export const LEVEL_PLAY_TOP_OFFSET = LEVEL_INFO_HEIGHT;
export const BORDER_RECTS = [
  // Top
  {
    x: 0,
    y: 0,
    width: BORDER_LEFT_WIDTH + FIELD_SIZE + BORDER_RIGHT_WIDTH,
    height: BORDER_TOP_BOTTOM_HEIGHT,
  },
  // Bottom
  {
    x: 0,
    y: FIELD_SIZE + BORDER_TOP_BOTTOM_HEIGHT,
    width: BORDER_LEFT_WIDTH + FIELD_SIZE + BORDER_RIGHT_WIDTH,
    height: BORDER_TOP_BOTTOM_HEIGHT,
  },
  // Left
  {
    x: 0,
    y: 0,
    width: BORDER_LEFT_WIDTH,
    height: FIELD_SIZE + BORDER_TOP_BOTTOM_HEIGHT * 2,
  },
  // Right
  {
    x: BORDER_LEFT_WIDTH + FIELD_SIZE,
    y: 0,
    width: BORDER_RIGHT_WIDTH,
    height: FIELD_SIZE + BORDER_TOP_BOTTOM_HEIGHT * 2,
  },
];

export function getFieldPixelSize(tileCount: number): number {
  return tileCount * TILE_SIZE_LARGE;
}

export function getBorderRects(fieldWidth: number, fieldHeight: number) {
  return [
    {
      x: 0,
      y: 0,
      width: BORDER_LEFT_WIDTH + fieldWidth + BORDER_RIGHT_WIDTH,
      height: BORDER_TOP_BOTTOM_HEIGHT,
    },
    {
      x: 0,
      y: fieldHeight + BORDER_TOP_BOTTOM_HEIGHT,
      width: BORDER_LEFT_WIDTH + fieldWidth + BORDER_RIGHT_WIDTH,
      height: BORDER_TOP_BOTTOM_HEIGHT,
    },
    {
      x: 0,
      y: 0,
      width: BORDER_LEFT_WIDTH,
      height: fieldHeight + BORDER_TOP_BOTTOM_HEIGHT * 2,
    },
    {
      x: BORDER_LEFT_WIDTH + fieldWidth,
      y: 0,
      width: BORDER_RIGHT_WIDTH,
      height: fieldHeight + BORDER_TOP_BOTTOM_HEIGHT * 2,
    },
  ];
}

const BASE_CANVAS_WIDTH =
  VIEWPORT_FIELD_SIZE + BORDER_LEFT_WIDTH + BORDER_RIGHT_WIDTH;
const BASE_CANVAS_HEIGHT =
  LEVEL_PLAY_TOP_OFFSET + VIEWPORT_FIELD_SIZE + BORDER_TOP_BOTTOM_HEIGHT * 2;

function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return {
      width: BASE_CANVAS_WIDTH,
      height: BASE_CANVAS_HEIGHT,
    };
  }

  return {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1),
  };
}

export function getResponsiveCanvasSize(): { width: number; height: number } {
  const viewportSize = getViewportSize();
  const viewportAspectRatio = viewportSize.width / viewportSize.height;
  const baseAspectRatio = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;

  if (viewportAspectRatio >= baseAspectRatio) {
    return {
      width: Math.ceil(BASE_CANVAS_HEIGHT * viewportAspectRatio),
      height: BASE_CANVAS_HEIGHT,
    };
  }

  return {
    width: BASE_CANVAS_WIDTH,
    height: Math.ceil(BASE_CANVAS_WIDTH / viewportAspectRatio),
  };
}

const RESPONSIVE_CANVAS_SIZE = getResponsiveCanvasSize();

export const CANVAS_WIDTH = RESPONSIVE_CANVAS_SIZE.width;
export const CANVAS_HEIGHT = RESPONSIVE_CANVAS_SIZE.height;

// Gameplay-only camera zoom (render-time scale of the field subtree; the HUD
// and menus are unaffected). The zoom is chosen so the play area always shows
// ~TARGET_TILES_WIDE medium (32px) tiles across, regardless of screen size —
// so wider screens get more zoom to keep the tile count constant. Recomputed
// on resize because the resize handler reloads the page. ZOOM_MIN/MAX are just
// safety rails for extreme viewports.
export const TARGET_TILES_WIDE = 34.5;
export const CLASSIC_TARGET_TILES_WIDE = 27;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 6;

export function getResponsiveZoom(targetTilesWide = TARGET_TILES_WIDE): number {
  const playWidth = CANVAS_WIDTH - BORDER_LEFT_WIDTH - BORDER_RIGHT_WIDTH;
  const zoom = playWidth / (targetTilesWide * TILE_SIZE_MEDIUM);
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

export const GAMEPLAY_ZOOM = getResponsiveZoom();
export const ZOOM_OUT_POWERUP_MULTIPLIER = 0.72;
export const ZOOM_OUT_POWERUP_DURATION = 10;
export const SPEED_POWERUP_MULTIPLIER = 1.45;
export const SPEED_POWERUP_DURATION = 10;

// Supersampling factor: the canvas backing store renders at this multiple of
// the logical size, so HD art (authored at 4x) resolves to full detail on
// screen instead of being sampled down to the gameplay tile size. Gameplay and
// world coordinates are unaffected. Lower to 2 for weaker GPUs.
export const RENDER_SCALE = 4;

export const BRICK_TILE_SIZE = TILE_SIZE_SMALL;
export const BRICK_SUPER_TILE_SIZE = TILE_SIZE_MEDIUM;
export const STEEL_TILE_SIZE = TILE_SIZE_MEDIUM;
export const JUNGLE_TILE_SIZE = TILE_SIZE_MEDIUM;
export const WATER_TILE_SIZE = TILE_SIZE_MEDIUM;
export const ICE_TILE_SIZE = TILE_SIZE_MEDIUM;

export const BULLET_WIDTH = 12;

export const PLAYER_FIRST_SPAWN_DELAY = 0;
export const PLAYER_SPAWN_DELAY = 0;
export const ENEMY_FIRST_SPAWN_DELAY = 0.16;
export const ENEMY_SPAWN_DELAY = 3;

export const ENEMY_MAX_TOTAL_COUNT = 20;
export const ENEMY_MAX_ALIVE_COUNT = 4;
export const ENEMY_MAX_ALIVE_COUNT_MULTIPLAYER = 6;

export const POWERUP_DURATION = 30;
export const SHIELD_SPAWN_DURATION = 3.5;
export const SHIELD_POWERUP_DURATION = 10;
export const BASE_DEFENCE_POWERUP_DURATION = 17;
export const FREEZE_POWERUP_DURATION = 10;

export const FRIENDLY_FIRE_STUN_DURATION = 5;
export const ICE_SLIDE_DURATION = 0.5;

export const POINTS_POWERUP_DURATION = 0.8;
export const POINTS_ENEMY_TANK_DURATION = 0.16;

export const LEVEL_START_DELAY = 2;

export const PLAYER_INITIAL_LIVES = 3;
export const PLAYER_EXTRA_LIVE_POINTS = 20000;
export const DEFAULT_HIGHSCORE = 20000;
export const BONUS_POINTS = 1000;

export const COLOR_BACKDROP = 'rgba(0,0,0,0.7)';
export const COLOR_GRAY = '#636363';
export const COLOR_GRAY_LIGHT = '#737373';
export const COLOR_BLACK = '#000';
export const COLOR_WHITE = '#fff';
export const COLOR_RED = '#d74000';
export const COLOR_YELLOW = '#ffae0a';
export const COLOR_STAGE_BACKGROUND = '#102816';

export const PRIMARY_SPRITE_FONT_ID = 'primary';
export const PRIMARY_RECT_FONT_ID = 'primary';

export const STORAGE_NAMESPACE = 'cattle-bity';
export const STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY = 'points.highscore.primary';
export const STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY =
  'points.highscore.secondary';
export const STORAGE_KEY_SETTINGS_INPUT_BINDINGS_PREFIX =
  'settings.input.bindings';
export const STORAGE_KEY_SETTINGS_AUDIO_MUTED = 'settings.audio-muted';
export const STORAGE_KEY_SETTINGS_SEEN_LEVEL_HINT = 'settings.seen-level-hint';
export const STORAGE_KEY_SETTINGS_SEEN_EDITOR_HINT =
  'settings.seen-editor-hint';
export const STORAGE_KEY_SETTINGS_SHOW_LEVEL_HINT = 'settings.show-level-hint';
export const STORAGE_KEY_SETTINGS_SHOW_EDITOR_HINT =
  'settings.show-editor-hint';
export const STORAGE_KEY_SETTINGS_SHOW_SCANLINES = 'settings.show-scanlines';

export const PLAYER_DEFAULT_SPAWN_POSITIONS = [
  { x: FIELD_CONTENT_OFFSET_X + 256, y: FIELD_CONTENT_OFFSET_Y + 768 },
  { x: FIELD_CONTENT_OFFSET_X + 512, y: FIELD_CONTENT_OFFSET_Y + 768 },
];
export const ENEMY_DEFAULT_SPAWN_POSITIONS = [
  { x: FIELD_CONTENT_OFFSET_X + 384, y: FIELD_CONTENT_OFFSET_Y + 0 },
  { x: FIELD_CONTENT_OFFSET_X + 768, y: FIELD_CONTENT_OFFSET_Y + 0 },
  { x: FIELD_CONTENT_OFFSET_X + 0, y: FIELD_CONTENT_OFFSET_Y + 0 },
];
export const BASE_DEFAULT_POSITION = {
  x: FIELD_CONTENT_OFFSET_X + 352,
  y: FIELD_CONTENT_OFFSET_Y + 736,
};
export const BASE_DEFAULT_SIZE = { width: 128, height: 96 };

export const MENU_TITLE_DEFAULT_POSITION = {
  x: 112,
  y: 96,
};
export const MENU_DEFAULT_POSITION = {
  x: 16,
  y: 192,
};

export const GROUND_FIELD_Z_INDEX = -1000;
export const WALL_SHADOW_Z_INDEX = -900;
// Shadow is cast down-and-to-the-side, fading out toward its far edge. It is
// faked as several silhouettes stepped outward to the max offset: near the wall
// many steps overlap (dark), at the far edge only the last step reaches (faint).
// A larger X than Y reads as a wall with a visible side face (more depth).
export const WALL_SHADOW_OFFSET_X = 9;
export const WALL_SHADOW_OFFSET_Y = 6;
export const WALL_SHADOW_STEPS = 6;
export const WALL_SHADOW_COLOR = '#000000';
// Per-step alpha; near-edge darkness ≈ 1 - (1 - alpha)^STEPS.
export const WALL_SHADOW_ALPHA = 0.14;

// Drop shadow for brick text (e.g. the menu title). Tighter than the wall
// shadow since the letter tiles are small.
export const TEXT_SHADOW_OFFSET_X = 6;
export const TEXT_SHADOW_OFFSET_Y = 6;
export const TEXT_SHADOW_STEPS = 5;
export const TEXT_SHADOW_ALPHA = 0.1;

export const BRICK_TILE_Z_INDEX = 0;
export const STEEL_TILE_Z_INDEX = 0;
export const WATER_TILE_Z_INDEX = 0;
export const ICE_TILE_Z_INDEX = 0;
export const BORDER_WALL_Z_INDEX = 0;
export const BASE_HEART_Z_INDEX = 0;
export const LEVEL_INFO_Z_INDEX = 1;
export const ENEMY_TANK_Z_INDEX = 1;
export const PLAYER_TANK_Z_INDEX = 2;
export const BULLET_Z_INDEX = 3;
export const SHIELD_Z_INDEX = 3;
export const SMALL_EXPLOSION_Z_INDEX = 4;
export const SPAWN_Z_INDEX = 4;
export const JUNGLE_TILE_Z_INDEX = 5;
export const EDITOR_TOOL_Z_INDEX = 6;
export const LARGE_EXPLOSION_Z_INDEX = 6;
export const EDITOR_BRUSH_Z_INDEX = 7;
export const POWERUP_Z_INDEX = 7;
export const POINTS_Z_INDEX = 7;
export const PAUSE_NOTICE_Z_INDEX = 8;
export const GAME_OVER_NOTICE_Z_INDEX = 8;
export const CURTAIN_Z_INDEX = 9;
export const LEVEL_TITLE_Z_INDEX = 10;
export const MODAL_Z_INDEX = 11;
export const DEBUG_COLLISION_RECT_Z_INDEX = 20;
export const DEBUG_GRID_Z_INDEX = 21;

export const GITHUB_URL = 'https://github.com/dogballs/cattle-bity';
