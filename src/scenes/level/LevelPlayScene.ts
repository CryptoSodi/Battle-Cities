import { DebugCameraMenu, DebugCollisionMenu } from '../../debug';
import { GameUpdateArgs, GameState, Session } from '../../game';
import { Border, GroundField, Tank, WallShadowField } from '../../gameObjects';
import { InputManager } from '../../input';
import { PowerupType } from '../../powerup';
import { TankDeathReason } from '../../tank';
import { TerrainFactory } from '../../terrain';
import { Rect, Vector } from '../../core';
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

import { LevelPlayLocationParams } from './params';

export class LevelPlayScene extends GameScene<LevelPlayLocationParams> {
  private world: LevelWorld;
  private eventBus: LevelEventBus;
  private session: Session;
  private inputManager: InputManager;
  private debugCollisionMenu: DebugCollisionMenu;
  private debugCameraMenu: DebugCameraMenu;
  // Live gameplay zoom (adjustable via the debug panel); defaults to config.
  private cameraZoom = config.GAMEPLAY_ZOOM;
  private initialCameraTarget: Vector;

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
  private playerOverScript: LevelPlayerOverScript;
  private playerScript: LevelPlayerScript;
  private pointsScript: LevelPointsScript;
  private powerupScript: LevelPowerupScript;
  private pauseScript: LevelPauseScript;
  private spawnScript: LevelSpawnScript;
  private winScript: LevelWinScript;

  protected setup(updateArgs: GameUpdateArgs): void {
    const { collisionSystem, inputManager, session } = updateArgs;
    const { mapConfig } = this.params;
    const fieldWidth = mapConfig.getFieldWidth();
    const fieldHeight = mapConfig.getFieldHeight();

    this.debugCollisionMenu = new DebugCollisionMenu(
      collisionSystem,
      this.root,
      { top: 470 },
    );
    this.debugCameraMenu = new DebugCameraMenu(
      () => this.cameraZoom,
      (zoom) => {
        this.cameraZoom = zoom;
      },
      { left: undefined, top: 580 },
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
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { collisionSystem, gameState } = updateArgs;

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

    this.updateCamera();

    this.root.updateWorldMatrix(false, true);

    collisionSystem.update();

    if (config.IS_DEV) {
      this.debugCollisionMenu.update();
    }

    collisionSystem.collide();
    this.clampTanksToFieldBounds();
  }

  private updateCamera(): void {
    const targetTank = this.world.getPlayerTanks()[0];
    const fieldWidth = this.world.field.size.width;
    const fieldHeight = this.world.field.size.height;
    const viewportWidth = config.CANVAS_WIDTH - config.BORDER_LEFT_WIDTH - config.BORDER_RIGHT_WIDTH;
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

    const targetCenter =
      targetTank !== null && targetTank !== undefined
        ? targetTank.getCenter()
        : this.initialCameraTarget;

    // World point to keep centered, clamped so the visible window never leaves
    // the field (or centered when the field is smaller than the window).
    let centerX = fieldWidth / 2;
    let centerY = fieldHeight / 2;
    if (targetCenter !== null && targetCenter !== undefined) {
      centerX =
        fieldWidth <= windowWidth
          ? fieldWidth / 2
          : Math.max(
              windowWidth / 2,
              Math.min(fieldWidth - windowWidth / 2, targetCenter.x),
            );
      centerY =
        fieldHeight <= windowHeight
          ? fieldHeight / 2
          : Math.max(
              windowHeight / 2,
              Math.min(fieldHeight - windowHeight / 2, targetCenter.y),
            );
    }

    // field.position is a plain translation (collision-safe); the renderer adds
    // the zoom around the pivot. Centering: screen(centerX) == pivotX.
    const nextX = pivotX - centerX;
    const nextY = pivotY - centerY;

    const currentX = this.world.field.position.x;
    const currentY = this.world.field.position.y;
    const deltaX = nextX - currentX;
    const deltaY = nextY - currentY;

    // Normal following snaps (locked, no lag). A large jump — e.g. recentering
    // on the spawn when the player dies — eases in instead, so the whole field
    // (enemies included) pans smoothly rather than teleporting.
    const SNAP_THRESHOLD = 8;
    let newX = nextX;
    let newY = nextY;
    if (Math.hypot(deltaX, deltaY) > SNAP_THRESHOLD) {
      newX = currentX + deltaX * 0.2;
      newY = currentY + deltaY * 0.2;
    }

    if (
      this.world.field.position.x !== newX ||
      this.world.field.position.y !== newY
    ) {
      this.root.setNeedsPaint();
      this.world.field.position.set(newX, newY);
      this.world.field.updateMatrix(true);
    }
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
  };

  private handleBaseDied = (): void => {
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

    if (this.session.isPlaytest()) {
      this.navigator.replace(GameSceneType.EditorMenu);
      return;
    }

    this.navigator.replace(GameSceneType.LevelScore);
  };

  private handleLevelWinCompleted = (): void => {
    if (this.session.isPlaytest()) {
      this.navigator.replace(GameSceneType.EditorMenu);
      return;
    }

    this.navigator.replace(GameSceneType.LevelScore);
  };
}
