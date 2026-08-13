import * as Stats from 'stats.js';

import {
  AudioLoader,
  CollisionSystem,
  ColorSpriteFontGenerator,
  GameObject,
  GameLoop,
  GameRenderer,
  ImageLoader,
  Logger,
  ParticleSystem,
  Prng,
  RectFontLoader,
  SpriteFontLoader,
  SpriteLoader,
  State,
  Vector,
} from './core';
import { DebugGameLoopMenu, DebugInspector } from './debug';
import {
  AudioManager,
  GameUpdateArgs,
  GameState,
  GameStorage,
  Session,
} from './game';
import {
  InputHintSettings,
  InputManager,
  MobileTouchController,
} from './input';
import { ManifestMapListReader, MapConfig, MapLoader } from './map';
import { PointsHighscoreManager } from './points';
import { SavedReplay } from './replay';
import { GameSceneRouter, GameSceneType } from './scenes';
import { TankTier } from './tank';
import { PlayerIdentity } from './auth';
import { getPhantomProvider } from './wallet';
import { apiFetch, apiFetchDirect, getApiUrl } from './network/api';
import { MagicBlockMovementSync } from './network/magicblock';
import { WebRtcHostMatchSync } from './network/webrtc';
import {
  clearPlayerRuntimeOnReload,
  readMultiplayerRuntime,
} from './network/multiplayerRuntime';

import * as config from './config';

import * as audioManifest from '../data/audio.manifest.json';
import * as spriteManifest from '../data/sprite.manifest.json';
import * as spriteFontConfig from '../data/fonts/sprite-font.json';
import * as rectFontConfig from '../data/fonts/rect-font.json';
import * as mapManifest from '../data/map.manifest.json';

const loadingElement = document.querySelector('[data-loading]');
const loadingStatusElement = document.querySelector('[data-loading-status]');
const loadingVersionElement = document.querySelector('[data-loading-version]');
const authShellElement = document.querySelector(
  '[data-auth-shell]',
) as HTMLElement;
const walletLoginButton = document.querySelector(
  '[data-auth-wallet]',
) as HTMLButtonElement;
const googleLoginButton = document.querySelector(
  '[data-auth-google]',
) as HTMLButtonElement;

function setLoadingStatus(message: string): void {
  if (loadingStatusElement !== null) {
    loadingStatusElement.textContent = message;
  }
}

if (loadingVersionElement !== null) {
  loadingVersionElement.textContent = `VER: ${process.env.BATTLECITY_VERSION}`;
}

const SPLASH_MESSAGES = [
  'Booting battle station...',
  'Connecting to Solana console...',
  'Establishing MagicBlock uplink...',
  'Loading suspiciously tiny tanks...',
  'Counting shells twice...',
  'Convincing enemies to follow the rules...',
];

function startSplashMessages(): () => void {
  if (isHeadlessBroadcaster) return () => undefined;
  let messageIndex = 0;
  setLoadingStatus(SPLASH_MESSAGES[messageIndex]);
  const timer = window.setInterval(() => {
    messageIndex = (messageIndex + 1) % SPLASH_MESSAGES.length;
    setLoadingStatus(SPLASH_MESSAGES[messageIndex]);
  }, 1200);
  return () => window.clearInterval(timer);
}
const authStatusElement = document.querySelector(
  '[data-auth-status]',
) as HTMLElement;

const log = new Logger('main', Logger.Level.Debug);

const runtimeParams = new URLSearchParams(window.location.search);
const isHeadlessBroadcaster =
  runtimeParams.get('mode') === 'webrtc' &&
  runtimeParams.get('broadcaster') === '1' &&
  runtimeParams.get('headless') === '1';
const isWebRtcObserver =
  runtimeParams.get('mode') === 'webrtc' &&
  runtimeParams.get('observer') === '1';
const rendererOverride = runtimeParams.get('renderer');
const gameRenderer = new GameRenderer({
  // debug: true,
  height: config.CANVAS_HEIGHT,
  width: config.CANVAS_WIDTH,
  renderer:
    isHeadlessBroadcaster
      ? 'canvas'
      : rendererOverride === 'canvas' || rendererOverride === 'webgl'
      ? rendererOverride
      : 'auto',
  renderScale: config.RENDER_SCALE,
});
let particles: ParticleSystem = null;

function syncCanvasCssSize(width: number, height: number): void {
  document.documentElement.style.setProperty('--game-width', width.toString());
  document.documentElement.style.setProperty(
    '--game-height',
    height.toString(),
  );
}

function syncMobileCanvasCssSize(): void {
  if (!config.isMobileTouchViewport()) {
    return;
  }

  const visualViewport = (window as any).visualViewport as
    | { width: number; height: number }
    | undefined;
  const viewportWidth = visualViewport
    ? visualViewport.width
    : document.documentElement.clientWidth;
  const viewportHeight = visualViewport
    ? visualViewport.height
    : document.documentElement.clientHeight;
  const isGameplay = document.body.classList.contains('level-playing');
  const isMainMenu = document.body.classList.contains('main-menu-active');
  const isShop = document.body.classList.contains('shop-active');
  const isRanking = document.body.classList.contains('ranking-active');
  const isSettings = document.body.classList.contains('settings-active');
  const isResults = document.body.classList.contains('results-active');
  const isPanelScreen = document.body.classList.contains('panel-screen-active');
  const stageWidth = Math.max(Math.floor(viewportWidth), 1);
  const stageHeight = Math.max(
    Math.floor(viewportHeight * (isGameplay ? 0.6 : 1)),
    1,
  );

  const gameAspect = config.CANVAS_WIDTH / config.CANVAS_HEIGHT;
  const stageAspect = stageWidth / stageHeight;
  const useHeightAsConstraint =
    ((isMainMenu ||
      isShop ||
      isRanking ||
      isSettings ||
      isResults ||
      isPanelScreen) &&
      !isGameplay) ||
    stageAspect > gameAspect;
  const width = useHeightAsConstraint ? stageHeight * gameAspect : stageWidth;
  const height = useHeightAsConstraint ? stageHeight : stageWidth / gameAspect;

  document.documentElement.style.setProperty(
    '--mobile-game-css-width',
    `${Math.floor(width)}px`,
  );
  document.documentElement.style.setProperty(
    '--mobile-game-css-height',
    `${Math.floor(height)}px`,
  );

  // Keep logical game coordinates unchanged while using a modest mobile
  // supersample for crisp HD sprites/text. This is still substantially
  // cheaper than drawing the full 1288px-wide logical surface.
  const backingWidth = Math.max(
    Math.floor(width * config.MOBILE_RENDER_SCALE),
    1,
  );
  const backingHeight = Math.max(
    Math.floor(height * config.MOBILE_RENDER_SCALE),
    1,
  );
  gameRenderer.resizeBackingStore(backingWidth, backingHeight);
  if (particles !== null) {
    particles.resizeBackingStore(backingWidth, backingHeight);
  }
}

