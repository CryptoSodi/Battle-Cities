import { DebugCameraMenu, DebugCollisionMenu } from '../../debug';
import { GameUpdateArgs, GameState, GameStorage, Session } from '../../game';
import {
  Border,
  BrickSuperTerrainTile,
  GroundField,
  Tank,
  WallShadowField,
} from '../../gameObjects';
import { InputDeviceType, InputManager } from '../../input';
import { PowerupType } from '../../powerup';
import { TankDeathReason } from '../../tank';
import { TerrainFactory, TerrainType } from '../../terrain';
import { ParticleSystem, Rect, Size, Timer, Vector } from '../../core';
import * as config from '../../config';

import { LevelEventBus, LevelScript, LevelWorld } from '../../level';
import {
  LevelEnemyDiedEvent,
  LevelPlayerDiedEvent,
  LevelPowerupPickedEvent,
} from '../../level/events';
import {
  LevelAudioScript,
  LevelBaseScript,
  LevelEnemyScript,
  LevelExplosionScript,
  LevelGameOverScript,
  LevelInfoScript,
  LevelIntroScript,
  LevelJuiceScript,
  LevelMinimapScript,
  LevelPauseScript,
  LevelPlayerOverScript,
  LevelPlayerScript,
  LevelPointsScript,
  LevelPowerupScript,
  LevelSpawnScript,
  LevelWinScript,
} from '../../level/scripts';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

import { saveReplay } from '../../replay';

import { LevelPlayLocationParams } from './params';

export class LevelPlayScene extends GameScene<LevelPlayLocationParams> {
  private world: LevelWorld;
  private eventBus: LevelEventBus;
  private session: Session;
  private inputManager: InputManager;
  private gameStorage: GameStorage;
  // Seed the match actually started with (captured once, before any replay's
  // reseed), so a real (non-replay) run can save it alongside the recording.
  private recordedSeed: number;
  // Which device single-player input was reading from at recording start
  // (see InputManager.activeDeviceType) -- must be saved and restored
  // alongside the seed and device logs, or a replay's single-player input
  // routing could start from a different device than the original match did.
  private recordedActiveDeviceType: InputDeviceType;
  // TEMPORARY diagnostic counter (remove once the replay-determinism bug is
  // found): sim ticks elapsed since this level's setup(), so logged events
  // can be compared by tick number across separate replay watches.
  private replayDebugTick: number = null;
  private debugCollisionMenu: DebugCollisionMenu;
  private debugCameraMenu: DebugCameraMenu;
  // Live gameplay zoom (adjustable via the debug panel); defaults to config.
  private cameraZoom = config.GAMEPLAY_ZOOM;
  private baseCameraZoom = config.GAMEPLAY_ZOOM;
  private zoomOutTimer = new Timer();
  private initialCameraTarget: Vector;
  // Reactive-camera state (all presentation-only; never read by the sim).
  private cameraBase: Vector = null; // smoothed follow position (no shake)
  private prevPlayerCenter: Vector = null;
  private lookAheadX = 0;
  private lookAheadY = 0;
  private cameraTrauma = 0;
  // When set, the camera focuses this world point instead of following the
  // player (death blast hold, destroyed-base pan). Auto-cleared by the timer
  // for the death hold; left set (no timer) for the base.
  private cameraFocus: Vector = null;
  private cameraFocusTimer = new Timer();
  private particles: ParticleSystem;
  private requestHitStop: (seconds: number) => void = () => undefined;

  private allScripts: LevelScript[] = [];
  private alwaysUpdateScripts: LevelScript[] = [];
  private playingUpdateScripts: LevelScript[] = [];

  private audioScript: LevelAudioScript;
  private minimapScript: LevelMinimapScript;
  private baseScript: LevelBaseScript;
  private enemyScript: LevelEnemyScript;
  private explosionScript: LevelExplosionScript;
  private gameOverScript: LevelGameOverScript;
  private infoScript: LevelInfoScript;
  private introScript: LevelIntroScript;
  private juiceScript: LevelJuiceScript;
  private playerOverScript: LevelPlayerOverScript;
  private playerScript: LevelPlayerScript;
  private pointsScript: LevelPointsScript;
  private powerupScript: LevelPowerupScript;
  private pauseScript: LevelPauseScript;
  private spawnScript: LevelSpawnScript;
  private winScript: LevelWinScript;

