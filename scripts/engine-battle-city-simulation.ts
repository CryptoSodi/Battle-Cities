import { CollisionSystem } from '../src/core/collision/CollisionSystem';
import { GameObject } from '../src/core/GameObject';
import { Rect } from '../src/core/Rect';
import { State } from '../src/core/State';
import { Prng } from '../src/core/utils/Prng';
import { GameState } from '../src/game/GameState';
import { GameUpdateArgs } from '../src/game/GameUpdateArgs';
import { Rotation } from '../src/game/Rotation';
import { Session, SessionRunBoosts } from '../src/game/Session';
import {
  Border,
  BrickSuperTerrainTile,
  EnemyTank,
  GroundField,
  PlayerTank,
  Tank,
  TankState,
  TerrainTile,
  WallShadowField,
} from '../src/gameObjects';
import { LevelEventBus } from '../src/level/LevelEventBus';
import {
  LevelMatchLifecycle,
  prepareLevelSession,
} from '../src/level/LevelMatchLifecycle';
import { LevelScript } from '../src/level/LevelScript';
import { LevelWorld } from '../src/level/LevelWorld';
import { LevelBaseScript } from '../src/level/scripts/LevelBaseScript';
import { LevelEnemyScript } from '../src/level/scripts/LevelEnemyScript';
import { LevelExplosionScript } from '../src/level/scripts/LevelExplosionScript';
import { LevelGameOverScript } from '../src/level/scripts/LevelGameOverScript';
import { LevelIntroScript } from '../src/level/scripts/LevelIntroScript';
import { LevelPlayerOverScript } from '../src/level/scripts/LevelPlayerOverScript';
import { LevelPlayerScript } from '../src/level/scripts/LevelPlayerScript';
import { LevelPointsScript } from '../src/level/scripts/LevelPointsScript';
import { LevelPowerupScript } from '../src/level/scripts/LevelPowerupScript';
import { LevelSpawnScript } from '../src/level/scripts/LevelSpawnScript';
import { LevelWinScript } from '../src/level/scripts/LevelWinScript';
import { MapConfig } from '../src/map/MapConfig';
import { MapDto } from '../src/map/MapDto';
import { applyRemotePlayerInput } from '../src/network/webrtc/applyRemotePlayerInput';
import { OrderedInputBuffer } from '../src/network/webrtc/OrderedInputBuffer';
import { PowerupType } from '../src/powerup';
import { TankDeathReason } from '../src/tank/TankDeathReason';
import { TankTier } from '../src/tank/TankTier';
import { TerrainFactory } from '../src/terrain/TerrainFactory';
import { TerrainRegionConfig } from '../src/terrain/TerrainRegionConfig';
import { TerrainType } from '../src/terrain/TerrainType';
import * as config from '../src/config';
import {
  SimulationEnemyFrame,
  SimulationEnemyDeathFrame,
  SimulationHostFramePacket,
  SimulationInputPacket,
  SimulationMapDto,
  SimulationOptions,
  SimulationPlayerFrame,
  SimulationPlayerIndex,
  SimulationPowerupFrame,
  SimulationPowerupPickupFrame,
  SimulationRotation,
  SimulationRunConsumables,
  SimulationTankTier,
} from '../shared/src/simulationProtocol';

const REMOTE_INPUT_TIMEOUT_MS = 500;
const BASE_WALL_REGIONS = [
  { x: 0, y: 0, width: 128, height: 32 },
  { x: 0, y: 32, width: 32, height: 64 },
  { x: 96, y: 32, width: 32, height: 64 },
] as const;

interface FireState {
  tank: Tank;
  seq: number;
  x: number;
  y: number;
  rotation: SimulationRotation;
}

interface PreviousPlayerPosition {
  tank: PlayerTank;
  x: number;
  y: number;
}

interface PreviousEnemyPosition {
  x: number;
  y: number;
}

export interface EngineSimulationRunState {
  stageNumber: number;
  tick: number;
  frameSeq: number;
  scores: [number, number];
  lives: [number, number];
  tankTiers: [SimulationTankTier, SimulationTankTier];
  runBoosts: SessionRunBoosts;
  playerRunConsumables: [
    SimulationRunConsumables,
    SimulationRunConsumables,
  ];
  playerElapsedSeconds: [number, number];
}