function logCanvasSize(label: string, canvas: HTMLCanvasElement): void {
  const bounds = canvas.getBoundingClientRect();
  log.info(`${label} canvas size`, {
    backing: `${canvas.width}x${canvas.height}`,
    css: `${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
    devicePixelRatio: window.devicePixelRatio || 1,
  });
}

syncCanvasCssSize(config.CANVAS_WIDTH, config.CANVAS_HEIGHT);
syncMobileCanvasCssSize();

let resizeTimeoutId: number = null;
window.addEventListener('resize', () => {
  // Mobile browser chrome, fullscreen, and orientation changes all emit
  // resize events. CSS owns the half-screen mobile layout, so rebuilding the
  // scene here would only destroy the active match and its recording.
  if (config.isMobileTouchViewport()) {
    syncMobileCanvasCssSize();
    return;
  }

  const nextCanvasSize = config.getResponsiveCanvasSize();

  if (
    nextCanvasSize.width === config.CANVAS_WIDTH &&
    nextCanvasSize.height === config.CANVAS_HEIGHT
  ) {
    return;
  }

  syncCanvasCssSize(nextCanvasSize.width, nextCanvasSize.height);

  if (resizeTimeoutId !== null) {
    window.clearTimeout(resizeTimeoutId);
  }

  // Rebuild scenes against the new internal width so the menu layout stays
  // correct without stretching or cropping the pixel art.
  resizeTimeoutId = window.setTimeout(() => {
    window.location.reload();
  }, 150);
});

const gameStorage = new GameStorage(config.STORAGE_NAMESPACE);
gameStorage.load();

const showScanlines = gameStorage.getBoolean(
  config.STORAGE_KEY_SETTINGS_SHOW_SCANLINES,
  false,
);
document.body.classList.toggle('scanlines-disabled', !showScanlines);

const inputManager = new InputManager(gameStorage);
if (!isHeadlessBroadcaster) {
  inputManager.listen();
}

const POINTER_TAP_SLOP = 24;
const POINTER_SWIPE_THRESHOLD = 48;

let pendingPointerClick: Vector = null;
let pendingPointerSwipe: number = null;
let activeCanvasPointerId: number = null;
let canvasPointerStart: Vector = null;
// Wall-clock timestamp of the last particle update, for real-time (not fixed
// sim step) cosmetic animation.
let lastParticleTime: number = null;

function getCanvasPointerPosition(event: PointerEvent): Vector {
  const canvas = gameRenderer.getDomElement();
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(
      config.CANVAS_WIDTH,
      ((event.clientX - bounds.left) / bounds.width) * config.CANVAS_WIDTH,
    ),
  );
  const y = Math.max(
    0,
    Math.min(
      config.CANVAS_HEIGHT,
      ((event.clientY - bounds.top) / bounds.height) * config.CANVAS_HEIGHT,
    ),
  );

  return new Vector(x, y);
}

const canvasElement = gameRenderer.getDomElement();

canvasElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || activeCanvasPointerId !== null) {
    return;
  }

  event.preventDefault();
  activeCanvasPointerId = event.pointerId;
  canvasPointerStart = getCanvasPointerPosition(event);
  canvasElement.setPointerCapture(event.pointerId);
});

canvasElement.addEventListener('pointermove', (event) => {
  if (event.pointerId === activeCanvasPointerId) {
    event.preventDefault();
  }
});

const finishCanvasPointer = (event: PointerEvent, cancelled = false): void => {
  if (
    event.pointerId !== activeCanvasPointerId ||
    canvasPointerStart === null
  ) {
    return;
  }

  event.preventDefault();
  const end = getCanvasPointerPosition(event);
  const deltaX = end.x - canvasPointerStart.x;
  const deltaY = end.y - canvasPointerStart.y;
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);

  if (!cancelled) {
    if (absoluteY >= POINTER_SWIPE_THRESHOLD && absoluteY > absoluteX * 1.2) {
      pendingPointerSwipe = deltaY < 0 ? 1 : -1;
    } else if (absoluteX <= POINTER_TAP_SLOP && absoluteY <= POINTER_TAP_SLOP) {
      pendingPointerClick = end;
    }
  }

  if (canvasElement.hasPointerCapture(event.pointerId)) {
    canvasElement.releasePointerCapture(event.pointerId);
  }
  activeCanvasPointerId = null;
  canvasPointerStart = null;
};

canvasElement.addEventListener('pointerup', (event) => {
  finishCanvasPointer(event);
});
canvasElement.addEventListener('pointercancel', (event) => {
  finishCanvasPointer(event, true);
});

const mobileGamepadStyle = document.createElement('style');
mobileGamepadStyle.textContent = `
.mobile-gamepad-qr {
  align-items: center;
  background: rgba(0, 0, 0, 0.78);
  border: 2px solid #ffae0a;
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
  font: 12px monospace;
  gap: 4px;
  padding: 8px;
  pointer-events: auto;
  position: fixed;
  left: clamp(12px, 3vw, 32px);
  text-align: center;
  top: 50%;
  transform: translateY(-50%);
  width: clamp(160px, 22vw, 240px);
  z-index: 20;
}
.mobile-gamepad-qr__title {
  color: #ffae0a;
  font-size: 10px;
  line-height: 1.1;
}
.mobile-gamepad-qr__image {
  background: #fff;
  display: block;
  image-rendering: pixelated;
  width: 100%;
}
.mobile-gamepad-qr__code {
  font-size: 16px;
  letter-spacing: 2px;
}
.mobile-gamepad-qr.hidden {
  display: none;
}
@media (max-width: 620px) {
  .mobile-gamepad-qr {
    left: 12px;
    top: 50%;
    width: 150px;
  }
}
.mobile-gamepad-debug {
  --debug-x: 0px;
  --debug-y: 0px;
  background: rgba(9, 13, 22, 0.82);
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  bottom: 14px;
  box-sizing: border-box;
  display: none;
  height: 184px;
  left: 14px;
  opacity: 0.92;
  pointer-events: none;
  position: fixed;
  width: 308px;
  z-index: 21;
}
.mobile-gamepad-debug.visible {
  display: block;
}
.mobile-gamepad-debug__body {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  height: 146px;
  left: 20px;
  position: absolute;
  top: 19px;
  width: 146px;
}
.mobile-gamepad-debug__body::before,
.mobile-gamepad-debug__body::after {
  background: rgba(255, 174, 10, 0.22);
  content: "";
  height: 2px;
  left: 27px;
  position: absolute;
  top: 72px;
  width: 92px;
}
.mobile-gamepad-debug__body::after {
  transform: rotate(90deg);
}
.mobile-gamepad-debug__stick {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 50%;
  height: 52px;
  left: 74px;
  position: absolute;
  top: 74px;
  transform: translate(calc(-50% + var(--debug-x)), calc(-50% + var(--debug-y)));
  width: 52px;
}
.mobile-gamepad-debug__stick.pressed {
  background: #ffae0a;
  border-color: #fff;
  box-shadow: 0 0 0 5px rgba(255, 174, 10, 0.28);
}
.mobile-gamepad-debug__dpad {
  height: 34px;
  left: 194px;
  position: absolute;
  top: 75px;
  width: 34px;
}
.mobile-gamepad-debug__direction {
  border: 5px solid transparent;
  height: 0;
  opacity: 0.48;
  position: absolute;
  width: 0;
}
.mobile-gamepad-debug__direction.active {
  opacity: 1;
}
.mobile-gamepad-debug__direction--up {
  border-bottom-color: #fff;
  left: 12px;
  top: -2px;
}
.mobile-gamepad-debug__direction--down {
  border-top-color: #fff;
  bottom: -2px;
  left: 12px;
}
.mobile-gamepad-debug__direction--left {
  border-right-color: #fff;
  left: -2px;
  top: 12px;
}
.mobile-gamepad-debug__direction--right {
  border-left-color: #fff;
  right: -2px;
  top: 12px;
}
.mobile-gamepad-debug__button {
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.82);
  display: flex;
  font: 700 16px Arial, sans-serif;
  height: 42px;
  justify-content: center;
  position: absolute;
  width: 42px;
}
.mobile-gamepad-debug__button.pressed {
  background: #ffae0a;
  border-color: #fff;
  color: #000;
}
.mobile-gamepad-debug__button--x {
  right: 62px;
  top: 30px;
}
.mobile-gamepad-debug__button--y {
  right: 20px;
  top: 72px;
}
.mobile-gamepad-debug__button--a {
  right: 104px;
  top: 72px;
}
.mobile-gamepad-debug__button--b {
  right: 62px;
  top: 114px;
}
.mobile-gamepad-debug__meta {
  bottom: 13px;
  color: rgba(255, 255, 255, 0.68);
  font: 14px monospace;
  left: 184px;
  line-height: 1.15;
  position: absolute;
  white-space: pre-line;
}
`;
document.head.appendChild(mobileGamepadStyle);

const mobileGamepadDebugElement = document.createElement('div');
mobileGamepadDebugElement.className = 'mobile-gamepad-debug';
mobileGamepadDebugElement.innerHTML = `
  <div class="mobile-gamepad-debug__body">
    <div class="mobile-gamepad-debug__stick" data-mobile-debug-stick></div>
  </div>
  <div class="mobile-gamepad-debug__dpad">
    <div class="mobile-gamepad-debug__direction mobile-gamepad-debug__direction--up" data-mobile-debug-direction="up"></div>
    <div class="mobile-gamepad-debug__direction mobile-gamepad-debug__direction--down" data-mobile-debug-direction="down"></div>
    <div class="mobile-gamepad-debug__direction mobile-gamepad-debug__direction--left" data-mobile-debug-direction="left"></div>
    <div class="mobile-gamepad-debug__direction mobile-gamepad-debug__direction--right" data-mobile-debug-direction="right"></div>
  </div>
  <div class="mobile-gamepad-debug__button mobile-gamepad-debug__button--x" data-mobile-debug-button="2">X</div>
  <div class="mobile-gamepad-debug__button mobile-gamepad-debug__button--y" data-mobile-debug-button="3">Y</div>
  <div class="mobile-gamepad-debug__button mobile-gamepad-debug__button--a" data-mobile-debug-button="0">A</div>
  <div class="mobile-gamepad-debug__button mobile-gamepad-debug__button--b" data-mobile-debug-button="1">B</div>
  <div class="mobile-gamepad-debug__meta" data-mobile-debug-meta>mobile pad</div>
`;
document.body.appendChild(mobileGamepadDebugElement);

const mobileGamepadDebugStick = mobileGamepadDebugElement.querySelector(
  '[data-mobile-debug-stick]',
) as HTMLElement;
const mobileGamepadDebugButtons = Array.from(
  mobileGamepadDebugElement.querySelectorAll('[data-mobile-debug-button]'),
) as HTMLElement[];
const mobileGamepadDebugDirections = Array.from(
  mobileGamepadDebugElement.querySelectorAll('[data-mobile-debug-direction]'),
) as HTMLElement[];
const mobileGamepadDebugMeta = mobileGamepadDebugElement.querySelector(
  '[data-mobile-debug-meta]',
) as HTMLElement;

// Replays are a watch-only experience. Set this before LevelPlay performs its
// first update so controller UI cannot flash on screen while the recorded
// input devices are being installed.
let isReplayPlayback = false;

function updateMobileGamepadDebug(): void {
  const gamepad = inputManager.getMobileGamepadHost().getGamepad(0);
  const visible =
    !isReplayPlayback &&
    !inputManager.isReplaying() &&
    gamepad !== null &&
    gamepad.connected === true;
  mobileGamepadDebugElement.classList.toggle('visible', visible);

  if (!visible) {
    return;
  }

  const axisX = Math.max(-1, Math.min(1, gamepad.axes[0] || 0));
  const axisY = Math.max(-1, Math.min(1, gamepad.axes[1] || 0));
  mobileGamepadDebugElement.style.setProperty('--debug-x', `${axisX * 47}px`);
  mobileGamepadDebugElement.style.setProperty('--debug-y', `${axisY * 47}px`);
  mobileGamepadDebugStick.classList.toggle(
    'pressed',
    Math.abs(axisX) > 0.08 || Math.abs(axisY) > 0.08,
  );

  mobileGamepadDebugDirections.forEach((directionElement) => {
    const direction = directionElement.dataset.mobileDebugDirection;
    const active =
      (direction === 'up' && axisY < -0.22) ||
      (direction === 'down' && axisY > 0.22) ||
      (direction === 'left' && axisX < -0.22) ||
      (direction === 'right' && axisX > 0.22);
    directionElement.classList.toggle('active', active);
  });

  mobileGamepadDebugButtons.forEach((buttonElement) => {
    const index = Number(buttonElement.dataset.mobileDebugButton);
    const pressed = gamepad.buttons[index]?.pressed === true;
    buttonElement.classList.toggle('pressed', pressed);
  });

  const age =
    gamepad.receivedAt === undefined ? 0 : Date.now() - gamepad.receivedAt;
  mobileGamepadDebugMeta.textContent = [
    `x ${axisX.toFixed(2)}`,
    `y ${axisY.toFixed(2)}`,
    `${age}ms ago`,
  ].join('\n');
}

const audioLoader = new AudioLoader(audioManifest);
const imageLoader = new ImageLoader();

const spriteFontLoader = new SpriteFontLoader(imageLoader);
spriteFontLoader.register(config.PRIMARY_SPRITE_FONT_ID, spriteFontConfig);

const colorSpriteFontGenerator = new ColorSpriteFontGenerator(spriteFontLoader);
colorSpriteFontGenerator.register(
  config.PRIMARY_SPRITE_FONT_ID,
  config.COLOR_BLACK,
);

const spriteLoader = new SpriteLoader(imageLoader, spriteManifest);

const rectFontLoader = new RectFontLoader();
rectFontLoader.register(config.PRIMARY_RECT_FONT_ID, rectFontConfig, {
  scale: config.TILE_SIZE_SMALL,
});

const manifestMapListReader = new ManifestMapListReader(mapManifest);
const mapLoader = new MapLoader(manifestMapListReader);

const audioManager = new AudioManager(audioLoader, gameStorage);
audioManager.loadSettings();
if (isHeadlessBroadcaster) {
  audioManager.setGlobalMuted(true);
}

const session = new Session();
const mobileTouchController = new MobileTouchController(inputManager, session);
const playerIdentity = new PlayerIdentity();
const magicBlockMovement = new MagicBlockMovementSync(playerIdentity);
clearPlayerRuntimeOnReload();
const multiplayerRuntime = readMultiplayerRuntime();
const webRtcMatch = new WebRtcHostMatchSync(multiplayerRuntime);

const inputHintSettings = new InputHintSettings(gameStorage);

const pointsHighscoreManager = new PointsHighscoreManager(gameStorage);

const collisionSystem = new CollisionSystem();

const sceneRouter = new GameSceneRouter();
const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
const presenceClientId = getPresenceClientId();
let presenceHeartbeatInFlight = false;
let presenceHeartbeatPending = false;
let presenceHeartbeatWarningShown = false;
let presenceTrackingStarted = false;
let lastReportedPresenceInGame: boolean = null;

function getPresenceClientId(): string {
  const storageKey = 'battlecities.presence.client';
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing !== null && /^[a-z0-9-]{6,80}$/i.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const generated = `tab-${Array.from(bytes, (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('')}`;
    window.sessionStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `tab-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

function isPresenceInGame(): boolean {
  if (isReplayPlayback) {
    return false;
  }

  const sceneType = sceneRouter.getCurrentType();
  return (
    sceneType === GameSceneType.LevelLoad ||
    sceneType === GameSceneType.LevelPlay ||
    sceneType === GameSceneType.LevelScore ||
    sceneType === GameSceneType.MainVictory
  );
}

async function sendPresenceHeartbeat(): Promise<void> {
  if (presenceHeartbeatInFlight) {
    presenceHeartbeatPending = true;
    return;
  }

  presenceHeartbeatInFlight = true;
  try {
    const inGame = isPresenceInGame();
    const response = await apiFetchDirect('/api/presence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: presenceClientId,
        inGame,
        gameMode: inGame
          ? session.isMultiplayer()
            ? 'multiplayer'
            : 'single-player'
          : null,
      }),
    });
    if (!response.ok) {
      throw new Error(`Presence heartbeat failed (${response.status})`);
    }
    lastReportedPresenceInGame = inGame;
    presenceHeartbeatWarningShown = false;
  } catch (error) {
    if (!presenceHeartbeatWarningShown) {
      log.warn('Presence heartbeat failed', error);
      presenceHeartbeatWarningShown = true;
    }
  } finally {
    presenceHeartbeatInFlight = false;
    if (presenceHeartbeatPending) {
      presenceHeartbeatPending = false;
      void sendPresenceHeartbeat();
    }
  }
}

function startPresenceTracking(): void {
  presenceTrackingStarted = true;
  void sendPresenceHeartbeat();
  window.setInterval(
    () => void sendPresenceHeartbeat(),
    PRESENCE_HEARTBEAT_INTERVAL_MS,
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void sendPresenceHeartbeat();
    }
  });
  window.addEventListener('pagehide', () => {
    void apiFetchDirect(
      `/api/presence?clientId=${encodeURIComponent(presenceClientId)}`,
      {
        method: 'DELETE',
        keepalive: true,
      },
    ).catch(() => undefined);
  });
}