  protected setup(updateArgs: GameUpdateArgs): void {
    const { collisionSystem, inputManager, gameStorage, rng, session } = updateArgs;
    this.gameStorage = gameStorage;
    document.querySelectorAll('.mobile-gamepad-qr').forEach((element) => {
      element.remove();
    });

    // Dev-only match replay (see src/replay): if entered with a recorded
    // replay, reseed the sim to the exact point its recording started from
    // and swap every input device for a RecordedInputDevice playing that log
    // back. Otherwise, reseed to a fresh checkpoint (rng is one shared
    // instance for the whole app session, so rng.getSeed() would only return
    // its original app-startup seed, not where its sequence currently sits --
    // reseeding here gives a clean, capturable starting point for this
    // level's draws) and wrap every device in an InputRecorderDevice so a
    // real playthrough gets captured and can be saved as the next "last
    // replay". Both branches must run BEFORE reset() below so recording/
    // playback starts at the same point (right after reset) it'll be read
    // back from.
    const { replay } = this.params;
    if (replay !== undefined) {
      rng.reseed(replay.seed);
      inputManager.startReplay(replay.deviceFrames);
      // Restore single-player's device-routing state to what it was when
      // recording began -- it isn't captured by the per-device frame logs
      // themselves (see InputManager.activeDeviceType), so without this a
      // replay could read player input from the wrong device.
      inputManager.setActiveDeviceType(replay.activeDeviceType);

      // TEMPORARY diagnostic (remove once the replay-determinism bug is
      // found): confirm the seed/data actually loaded is identical every
      // time this same saved replay is watched.
      if (config.IS_DEV) {
        // eslint-disable-next-line no-console
        console.log('[replay] seed=', replay.seed, 'getSeed()=', rng.getSeed());
        // eslint-disable-next-line no-console
        console.log('[replay] activeDeviceType=', replay.activeDeviceType);
        // eslint-disable-next-line no-console
        console.log(
          '[replay] deviceFrames checksum=',
          JSON.stringify(replay.deviceFrames).length,
          Object.keys(replay.deviceFrames)
            .map((key) => `${key}:${replay.deviceFrames[key].length}`)
            .join(' '),
        );
        this.replayDebugTick = 0;
      }
    } else {
      this.recordedSeed = (Date.now() >>> 0) || 1;
      rng.reseed(this.recordedSeed);
      inputManager.startRecording();
      this.recordedActiveDeviceType = inputManager.getActiveDeviceType();
    }

    // Drop any input state carried in from the menu/transition so a key still
    // "held" (or stuck from a missed keyup) can't move the tank on spawn.
    inputManager.reset();
    // Fresh overlay — drop any particles left over from a previous scene.
    this.particles = updateArgs.particles;
    this.particles.clear();
    this.requestHitStop = updateArgs.hitStop;
    const { mapConfig } = this.params;
    const fieldWidth = mapConfig.getFieldWidth();
    const fieldHeight = mapConfig.getFieldHeight();
    const targetTilesWide =
      mapConfig.getFieldTileWidth() === config.LEGACY_FIELD_TILE_COUNT &&
      mapConfig.getFieldTileHeight() === config.LEGACY_FIELD_TILE_COUNT
        ? config.CLASSIC_TARGET_TILES_WIDE
        : config.TARGET_TILES_WIDE;
    this.baseCameraZoom = config.getResponsiveZoom(targetTilesWide);
    this.cameraZoom = this.baseCameraZoom;
    this.zoomOutTimer.done.addListener(this.handleZoomOutTimer);
    this.cameraFocusTimer.done.addListener(() => {
      this.cameraFocus = null;
    });

    this.debugCollisionMenu = new DebugCollisionMenu(
      collisionSystem,
      this.root,
      () => this.world?.field ?? null,
      { top: 560 },
    );
    this.debugCameraMenu = new DebugCameraMenu(
      () => this.cameraZoom,
      (zoom) => {
        this.baseCameraZoom = zoom;
        this.cameraZoom = zoom;
      },
      { left: undefined, top: 690 },
    );
    if (config.IS_DEV) {
      this.debugCollisionMenu.attach();
      this.debugCollisionMenu.show();
      this.debugCameraMenu.attach();
    }

    this.world = new LevelWorld(this.root, fieldWidth, fieldHeight);

    this.world.field.position.set(
      config.BORDER_LEFT_WIDTH,
      config.LEVEL_PLAY_TOP_OFFSET + config.BORDER_TOP_BOTTOM_HEIGHT,
    );
    // Grass ground beneath everything (tiles across the whole field).
    this.world.field.add(new GroundField(fieldWidth, fieldHeight));
    // Soft drop shadow cast by walls onto the ground (above grass, below tiles).
    this.world.field.add(new WallShadowField(fieldWidth, fieldHeight));
    this.world.field.add(new Border(fieldWidth, fieldHeight));
    this.root.add(this.world.field);

    this.eventBus = new LevelEventBus();

    this.inputManager = inputManager;
    this.session = session;
    this.applyRunExtraLives();

    const playerSpawnPositions = mapConfig.getPlayerSpawnPositions();
    this.initialCameraTarget =
      playerSpawnPositions[0]?.clone() ?? new Vector(0, 0);
    this.initialCameraTarget.addScalar(config.TILE_SIZE_LARGE / 2);

    const terrainRegions = mapConfig.getTerrainRegions();
    // The eagle base isn't a terrain region, but bricks resting on it should
    // treat it as solid (top brick, not the grass base course).
    const basePosition = mapConfig.getBasePosition();
    const baseRect = new Rect(
      basePosition.x,
      basePosition.y,
      config.BASE_DEFAULT_SIZE.width,
      config.BASE_DEFAULT_SIZE.height,
    );
    const tiles = TerrainFactory.createMapFromRegionConfigs(
      terrainRegions,
      fieldWidth,
      fieldHeight,
      [baseRect],
    );

    for (const tile of tiles) {
      tile.destroyed.addListener(() => {
        this.eventBus.mapTileDestroyed.notify({
          type: tile.type,
          position: tile.position.clone(),
          size: tile.size.clone(),
        });
      });

      // Bricks are nested super-tiles: the super-tile's `destroyed` only fires
      // once the whole 32px cell is cleared, so per-brick chips would otherwise
      // show no debris. Spawn debris off each individual sub-brick instead.
      if (tile instanceof BrickSuperTerrainTile) {
        tile.subTileDestroyed.addListener((center) => {
          this.spawnDebrisAt(center.x, center.y);
        });
      }
    }

    this.world.field.add(...tiles);

    this.audioScript = new LevelAudioScript();
    this.minimapScript = new LevelMinimapScript();
    this.baseScript = new LevelBaseScript();
    this.enemyScript = new LevelEnemyScript();
    this.explosionScript = new LevelExplosionScript();
    this.gameOverScript = new LevelGameOverScript();
    this.infoScript = new LevelInfoScript();
    this.introScript = new LevelIntroScript();
    this.juiceScript = new LevelJuiceScript();
    this.pauseScript = new LevelPauseScript();
    this.playerOverScript = new LevelPlayerOverScript();
    this.playerScript = new LevelPlayerScript();
    this.pointsScript = new LevelPointsScript();
    this.powerupScript = new LevelPowerupScript();
    this.spawnScript = new LevelSpawnScript();
    this.winScript = new LevelWinScript();

    this.allScripts = [
      this.audioScript,
      this.minimapScript,
      this.baseScript,
      this.enemyScript,
      this.explosionScript,
      this.gameOverScript,
      this.infoScript,
      this.introScript,
      this.juiceScript,
      this.pauseScript,
      this.playerOverScript,
      this.playerScript,
      this.pointsScript,
      this.powerupScript,
      this.spawnScript,
      this.winScript,
    ];

    this.allScripts.forEach((script) => {
      script.invokeInit(this.world, this.eventBus, session, mapConfig);
    });

    // When intro starts, enable only it and audio
    this.alwaysUpdateScripts = [this.audioScript, this.introScript];

    // When intro is completed, enable the rest of the scripts
    this.introScript.completed.addListener(() => {
      this.alwaysUpdateScripts.push(
        this.gameOverScript,
        this.pauseScript,
        this.winScript,
      );

      this.playingUpdateScripts.push(
        this.minimapScript,
        this.baseScript,
        this.explosionScript,
        this.juiceScript,
        this.infoScript,
        this.enemyScript,
        this.spawnScript,
        this.playerOverScript,
        this.playerScript,
        this.pointsScript,
        this.powerupScript,
      );
    });

    this.eventBus.baseDied.addListener(this.handleBaseDied);
    this.eventBus.enemyAllDied.addListener(this.handleEnemyAllDied);
    this.eventBus.enemyDied.addListener(this.handleEnemyDied);
    this.eventBus.playerDied.addListener(this.handlePlayerDied);
    this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
    this.eventBus.levelGameOverCompleted.addListener(
      this.handleLevelGameOverCompleted,
    );
    this.eventBus.levelGameOverMoveBlocked.addListener(
      this.handleLevelGameOverMoveBlocked,
    );
    this.eventBus.levelWinCompleted.addListener(this.handleLevelWinCompleted);

    // Reactive-camera trauma (screen shake) fed off gameplay events.
    this.eventBus.playerFired.addListener(() => {
      this.addCameraTrauma(config.CAMERA_TRAUMA_FIRE);
    });
    this.eventBus.enemyExploded.addListener(() => {
      this.addCameraTrauma(config.CAMERA_TRAUMA_ENEMY_EXPLODE);
      // Brief hit-stop for kill crunch. Explosion particles come from the
      // Explosion object itself.
      this.requestHitStop(config.HIT_STOP_KILL * config.CAMERA_SHAKE_INTENSITY);
    });
    this.eventBus.mapTileDestroyed.addListener((event) => {
      this.addCameraTrauma(config.CAMERA_TRAUMA_TILE);
      // Brick debris is emitted per sub-brick via subTileDestroyed; the
      // super-tile's own destroy event would double the burst on the last
      // chip. Other tile types (steel, etc.) still spawn debris here.
      if (event.type !== TerrainType.BrickSuper) {
        this.spawnTileDebris(event.position, event.size);
      }
    });

    // TEMPORARY diagnostic (remove once the replay-determinism bug is
    // found): log every enemy spawn's tick/type/position during a replay
    // watch, so two separate watches of the same saved replay can be
    // compared line-by-line for the first point they diverge.
    if (config.IS_DEV) {
      this.eventBus.enemySpawnCompleted.addListener((event) => {
        if (this.replayDebugTick === null) {
          return;
        }
        // eslint-disable-next-line no-console
        console.log(
          '[replay] tick=',
          this.replayDebugTick,
          'enemySpawnCompleted partyIndex=',
          event.partyIndex,
          'type=',
          event.type.tier,
          'pos=',
          event.centerPosition.x,
          event.centerPosition.y,
        );
      });
    }
  }