interface EngineSimulationOptions extends SimulationOptions {
  runState?: EngineSimulationRunState;
}

class HeadlessWebRtcMatch {
  private readonly lastFireSeqs = new Map<number, number>();
  private readonly controlledTanks = new Map<number, PlayerTank>();
  private readonly lastProcessedInputSeq: [number, number] = [0, 0];

  public constructor(
    private readonly inputBuffers: readonly [
      OrderedInputBuffer<SimulationInputPacket>,
      OrderedInputBuffer<SimulationInputPacket>,
    ],
    private readonly pendingFireSeqs: readonly [number[], number[]],
    private readonly pendingPowerSlots: Map<SimulationPlayerIndex, number[]>,
    private disableEnemyShooting: boolean,
  ) {}

  public handlePlayerTank(
    tank: PlayerTank,
    updateArgs: GameUpdateArgs,
  ): boolean {
    const playerIndex = tank.partyIndex as SimulationPlayerIndex;
    if (this.controlledTanks.get(playerIndex) !== tank) {
      this.observeAuthoritativePlayerTank(tank);
      tank.idle(false);
      return true;
    }

    const inputBuffer = this.inputBuffers[playerIndex];
    if (inputBuffer.isStale(Date.now(), REMOTE_INPUT_TIMEOUT_MS)) {
      tank.idle(false);
      return true;
    }
    const input = inputBuffer.consumeNext();
    if (input === null) {
      tank.idle(false);
      return true;
    }

    const fireSeqs = this.pendingFireSeqs[playerIndex];
    const shouldFire = fireSeqs.length > 0 && fireSeqs[0] <= input.seq;
    if (shouldFire) {
      while (fireSeqs.length > 0 && fireSeqs[0] <= input.seq) {
        fireSeqs.shift();
      }
    }
    const appliedInput = shouldFire && !input.fire
      ? { ...input, fire: true }
      : input;
    const lastFireSeq = this.lastFireSeqs.get(tank.partyIndex) ?? 0;
    const appliedFireSeq = applyRemotePlayerInput(
      tank,
      appliedInput,
      updateArgs.deltaTime,
      lastFireSeq,
    );
    this.lastFireSeqs.set(
      tank.partyIndex,
      appliedFireSeq,
    );
    this.lastProcessedInputSeq[playerIndex] = input.seq;
    return true;
  }

  public getLastProcessedInputSeq(): [number, number] {
    return [...this.lastProcessedInputSeq] as [number, number];
  }

  public observeAuthoritativePlayerTank(tank: PlayerTank): void {
    const playerIndex = tank.partyIndex as SimulationPlayerIndex;
    this.controlledTanks.set(playerIndex, tank);
    this.inputBuffers[playerIndex].clear();
    this.pendingFireSeqs[playerIndex].length = 0;
  }

  public isEnabled(): boolean {
    return true;
  }

  public isBroadcaster(): boolean {
    return true;
  }

  public consumeRemotePowerSlot(playerIndex: number): number | null {
    const slots = this.pendingPowerSlots.get(
      playerIndex as SimulationPlayerIndex,
    );
    if (slots === undefined || slots.length === 0) {
      return null;
    }
    const slot = slots.shift() ?? null;
    if (slots.length === 0) {
      this.pendingPowerSlots.delete(playerIndex as SimulationPlayerIndex);
    }
    return slot;
  }

  public isWaitingForPeer(): boolean {
    return false;
  }

  public shouldDisableEnemyShooting(): boolean {
    return this.disableEnemyShooting;
  }

  public setEnemyShootingDisabled(disabled: boolean): void {
    this.disableEnemyShooting = disabled;
  }
}

/**
 * Browserless authoritative simulation that executes the same level scripts,
 * entities, collision system, timers, and session rules as LevelPlayScene.
 */
export class EngineBattleCitySimulation {
  public readonly tickRate: number;
  public readonly deltaTime: number;

