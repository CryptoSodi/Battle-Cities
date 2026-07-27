import { BoundingBox, Subject, Timer, Vector } from '../../core';
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

const NETWORK_DEATH_COLLISION_GRACE = 0.2;
const TANK_SPAWN_SIZE = 64;

export interface NetworkEnemyDeath {
  partyIndex: number;
  x: number;
  y: number;
  reason: TankDeathReason;
  hitterPartyIndex?: number | null;
}

export interface NetworkReplayEnemy {
  partyIndex: number;
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

export class LevelEnemyScript extends LevelScript {
  private readonly isNetworkEnemyMirror: boolean;
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
  private activeEnemyIds = new Set<number>();
  private pendingNetworkRemovals: {
    tank: EnemyTank;
    remaining: number;
  }[] = [];
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
  private readonly headless: boolean;

  public constructor(
    isNetworkEnemyMirror = detectNetworkEnemyMirror(),
    headless = false,
  ) {
    super();
    this.isNetworkEnemyMirror = isNetworkEnemyMirror;
    this.headless = headless;
  }

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

  public getActiveEnemyIds(): number[] {
    return Array.from(this.activeEnemyIds);
  }

  public syncNetworkEnemyCount(activeIds: number[]): void {
    if (!this.isNetworkEnemyMirror) {
      return;
    }
    const activeIdSet = new Set(activeIds.filter((id) => {
      return Number.isInteger(id) && id >= 0 && id < this.list.length;
    }));
    this.aliveTanks
      .filter((tank) => !activeIdSet.has(tank.partyIndex))
      .forEach((tank) => this.removeNetworkEnemy(tank));

    if (activeIdSet.size === 0) {
      return;
    }
    const desiredCount = Math.max(...Array.from(activeIdSet)) + 1;
    while (this.listIndex < desiredCount && this.listIndex < this.list.length) {
      this.requestSpawn();
    }
  }

  public syncNetworkReplayEnemies(frames: NetworkReplayEnemy[]): void {
    if (!this.isNetworkEnemyMirror) {
      return;
    }
    frames.forEach((frame) => {
      if (
        this.aliveTanks.some((tank) => tank.partyIndex === frame.partyIndex) ||
        !Number.isInteger(frame.partyIndex) ||
        frame.partyIndex < 0 ||
        frame.partyIndex >= this.list.length
      ) {
        return;
      }
      const x = frame.x - (Number.isFinite(frame.deltaX) ? frame.deltaX : 0);
      const y = frame.y - (Number.isFinite(frame.deltaY) ? frame.deltaY : 0);
      this.activeEnemyIds.add(frame.partyIndex);
      this.listIndex = Math.max(this.listIndex, frame.partyIndex + 1);
      this.spawningCount += 1;
      this.handleSpawnCompleted({
        type: this.list[frame.partyIndex],
        centerPosition: new Vector(
          x + TANK_SPAWN_SIZE / 2,
          y + TANK_SPAWN_SIZE / 2,
        ),
        partyIndex: frame.partyIndex,
      });
    });
  }

  public syncNetworkEnemyDeaths(deaths: NetworkEnemyDeath[]): void {
    if (!this.isNetworkEnemyMirror) {
      return;
    }
    deaths.forEach((death) => {
      const tank = this.aliveTanks.find((candidate) => {
        return candidate.partyIndex === death.partyIndex;
      });
      if (tank !== undefined) {
        this.removeNetworkEnemy(tank, death);
      }
    });
  }

