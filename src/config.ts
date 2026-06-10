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

export const BORDER_LEFT_WIDTH = 64;
export const BORDER_RIGHT_WIDTH = 128;
export const BORDER_TOP_BOTTOM_HEIGHT = 32;
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
    y: BORDER_TOP_BOTTOM_HEIGHT,
    width: BORDER_LEFT_WIDTH,
    height: FIELD_SIZE,
  },
  // Right
  {
    x: BORDER_LEFT_WIDTH + FIELD_SIZE,
    y: BORDER_TOP_BOTTOM_HEIGHT,
    width: BORDER_RIGHT_WIDTH,
    height: FIELD_SIZE,
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
      y: BORDER_TOP_BOTTOM_HEIGHT,
      width: BORDER_LEFT_WIDTH,
      height: fieldHeight,
    },
    {
      x: BORDER_LEFT_WIDTH + fieldWidth,
      y: BORDER_TOP_BOTTOM_HEIGHT,
      width: BORDER_RIGHT_WIDTH,
      height: fieldHeight,
    },
  ];
}

const BASE_CANVAS_WIDTH =
  VIEWPORT_FIELD_SIZE + BORDER_LEFT_WIDTH + BORDER_RIGHT_WIDTH;
const BASE_CANVAS_HEIGHT =
  VIEWPORT_FIELD_SIZE + BORDER_TOP_BOTTOM_HEIGHT * 2;

function getViewportAspectRatio(): number {
  if (typeof window === 'undefined') {
    return BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;
  }

  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);

  return width / height;
}

function snapCanvasWidth(width: number): number {
  return Math.ceil(width / TILE_SIZE_MEDIUM) * TILE_SIZE_MEDIUM;
}

export const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT;
export function getResponsiveCanvasWidth(): number {
  return Math.max(
    BASE_CANVAS_WIDTH,
    snapCanvasWidth(CANVAS_HEIGHT * getViewportAspectRatio()),
  );
}

export const CANVAS_WIDTH = getResponsiveCanvasWidth();

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