  private readonly root = new GameObject(
    config.CANVAS_WIDTH,
    config.CANVAS_HEIGHT,
  );
  private readonly collisionSystem = new CollisionSystem();
  private readonly gameState = new State<GameState>(GameState.Playing);
  private readonly rng: Prng;
  private readonly mapConfig = new MapConfig();
  private readonly eventBus = new LevelEventBus();
  private readonly session = new Session();
  private readonly world: LevelWorld;
  private readonly updateArgs: GameUpdateArgs;
  private readonly inputBuffers: [
    OrderedInputBuffer<SimulationInputPacket>,
    OrderedInputBuffer<SimulationInputPacket>,
  ] = [new OrderedInputBuffer(), new OrderedInputBuffer()];
  private readonly pendingFireSeqs: [number[], number[]] = [[], []];
  private readonly webRtcMatch: HeadlessWebRtcMatch;
  private readonly pendingPowerSlots = new Map<
    SimulationPlayerIndex,
    number[]
  >();
  private readonly playerElapsed: [number, number] = [0, 0];
  private readonly playerFire = new Map<number, FireState>();
  private readonly enemyFire = new Map<number, FireState>();
  private readonly previousPlayers = new Map<number, PreviousPlayerPosition>();
  private readonly previousEnemies = new Map<number, PreviousEnemyPosition>();
  private readonly pendingEnemyDeaths: SimulationEnemyDeathFrame[] = [];
  private readonly allScripts: LevelScript[];
  private readonly alwaysUpdateScripts: LevelScript[] = [];
  private readonly playingUpdateScripts: LevelScript[] = [];
  private readonly baseScript: LevelBaseScript;
  private readonly enemyScript: LevelEnemyScript;
  private readonly explosionScript: LevelExplosionScript;
  private readonly gameOverScript: LevelGameOverScript;
  private readonly introScript: LevelIntroScript;
  private readonly playerOverScript: LevelPlayerOverScript;
  private readonly playerScript: LevelPlayerScript;
  private readonly pointsScript: LevelPointsScript;
  private readonly powerupScript: LevelPowerupScript;
  private readonly spawnScript: LevelSpawnScript;
  private readonly winScript: LevelWinScript;
  private readonly matchLifecycle: LevelMatchLifecycle;
  private enemyExplosionCount = 0;
  private enemyDeathSeq = 0;
  private currentTick = 0;
  private frameSeq = 0;
  private pendingHitStopSeconds = 0;
  private readonly stageNumber: number;