window.addEventListener('battlecities:android-back', (event) => {
  if (!sceneRouter.canGoBack()) {
    return;
  }

  event.preventDefault();
  sceneRouter.back();
});

const adminReplayId = readAdminReplayId();
const profileReplay = readProfileReplay();
if (
  magicBlockMovement.isWatching() ||
  magicBlockMovement.isOnlineMatch() ||
  webRtcMatch.isEnabled()
) {
  const requestedLevel = multiplayerRuntime?.level ?? Number(
    new URLSearchParams(window.location.search).get('level'),
  );
  const levelNumber = Number.isInteger(requestedLevel)
    ? multiplayerRuntime !== null
      ? Math.max(requestedLevel, 1)
      : Math.min(Math.max(requestedLevel, 1), mapLoader.getItemsCount())
    : 1;
  if (magicBlockMovement.isOnlineMatch() || webRtcMatch.isEnabled()) {
    session.setMultiplayer();
  }
  if (multiplayerRuntime !== null) {
    const tankTier = multiplayerRuntime.tankTier as TankTier;
    session.setPlayerTankTier(multiplayerRuntime.playerSlot, tankTier);
    session.getPlayer(multiplayerRuntime.playerSlot).setTankTier(tankTier);
  }
  session.start(levelNumber, mapLoader.getItemsCount());
  sceneRouter.start(GameSceneType.LevelLoad);
} else {
  sceneRouter.start(GameSceneType.MainMenu);
}

