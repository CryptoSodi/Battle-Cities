import { Prng, Rect, Timer, Vector } from '../../core';
import { DebugLevelPowerupMenu } from '../../debug';
import { GameUpdateArgs } from '../../game';
import { Powerup } from '../../gameObjects';
import {
  claimBatcDrop,
  BatcDropRoll,
  PowerupFactory,
  PowerupGrid,
  PowerupType,
  retryPendingBatcDropClaims,
  rollBatcDrop,
} from '../../powerup';
import { PowerupSpawnFrame } from '../../replay';
import { TerrainType } from '../../terrain';
import * as config from '../../config';
import { LocalPowerupSnapshot } from '../../network/local';

import { LevelScript } from '../LevelScript';
import {
  LevelEnemyHitEvent,
  LevelEnemySpawnCompletedEvent,
  LevelMapTileDestroyedEvent,
  LevelPowerupPickedEvent,
} from '../events';

function createDropRequestId(sequence: number): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`;
  return `${random}-${sequence}`;
}

function detectNetworkMode(): {
  isLocalServerMatch: boolean;
  isWebRtcClient: boolean;
} {
  if (typeof window === 'undefined') {
    return { isLocalServerMatch: false, isWebRtcClient: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    isLocalServerMatch: params.get('mode') === 'local',
    isWebRtcClient:
      params.get('mode') === 'webrtc' && params.get('broadcaster') !== '1',
  };
}

export interface NetworkPowerupSnapshot {
  id: number;
  kind: PowerupType;
  x: number;
  y: number;
}

export interface NetworkPowerupPickup {
  seq: number;
  type: PowerupType;
  partyIndex: number;
  x: number;
  y: number;
  hotbarSlot?: number;
}

export class LevelPowerupScript extends LevelScript {
  private readonly isLocalServerMatch: boolean;
  private readonly isWebRtcClient: boolean;
  private networkPowerupId: number = null;
  private activePowerupId: number = null;
  private powerupSequence = 0;
  private pickupSequence = 0;
  private lastNetworkPickupSequence = 0;
  private latestPickup: NetworkPowerupPickup = null;
  private timer: Timer;
  private activePowerup: Powerup = null;
  private grid: PowerupGrid;
  private rng: Prng;
  // Dev-only match replay (see src/replay/PowerupSpawnFrame): when set, each
  // spawn() call re-enacts the next recorded (type, position) pair instead of
  // drawing from rng.
  private replayPowerupSpawns: PowerupSpawnFrame[] | null = null;
  private replaySpawnIndex = 0;
  private isRecordingPowerups = false;
  private recordedPowerupSpawns: PowerupSpawnFrame[] = [];
  private readonly headless: boolean;
  private dropRequestSequence = 0;
  private nextBatcDropRoll: BatcDropRoll | null = null;
  private batcDropRollPending = false;

  public constructor(
    options: {
      isLocalServerMatch?: boolean;
      isWebRtcClient?: boolean;
      headless?: boolean;
    } = {},
  ) {
    super();
    const detected = detectNetworkMode();
    this.isLocalServerMatch =
      options.isLocalServerMatch ?? detected.isLocalServerMatch;
    this.isWebRtcClient = options.isWebRtcClient ?? detected.isWebRtcClient;
    this.headless = options.headless === true;
  }

  public setReplayPowerupSpawns(frames: PowerupSpawnFrame[] | null): void {
    this.replayPowerupSpawns = frames;
  }

  public startRecordingPowerups(): void {
    this.isRecordingPowerups = true;
  }

  public getRecordedPowerupSpawns(): PowerupSpawnFrame[] {
    return this.recordedPowerupSpawns;
  }

  public syncNetworkPowerup(snapshot: LocalPowerupSnapshot | null): void {
    if (!this.isLocalServerMatch) {
      return;
    }
    this.applyNetworkPowerup(snapshot);
  }

  public syncWebRtcPowerup(snapshot: NetworkPowerupSnapshot | null): void {
    if (!this.isWebRtcClient) {
      return;
    }
    this.applyNetworkPowerup(snapshot);
  }

  public syncWebRtcPickup(snapshot: NetworkPowerupPickup | null): void {
    if (
      !this.isWebRtcClient ||
      snapshot === null ||
      snapshot.seq <= this.lastNetworkPickupSequence
    ) {
      return;
    }
    this.lastNetworkPickupSequence = snapshot.seq;
    this.eventBus.powerupPicked.notify({
      type: snapshot.type,
      partyIndex: snapshot.partyIndex,
      centerPosition: new Vector(snapshot.x, snapshot.y),
      hotbarSlot: snapshot.hotbarSlot,
    });
  }

  public getWebRtcPowerup(): NetworkPowerupSnapshot | null {
    if (this.activePowerup === null || this.activePowerupId === null) {
      return null;
    }
    return {
      id: this.activePowerupId,
      kind: this.activePowerup.type,
      x: this.activePowerup.position.x,
      y: this.activePowerup.position.y,
    };
  }

  public getWebRtcPickup(): NetworkPowerupPickup | null {
    return this.latestPickup;
  }

  private applyNetworkPowerup(
    snapshot: LocalPowerupSnapshot | NetworkPowerupSnapshot | null,
  ): void {
    if (snapshot === null) {
      if (this.networkPowerupId !== null) {
        this.revoke();
        this.networkPowerupId = null;
      }
      return;
    }
    if (snapshot.id === this.networkPowerupId) {
      return;
    }
    this.revoke();
    const powerup = PowerupFactory.create(snapshot.kind);
    powerup.position.set(snapshot.x, snapshot.y);
    powerup.setNetworkControlled(true);
    this.activePowerup = powerup;
    this.networkPowerupId = snapshot.id;
    this.world.field.add(powerup);
    this.eventBus.powerupSpawned.notify({
      type: powerup.type,
      position: powerup.position.clone(),
    });
  }

  protected setup(updateArgs: GameUpdateArgs): void {
    this.rng = updateArgs.rng;

    this.eventBus.enemyHit.addListener(this.handleEnemyHit);
    this.eventBus.enemySpawnCompleted.addListener(
      this.handleEnemySpawnCompleted,
    );
    this.eventBus.mapTileDestroyed.addListener(this.handleMapTileDestroyed);
    this.eventBus.powerupPicked.addListener(this.capturePowerupPickup);

    this.timer = new Timer();
    this.timer.done.addListener(this.handleTimer);

    this.grid = new PowerupGrid(
      this.mapConfig.getFieldWidth(),
      this.mapConfig.getFieldHeight(),
    );
    this.blockGridDefaults();
    this.blockGridInitialMap();

    if (!this.isNetworkControlled() && this.replayPowerupSpawns === null) {
      retryPendingBatcDropClaims();
      this.primeBatcDropRoll();
    }

    if (config.IS_DEV && !this.headless) {
      const debugMenu = new DebugLevelPowerupMenu(this.world, this.grid, {
        top: 125,
      });
      debugMenu.attach();
      debugMenu.spawnRequest.addListener((type: PowerupType) => {
        this.spawn(type);
      });
    }
  }

  protected update({ deltaTime }: GameUpdateArgs): void {
    if (this.isWebRtcClient) {
      return;
    }
    this.timer.update(deltaTime);
  }

  private handleEnemyHit = (event: LevelEnemyHitEvent): void => {
    if (this.isLocalServerMatch || this.isWebRtcClient) {
      return;
    }
    const { type: tankType } = event;

    // Ignore if tank does not have droppable powerup
    if (!tankType.hasDrop) {
      return;
    }

    const reward = this.nextBatcDropRoll;
    this.nextBatcDropRoll = null;
    this.spawn(reward?.type ?? null, reward?.claimId ?? null);
    this.primeBatcDropRoll();
  };

  // Remove active powerup whenever new enemy spawns with drop
  private handleEnemySpawnCompleted = (
    event: LevelEnemySpawnCompletedEvent,
  ): void => {
    if (this.isLocalServerMatch || this.isWebRtcClient) {
      return;
    }
    const { type: tankType } = event;

    // Tanks without drops don't affect powerups
    if (!tankType.hasDrop) {
      return;
    }

    this.revoke();
  };

  private primeBatcDropRoll(): void {
    if (
      this.isNetworkControlled() ||
      this.replayPowerupSpawns !== null ||
      this.batcDropRollPending ||
      this.nextBatcDropRoll !== null
    )
      return;
    this.batcDropRollPending = true;
    const requestId = createDropRequestId(++this.dropRequestSequence);
    void rollBatcDrop(requestId, this.session.getLevelNumber()).then(
      (reward) => {
        this.nextBatcDropRoll = reward;
        this.batcDropRollPending = false;
      },
    );
  }

  // Remove powerup after timer expires
  private handleTimer = (): void => {
    this.revoke();
  };

  private handleMapTileDestroyed = (
    event: LevelMapTileDestroyedEvent,
  ): void => {
    const { type: terrainType, position, size } = event;

    // Only steel tiles when destroyed can free new space for powerup spawn
    if (terrainType !== TerrainType.Steel) {
      return;
    }

    const rect = new Rect(position.x, position.y, size.width, size.height);

    this.grid.freeRect(rect);
  };

  private spawn(type: PowerupType = null, batcClaimId: string = null): void {
    // Override previous powerup with newly picked up one
    this.revoke();

    // Needed either way: to block spawn positions around live players below,
    // or as the fallback "give directly to player" target further down.
    const playerTankRects = this.createPlayerTankRects();

    let powerup: Powerup;
    let position: Vector | null;

    if (this.replayPowerupSpawns !== null) {
      // Dev-only match replay: re-enact exactly which powerup spawned where,
      // instead of drawing from rng (see PowerupSpawnFrame -- once enemies
      // stopped consuming the same rng stream, its alignment with the
      // original recording broke, so this must be replayed verbatim too).
      const frame = this.replayPowerupSpawns[this.replaySpawnIndex] ?? null;
      this.replaySpawnIndex += 1;
      powerup =
        frame !== null
          ? PowerupFactory.create(frame.type)
          : PowerupFactory.createRandom(this.rng); // recording exhausted; fall back
      position =
        frame !== null && frame.position !== null
          ? new Vector(frame.position.x, frame.position.y)
          : null;
    } else {
      powerup =
        type !== null
          ? PowerupFactory.create(type)
          : PowerupFactory.createRandom(this.rng);

      // Block area around player tank at the moment of powerup spawn
      // so player won't accidently pick up a powerup. After spawning free it back
      // because player tank is in constant movement.
      if (playerTankRects.length > 0) {
        this.grid.backup();
        playerTankRects.forEach((playerTankRect) => {
          if (playerTankRect === null) {
            return;
          }
          this.grid.blockRect(playerTankRect);
        });
      }

      position = this.grid.getRandomPosition(this.rng);

      if (playerTankRects.length > 0) {
        this.grid.restore();
      }
    }

    if (this.isRecordingPowerups) {
      this.recordedPowerupSpawns.push({
        type: powerup.type,
        position: position !== null ? { x: position.x, y: position.y } : null,
      });
    }

    // In case no free position available, give powerup directly to player.
    // Spawn it on top of player tank, if available. Otherwise, on top of base.
    // Specify appropriate center position to display points for picking it up.
    if (position === null) {
      // Check which player rect is available
      // If primary player tank is missing, use second tank
      let partyIndex = 0;
      if (playerTankRects[0] === null) {
        partyIndex = 1;
      }

      // In case second is missing - use default spot
      const directRect = playerTankRects[partyIndex] ?? this.createBaseRect();

      this.eventBus.powerupPicked.notify({
        type: powerup.type,
        centerPosition: directRect.getCenter(),
        partyIndex,
      });
      if (batcClaimId !== null) void claimBatcDrop(batcClaimId);
      return;
    }

    powerup.position.copyFrom(position);

    powerup.picked.addListener(({ partyIndex }) => {
      this.activePowerup = null;
      this.activePowerupId = null;
      this.timer.stop();
      this.eventBus.powerupPicked.notify({
        type: powerup.type,
        centerPosition: powerup.getCenter(),
        partyIndex,
      });
      if (batcClaimId !== null) void claimBatcDrop(batcClaimId);
    });

    // Salvage boost: dropped powerups stay on the field longer. Deterministic
    // (a plain multiplier on the despawn timer) and replay-safe (the session
    // holds the recorded run's boosts during playback).
    const salvage = this.session.getRunBoosts().salvage;
    this.timer.reset(config.POWERUP_DURATION * (1 + salvage / 100));

    this.activePowerup = powerup;
    this.activePowerupId = ++this.powerupSequence;

    this.world.field.add(powerup);

    this.eventBus.powerupSpawned.notify({
      type: powerup.type,
      position,
    });
  }

  private revoke(): void {
    if (this.activePowerup === null) {
      return;
    }

    this.activePowerup.destroy();
    this.activePowerup = null;
    this.activePowerupId = null;

    this.eventBus.powerupRevoked.notify(null);
  }

  private isNetworkControlled(): boolean {
    return (
      this.isLocalServerMatch ||
      this.isWebRtcClient ||
      this.headless ||
      this.session.isMultiplayer()
    );
  }

  private capturePowerupPickup = (event: LevelPowerupPickedEvent): void => {
    this.pickupSequence += 1;
    this.latestPickup = {
      seq: this.pickupSequence,
      type: event.type,
      partyIndex: event.partyIndex,
      x: event.centerPosition.x,
      y: event.centerPosition.y,
      hotbarSlot: event.hotbarSlot,
    };
  };

  private createBaseRect(): Rect {
    const basePosition = this.mapConfig.getBasePosition();

    return new Rect(
      basePosition.x,
      basePosition.y,
      config.BASE_DEFAULT_SIZE.width,
      config.BASE_DEFAULT_SIZE.height,
    );
  }

  private createPlayerTankRects(): Rect[] {
    const rects = [];

    const playerTanks = this.world.getPlayerTanks();
    playerTanks.forEach((playerTank) => {
      if (playerTank === null) {
        rects.push(null);
        return;
      }

      // Create a margin around player tank, so player won't accidently pick
      // powerup up.
      const margin = config.TILE_SIZE_LARGE;

      const rect = new Rect(
        playerTank.position.x - margin,
        playerTank.position.y - margin,
        playerTank.size.width + margin * 2,
        playerTank.size.height + margin * 2,
      );

      rects.push(rect);
    });

    return rects;
  }

  private blockGridDefaults(): void {
    this.grid.blockRect(this.createBaseRect());

    const playerSpawnPositions = this.mapConfig.getPlayerSpawnPositions();
    playerSpawnPositions.forEach((position) => {
      this.grid.blockRect(new Rect(position.x, position.y, 64, 64));
    });

    const enemySpawnPositions = this.mapConfig.getEnemySpawnPositions();
    enemySpawnPositions.forEach((position) => {
      this.grid.blockRect(new Rect(position.x, position.y, 64, 64));
    });
  }

  private blockGridInitialMap(): void {
    const denyTypes = [TerrainType.Steel, TerrainType.Water];
    const regions = this.mapConfig.getTerrainRegions();

    regions.forEach((region) => {
      if (!denyTypes.includes(region.type)) {
        return;
      }

      this.grid.blockRect(
        new Rect(region.x, region.y, region.width, region.height),
      );
    });
  }
}