  public constructor(map: SimulationMapDto, options: EngineSimulationOptions) {
    this.tickRate = Math.max(10, Math.floor(options.tickRate ?? 60));
    this.deltaTime = 1 / this.tickRate;
    this.rng = new Prng(options.seed);
    this.mapConfig.fromDto(map as MapDto);

    const level = Math.max(1, Math.floor(options.level ?? 1));
    this.stageNumber = level;
    this.session.setMultiplayer();
    this.session.start(level, 35);
    const runState = options.runState;
    this.session.setRunBoosts(
      runState?.runBoosts ?? {
        hull: options.runBoosts?.hull ?? 0,
        armor: options.runBoosts?.armor ?? 0,
        engine: options.runBoosts?.engine ?? 0,
        salvage: options.runBoosts?.salvage ?? 0,
      },
    );
    this.session.setRunConsumables({
      powerups: [],
      powerupItems: [],
      powerupCounts: [],
      extraLives: runState === undefined
        ? Math.max(0, Math.floor(options.extraLives ?? 0))
        : 0,
    });
    if (runState === undefined) {
      this.applyInitialPlayerTiers(options.initialPlayerTiers);
    } else {
      this.currentTick = runState.tick;
      this.frameSeq = runState.frameSeq;
      this.playerElapsed[0] = runState.playerElapsedSeconds[0];
      this.playerElapsed[1] = runState.playerElapsedSeconds[1];
      runState.scores.forEach((score, player) => {
        this.session.getPlayer(player).setAuthoritativeGamePoints(score);
      });
      runState.lives.forEach((lives, player) => {
        this.session.getPlayer(player).setLivesCount(lives);
      });
      this.applyInitialPlayerTiers(runState.tankTiers);
    }
    prepareLevelSession(
      this.session,
      this.mapConfig.getEnemySpawnList().length,
    );

    this.world = new LevelWorld(
      this.root,
      this.mapConfig.getFieldWidth(),
      this.mapConfig.getFieldHeight(),
    );
    this.world.field.position.set(
      config.BORDER_LEFT_WIDTH,
      config.LEVEL_PLAY_TOP_OFFSET + config.BORDER_TOP_BOTTOM_HEIGHT,
    );
    this.world.field.add(
      new GroundField(this.world.field.size.width, this.world.field.size.height),
    );
    this.world.field.add(
      new WallShadowField(
        this.world.field.size.width,
        this.world.field.size.height,
      ),
    );
    this.world.field.add(
      new Border(this.world.field.size.width, this.world.field.size.height),
    );
    this.root.add(this.world.field);
    this.createTerrain();

    this.webRtcMatch = new HeadlessWebRtcMatch(
      this.inputBuffers,
      this.pendingFireSeqs,
      this.pendingPowerSlots,
      options.disableEnemyShooting === true,
    );
    this.updateArgs = this.createUpdateArgs(this.webRtcMatch);

    this.baseScript = new LevelBaseScript(true);
    this.enemyScript = new LevelEnemyScript(false, true);
    this.explosionScript = new LevelExplosionScript();
    this.gameOverScript = new LevelGameOverScript();
    this.introScript = new LevelIntroScript();
    this.playerOverScript = new LevelPlayerOverScript();
    this.playerScript = new LevelPlayerScript({
      headless: true,
      playerRunConsumables: (runState?.playerRunConsumables ??
        options.playerRunConsumables)?.map(
        (consumables) => ({
          powerups: consumables.powerups as PowerupType[],
          powerupCounts: consumables.powerups.map((_, index) => {
            return Math.max(
              0,
              Math.floor(consumables.powerupCounts?.[index] ?? 1),
            );
          }),
        }),
      ) as [
        { powerups: PowerupType[]; powerupCounts: number[] },
        { powerups: PowerupType[]; powerupCounts: number[] },
      ],
    });
    this.pointsScript = new LevelPointsScript();
    this.powerupScript = new LevelPowerupScript({
      isLocalServerMatch: false,
      isWebRtcClient: false,
      headless: true,
    });
    this.spawnScript = new LevelSpawnScript();
    this.winScript = new LevelWinScript();

    this.allScripts = [
      this.baseScript,
      this.enemyScript,
      this.explosionScript,
      this.gameOverScript,
      this.introScript,
      this.playerOverScript,
      this.playerScript,
      this.pointsScript,
      this.powerupScript,
      this.spawnScript,
      this.winScript,
    ];
    this.allScripts.forEach((script) => {
      script.invokeInit(
        this.world,
        this.eventBus,
        this.session,
        this.mapConfig,
      );
    });

    this.matchLifecycle = new LevelMatchLifecycle(
      this.eventBus,
      this.session,
      {
        gameOver: this.gameOverScript,
        playerOver: this.playerOverScript,
        player: this.playerScript,
        win: this.winScript,
      },
    );

    this.alwaysUpdateScripts.push(this.introScript);
    this.introScript.completed.addListener(() => {
      this.alwaysUpdateScripts.push(this.gameOverScript, this.winScript);
      this.playingUpdateScripts.push(
        this.baseScript,
        this.explosionScript,
        this.enemyScript,
        this.spawnScript,
        this.playerOverScript,
        this.playerScript,
        this.pointsScript,
        this.powerupScript,
      );
    });

    this.playerScript.tankCreated.addListener((tank) => {
      this.webRtcMatch.observeAuthoritativePlayerTank(tank);
      this.observeTankFire(tank, this.playerFire);
    });
    this.enemyScript.tankCreated.addListener((tank) => {
      this.observeTankFire(tank, this.enemyFire);
      tank.died.addListener((event) => {
        const center = tank.getCenter();
        this.pendingEnemyDeaths.push({
          seq: ++this.enemyDeathSeq,
          partyIndex: tank.partyIndex,
          x: center.x,
          y: center.y,
          reason: event.reason as TankDeathReason,
          hitterPartyIndex:
            event.hitterPartyIndex === 0 || event.hitterPartyIndex === 1
              ? event.hitterPartyIndex
              : null,
        });
      });
    });
    this.eventBus.enemyExploded.addListener(() => {
      this.enemyExplosionCount += 1;
      this.requestHitStop(
        config.HIT_STOP_KILL * config.CAMERA_SHAKE_INTENSITY,
      );
    });
    this.eventBus.playerDied.addListener(() => {
      this.requestHitStop(
        config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY,
      );
    });
    this.eventBus.baseDied.addListener(() => {
      this.requestHitStop(
        config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY,
      );
    });

    this.root.updateMatrix(true);
    this.root.updateWorldMatrix(false, true);
  }