function readAdminReplayId(): string | null {
  const replayId = runtimeParams.get('adminReplay');
  if (replayId === null || !/^[a-z0-9-]{1,120}$/i.test(replayId)) {
    return null;
  }
  return replayId;
}

function readProfileReplay(): { playerId: string; matchId: string } | null {
  const playerId = runtimeParams.get('profileReplayPlayer');
  const matchId = runtimeParams.get('profileReplayMatch');
  return playerId !== null && matchId !== null &&
    /^ply-[a-z0-9-]+$/i.test(playerId) && /^mtc-[a-z0-9-]+$/i.test(matchId)
    ? { playerId, matchId }
    : null;
}

async function startAdminReplay(): Promise<boolean> {
  if (
    adminReplayId === null ||
    magicBlockMovement.isWatching() ||
    magicBlockMovement.isOnlineMatch() ||
    webRtcMatch.isEnabled()
  ) {
    return false;
  }
  try {
    const response = await apiFetchDirect(
      `/api/admin/replays?id=${encodeURIComponent(adminReplayId)}`,
    );
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    const replay = body?.item?.replay;
    if (
      typeof replay !== 'object' ||
      replay === null ||
      !Number.isInteger(replay.levelNumber)
    ) {
      return false;
    }
    const mapConfig = await loadReplayMap(replay.levelNumber);
    if (mapConfig === null) {
      return false;
    }
    // Keep this identical to MainReplayScene: a replay enters LevelPlay
    // directly, avoiding LevelLoad's live-session setup before its recorded
    // input, seed, loadout and enemy traces are restored.
    isReplayPlayback = true;
    sceneRouter.start(GameSceneType.LevelPlay, {
      mapConfig,
      replay: replay as SavedReplay,
    });
    return true;
  } catch {
    return false;
  }
}