  // Adds screen-shake trauma (clamped to 1). Presentation-only.
  private addCameraTrauma(amount: number): void {
    this.cameraTrauma = Math.min(1, this.cameraTrauma + amount);
  }

  // Cosmetic debris flecks when a whole tile (e.g. steel) is destroyed.
  private spawnTileDebris(position: Vector, size: Size): void {
    this.spawnDebrisAt(position.x + size.width / 2, position.y + size.height / 2);
  }

  // Cosmetic debris flecks emitted at a field-local center point.
  private spawnDebrisAt(centerX: number, centerY: number): void {
    const count = Math.round(6 * config.PARTICLE_INTENSITY);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;
      this.particles.spawn({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.35 + Math.random() * 0.35,
        size: 2 + Math.random() * 2,
        color: 'rgb(150,72,40)',
        gravity: 300,
        drag: 1.2,
      });
    }
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { collisionSystem, gameState } = updateArgs;
    if (this.replayDebugTick !== null) {
      this.replayDebugTick += 1;
    }
    this.zoomOutTimer.update(updateArgs.deltaTime);
    this.cameraFocusTimer.update(updateArgs.deltaTime);

    this.alwaysUpdateScripts.forEach((script) => {
      script.invokeUpdate(updateArgs);
    });

    if (!gameState.is(GameState.Paused)) {
      // These scripts won't run when game is paused
      this.playingUpdateScripts.forEach((script) => {
        // Extra check not to run same script twice
        if (this.alwaysUpdateScripts.includes(script)) {
          return;
        }

        script.invokeUpdate(updateArgs);
      });
    }