  public get tick(): number {
    return this.currentTick;
  }

  public get seq(): number {
    return this.frameSeq;
  }

  public consumeHitStopSeconds(): number {
    const seconds = this.pendingHitStopSeconds;
    this.pendingHitStopSeconds = 0;
    return seconds;
  }

  public setEnemyShootingDisabled(disabled: boolean): void {
    this.webRtcMatch.setEnemyShootingDisabled(disabled);
  }

  public acceptInput(packet: SimulationInputPacket): boolean {
    if (
      (packet.player !== 0 && packet.player !== 1) ||
      !Number.isInteger(packet.seq) ||
      !isRotation(packet.direction) ||
      !isPowerSlot(packet.powerSlot)
    ) {
      return false;
    }

    if (!this.inputBuffers[packet.player].accept(packet)) {
      return false;
    }
    if (packet.fire) {
      const fireSeqs = this.pendingFireSeqs[packet.player];
      if (fireSeqs.length < 16) {
        fireSeqs.push(packet.seq);
      }
    }
    if (packet.powerSlot !== null && packet.powerSlot !== undefined) {
      let slots = this.pendingPowerSlots.get(packet.player);
      if (slots === undefined) {
        slots = [];
        this.pendingPowerSlots.set(packet.player, slots);
      }
      if (slots.length < 16) {
        slots.push(packet.powerSlot);
      }
    }
    if (Number.isFinite(packet.elapsedSeconds)) {
      this.playerElapsed[packet.player] = Math.max(0, packet.elapsedSeconds);
    }
    return true;
  }

  public step(): SimulationHostFramePacket {
    this.currentTick += 1;
    this.session.recordLevelTick();

    this.alwaysUpdateScripts.forEach((script) => {
      script.invokeUpdate(this.updateArgs);
    });
    if (!this.gameState.is(GameState.Paused)) {
      this.playingUpdateScripts.forEach((script) => {
        if (!this.alwaysUpdateScripts.includes(script)) {
          script.invokeUpdate(this.updateArgs);
        }
      });
    }

    this.prepareNetworkTick();
    this.root.traverseDescedants((node) => {
      const shouldUpdate =
        this.gameState.is(GameState.Playing) || node.ignorePause;
      if (shouldUpdate) {
        node.invokeUpdate(this.updateArgs);
      }
    });
    this.root.updateWorldMatrix(false, true);
    this.collisionSystem.update();
    this.collisionSystem.collide();
    this.clampTanksToFieldBounds();

    return this.createFrame();
  }

  public getScores(): [number, number] {
    return [
      this.session.getPlayer(0).getGamePoints(),
      this.session.getPlayer(1).getGamePoints(),
    ];
  }

  public getLives(): [number, number] {
    return [
      this.session.getPlayer(0).getLivesCount(),
      this.session.getPlayer(1).getLivesCount(),
    ];
  }

  public getEnemyExplosionCount(): number {
    return this.enemyExplosionCount;
  }

  public isComplete(): boolean {
    return this.matchLifecycle.isComplete();
  }

  public isTerminal(): boolean {
    return this.matchLifecycle.isComplete() &&
      this.matchLifecycle.getResult() === 'loss';
  }

