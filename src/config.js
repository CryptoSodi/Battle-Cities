"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIO_MUSIC_VOLUME = exports.AUDIO_SFX_VOLUME = exports.AUDIO_MASTER_INTENSITY = exports.AUDIO_MASTER_VOLUME = exports.PARTICLE_INTENSITY = exports.CAMERA_SHAKE_INTENSITY = exports.CAMERA_MAX_SHAKE = exports.CAMERA_TRAUMA_DECAY = exports.CAMERA_LOOK_AHEAD_LERP = exports.CAMERA_LOOK_AHEAD = exports.CAMERA_SNAP_THRESHOLD = exports.CAMERA_FOLLOW_LERP = exports.SPEED_POWERUP_DURATION = exports.SPEED_POWERUP_MULTIPLIER = exports.ZOOM_OUT_POWERUP_DURATION = exports.ZOOM_OUT_POWERUP_MULTIPLIER = exports.GAMEPLAY_ZOOM = exports.getResponsiveZoom = exports.ZOOM_MAX = exports.ZOOM_MIN = exports.MOBILE_TARGET_TILES_WIDE = exports.CLASSIC_TARGET_TILES_WIDE = exports.TARGET_TILES_WIDE = exports.CANVAS_HEIGHT = exports.CANVAS_WIDTH = exports.getResponsiveCanvasSize = exports.isMobileTouchViewport = exports.getBorderRects = exports.getFieldPixelSize = exports.BORDER_RECTS = exports.LEVEL_PLAY_TOP_OFFSET = exports.LEVEL_INFO_HEIGHT = exports.BORDER_TOP_BOTTOM_HEIGHT = exports.BORDER_RIGHT_WIDTH = exports.BORDER_LEFT_WIDTH = exports.FIELD_CONTENT_OFFSET_Y = exports.FIELD_CONTENT_OFFSET_X = exports.VIEWPORT_FIELD_SIZE = exports.FIELD_SIZE = exports.LEGACY_FIELD_SIZE = exports.VIEWPORT_FIELD_TILE_COUNT = exports.FIELD_TILE_COUNT_HEIGHT = exports.FIELD_TILE_COUNT_WIDTH = exports.FIELD_TILE_COUNT = exports.LEGACY_FIELD_TILE_COUNT = exports.TILE_SIZE_LARGE = exports.TILE_SIZE_MEDIUM = exports.TILE_SIZE_SMALL = exports.IS_PROD = exports.IS_DEV = void 0;
exports.COLOR_BACKDROP = exports.BONUS_POINTS = exports.DEFAULT_HIGHSCORE = exports.PLAYER_EXTRA_LIVE_POINTS = exports.PLAYER_INITIAL_LIVES = exports.LEVEL_START_DELAY = exports.POINTS_ENEMY_TANK_DURATION = exports.POINTS_POWERUP_DURATION = exports.ICE_SLIDE_DURATION = exports.FRIENDLY_FIRE_STUN_DURATION = exports.FREEZE_POWERUP_DURATION = exports.BASE_DEFENCE_POWERUP_DURATION = exports.SHIELD_POWERUP_DURATION = exports.SHIELD_SPAWN_DURATION = exports.POWERUP_DURATION = exports.ENEMY_MAX_ALIVE_COUNT_MULTIPLAYER = exports.ENEMY_MAX_ALIVE_COUNT = exports.ENEMY_MAX_TOTAL_COUNT = exports.ENEMY_SPAWN_DELAY = exports.ENEMY_FIRST_SPAWN_DELAY = exports.PLAYER_SPAWN_DELAY = exports.PLAYER_FIRST_SPAWN_DELAY = exports.BULLET_WIDTH = exports.ICE_TILE_SIZE = exports.WATER_TILE_SIZE = exports.JUNGLE_TILE_SIZE = exports.STEEL_TILE_SIZE = exports.BRICK_SUPER_TILE_SIZE = exports.BRICK_TILE_SIZE = exports.MOBILE_RENDER_SCALE = exports.RENDER_SCALE = exports.HIT_SPARK_COUNT = exports.TREAD_DUST_DISTANCE = exports.SHOW_EXPLOSION_SPRITE = exports.ENEMY_DROP_BLINK_ALPHA = exports.ENEMY_DROP_BLINK_COLOR = exports.ENEMY_DROP_BLINK_INTERVAL = exports.SPRITE_FLASH_DECAY_SECONDS = exports.SPRITE_FLASH_HIT = exports.FLASH_BASE_DIED = exports.FLASH_PLAYER_DIED = exports.HIT_STOP_DEATH = exports.HIT_STOP_KILL = exports.CAMERA_TRAUMA_BASE_DIED = exports.CAMERA_TRAUMA_PLAYER_DIED = exports.CAMERA_TRAUMA_ENEMY_EXPLODE = exports.CAMERA_TRAUMA_TILE = exports.CAMERA_TRAUMA_FIRE = exports.CAMERA_DEATH_HOLD = exports.AUDIO_VOLUME_STEPS = void 0;
exports.TEXT_SHADOW_ALPHA = exports.TEXT_SHADOW_STEPS = exports.TEXT_SHADOW_OFFSET_Y = exports.TEXT_SHADOW_OFFSET_X = exports.WALL_SHADOW_ALPHA = exports.WALL_SHADOW_COLOR = exports.WALL_SHADOW_STEPS = exports.WALL_SHADOW_OFFSET_Y = exports.WALL_SHADOW_OFFSET_X = exports.WALL_SHADOW_Z_INDEX = exports.GROUND_FIELD_Z_INDEX = exports.MENU_DEFAULT_POSITION = exports.MENU_TITLE_DEFAULT_POSITION = exports.BASE_DEFAULT_SIZE = exports.BASE_DEFAULT_POSITION = exports.ENEMY_DEFAULT_SPAWN_POSITIONS = exports.PLAYER_DEFAULT_SPAWN_POSITIONS = exports.SHOP_RUN_FUEL_COST = exports.SHOP_GUEST_INVENTORY_COUNT = exports.SHOP_GUEST_FUEL_BALANCE = exports.SHOP_STARTING_SOL_BALANCE = exports.SHOP_STARTING_TOKEN_BALANCE = exports.STORAGE_KEY_SHOP_TX_INDEX = exports.STORAGE_KEY_SHOP_LOADOUT = exports.STORAGE_KEY_SHOP_INVENTORY = exports.STORAGE_KEY_SHOP_FUEL_BALANCE = exports.STORAGE_KEY_SHOP_SOL_BALANCE = exports.STORAGE_KEY_SHOP_TOKEN_BALANCE = exports.STORAGE_KEY_SHOP_WALLET_ADDRESS = exports.STORAGE_KEY_SHOP_WALLET_CONNECTED = exports.STORAGE_KEY_SETTINGS_SHOW_SCANLINES = exports.STORAGE_KEY_SETTINGS_SHOW_EDITOR_HINT = exports.STORAGE_KEY_SETTINGS_SHOW_LEVEL_HINT = exports.STORAGE_KEY_SETTINGS_SEEN_EDITOR_HINT = exports.STORAGE_KEY_SETTINGS_SEEN_LEVEL_HINT = exports.STORAGE_KEY_SETTINGS_AUDIO_VOLUME = exports.STORAGE_KEY_SETTINGS_AUDIO_MUTED = exports.STORAGE_KEY_SETTINGS_INPUT_BINDINGS_PREFIX = exports.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY = exports.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY = exports.STORAGE_NAMESPACE = exports.PRIMARY_RECT_FONT_ID = exports.PRIMARY_SPRITE_FONT_ID = exports.COLOR_STAGE_BACKGROUND = exports.COLOR_YELLOW = exports.COLOR_RED = exports.COLOR_WHITE = exports.COLOR_BLACK = exports.COLOR_GRAY_LIGHT = exports.COLOR_GRAY = void 0;
exports.GITHUB_URL = exports.DEBUG_GRID_Z_INDEX = exports.DEBUG_COLLISION_RECT_Z_INDEX = exports.MODAL_Z_INDEX = exports.LEVEL_TITLE_Z_INDEX = exports.CURTAIN_Z_INDEX = exports.GAME_OVER_NOTICE_Z_INDEX = exports.PAUSE_NOTICE_Z_INDEX = exports.POINTS_Z_INDEX = exports.POWERUP_Z_INDEX = exports.EDITOR_BRUSH_Z_INDEX = exports.LARGE_EXPLOSION_Z_INDEX = exports.EDITOR_TOOL_Z_INDEX = exports.JUNGLE_TILE_Z_INDEX = exports.SPAWN_Z_INDEX = exports.SMALL_EXPLOSION_Z_INDEX = exports.SHIELD_Z_INDEX = exports.BULLET_Z_INDEX = exports.PLAYER_TANK_Z_INDEX = exports.ENEMY_TANK_Z_INDEX = exports.LEVEL_INFO_Z_INDEX = exports.BASE_HEART_Z_INDEX = exports.BORDER_WALL_Z_INDEX = exports.ICE_TILE_Z_INDEX = exports.WATER_TILE_Z_INDEX = exports.STEEL_TILE_Z_INDEX = exports.BRICK_TILE_Z_INDEX = void 0;
exports.IS_DEV = process.env.NODE_ENV === 'development';
exports.IS_PROD = process.env.NODE_ENV === 'production';
exports.TILE_SIZE_SMALL = 16;
exports.TILE_SIZE_MEDIUM = 32;
exports.TILE_SIZE_LARGE = 64;
exports.LEGACY_FIELD_TILE_COUNT = 13;
exports.FIELD_TILE_COUNT = 20;
exports.FIELD_TILE_COUNT_WIDTH = exports.FIELD_TILE_COUNT;
exports.FIELD_TILE_COUNT_HEIGHT = exports.FIELD_TILE_COUNT;
exports.VIEWPORT_FIELD_TILE_COUNT = 16;
exports.LEGACY_FIELD_SIZE = exports.LEGACY_FIELD_TILE_COUNT * exports.TILE_SIZE_LARGE;
exports.FIELD_SIZE = exports.FIELD_TILE_COUNT * exports.TILE_SIZE_LARGE;
exports.VIEWPORT_FIELD_SIZE = exports.VIEWPORT_FIELD_TILE_COUNT * exports.TILE_SIZE_LARGE;
exports.FIELD_CONTENT_OFFSET_X = 0;
exports.FIELD_CONTENT_OFFSET_Y = exports.FIELD_SIZE - exports.LEGACY_FIELD_SIZE;
exports.BORDER_LEFT_WIDTH = 32;
exports.BORDER_RIGHT_WIDTH = 32;
exports.BORDER_TOP_BOTTOM_HEIGHT = 32;
exports.LEVEL_INFO_HEIGHT = 64;
exports.LEVEL_PLAY_TOP_OFFSET = exports.LEVEL_INFO_HEIGHT;
exports.BORDER_RECTS = [
    // Top
    {
        x: 0,
        y: 0,
        width: exports.BORDER_LEFT_WIDTH + exports.FIELD_SIZE + exports.BORDER_RIGHT_WIDTH,
        height: exports.BORDER_TOP_BOTTOM_HEIGHT,
    },
    // Bottom
    {
        x: 0,
        y: exports.FIELD_SIZE + exports.BORDER_TOP_BOTTOM_HEIGHT,
        width: exports.BORDER_LEFT_WIDTH + exports.FIELD_SIZE + exports.BORDER_RIGHT_WIDTH,
        height: exports.BORDER_TOP_BOTTOM_HEIGHT,
    },
    // Left
    {
        x: 0,
        y: 0,
        width: exports.BORDER_LEFT_WIDTH,
        height: exports.FIELD_SIZE + exports.BORDER_TOP_BOTTOM_HEIGHT * 2,
    },
    // Right
    {
        x: exports.BORDER_LEFT_WIDTH + exports.FIELD_SIZE,
        y: 0,
        width: exports.BORDER_RIGHT_WIDTH,
        height: exports.FIELD_SIZE + exports.BORDER_TOP_BOTTOM_HEIGHT * 2,
    },
];
function getFieldPixelSize(tileCount) {
    return tileCount * exports.TILE_SIZE_LARGE;
}
exports.getFieldPixelSize = getFieldPixelSize;
function getBorderRects(fieldWidth, fieldHeight) {
    return [
        {
            x: 0,
            y: 0,
            width: exports.BORDER_LEFT_WIDTH + fieldWidth + exports.BORDER_RIGHT_WIDTH,
            height: exports.BORDER_TOP_BOTTOM_HEIGHT,
        },
        {
            x: 0,
            y: fieldHeight + exports.BORDER_TOP_BOTTOM_HEIGHT,
            width: exports.BORDER_LEFT_WIDTH + fieldWidth + exports.BORDER_RIGHT_WIDTH,
            height: exports.BORDER_TOP_BOTTOM_HEIGHT,
        },
        {
            x: 0,
            y: 0,
            width: exports.BORDER_LEFT_WIDTH,
            height: fieldHeight + exports.BORDER_TOP_BOTTOM_HEIGHT * 2,
        },
        {
            x: exports.BORDER_LEFT_WIDTH + fieldWidth,
            y: 0,
            width: exports.BORDER_RIGHT_WIDTH,
            height: fieldHeight + exports.BORDER_TOP_BOTTOM_HEIGHT * 2,
        },
    ];
}
exports.getBorderRects = getBorderRects;
const BASE_CANVAS_WIDTH = exports.VIEWPORT_FIELD_SIZE + exports.BORDER_LEFT_WIDTH + exports.BORDER_RIGHT_WIDTH;
const BASE_CANVAS_HEIGHT = exports.LEVEL_PLAY_TOP_OFFSET + exports.VIEWPORT_FIELD_SIZE + exports.BORDER_TOP_BOTTOM_HEIGHT * 2;
// Shop and shared panel screens use a 1240px content width with 24px gutters.
// Mobile scales this wider logical canvas down to the physical viewport so
// those screens fit without changing gameplay's camera framing.
const MOBILE_UI_CANVAS_WIDTH = 1288;
// Narrow desktop windows need the same minimum logical width; otherwise the
// fixed-width desktop panels are clipped before CSS scales the canvas.
const DESKTOP_UI_CANVAS_MIN_WIDTH = 1288;
function getViewportSize() {
    if (typeof window === 'undefined') {
        return {
            width: BASE_CANVAS_WIDTH,
            height: BASE_CANVAS_HEIGHT,
        };
    }
    const mobileTouchLayout = isMobileTouchViewport();
    return {
        width: Math.max(window.innerWidth, 1),
        height: Math.max(mobileTouchLayout
            ? Math.floor(window.innerHeight * 0.6)
            : window.innerHeight, 1),
    };
}
function isMobileTouchViewport() {
    return (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches);
}
exports.isMobileTouchViewport = isMobileTouchViewport;
function getResponsiveCanvasSize() {
    const viewportSize = getViewportSize();
    const viewportAspectRatio = viewportSize.width / viewportSize.height;
    if (isMobileTouchViewport()) {
        return {
            width: MOBILE_UI_CANVAS_WIDTH,
            height: Math.ceil(MOBILE_UI_CANVAS_WIDTH / viewportAspectRatio),
        };
    }
    const desktopCanvasWidth = Math.max(DESKTOP_UI_CANVAS_MIN_WIDTH, Math.ceil(BASE_CANVAS_HEIGHT * viewportAspectRatio));
    return {
        width: desktopCanvasWidth,
        height: Math.ceil(desktopCanvasWidth / viewportAspectRatio),
    };
}
exports.getResponsiveCanvasSize = getResponsiveCanvasSize;
const RESPONSIVE_CANVAS_SIZE = getResponsiveCanvasSize();
exports.CANVAS_WIDTH = RESPONSIVE_CANVAS_SIZE.width;
exports.CANVAS_HEIGHT = RESPONSIVE_CANVAS_SIZE.height;
// Gameplay-only camera zoom (render-time scale of the field subtree; the HUD
// and menus are unaffected). The zoom is chosen so the play area always shows
// ~TARGET_TILES_WIDE medium (32px) tiles across, regardless of screen size —
// so wider screens get more zoom to keep the tile count constant. Recomputed
// on resize because the resize handler reloads the page. ZOOM_MIN/MAX are just
// safety rails for extreme viewports.
exports.TARGET_TILES_WIDE = 34.5;
exports.CLASSIC_TARGET_TILES_WIDE = 27;
exports.MOBILE_TARGET_TILES_WIDE = 23;
exports.ZOOM_MIN = 0.5;
exports.ZOOM_MAX = 6;
function getResponsiveZoom(targetTilesWide = exports.TARGET_TILES_WIDE) {
    const playWidth = exports.CANVAS_WIDTH - exports.BORDER_LEFT_WIDTH - exports.BORDER_RIGHT_WIDTH;
    const zoom = playWidth / (targetTilesWide * exports.TILE_SIZE_MEDIUM);
    return Math.max(exports.ZOOM_MIN, Math.min(exports.ZOOM_MAX, zoom));
}
exports.getResponsiveZoom = getResponsiveZoom;
exports.GAMEPLAY_ZOOM = getResponsiveZoom();
exports.ZOOM_OUT_POWERUP_MULTIPLIER = 0.72;
exports.ZOOM_OUT_POWERUP_DURATION = 10;
exports.SPEED_POWERUP_MULTIPLIER = 1.45;
exports.SPEED_POWERUP_DURATION = 10;
// Reactive camera (follow-lerp, look-ahead, trauma shake). Purely cosmetic —
// it only translates the field for presentation and never affects the sim, so
// the shake may use unseeded Math.random without breaking replay determinism.
exports.CAMERA_FOLLOW_LERP = 0.2; // ease factor for large recenter jumps
// Below this distance the camera snaps to the target (crisp, lag-free play);
// larger jumps (e.g. death respawn recenter) ease in via CAMERA_FOLLOW_LERP.
exports.CAMERA_SNAP_THRESHOLD = 8;
exports.CAMERA_LOOK_AHEAD = 28; // logical px the view leads the player by
exports.CAMERA_LOOK_AHEAD_LERP = 0.08; // easing of the look-ahead offset
exports.CAMERA_TRAUMA_DECAY = 1.6; // trauma units drained per second
exports.CAMERA_MAX_SHAKE = 12; // logical px shake amplitude at trauma = 1
exports.CAMERA_SHAKE_INTENSITY = 1; // master scalar (0 disables shake)
// Particle overlay master scalar (reduced-motion / low-end). Scales emitted
// counts; 0 disables particle effects entirely.
exports.PARTICLE_INTENSITY = 1;
// Web Audio mixer (see core/AudioMixer). AUDIO_MASTER_VOLUME is the default
// master level (overridden by the persisted settings volume); the two bus
// levels balance impacts vs. ambient loops; AUDIO_MASTER_INTENSITY is the
// reduced-audio / low-end scalar layered on top of everything.
exports.AUDIO_MASTER_VOLUME = 1;
exports.AUDIO_MASTER_INTENSITY = 1;
exports.AUDIO_SFX_VOLUME = 1;
exports.AUDIO_MUSIC_VOLUME = 0.8;
// Discrete master-volume steps the audio settings menu cycles through.
exports.AUDIO_VOLUME_STEPS = [1, 0.75, 0.5, 0.25, 0];
// How long the camera holds on the player's death blast before releasing back
// to the spawn point (must be < PLAYER_SPAWN_DELAY so the pan lands first).
exports.CAMERA_DEATH_HOLD = 0.9;
// How much trauma [0..1] each event adds.
exports.CAMERA_TRAUMA_FIRE = 0.1;
exports.CAMERA_TRAUMA_TILE = 0.08;
exports.CAMERA_TRAUMA_ENEMY_EXPLODE = 0.42;
exports.CAMERA_TRAUMA_PLAYER_DIED = 0.6;
exports.CAMERA_TRAUMA_BASE_DIED = 0.85;
// Hit-stop (brief real-time simulation freeze) + white screen flash on impacts.
// Durations in seconds; flashes in [0..1]. Scaled by CAMERA_SHAKE_INTENSITY at
// the call sites so the reduced-motion switch disables them too.
exports.HIT_STOP_KILL = 0.045;
exports.HIT_STOP_DEATH = 0.11;
exports.FLASH_PLAYER_DIED = 0.35;
exports.FLASH_BASE_DIED = 0.55;
// Per-sprite white flash when a tank takes a (non-fatal or fatal) hit. The
// sprite is tinted toward white by SPRITE_FLASH_HIT [0..1] on impact, decaying
// to 0 over SPRITE_FLASH_DECAY_SECONDS. Render-only (see SpritePainter.flash),
// scaled by CAMERA_SHAKE_INTENSITY so reduced-motion disables it.
exports.SPRITE_FLASH_HIT = 0.85;
exports.SPRITE_FLASH_DECAY_SECONDS = 0.11;
exports.ENEMY_DROP_BLINK_INTERVAL = 0.12;
exports.ENEMY_DROP_BLINK_COLOR = '#5a0505';
exports.ENEMY_DROP_BLINK_ALPHA = 0.5;
// Toggle only the sprite-sheet explosion animation from data/graphics/explosion.png.
// Procedural explosion particles, sounds, and gameplay events still run.
exports.SHOW_EXPLOSION_SPRITE = true;
// LevelJuiceScript ambient FX (cosmetic overlay, Math.random only, gated by
// PARTICLE_INTENSITY). Tread dust puffs behind moving tanks; spark bursts when
// a tank survives a hit.
exports.TREAD_DUST_DISTANCE = 9; // px a tank travels between dust puffs
exports.HIT_SPARK_COUNT = 8; // sparks when a tank survives a hit
// Supersampling factor: the canvas backing store renders at this multiple of
// the logical size, so HD art (authored at 4x) resolves to full detail on
// screen instead of being sampled down to the gameplay tile size. Gameplay and
// world coordinates are unaffected. Lower to 2 for weaker GPUs.
exports.RENDER_SCALE = 1;
// Mobile backing pixels per displayed CSS pixel. A modest supersample keeps
// HD sprites/text crisp without returning to the full 1288px logical buffer.
exports.MOBILE_RENDER_SCALE = 1.5;
exports.BRICK_TILE_SIZE = exports.TILE_SIZE_SMALL;
exports.BRICK_SUPER_TILE_SIZE = exports.TILE_SIZE_MEDIUM;
exports.STEEL_TILE_SIZE = exports.TILE_SIZE_MEDIUM;
exports.JUNGLE_TILE_SIZE = exports.TILE_SIZE_MEDIUM;
exports.WATER_TILE_SIZE = exports.TILE_SIZE_MEDIUM;
exports.ICE_TILE_SIZE = exports.TILE_SIZE_MEDIUM;
exports.BULLET_WIDTH = 12;
exports.PLAYER_FIRST_SPAWN_DELAY = 0;
// Delay before the player respawns after dying — long enough for the death
// blast to finish and the camera to pan back to the spawn point.
exports.PLAYER_SPAWN_DELAY = 1.5;
exports.ENEMY_FIRST_SPAWN_DELAY = 0.16;
exports.ENEMY_SPAWN_DELAY = 3;
exports.ENEMY_MAX_TOTAL_COUNT = 20;
exports.ENEMY_MAX_ALIVE_COUNT = 4;
exports.ENEMY_MAX_ALIVE_COUNT_MULTIPLAYER = 6;
exports.POWERUP_DURATION = 30;
exports.SHIELD_SPAWN_DURATION = 3.5;
exports.SHIELD_POWERUP_DURATION = 10;
exports.BASE_DEFENCE_POWERUP_DURATION = 17;
exports.FREEZE_POWERUP_DURATION = 10;
exports.FRIENDLY_FIRE_STUN_DURATION = 5;
exports.ICE_SLIDE_DURATION = 0.5;
exports.POINTS_POWERUP_DURATION = 0.8;
exports.POINTS_ENEMY_TANK_DURATION = 0.16;
exports.LEVEL_START_DELAY = 2;
exports.PLAYER_INITIAL_LIVES = 3;
exports.PLAYER_EXTRA_LIVE_POINTS = 20000;
exports.DEFAULT_HIGHSCORE = 20000;
exports.BONUS_POINTS = 1000;
exports.COLOR_BACKDROP = 'rgba(0,0,0,0.7)';
exports.COLOR_GRAY = '#636363';
exports.COLOR_GRAY_LIGHT = '#737373';
exports.COLOR_BLACK = '#000';
exports.COLOR_WHITE = '#fff';
exports.COLOR_RED = '#d74000';
exports.COLOR_YELLOW = '#ffae0a';
exports.COLOR_STAGE_BACKGROUND = '#102816';
exports.PRIMARY_SPRITE_FONT_ID = 'primary';
exports.PRIMARY_RECT_FONT_ID = 'primary';
exports.STORAGE_NAMESPACE = 'cattle-bity';
exports.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY = 'points.highscore.primary';
exports.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY = 'points.highscore.secondary';
exports.STORAGE_KEY_SETTINGS_INPUT_BINDINGS_PREFIX = 'settings.input.bindings';
exports.STORAGE_KEY_SETTINGS_AUDIO_MUTED = 'settings.audio-muted';
exports.STORAGE_KEY_SETTINGS_AUDIO_VOLUME = 'settings.audio-volume';
exports.STORAGE_KEY_SETTINGS_SEEN_LEVEL_HINT = 'settings.seen-level-hint';
exports.STORAGE_KEY_SETTINGS_SEEN_EDITOR_HINT = 'settings.seen-editor-hint';
exports.STORAGE_KEY_SETTINGS_SHOW_LEVEL_HINT = 'settings.show-level-hint';
exports.STORAGE_KEY_SETTINGS_SHOW_EDITOR_HINT = 'settings.show-editor-hint';
exports.STORAGE_KEY_SETTINGS_SHOW_SCANLINES = 'settings.show-scanlines';
exports.STORAGE_KEY_SHOP_WALLET_CONNECTED = 'shop.wallet-connected';
exports.STORAGE_KEY_SHOP_WALLET_ADDRESS = 'shop.wallet-address';
exports.STORAGE_KEY_SHOP_TOKEN_BALANCE = 'shop.token-balance';
exports.STORAGE_KEY_SHOP_SOL_BALANCE = 'shop.sol-balance';
exports.STORAGE_KEY_SHOP_FUEL_BALANCE = 'shop.fuel-balance';
exports.STORAGE_KEY_SHOP_INVENTORY = 'shop.inventory';
exports.STORAGE_KEY_SHOP_LOADOUT = 'shop.loadout';
exports.STORAGE_KEY_SHOP_TX_INDEX = 'shop.tx-index';
// Dev-only: the most recently completed match's input recording, watchable
// via the main menu's REPLAY item (config.IS_DEV builds only). See src/replay.
exports.SHOP_STARTING_TOKEN_BALANCE = 1000;
exports.SHOP_STARTING_SOL_BALANCE = 1.25;
exports.SHOP_GUEST_FUEL_BALANCE = 9999;
// Guest (temp) accounts get a full inventory of every shop item, and their
// items never deplete — guests exist to try the full game, not to grind it.
exports.SHOP_GUEST_INVENTORY_COUNT = 99;
exports.SHOP_RUN_FUEL_COST = 1;
exports.PLAYER_DEFAULT_SPAWN_POSITIONS = [
    { x: exports.FIELD_CONTENT_OFFSET_X + 256, y: exports.FIELD_CONTENT_OFFSET_Y + 768 },
    { x: exports.FIELD_CONTENT_OFFSET_X + 512, y: exports.FIELD_CONTENT_OFFSET_Y + 768 },
];
exports.ENEMY_DEFAULT_SPAWN_POSITIONS = [
    { x: exports.FIELD_CONTENT_OFFSET_X + 384, y: exports.FIELD_CONTENT_OFFSET_Y + 0 },
    { x: exports.FIELD_CONTENT_OFFSET_X + 768, y: exports.FIELD_CONTENT_OFFSET_Y + 0 },
    { x: exports.FIELD_CONTENT_OFFSET_X + 0, y: exports.FIELD_CONTENT_OFFSET_Y + 0 },
];
exports.BASE_DEFAULT_POSITION = {
    x: exports.FIELD_CONTENT_OFFSET_X + 352,
    y: exports.FIELD_CONTENT_OFFSET_Y + 736,
};
exports.BASE_DEFAULT_SIZE = { width: 128, height: 96 };
exports.MENU_TITLE_DEFAULT_POSITION = {
    x: 112,
    y: 96,
};
exports.MENU_DEFAULT_POSITION = {
    x: 16,
    y: 192,
};
exports.GROUND_FIELD_Z_INDEX = -1000;
exports.WALL_SHADOW_Z_INDEX = -900;
// Shadow is cast down-and-to-the-side, fading out toward its far edge. It is
// faked as several silhouettes stepped outward to the max offset: near the wall
// many steps overlap (dark), at the far edge only the last step reaches (faint).
// A larger X than Y reads as a wall with a visible side face (more depth).
exports.WALL_SHADOW_OFFSET_X = 9;
exports.WALL_SHADOW_OFFSET_Y = 6;
exports.WALL_SHADOW_STEPS = 6;
exports.WALL_SHADOW_COLOR = '#000000';
// Per-step alpha; near-edge darkness ≈ 1 - (1 - alpha)^STEPS.
exports.WALL_SHADOW_ALPHA = 0.14;
// Drop shadow for brick text (e.g. the menu title). Tighter than the wall
// shadow since the letter tiles are small.
exports.TEXT_SHADOW_OFFSET_X = 6;
exports.TEXT_SHADOW_OFFSET_Y = 6;
exports.TEXT_SHADOW_STEPS = 5;
exports.TEXT_SHADOW_ALPHA = 0.1;
exports.BRICK_TILE_Z_INDEX = 0;
exports.STEEL_TILE_Z_INDEX = 0;
exports.WATER_TILE_Z_INDEX = 0;
exports.ICE_TILE_Z_INDEX = 0;
exports.BORDER_WALL_Z_INDEX = 0;
exports.BASE_HEART_Z_INDEX = 0;
exports.LEVEL_INFO_Z_INDEX = 1;
exports.ENEMY_TANK_Z_INDEX = 1;
exports.PLAYER_TANK_Z_INDEX = 2;
exports.BULLET_Z_INDEX = 3;
exports.SHIELD_Z_INDEX = 3;
exports.SMALL_EXPLOSION_Z_INDEX = 4;
exports.SPAWN_Z_INDEX = 4;
exports.JUNGLE_TILE_Z_INDEX = 5;
exports.EDITOR_TOOL_Z_INDEX = 6;
exports.LARGE_EXPLOSION_Z_INDEX = 6;
exports.EDITOR_BRUSH_Z_INDEX = 7;
exports.POWERUP_Z_INDEX = 7;
exports.POINTS_Z_INDEX = 7;
exports.PAUSE_NOTICE_Z_INDEX = 8;
exports.GAME_OVER_NOTICE_Z_INDEX = 8;
exports.CURTAIN_Z_INDEX = 9;
exports.LEVEL_TITLE_Z_INDEX = 10;
exports.MODAL_Z_INDEX = 11;
exports.DEBUG_COLLISION_RECT_Z_INDEX = 20;
exports.DEBUG_GRID_Z_INDEX = 21;
exports.GITHUB_URL = 'https://github.com/CryptoSodi/Battle-Cities';