async function startProfileReplay(): Promise<boolean> {
  if (
    profileReplay === null ||
    magicBlockMovement.isWatching() ||
    magicBlockMovement.isOnlineMatch() ||
    webRtcMatch.isEnabled()
  ) {
    return false;
  }
  try {
    const response = await apiFetchDirect(
      `/api/players/${encodeURIComponent(profileReplay.playerId)}/profile/matches/${encodeURIComponent(profileReplay.matchId)}/replay`,
    );
    if (!response.ok) return false;
    const replays = (await response.json())?.item?.replays;
    const replay = Array.isArray(replays) ? replays[0] : null;
    if (typeof replay !== 'object' || replay === null || !Number.isInteger(replay.levelNumber)) {
      return false;
    }
    const mapConfig = await loadReplayMap(replay.levelNumber);
    if (mapConfig === null) return false;
    isReplayPlayback = true;
    sceneRouter.start(GameSceneType.LevelPlay, {
      mapConfig,
      replay: replay as SavedReplay,
      replaySequence: replays.slice(1) as SavedReplay[],
    });
    return true;
  } catch {
    return false;
  }
}

function loadReplayMap(levelNumber: number): Promise<MapConfig | null> {
  return new Promise((resolve) => {
    const handleLoaded = (mapConfig: MapConfig): void => {
      mapLoader.error.removeListener(handleError);
      resolve(mapConfig);
    };
    const handleError = (): void => {
      mapLoader.loaded.removeListener(handleLoaded);
      resolve(null);
    };
    mapLoader.loaded.addListenerOnce(handleLoaded);
    mapLoader.error.addListenerOnce(handleError);
    mapLoader.loadAsync(levelNumber);
  });
}
sceneRouter.transitionStarted.addListener(() => {
  collisionSystem.reset();
  document.body.classList.remove('level-playing');
});
sceneRouter.transitionCompleted.addListener(() => {
  if (
    presenceTrackingStarted &&
    isPresenceInGame() !== lastReportedPresenceInGame
  ) {
    void sendPresenceHeartbeat();
  }
});

