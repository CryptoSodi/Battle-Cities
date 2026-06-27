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
import { InputHintSettings, InputManager } from './input';
import { ManifestMapListReader, MapLoader } from './map';
import { PointsHighscoreManager } from './points';
import { GameSceneRouter, GameSceneType } from './scenes';

import * as config from './config';

import * as audioManifest from '../data/audio.manifest.json';
import * as spriteManifest from '../data/sprite.manifest.json';
import * as spriteFontConfig from '../data/fonts/sprite-font.json';
import * as rectFontConfig from '../data/fonts/rect-font.json';
import * as mapManifest from '../data/map.manifest.json';

const loadingElement = document.querySelector('[data-loading]');

const log = new Logger('main', Logger.Level.Debug);

const rendererOverride = new URLSearchParams(window.location.search).get(
  'renderer',
);
const gameRenderer = new GameRenderer({
  // debug: true,
  height: config.CANVAS_HEIGHT,
  width: config.CANVAS_WIDTH,
  renderer:
    rendererOverride === 'canvas' || rendererOverride === 'webgl'
      ? rendererOverride
      : 'auto',
  renderScale: config.RENDER_SCALE,
});

function syncCanvasCssSize(width: number, height: number): void {
  document.documentElement.style.setProperty('--game-width', width.toString());
  document.documentElement.style.setProperty('--game-height', height.toString());
}

syncCanvasCssSize(config.CANVAS_WIDTH, config.CANVAS_HEIGHT);