    // Update all objects on the scene
    this.root.traverseDescedants((node) => {
      const shouldUpdate = gameState.is(GameState.Playing) || node.ignorePause;
      if (shouldUpdate) {
        node.invokeUpdate(updateArgs);
      }
    });

    this.updateCamera(updateArgs.deltaTime);

    this.root.updateWorldMatrix(false, true);

    collisionSystem.update();

    if (config.IS_DEV) {
      this.debugCollisionMenu.update();
    }

    collisionSystem.collide();
    this.clampTanksToFieldBounds();
  }

  private updateCamera(deltaTime: number): void {
    const targetTank = this.world.getPlayerTanks()[0];
    const fieldWidth = this.world.field.size.width;
    const fieldHeight = this.world.field.size.height;
    const viewportWidth =
      config.CANVAS_WIDTH -
      config.BORDER_LEFT_WIDTH -
      config.BORDER_RIGHT_WIDTH;
    const viewportHeight =
      config.CANVAS_HEIGHT -
      config.LEVEL_PLAY_TOP_OFFSET -
      config.BORDER_TOP_BOTTOM_HEIGHT * 2;

    // Gameplay zoom is render-only: the field is drawn scaled around the play
    // area's screen center (the pivot), so the camera centers on the same world
    // point regardless of zoom — only the visible world window shrinks.
    const zoom = this.cameraZoom;
    const playLeft = config.BORDER_LEFT_WIDTH;
    const playTop =
      config.LEVEL_PLAY_TOP_OFFSET + config.BORDER_TOP_BOTTOM_HEIGHT;
    const pivotX = playLeft + viewportWidth / 2;
    const pivotY = playTop + viewportHeight / 2;

    // World units visible after zoom (zoomed in => fewer tiles on screen).
    const windowWidth = viewportWidth / zoom;
    const windowHeight = viewportHeight / zoom;

    this.world.field.cameraZoom = zoom;
    this.world.field.cameraPivotX = pivotX;
    this.world.field.cameraPivotY = pivotY;

    // Camera target: a temporary focus override (holding on the death blast, or
    // panning to the destroyed base) takes priority; otherwise follow player 1,
    // falling back to the spawn point when there is no player tank.
    const following =
      this.cameraFocus === null &&
      targetTank !== null &&
      targetTank !== undefined;
    let targetCenter: Vector;
    if (this.cameraFocus !== null) {
      targetCenter = this.cameraFocus;
    } else if (targetTank !== null && targetTank !== undefined) {
      targetCenter = targetTank.getCenter();
    } else {
      targetCenter = this.initialCameraTarget;
    }

    // Look-ahead: bias the centered point toward the player's movement so more
    // of the level ahead is visible. Only while actively following the player;
    // eases back to zero otherwise (focus / spawn / dead).
    let desiredLookX = 0;
    let desiredLookY = 0;
    if (following) {
      if (this.prevPlayerCenter !== null) {
        const vx = targetCenter.x - this.prevPlayerCenter.x;
        const vy = targetCenter.y - this.prevPlayerCenter.y;
        const speed = Math.hypot(vx, vy);
        if (speed > 0.01) {
          desiredLookX = (vx / speed) * config.CAMERA_LOOK_AHEAD;
          desiredLookY = (vy / speed) * config.CAMERA_LOOK_AHEAD;
        }
      }
      this.prevPlayerCenter = targetCenter.clone();
    } else {
      this.prevPlayerCenter = null;
    }
    this.lookAheadX +=
      (desiredLookX - this.lookAheadX) * config.CAMERA_LOOK_AHEAD_LERP;
    this.lookAheadY +=
      (desiredLookY - this.lookAheadY) * config.CAMERA_LOOK_AHEAD_LERP;

    // World point to keep centered (target + look-ahead), clamped so the visible
    // window never leaves the field (or centered when the field is smaller).
    let centerX = fieldWidth / 2;
    let centerY = fieldHeight / 2;
    if (targetCenter !== null && targetCenter !== undefined) {
      const rawX = targetCenter.x + this.lookAheadX;
      const rawY = targetCenter.y + this.lookAheadY;
      centerX =
        fieldWidth <= windowWidth
          ? fieldWidth / 2
          : Math.max(
              windowWidth / 2,
              Math.min(fieldWidth - windowWidth / 2, rawX),
            );
      centerY =
        fieldHeight <= windowHeight
          ? fieldHeight / 2
          : Math.max(
              windowHeight / 2,
              Math.min(fieldHeight - windowHeight / 2, rawY),
            );
    }

    // field.position is a plain translation (collision-safe); the renderer adds
    // the zoom around the pivot. Centering: screen(centerX) == pivotX.
    const targetX = pivotX - centerX;
    const targetY = pivotY - centerY;

    // Follow: the camera BASE tracks the target. During normal play it snaps
    // (locked, zero lag) so driving feels crisp; only a large discontinuous
    // jump — e.g. recentering on the spawn after death — eases in so the whole
    // field pans smoothly instead of teleporting. Shake is added on top of the
    // base (below) so it never feeds back into the follow. First frame snaps.
    if (this.cameraBase === null) {
      this.cameraBase = new Vector(targetX, targetY);
    } else {
      const dx = targetX - this.cameraBase.x;
      const dy = targetY - this.cameraBase.y;
      if (Math.hypot(dx, dy) > config.CAMERA_SNAP_THRESHOLD) {
        this.cameraBase.x += dx * config.CAMERA_FOLLOW_LERP;
        this.cameraBase.y += dy * config.CAMERA_FOLLOW_LERP;
      } else {
        this.cameraBase.x = targetX;
        this.cameraBase.y = targetY;
      }
    }

    // Trauma shake: decays over time; offset scales with trauma^2 for a punchy
    // falloff. Cosmetic only, so it uses unseeded Math.random (NOT the sim rng)
    // and is divided by zoom so the on-screen magnitude is zoom-independent.
    this.cameraTrauma = Math.max(
      0,
      this.cameraTrauma - config.CAMERA_TRAUMA_DECAY * deltaTime,
    );
    const shakeMagnitude =
      this.cameraTrauma *
      this.cameraTrauma *
      config.CAMERA_MAX_SHAKE *
      config.CAMERA_SHAKE_INTENSITY;
    let shakeX = 0;
    let shakeY = 0;
    if (shakeMagnitude > 0) {
      shakeX = ((Math.random() * 2 - 1) * shakeMagnitude) / zoom;
      shakeY = ((Math.random() * 2 - 1) * shakeMagnitude) / zoom;
    }

    const newX = this.cameraBase.x + shakeX;
    const newY = this.cameraBase.y + shakeY;

    if (
      this.world.field.position.x !== newX ||
      this.world.field.position.y !== newY
    ) {
      this.root.setNeedsPaint();
      this.world.field.position.set(newX, newY);
      this.world.field.updateMatrix(true);
    }

    // Feed the same camera transform to the particle overlay so particles
    // (in field-local coords) map to the same screen position as the world.
    // screen = local * zoom + (field.position * zoom + pivot * (1 - zoom)).
    this.particles.setView(
      zoom,
      newX * zoom + pivotX * (1 - zoom),
      newY * zoom + pivotY * (1 - zoom),
    );
  }

  private clampTanksToFieldBounds(): void {
    const maxX = this.world.field.size.width - config.TILE_SIZE_LARGE;
    const maxY = this.world.field.size.height - config.TILE_SIZE_LARGE;

    this.world.field.traverseDescedants((node) => {
      if (!(node instanceof Tank)) {
        return;
      }

      const nextX = Math.max(0, Math.min(node.position.x, maxX));
      const nextY = Math.max(0, Math.min(node.position.y, maxY));

      if (node.position.x === nextX && node.position.y === nextY) {
        return;
      }

      this.root.setNeedsPaint();
      node.position.set(nextX, nextY);
      node.updateMatrix(true);
      node.collider.update();
    });
  }

  private handlePlayerDied = (event: LevelPlayerDiedEvent): void => {
    this.addCameraTrauma(config.CAMERA_TRAUMA_PLAYER_DIED);
    this.requestHitStop(config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY);
    this.particles.flash(config.FLASH_PLAYER_DIED * config.CAMERA_SHAKE_INTENSITY);
    // Hold the camera on the death blast for a moment before it releases back
    // to the spawn point (where the respawn, delayed by PLAYER_SPAWN_DELAY,
    // then plays out).
    this.cameraFocus = event.centerPosition.clone();
    this.cameraFocusTimer.reset(config.CAMERA_DEATH_HOLD);
    const playerSession = this.session.getPlayer(event.partyIndex);
    playerSession.removeLife();

    if (this.session.isAnyPlayerAlive()) {
      // If other player is alive, but current player is dead - show
      // notification for dead player that his game is over. Only the first
      // player who dies gets this notification.
      if (!playerSession.isAlive()) {
        this.playerOverScript.setPlayerIndex(event.partyIndex);
        this.playerOverScript.enable();
      }
      return;
    }

    // If both players die - game is lost

    this.session.setGameOver();

    this.pauseScript.disable();
    this.playerScript.disable();
    this.gameOverScript.enable();

    // Game can be lost even after level is won if the base is killed
    this.winScript.disable();
  };

  private handleEnemyAllDied = (): void => {
    this.pauseScript.disable();
    this.winScript.enable();
  };

  private handleEnemyDied = (event: LevelEnemyDiedEvent): void => {
    // Only kills are awarded
    if (event.reason === TankDeathReason.WipeoutPowerup) {
      return;
    }

    const playerSession = this.session.getPlayer(event.hitterPartyIndex);

    playerSession.addKillPoints(event.type.tier);
  };

  private handlePowerupPicked = (event: LevelPowerupPickedEvent): void => {
    const playerSession = this.session.getPlayer(event.partyIndex);

    playerSession.addPowerupPoints(event.type);

    if (event.type === PowerupType.Life) {
      playerSession.addLife();
    }

    if (event.type === PowerupType.ZoomOut) {
      this.cameraZoom =
        this.baseCameraZoom * config.ZOOM_OUT_POWERUP_MULTIPLIER;
      this.zoomOutTimer.reset(config.ZOOM_OUT_POWERUP_DURATION);
    }
  };

  private handleZoomOutTimer = (): void => {
    this.cameraZoom = this.baseCameraZoom;
  };

  private applyRunExtraLives(): void {
    const extraLives = this.session.getRunConsumables().extraLives;

    for (let index = 0; index < extraLives; index += 1) {
      this.session.primaryPlayer.addLife();
      if (this.session.isMultiplayer()) {
        this.session.secondaryPlayer.addLife();
      }
    }
  }

  private handleBaseDied = (): void => {
    this.addCameraTrauma(config.CAMERA_TRAUMA_BASE_DIED);
    this.requestHitStop(config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY);
    this.particles.flash(config.FLASH_BASE_DIED * config.CAMERA_SHAKE_INTENSITY);
    // Pan the camera to the base so the player sees it get destroyed. No timer —
    // it stays there through the game-over sequence.
    const basePosition = this.params.mapConfig.getBasePosition();
    this.cameraFocus = new Vector(
      basePosition.x + config.BASE_DEFAULT_SIZE.width / 2,
      basePosition.y + config.BASE_DEFAULT_SIZE.height / 2,
    );
    this.cameraFocusTimer.stop();
    this.session.setGameOver();

    this.pauseScript.disable();
    this.playerScript.disable();
    this.gameOverScript.enable();

    // Player can lose even after level is won
    this.winScript.disable();
  };

  // Block user input after some delay when game is over
  private handleLevelGameOverMoveBlocked = (): void => {
    this.inputManager.unlisten();
  };

  private handleLevelGameOverCompleted = (): void => {
    // Restore input
    this.inputManager.listen();

    this.finishInputCapture();

    if (this.session.isPlaytest()) {
      this.navigator.replace(GameSceneType.EditorMenu);
      return;
    }

    this.navigator.replace(GameSceneType.LevelScore);
  };

  private handleLevelWinCompleted = (): void => {
    this.finishInputCapture();

    if (this.session.isPlaytest()) {
      this.navigator.replace(GameSceneType.EditorMenu);
      return;
    }

    this.navigator.replace(GameSceneType.LevelScore);
  };

  // Wraps up whichever input capture mode this level started in: saves a
  // completed recording as the next "last replay" (dev-only REPLAY menu
  // item), or just restores live devices after a replay finished playing.
  private finishInputCapture(): void {
    if (this.inputManager.isRecording()) {
      const deviceFrames = this.inputManager.stopRecording();
      saveReplay(this.gameStorage, {
        seed: this.recordedSeed,
        levelNumber: this.session.getLevelNumber(),
        deviceFrames,
        activeDeviceType: this.recordedActiveDeviceType,
      });
      return;
    }

    if (this.inputManager.isReplaying()) {
      this.inputManager.stopReplay();
    }
  }
}