const debugInspector = new DebugInspector(gameRenderer.getDomElement());
if (!isHeadlessBroadcaster) {
  debugInspector.listen();
}
debugInspector.click.addListener((position: Vector) => {
  const intersections: GameObject[] = [];

  const scene = sceneRouter.getCurrentScene();
  scene.getRoot().traverseDescedants((child) => {
    if (child.getWorldBoundingBox().containsPoint(position)) {
      intersections.push(child);
    }
  });
  log.debug(intersections);
});

const gameState = new State<GameState>(GameState.Playing);

// Seeded RNG for all simulation randomness. Seeded from the clock for variety;
// record getSeed() to reproduce a run deterministically.
const rng = new Prng(Date.now() >>> 0 || 1);

// Cosmetic particle overlay (dust, sparks, debris). Own canvas over the game
// canvas; matches the game's logical resolution so world coords line up.
particles = new ParticleSystem(config.CANVAS_WIDTH, config.CANVAS_HEIGHT);
syncMobileCanvasCssSize();

const gameLoop = new GameLoop({ timerDriven: isHeadlessBroadcaster });
// Replay uses more fixed simulation ticks per rendered frame. Each tick stays
// at 60 Hz, preserving the recorded input/collision order while making review
// materially faster. Live and networked games always remain at 1x.
const REPLAY_PLAYBACK_SPEED = 3;

const updateArgs: GameUpdateArgs = {
  audioManager,
  audioLoader,
  collisionSystem,
  colorSpriteFontGenerator,
  deltaTime: 0,
  hitStop: (seconds: number) => gameLoop.hitStop(seconds),
  gameStorage,
  imageLoader,
  inputHintSettings,
  inputManager,
  gameState,
  mapLoader,
  magicBlockMovement,
  webRtcMatch,
  particles,
  playerIdentity,
  pointsHighscoreManager,
  pointerClick: null,
  pointerSwipe: null,
  rng,
  rectFontLoader,
  session,
  spriteFontLoader,
  spriteLoader,
};

const stats = new Stats();
const debugGameLoopMenu = new DebugGameLoopMenu(gameLoop);

if (config.IS_DEV && !isHeadlessBroadcaster) {
  debugGameLoopMenu.attach();
}

function waitForLogin(): Promise<void> {
  if (isHeadlessBroadcaster || isWebRtcObserver) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let loginStarted = false;

    const showLogin = (): void => {
      document.documentElement.classList.remove('auth-bootstrap');
    };

    const setStatus = (message: string): void => {
      if (authStatusElement !== null) {
        authStatusElement.textContent = message;
      }
    };

    const setWalletBusy = (busy: boolean): void => {
      if (walletLoginButton !== null) {
        walletLoginButton.disabled = busy;
        walletLoginButton.setAttribute('aria-busy', busy ? 'true' : 'false');
      }
    };

    const refreshPlayerIdentity = async (): Promise<void> => {
      const hasPlayer = await playerIdentity.refresh();
      if (!hasPlayer) {
        throw new Error('Player profile failed.');
      }
      await pointsHighscoreManager.syncWithServer();
    };

    const startServerSession = async (body: object): Promise<void> => {
      const response = await apiFetch('/api/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Session failed.');
      }
    };

    const createWalletChallenge = async (
      walletAddress: string,
    ): Promise<{ nonce: string; message: string }> => {
      const response = await apiFetch('/api/session', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        throw new Error('Wallet challenge failed.');
      }

      return response.json();
    };

    const signatureToBase64 = (signature: Uint8Array): string => {
      let binary = '';
      signature.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return window.btoa(binary);
    };

    const startWalletSession = async (): Promise<void> => {
      if (loginStarted) {
        return;
      }

      const provider = getPhantomProvider();
      if (provider === null) {
        setStatus('Install Phantom wallet to connect with Solana.');
        return;
      }

      loginStarted = true;
      setWalletBusy(true);
      setStatus('Connecting Phantom wallet...');

      try {
        const result = await provider.connect();
        const walletAddress = result.publicKey.toString();
        const challenge = await createWalletChallenge(walletAddress);
        const encodedMessage = new TextEncoder().encode(challenge.message);
        const signedMessage = await provider.signMessage(
          encodedMessage,
          'utf8',
        );
        const signature =
          signedMessage instanceof Uint8Array
            ? signedMessage
            : signedMessage.signature;

        await startServerSession({
          provider: 'wallet',
          walletAddress,
          nonce: challenge.nonce,
          message: challenge.message,
          signature: signatureToBase64(signature),
        });
        await refreshPlayerIdentity();
        setStatus('Phantom wallet connected.');
        resolve();
      } catch {
        loginStarted = false;
        setWalletBusy(false);
        setStatus('Could not connect Phantom wallet. Try again.');
      }
    };

    const startGoogleSession = async (): Promise<void> => {
      if (loginStarted) {
        return;
      }

      loginStarted = true;
      const nativeGoogleAuth = (window as any).Capacitor?.Plugins?.GoogleAuth;
      if (nativeGoogleAuth !== undefined) {
        try {
          setStatus('Choose a Google account...');
          const result = await nativeGoogleAuth.signIn();
          const response = await apiFetch('/api/auth/google/native', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idToken: result.idToken }),
          });
          if (!response.ok) {
            throw new Error('Native Google session failed');
          }
          await refreshPlayerIdentity();
          setStatus('Google account connected.');
          resolve();
        } catch {
          loginStarted = false;
          setStatus('Could not sign in with Google. Try again.');
        }
        return;
      }

      setStatus('Opening Google login...');
      window.location.assign(getApiUrl('/api/auth/google/start'));
    };

    const authError = new URLSearchParams(window.location.search).get(
      'authError',
    );
    if (authError === 'google_config') {
      setStatus('Google login is not configured yet.');
    } else if (authError === 'google') {
      setStatus('Google login failed. Try again.');
    }

    playerIdentity
      .refresh()
      .then((hasPlayer) => {
        if (hasPlayer) {
          loginStarted = true;
          setStatus(
            `${playerIdentity.getProviderLabel()} session is already active.`,
          );
          resolve();
          return;
        }

        showLogin();

        apiFetch('/api/session')
          .then((response) => (response.ok ? response.json() : null))
          .then((session) => {
            if (session?.authenticated === true) {
              apiFetch('/api/session', {
                method: 'DELETE',
              }).finally(() => {
                setStatus('Please sign in again to finish account setup.');
              });
            }
          })
          .catch(() => undefined);
      })
      .catch(() => showLogin());

    walletLoginButton?.addEventListener('click', () => {
      startWalletSession();
    });

    googleLoginButton?.addEventListener('click', () => {
      void startGoogleSession();
    });
  });
}