  public createNextStageRunState(): EngineSimulationRunState {
    if (
      !this.matchLifecycle.isComplete() ||
      this.matchLifecycle.getResult() !== 'win'
    ) {
      throw new Error('Cannot advance an unfinished or lost stage');
    }
    const maxLevelPoints = this.session.getMaxLevelPoints();
    this.session.getPlayers().forEach((player) => {
      if (
        player.getLevelPoints() > 0 &&
        player.getLevelPoints() === maxLevelPoints
      ) {
        player.addBonusPoints();
      }
    });
    this.session.activateNextLevel();
    const playerRunConsumables =
      this.playerScript.getAuthoritativeRunConsumables() ?? [
        { powerups: [], powerupCounts: [] },
        { powerups: [], powerupCounts: [] },
      ];
    return {
      stageNumber: this.session.getLevelNumber(),
      tick: this.currentTick,
      frameSeq: this.frameSeq,
      scores: this.getScores(),
      lives: this.getLives(),
      tankTiers: this.session.getPlayerTankTiers() as [
        SimulationTankTier,
        SimulationTankTier,
      ],
      runBoosts: this.session.getRunBoosts(),
      playerRunConsumables,
      playerElapsedSeconds: [...this.playerElapsed] as [number, number],
    };
  }

  private applyInitialPlayerTiers(
    tiers: [SimulationTankTier, SimulationTankTier] | undefined,
  ): void {
    if (tiers === undefined) {
      return;
    }
    tiers.forEach((tier, player) => {
      this.session.getPlayer(player).setTankTier(tier as TankTier);
      this.session.setPlayerTankTier(player, tier as TankTier);
    });
  }

  private createUpdateArgs(webRtcMatch: HeadlessWebRtcMatch): GameUpdateArgs {
    const silentSound = {
      play: (): void => undefined,
      playLoop: (): void => undefined,
      resume: (): void => undefined,
      pause: (): void => undefined,
      stop: (): void => undefined,
      canResume: (): boolean => false,
      setMuted: (): void => undefined,
      isMuted: (): boolean => true,
      setGlobalMuted: (): void => undefined,
      isGlobalMuted: (): boolean => true,
    };
    const spriteLoader = {
      load: (): null => null,
      loadList: (ids: string[]): null[] => ids.map(() => null),
      loadSequence: (): null[] => [null],
      has: (): boolean => false,
    };
    const neutralInputMethod = {
      isDownAny: (): boolean => false,
      isHoldAny: (): boolean => false,
      isNotHoldAll: (): boolean => true,
      getHoldLastIndex: (): number => -1,
    };
    const inputManager = {
      isReplaying: (): boolean => false,
      getActiveMethod: () => neutralInputMethod,
      getMethodByVariant: () => neutralInputMethod,
    };
    const magicBlockMovement = {
      isWatching: (): boolean => false,
      isRemoteTank: (): boolean => false,
      isLocalServerMatchWaitingForStart: (): boolean => false,
      isOnlineMatch: (): boolean => false,
      isLocalServerMatch: (): boolean => false,
      recordLocalFire: (): void => undefined,
      setPlayerMirrorBulletsSuppressed: (): void => undefined,
    };

    return {
      audioLoader: { load: () => silentSound },
      collisionSystem: this.collisionSystem,
      deltaTime: this.deltaTime,
      stageNumber: this.stageNumber,
      gameState: this.gameState,
      gameStorage: null,
      hitStop: this.requestHitStop,
      inputManager,
      magicBlockMovement,
      particles: {
        spawn: (): void => undefined,
        flash: (): void => undefined,
        clear: (): void => undefined,
      },
      rng: this.rng,
      session: this.session,
      spriteLoader,
      webRtcMatch,
    } as unknown as GameUpdateArgs;
  }

