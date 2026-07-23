import { Subject, Timer, Vector } from '../../core';
import { DebugLevelEnemyMenu } from '../../debug';
import { GameUpdateArgs, Rotation } from '../../game';
import { EnemyTank } from '../../gameObjects';
import { PowerupType } from '../../powerup';
import { EnemyMovementFrame } from '../../replay';
import { TankDeathReason, TankFactory, TankParty, TankType } from '../../tank';
import {
  AiTankBehavior,
  RecordedTankBehavior,
  StandStillTankBehavior,
} from '../../tank/behaviors';
import * as config from '../../config';

import { LevelScript } from '../LevelScript';
import {
  LevelEnemySpawnCompletedEvent,
  LevelPowerupPickedEvent,
} from '../events';

export class LevelEnemyScript extends LevelScript {
  private readonly isMagicBlockMatch =
    ['match', 'local'].includes(
      new URLSearchParams(window.location.search).get('mode'),
    );
  private list: TankType[] = [];
  private listIndex = 0;
  private aliveTanks: EnemyTank[] = [];
  private positions: Vector[] = [];
  private positionIndex = 0;
  private spawnTimer = new Timer();
  private freezeTimer = new Timer();
  private debugMovementStopped = false;
  private debugPlayerMirrorBulletsHidden = false;
  private spawningCount = 0;
  // Dev-only match replay (see src/replay): when set, newly spawned enemies
  // re-enact this recorded movement instead of deciding for themselves (see
  // RecordedTankBehavior) -- keyed by partyIndex, same as the saved replay's
  // own enemyTraces.
  private replayEnemyTraces: Record<number, EnemyMovementFrame[]> | null = null;
  // Fires synchronously the moment a tank is constructed and pushed to
  // aliveTanks -- deliberately NOT the eventBus.enemySpawnCompleted Subject,
  // whose listener order between scripts depends on when each script's own
  // (lazy, first-update-triggered) setup() runs, which isn't guaranteed to
  // be before a listener registered eagerly elsewhere (see LevelPlayScene's
  // enemy-fire recording, which needs the tank to already exist).
  public tankCreated = new Subject<EnemyTank>();

  public setReplayEnemyTraces(
    traces: Record<number, EnemyMovementFrame[]> | null,
  ): void {
    this.replayEnemyTraces = traces;
  }

  // Exposes the currently-alive enemies so the scene can record their
  // per-tick movement during a real (non-replay) playthrough.
  public getAliveTanks(): EnemyTank[] {
    return this.aliveTanks;
  }

  public syncNetworkEnemyCount(activeIds: number[]): void {
    if (!this.isMagicBlockMatch) {
      return;
    }
    const activeIdSet = new Set(activeIds);
    this.aliveTanks
      .filter((tank) => !activeIdSet.has(tank.partyIndex))
      .forEach((tank) => this.removeNetworkEnemy(tank));

    if (activeIds.length === 0) {
      return;
    }
    const desiredCount = Math.max(...activeIds) + 1;
    while (this.listIndex < desiredCount && this.listIndex < this.list.length) {
      this.requestSpawn();
    }
  }

  private removeNetworkEnemy(tank: EnemyTank): void {
    tank.die(TankDeathReason.Bullet);
  }

  protected setup(): void {
    this.eventBus.enemySpawnCompleted.addListener(this.handleSpawnCompleted);
    this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);

    this.list = this.mapConfig.getEnemySpawnList();

    this.positions = this.mapConfig.getEnemySpawnPositions();

    if (!this.isMagicBlockMatch) {
      this.spawnTimer.reset(config.ENEMY_FIRST_SPAWN_DELAY);
    }
    this.spawnTimer.done.addListener(this.handleSpawnTimer);

    this.freezeTimer.done.addListener(this.handleFreezeTimer);