function enterGameView(): void {
  if (authShellElement !== null) {
    authShellElement.remove();
  }

  if (loadingElement instanceof HTMLElement) {
    loadingElement.hidden = false;
  }

  document.body.classList.add('game-running');
  document.documentElement.classList.remove('auth-bootstrap');
  document.documentElement.classList.remove('observer-bootstrap');

  if (config.IS_DEV) {
    document.body.appendChild(stats.dom);
  }
}

async function hydrateShopCacheFromServer(): Promise<void> {
  try {
    const response = await apiFetch('/api/economy/account');
    if (!response.ok) {
      return;
    }

    const body = await response.json();
    if (body?.authenticated !== true || body?.account === undefined) {
      return;
    }

    const account = body.account;
    gameStorage.setBoolean(
      config.STORAGE_KEY_SHOP_WALLET_CONNECTED,
      true,
    );
    gameStorage.set(
      config.STORAGE_KEY_SHOP_WALLET_ADDRESS,
      account.walletAddress || '',
    );
    gameStorage.setNumber(
      config.STORAGE_KEY_SHOP_TOKEN_BALANCE,
      Number(account.tokenBalance ?? config.SHOP_STARTING_TOKEN_BALANCE),
    );
    gameStorage.setNumber(
      config.STORAGE_KEY_SHOP_SOL_BALANCE,
      Number(account.solBalance ?? config.SHOP_STARTING_SOL_BALANCE),
    );
    gameStorage.setNumber(
      config.STORAGE_KEY_SHOP_FUEL_BALANCE,
      Number(account.fuelBalance ?? 0),
    );
    gameStorage.set(
      config.STORAGE_KEY_SHOP_INVENTORY,
      JSON.stringify(account.inventory || {}),
    );
    gameStorage.set(
      config.STORAGE_KEY_SHOP_LOADOUT,
      JSON.stringify(account.loadout || {}),
    );
    gameStorage.save();
  } catch {
    // Best effort only.
  }
}

// Simulation: runs at a fixed timestep, possibly several times per animation
// frame. Input is polled per sim step so edge detection stays correct when a
// frame advances more than one step.
gameLoop.update.addListener((event) => {
  inputManager.update();
  gameLoop.setTimeScale(
    isReplayPlayback || inputManager.isReplaying()
      ? REPLAY_PLAYBACK_SPEED
      : 1,
  );

  updateArgs.deltaTime = event.deltaTime;
  updateArgs.pointerClick = pendingPointerClick;
  updateArgs.pointerSwipe = pendingPointerSwipe;
  pendingPointerClick = null;
  pendingPointerSwipe = null;

  const scene = sceneRouter.getCurrentScene();
  // Snapshot positions before the step moves anything, so the renderer can
  // interpolate between this step and the next for smooth motion.
  const root = scene.getRoot();
  if (root != null) {
    root.traverse((object) => {
      object.interpCapture();
    });
  }
  scene.invokeUpdate(updateArgs);

  const replayDeadline = performance.now() + 8;
  let replaySteps = 0;
  while (replaySteps < 8 && performance.now() < replayDeadline) {
    const replayDeltaTime = webRtcMatch.beginCatchUpStep();
    if (replayDeltaTime === null) {
      break;
    }
    updateArgs.deltaTime = replayDeltaTime;
    try {
      scene.invokeUpdate(updateArgs);
    } finally {
      webRtcMatch.endCatchUpStep();
    }
    replaySteps += 1;
  }
  updateArgs.deltaTime = event.deltaTime;
});