  private removeNetworkEnemy(
    tank: EnemyTank,
    death: NetworkEnemyDeath = null,
  ): void {
    this.activeEnemyIds.delete(tank.partyIndex);
    const centerPosition =
      death !== null && Number.isFinite(death.x) && Number.isFinite(death.y)
        ? new Vector(death.x, death.y)
        : tank.getCenter();
    this.eventBus.enemyDied.notify({
      type: tank.type,
      centerPosition,
      reason: death?.reason ?? TankDeathReason.Bullet,
      hitterPartyIndex: death?.hitterPartyIndex ?? null,
      networkMirror: true,
    });
    tank.beginNetworkDeathGrace();
    this.pendingNetworkRemovals.push({
      tank,
      remaining: NETWORK_DEATH_COLLISION_GRACE,
    });
    this.aliveTanks = this.aliveTanks.filter((aliveTank) => {
      return aliveTank !== tank;
    });
  }

  protected init(): void {
    this.eventBus.enemySpawnCompleted.addListener(this.handleSpawnCompleted);
    this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);

    this.list = this.mapConfig.getEnemySpawnList();
    this.positions = this.mapConfig.getEnemySpawnPositions();
  }

  protected setup(): void {
    if (!this.isNetworkEnemyMirror) {
      this.spawnTimer.reset(config.ENEMY_FIRST_SPAWN_DELAY);
    }
    this.spawnTimer.done.addListener(this.handleSpawnTimer);

    this.freezeTimer.done.addListener(this.handleFreezeTimer);

    if (config.IS_DEV && !this.headless) {
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
    if (!this.isNetworkEnemyMirror) {
      this.spawnTimer.update(deltaTime);
    }
    this.freezeTimer.update(deltaTime);
    this.updatePendingNetworkRemovals(deltaTime);
  }

  private updatePendingNetworkRemovals(deltaTime: number): void {
    this.pendingNetworkRemovals.forEach((pending) => {
      pending.remaining -= deltaTime;
    });
    this.pendingNetworkRemovals
      .filter((pending) => pending.remaining <= 0)
      .forEach((pending) => pending.tank.finishNetworkRemoval());
    this.pendingNetworkRemovals = this.pendingNetworkRemovals.filter(
      (pending) => pending.remaining > 0,
    );
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

    if (!this.requestSpawn()) {
      // Retry on the next simulation tick without consuming this enemy or
      // advancing to another spawn point.
      this.spawnTimer.reset(0);
      return;
    }

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
      : this.isNetworkEnemyMirror
        ? new StandStillTankBehavior()
        : new AiTankBehavior();
    const tank = TankFactory.createEnemy(event.partyIndex, type, behavior);
    tank.setNetworkControlled(this.isNetworkEnemyMirror);
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
      this.activeEnemyIds.delete(tank.partyIndex);

      // Remove from alive
      this.aliveTanks = this.aliveTanks.filter((aliveTank) => {
        return aliveTank !== tank;
      });

      // If timer was stopped because max count of alive enemies has been
      // reached, restart it, because one of alive tanks has just been killed
      if (!this.isNetworkEnemyMirror && !this.spawnTimer.isActive()) {
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

  private requestSpawn(): boolean {
    const type = this.list[this.listIndex];
    const position = this.positions[this.positionIndex];
    if (type === undefined || position === undefined) {
      this.spawnTimer.stop();
      return false;
    }

    if (!this.isNetworkEnemyMirror && this.isSpawnPositionOccupied(position)) {
      return false;
    }

    this.spawningCount += 1;

    const partyIndex = this.listIndex;
    this.activeEnemyIds.add(partyIndex);

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

    return true;
  }

  private isSpawnPositionOccupied(position: Vector): boolean {
    const spawnBox = new BoundingBox(
      position.clone(),
      new Vector(position.x + TANK_SPAWN_SIZE, position.y + TANK_SPAWN_SIZE),
    );
    const tanks = [...this.aliveTanks, ...this.world.getPlayerTanks()].filter(
      (tank) => tank !== null && tank !== undefined,
    );

    return tanks.some((tank) => {
      tank.updateMatrix();
      return spawnBox.intersectsBox(tank.getBoundingBox());
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

function detectNetworkEnemyMirror(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  return (
    mode === 'match' ||
    mode === 'local' ||
    (mode === 'webrtc' && params.get('broadcaster') !== '1')
  );
}