  private createTerrain(): void {
    const basePosition = this.mapConfig.getBasePosition();
    const baseRect = new Rect(
      basePosition.x,
      basePosition.y,
      config.BASE_DEFAULT_SIZE.width,
      config.BASE_DEFAULT_SIZE.height,
    );
    const regions = [
      ...this.mapConfig.getTerrainRegions(),
      ...BASE_WALL_REGIONS.map((region) => ({
        type: TerrainType.Brick,
        x: basePosition.x + region.x,
        y: basePosition.y + region.y,
        width: region.width,
        height: region.height,
      })),
    ] as TerrainRegionConfig[];
    const tiles = TerrainFactory.createMapFromRegionConfigs(
      regions,
      this.world.field.size.width,
      this.world.field.size.height,
      [baseRect],
    );
    tiles.forEach((tile) => {
      tile.destroyed.addListener(() => {
        this.eventBus.mapTileDestroyed.notify({
          type: tile.type,
          position: tile.position.clone(),
          size: tile.size.clone(),
        });
      });
      if (tile instanceof BrickSuperTerrainTile) {
        tile.subTileDestroyed.addListener(() => undefined);
      }
    });
    this.world.field.add(...tiles);
  }

  private requestHitStop = (seconds: number): void => {
    if (Number.isFinite(seconds) && seconds > this.pendingHitStopSeconds) {
      this.pendingHitStopSeconds = seconds;
    }
  };

  private prepareNetworkTick(): void {
    this.world.getPlayerTanks().forEach((tank) => {
      if (tank === null || tank === undefined) {
        return;
      }
      this.observeTankFire(tank, this.playerFire);
      const previous = this.previousPlayers.get(tank.partyIndex);
      if (previous?.tank !== tank) {
        this.previousPlayers.set(tank.partyIndex, {
          tank,
          x: tank.position.x,
          y: tank.position.y,
        });
      }
    });
    this.enemyScript.getAliveTanks().forEach((tank) => {
      this.observeTankFire(tank, this.enemyFire);
      if (!this.previousEnemies.has(tank.partyIndex)) {
        this.previousEnemies.set(tank.partyIndex, {
          x: tank.position.x,
          y: tank.position.y,
        });
      }
    });
  }

  private observeTankFire(
    tank: Tank,
    states: Map<number, FireState>,
  ): void {
    const existing = states.get(tank.partyIndex);
    if (existing?.tank === tank) {
      return;
    }
    const state: FireState = existing ?? {
      tank,
      seq: 0,
      x: 0,
      y: 0,
      rotation: tank.rotation as SimulationRotation,
    };
    state.tank = tank;
    state.x = tank.position.x;
    state.y = tank.position.y;
    state.rotation = tank.rotation as SimulationRotation;
    states.set(tank.partyIndex, state);
    tank.fired.addListener(() => {
      state.seq += 1;
      state.x = tank.position.x;
      state.y = tank.position.y;
      state.rotation = tank.rotation as SimulationRotation;
    });
  }

  private clampTanksToFieldBounds(): void {
    const maxX = this.world.field.size.width - config.TILE_SIZE_LARGE;
    const maxY = this.world.field.size.height - config.TILE_SIZE_LARGE;
    this.world.field.children.forEach((node) => {
      if (!(node instanceof Tank)) {
        return;
      }
      const nextX = Math.max(0, Math.min(node.position.x, maxX));
      const nextY = Math.max(0, Math.min(node.position.y, maxY));
      if (node.position.x === nextX && node.position.y === nextY) {
        return;
      }
      node.position.set(nextX, nextY);
      node.updateMatrix(true);
      node.collider.update();
    });
  }