// Presentation: runs exactly once per animation frame.
gameLoop.render.addListener((event) => {
  if (isHeadlessBroadcaster) {
    gameState.update();
    return;
  }

  stats.begin();
  const currentSceneType = sceneRouter.getCurrentType();
  document.body.classList.toggle(
    'main-menu-active',
    currentSceneType === GameSceneType.MainMenu,
  );
  document.body.classList.toggle(
    'shop-active',
    currentSceneType === GameSceneType.MainShop,
  );
  document.body.classList.toggle(
    'ranking-active',
    currentSceneType === GameSceneType.MainRanking,
  );
  document.body.classList.toggle(
    'settings-active',
    currentSceneType === GameSceneType.SettingsMenu,
  );
  document.body.classList.toggle(
    'results-active',
    currentSceneType === GameSceneType.LevelScore,
  );
  document.body.classList.toggle(
    'panel-screen-active',
    currentSceneType === GameSceneType.MainAirdrop ||
      currentSceneType === GameSceneType.MainBoost ||
      currentSceneType === GameSceneType.MainEvents ||
      currentSceneType === GameSceneType.MainMore ||
      currentSceneType === GameSceneType.MainPlayerProfile ||
      currentSceneType === GameSceneType.MainSocials ||
      currentSceneType === GameSceneType.MainStaking ||
      currentSceneType === GameSceneType.MainTankSelect ||
      currentSceneType === GameSceneType.MainTrading ||
      currentSceneType === GameSceneType.MainTreasury ||
      currentSceneType === GameSceneType.MainWiki,
  );
  syncMobileCanvasCssSize();

  const scene = sceneRouter.getCurrentScene();
  const root = scene.getRoot();
  // The scene root is built on the scene's first update. Skip rendering until
  // it exists — e.g. a frame between scene transitions where no sim step has
  // run for the newly-current scene yet.
  if (root != null) {
    gameRenderer.render(root, event.alpha);
  }

  // Cosmetic particle overlay: advance + draw once per animation frame using
  // real elapsed time, independent of the fixed sim step. Clamped so a
  // backgrounded tab doesn't fast-forward the effects on return.
  const now = performance.now();
  const particleDt =
    lastParticleTime === null
      ? 0
      : Math.min(0.05, (now - lastParticleTime) / 1000);
  lastParticleTime = now;
  particles.update(particleDt);
  particles.render();

  gameState.update();
  updateMobileGamepadDebug();
  mobileTouchController.update(
    document.body.classList.contains('level-playing') &&
      !isReplayPlayback &&
      !inputManager.isReplaying(),
  );

  stats.end();
});

async function preloadUiFont(): Promise<void> {
  const fontSet = (document as Document & {
    fonts?: { load(font: string): Promise<unknown> };
  }).fonts;

  if (fontSet === undefined) {
    return;
  }

  await Promise.all([
    fontSet.load('400 24px "Battle Cities UI"'),
    fontSet.load('600 24px "Battle Cities UI"'),
    fontSet.load('700 24px "Battle Cities UI"'),
  ]);
}

function getInitialMenuSpriteIds(): string[] {
  const ids = [
    'menu.item.start',
    'menu.item.shop',
    'menu.item.ranking',
    'menu.item.headquarters',
    'menu.item.settings',
    'menu.item.logout',
  ];

  if (config.IS_DEV) {
    ids.push(
      'menu.item.2players',
      'menu.item.modes',
      'menu.item.construction',
      'menu.item.replay',
    );
  }

  if (config.isMobileTouchViewport()) {
    ids.push(
      'menu.background.mobile',
      'menu.hud.player',
      'menu.hud.score',
      'menu.hud.highScore',
      'menu.hud.eventBar',
    );
  } else {
    ids.push('menu.background');
  }

  return ids;
}

function startBackgroundSpritePreload(): void {
  const preload = (): void => {
    log.time('Background sprites preload');
    spriteLoader
      .preloadAllInBatchesAsync(3)
      .then(() => log.timeEnd('Background sprites preload'))
      .catch((error) => log.warn('Background sprite preload failed', error));
  };
  const requestIdle = (window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
  }).requestIdleCallback;

  if (typeof requestIdle === 'function') {
    requestIdle.call(window, preload, { timeout: 1000 });
  } else {
    window.setTimeout(preload, 100);
  }
}

async function main(): Promise<void> {
  const stopSplashMessages = startSplashMessages();
  if (!isHeadlessBroadcaster) {
    await preloadUiFont();
  }
  await waitForLogin();
  if (!isHeadlessBroadcaster && !isWebRtcObserver) {
    await hydrateShopCacheFromServer();
    if (!(await startAdminReplay())) {
      await startProfileReplay();
    }
    if (!isReplayPlayback) {
      startPresenceTracking();
    }
  }
  enterGameView();

  log.time('Audio preload');
  await audioLoader.preloadAllAsync();
  log.timeEnd('Audio preload');

  log.time('Rect font preload');
  await rectFontLoader.preloadAll();
  log.timeEnd('Rect font preload');

  log.time('Sprite font preload');
  await spriteFontLoader.preloadAllAsync();
  log.timeEnd('Sprite font preload');

  log.time('Color sprite font generation');
  colorSpriteFontGenerator.generate(
    config.PRIMARY_SPRITE_FONT_ID,
    config.COLOR_WHITE,
  );
  colorSpriteFontGenerator.generate(
    config.PRIMARY_SPRITE_FONT_ID,
    config.COLOR_GRAY,
  );
  colorSpriteFontGenerator.generate(
    config.PRIMARY_SPRITE_FONT_ID,
    config.COLOR_RED,
  );
  colorSpriteFontGenerator.generate(
    config.PRIMARY_SPRITE_FONT_ID,
    config.COLOR_YELLOW,
  );
  log.timeEnd('Color sprite font generation');

  log.time('Menu sprites preload');
  await spriteLoader.preloadAsync(getInitialMenuSpriteIds());
  log.timeEnd('Menu sprites preload');

  log.time('Input bindings load');
  inputManager.loadAllBindings();
  log.timeEnd('Input bindings load');

  stopSplashMessages();
  loadingElement.remove();
  if (!isHeadlessBroadcaster) {
    const gameCanvas = gameRenderer.getDomElement();
    const gameStage = document.createElement('div');
    gameStage.className = 'game-stage';
    document.body.appendChild(gameStage);
    gameStage.appendChild(gameCanvas);
    logCanvasSize('Game', gameCanvas);
    // Particle overlay sits directly above the game canvas.
    const particleCanvas = particles.getDomElement();
    gameStage.appendChild(particleCanvas);
    logCanvasSize('Particle', particleCanvas);
  } else {
    document.body.classList.add('headless-broadcaster');
    log.info('Headless WebRTC broadcaster simulation started');
  }

  gameLoop.start();
  if (!isHeadlessBroadcaster) {
    startBackgroundSpritePreload();
  }
  // gameLoop.next();
}

main();

if (config.IS_DEV) {
  window.gameLoop = gameLoop;
}
