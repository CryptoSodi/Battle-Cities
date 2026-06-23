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