  private createFrame(): SimulationHostFramePacket {
    const activeEnemyIds = this.enemyScript.getActiveEnemyIds();
    const activeEnemyIdSet = new Set(activeEnemyIds);
    Array.from(this.previousEnemies.keys()).forEach((partyIndex) => {
      if (!activeEnemyIdSet.has(partyIndex)) {
        this.previousEnemies.delete(partyIndex);
        this.enemyFire.delete(partyIndex);
      }
    });

    const players = this.world
      .getPlayerTanks()
      .filter((tank) => tank !== null && tank !== undefined)
      .map((tank) => this.createPlayerFrame(tank));
    const enemies = this.enemyScript
      .getAliveTanks()
      .map((tank) => this.createEnemyFrame(tank));
    const powerup = this.powerupScript.getWebRtcPowerup();
    const pickup = this.powerupScript.getWebRtcPickup();

    return {
      type: 'webrtc-host-frame',
      seq: ++this.frameSeq,
      tick: this.currentTick,
      lastProcessedInputSeq: this.webRtcMatch.getLastProcessedInputSeq(),
      deltaTime: this.deltaTime,
      stageNumber: this.stageNumber,
      matchResult: this.matchLifecycle.getResult(),
      playerScores: this.getScores(),
      playerLives: this.getLives(),
      playerKillCounts: this.session.getPlayers().map((player) => {
        const record = player.getLevelPointsRecord();
        return [
          record.getTierKillCount(TankTier.A),
          record.getTierKillCount(TankTier.B),
          record.getTierKillCount(TankTier.C),
          record.getTierKillCount(TankTier.D),
        ];
      }) as [
        [number, number, number, number],
        [number, number, number, number],
      ],
      sharedElapsedSeconds: this.currentTick * this.deltaTime,
      playerOneElapsedSeconds: this.playerElapsed[0],
      playerTwoElapsedSeconds: this.playerElapsed[1],
      players,
      powerup: powerup as SimulationPowerupFrame | null,
      powerupPickup: pickup as SimulationPowerupPickupFrame | null,
      activeEnemyIds,
      enemyDeaths: this.pendingEnemyDeaths.splice(
        0,
        this.pendingEnemyDeaths.length,
      ),
      enemies,
    };
  }

  private createPlayerFrame(tank: PlayerTank): SimulationPlayerFrame {
    const previous = this.previousPlayers.get(tank.partyIndex);
    const sameTank = previous?.tank === tank;
    const deltaX = sameTank ? tank.position.x - previous.x : 0;
    const deltaY = sameTank ? tank.position.y - previous.y : 0;
    this.previousPlayers.set(tank.partyIndex, {
      tank,
      x: tank.position.x,
      y: tank.position.y,
    });
    const fire = this.playerFire.get(tank.partyIndex);
    return {
      partyIndex: tank.partyIndex as SimulationPlayerIndex,
      tier: tank.type.tier as SimulationTankTier,
      x: tank.position.x,
      y: tank.position.y,
      rotation: tank.rotation as SimulationRotation,
      moving: tank.state === TankState.Moving,
      deltaX,
      deltaY,
      alive: tank.isAlive(),
      fireSeq: fire?.seq ?? 0,
      fireX: fire?.x ?? tank.position.x,
      fireY: fire?.y ?? tank.position.y,
      fireRotation:
        fire?.rotation ?? (tank.rotation as SimulationRotation),
      initialSync: !sameTank,
    };
  }

  private createEnemyFrame(tank: EnemyTank): SimulationEnemyFrame {
    const previous = this.previousEnemies.get(tank.partyIndex);
    const deltaX =
      previous === undefined ? 0 : tank.position.x - previous.x;
    const deltaY =
      previous === undefined ? 0 : tank.position.y - previous.y;
    this.previousEnemies.set(tank.partyIndex, {
      x: tank.position.x,
      y: tank.position.y,
    });
    const fire = this.enemyFire.get(tank.partyIndex);
    return {
      partyIndex: tank.partyIndex,
      x: tank.position.x,
      y: tank.position.y,
      rotation: tank.rotation as SimulationRotation,
      moving: tank.state === TankState.Moving,
      deltaX,
      deltaY,
      alive: tank.isAlive(),
      fireSeq: fire?.seq ?? 0,
      fireX: fire?.x ?? tank.position.x,
      fireY: fire?.y ?? tank.position.y,
      fireRotation:
        fire?.rotation ?? (tank.rotation as SimulationRotation),
    };
  }
}

function isRotation(value: SimulationRotation | null): boolean {
  return (
    value === null ||
    value === Rotation.Up ||
    value === Rotation.Right ||
    value === Rotation.Down ||
    value === Rotation.Left
  );
}

function isPowerSlot(value: number | null | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (Number.isInteger(value) && value >= 0 && value < 4)
  );
}