    if (config.IS_DEV) {
      const debugMenu = new DebugLevelEnemyMenu({
        top: 365,
        left: 0,
        right: null,
      });
      debugMenu.attach();
      debugMenu.movementToggleRequest.addListener(
        this.handleDebugMovementToggle,
      );
      debugMenu.playerMirrorBulletsToggleRequest.addListener(
        this.handleDebugPlayerMirrorBulletsToggle,
      );
    }
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { deltaTime } = updateArgs;
    updateArgs.magicBlockMovement.setPlayerMirrorBulletsSuppressed(
      this.debugPlayerMirrorBulletsHidden,
    );
    if (!this.isMagicBlockMatch) {
      this.spawnTimer.update(deltaTime);
    }
    this.freezeTimer.update(deltaTime);
  }

  private handleSpawnTimer = (): void => {
    // Happens after max enemies spawn
    if (this.aliveTanks.length >= this.getMaxAliveCount()) {
      this.spawnTimer.stop();
      return;
    }

    // No more tanks to spawn
    if (this.listIndex >= this.list.length) {
      this.spawnTimer.stop();
      return;
    }

    this.requestSpawn();

    // Start timer to spawn next enemy
    this.spawnTimer.reset(config.ENEMY_SPAWN_DELAY);
  };

  private handleSpawnCompleted = (
    event: LevelEnemySpawnCompletedEvent,
  ): void => {
    this.spawningCount -= 1;

    const { type } = event;

    if (type.party !== TankParty.Enemy) {
      return;
    }

    const behavior = this.replayEnemyTraces !== null
      ? new RecordedTankBehavior(this.replayEnemyTraces[event.partyIndex] ?? [])
      : this.isMagicBlockMatch
        ? new StandStillTankBehavior()
        : new AiTankBehavior();
    const tank = TankFactory.createEnemy(event.partyIndex, type, behavior);
    tank.setNetworkControlled(this.isMagicBlockMatch);
    if (tank.behavior instanceof AiTankBehavior) {
      tank.behavior.setBasePosition(this.mapConfig.getBasePosition());
    }
    tank.updateMatrix(); // Origin should be in before setting center
    tank.rotate(Rotation.Down);
    tank.setCenter(event.centerPosition);
    tank.updateMatrix();

    if (this.freezeTimer.isActive() || this.debugMovementStopped) {
      tank.freezeState.set(true);
    }

    tank.hit.addListener(() => {
      this.eventBus.enemyHit.notify({
        type: tank.type,
      });
    });

    tank.died.addListener((deathEvent) => {
      this.eventBus.enemyDied.notify({
        type: tank.type,
        centerPosition: tank.getCenter(),
        reason: deathEvent.reason,
        hitterPartyIndex: deathEvent.hitterPartyIndex,
      });

      tank.removeSelf();

      // Remove from alive
      this.aliveTanks = this.aliveTanks.filter((aliveTank) => {
        return aliveTank !== tank;
      });

      // If timer was stopped because max count of alive enemies has been
      // reached, restart it, because one of alive tanks has just been killed
      if (!this.isMagicBlockMatch && !this.spawnTimer.isActive()) {
        this.spawnTimer.reset(config.ENEMY_SPAWN_DELAY);
      }

      if (this.areAllDead()) {
        this.eventBus.enemyAllDied.notify(null);
      }
    });

    this.aliveTanks.push(tank);
    this.tankCreated.notify(tank);

    this.world.field.add(tank);
  };

  private requestSpawn(): void {
    this.spawningCount += 1;

    const type = this.list[this.listIndex];
    const position = this.positions[this.positionIndex];

    const partyIndex = this.listIndex;

    // Go to next tank
    this.listIndex += 1;

    // Take turns for positions where to spawn tanks
    this.positionIndex += 1;
    if (this.positionIndex >= this.positions.length) {
      this.positionIndex = 0;
    }

    const unspawnedCount = this.getUnspawnedCount();

    this.eventBus.enemySpawnRequested.notify({
      type,
      position,
      partyIndex,
      unspawnedCount,
    });
  }

  private getUnspawnedCount(): number {
    return this.list.length - this.listIndex;
  }

  private areAllDead(): boolean {
    const spawningCount = this.spawningCount;
    const unspawnedCount = this.getUnspawnedCount();
    const aliveCount = this.aliveTanks.length;

    const areAllDead =
      spawningCount === 0 && unspawnedCount === 0 && aliveCount === 0;

    return areAllDead;
  }

  private handleFreezeTimer = (): void => {
    this.aliveTanks.forEach((tank) => {
      tank.freezeState.set(this.debugMovementStopped);
    });
  };

  private handleDebugMovementToggle = (stopped: boolean): void => {
    this.debugMovementStopped = stopped;
    this.aliveTanks.forEach((tank) => {
      tank.freezeState.set(stopped || this.freezeTimer.isActive());
    });
  };

  private handleDebugPlayerMirrorBulletsToggle = (hidden: boolean): void => {
    this.debugPlayerMirrorBulletsHidden = hidden;
  };

  private handlePowerupPicked = (event: LevelPowerupPickedEvent): void => {
    const { type: powerupType } = event;

    if (powerupType === PowerupType.Freeze) {
      this.freezeTimer.reset(config.FREEZE_POWERUP_DURATION);

      this.aliveTanks.forEach((tank) => {
        tank.freezeState.set(true);
      });
    }

    if (powerupType === PowerupType.Wipeout) {
      this.aliveTanks.forEach((tank) => {
        // Enemy with drop cant drop it when killed by powerup
        tank.discardDrop();

        // Pass death reason because picking up this powerup does not award
        // per-enemy points. Only powerup pickup points are awarded.
        tank.die(TankDeathReason.WipeoutPowerup);
      });
    }
  };

  private getMaxAliveCount(): number {
    if (this.session.isMultiplayer()) {
      return config.ENEMY_MAX_ALIVE_COUNT_MULTIPLAYER;
    }
    return config.ENEMY_MAX_ALIVE_COUNT;
  }
}