let resizeTimeoutId: number = null;
window.addEventListener('resize', () => {
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
  true,
);
document.body.classList.toggle('scanlines-disabled', !showScanlines);

const inputManager = new InputManager(gameStorage);
inputManager.listen();

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
  right: clamp(12px, 3vw, 32px);
  text-align: center;
  top: clamp(72px, 20vh, 180px);
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
@media (max-width: 620px) {
  .mobile-gamepad-qr {
    right: 12px;
    top: 64px;
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
  height: 128px;
  left: 14px;
  opacity: 0.92;
  pointer-events: none;
  position: fixed;
  width: 214px;
  z-index: 21;
}
.mobile-gamepad-debug.visible {
  display: block;
}
.mobile-gamepad-debug__body {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  height: 96px;
  left: 18px;
  position: absolute;
  top: 16px;
  width: 96px;
}
.mobile-gamepad-debug__body::before,
.mobile-gamepad-debug__body::after {
  background: rgba(255, 174, 10, 0.22);
  content: "";
  height: 2px;
  left: 18px;
  position: absolute;
  top: 47px;
  width: 60px;
}
.mobile-gamepad-debug__body::after {
  transform: rotate(90deg);
}
.mobile-gamepad-debug__stick {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 50%;
  height: 34px;
  left: 49px;
  position: absolute;
  top: 49px;
  transform: translate(calc(-50% + var(--debug-x)), calc(-50% + var(--debug-y)));
  width: 34px;
}
.mobile-gamepad-debug__stick.pressed {
  background: #ffae0a;
  border-color: #fff;
  box-shadow: 0 0 0 5px rgba(255, 174, 10, 0.28);
}
.mobile-gamepad-debug__dpad {
  height: 34px;
  left: 128px;
  position: absolute;
  top: 48px;
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
  font: 700 11px Arial, sans-serif;
  height: 28px;
  justify-content: center;
  position: absolute;
  width: 28px;
}
.mobile-gamepad-debug__button.pressed {
  background: #ffae0a;
  border-color: #fff;
  color: #000;
}
.mobile-gamepad-debug__button--x {
  right: 44px;
  top: 22px;
}
.mobile-gamepad-debug__button--y {
  right: 16px;
  top: 50px;
}
.mobile-gamepad-debug__button--a {
  right: 72px;
  top: 50px;
}
.mobile-gamepad-debug__button--b {
  right: 44px;
  top: 78px;
}
.mobile-gamepad-debug__meta {
  bottom: 9px;
  color: rgba(255, 255, 255, 0.68);
  font: 10px monospace;
  left: 122px;
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

function updateMobileGamepadDebug(): void {
  const gamepad = inputManager.getMobileGamepadHost().getGamepad(0);
  const visible = gamepad !== null && gamepad.connected === true;
  mobileGamepadDebugElement.classList.toggle('visible', visible);

  if (!visible) {
    return;
  }

  const axisX = Math.max(-1, Math.min(1, gamepad.axes[0] || 0));
  const axisY = Math.max(-1, Math.min(1, gamepad.axes[1] || 0));
  mobileGamepadDebugElement.style.setProperty('--debug-x', `${axisX * 31}px`);
  mobileGamepadDebugElement.style.setProperty('--debug-y', `${axisY * 31}px`);
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

  const age = gamepad.receivedAt === undefined ? 0 : Date.now() - gamepad.receivedAt;
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

const session = new Session();

const inputHintSettings = new InputHintSettings(gameStorage);

const pointsHighscoreManager = new PointsHighscoreManager(gameStorage);

const collisionSystem = new CollisionSystem();

const sceneRouter = new GameSceneRouter();
sceneRouter.start(GameSceneType.MainMenu);
sceneRouter.transitionStarted.addListener(() => {
  collisionSystem.reset();
});

const debugInspector = new DebugInspector(gameRenderer.getDomElement());
debugInspector.listen();
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
const rng = new Prng((Date.now() >>> 0) || 1);

const updateArgs: GameUpdateArgs = {
  audioManager,
  audioLoader,
  collisionSystem,
  colorSpriteFontGenerator,
  deltaTime: 0,
  gameStorage,
  imageLoader,
  inputHintSettings,
  inputManager,
  gameState,
  mapLoader,
  pointsHighscoreManager,
  rng,
  rectFontLoader,
  session,
  spriteFontLoader,
  spriteLoader,
};

const gameLoop = new GameLoop();

const stats = new Stats();
const debugGameLoopMenu = new DebugGameLoopMenu(gameLoop);

if (config.IS_DEV) {
  document.body.appendChild(stats.dom);
  debugGameLoopMenu.attach();
}

// Simulation: runs at a fixed timestep, possibly several times per animation
// frame. Input is polled per sim step so edge detection stays correct when a
// frame advances more than one step.
gameLoop.update.addListener((event) => {
  inputManager.update();

  updateArgs.deltaTime = event.deltaTime;

  const scene = sceneRouter.getCurrentScene();
  scene.invokeUpdate(updateArgs);
});

// Presentation: runs exactly once per animation frame.
gameLoop.render.addListener(() => {
  stats.begin();

  const scene = sceneRouter.getCurrentScene();
  const root = scene.getRoot();
  // The scene root is built on the scene's first update. Skip rendering until
  // it exists — e.g. a frame between scene transitions where no sim step has
  // run for the newly-current scene yet.
  if (root != null) {
    gameRenderer.render(root);
  }

  gameState.update();
  updateMobileGamepadDebug();

  stats.end();
});

async function main(): Promise<void> {
  log.time('Audio preload');
  loadingElement.textContent = 'Loading audio...';
  await audioLoader.preloadAllAsync();
  log.timeEnd('Audio preload');

  log.time('Rect font preload');
  loadingElement.textContent = 'Loading rects fonts...';
  await rectFontLoader.preloadAll();
  log.timeEnd('Rect font preload');

  log.time('Sprite font preload');
  loadingElement.textContent = 'Loading sprite fonts...';
  await spriteFontLoader.preloadAllAsync();
  log.timeEnd('Sprite font preload');

  log.time('Color sprite font generation');
  loadingElement.textContent = 'Generating sprite font colors...';
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

  log.time('Sprites preload');
  loadingElement.textContent = 'Loading sprites...';
  await spriteLoader.preloadAllAsync();
  log.timeEnd('Sprites preload');

  log.time('Input bindings load');
  loadingElement.textContent = 'Loading input bindings...';
  inputManager.loadAllBindings();
  log.timeEnd('Input bindings load');

  document.body.removeChild(loadingElement);
  document.body.appendChild(gameRenderer.getDomElement());

  gameLoop.start();
  // gameLoop.next();
}

main();

if (config.IS_DEV) {
  window.gameLoop = gameLoop;
}
