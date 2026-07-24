import { BN, BorshInstructionCoder } from '@coral-xyz/anchor';
import {
  ConnectionMagicRouter,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationMetadataPdaFromDelegatedAccount,
  delegationRecordPdaFromDelegatedAccount,
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
} from '@magicblock-labs/ephemeral-rollups-sdk';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

import { Logger } from '../../core';
import { Rotation } from '../../game';
import { EnemyTank, PlayerTank, Tank } from '../../gameObjects';
import { TerrainRegionConfig, TerrainType } from '../../terrain';
import { getPhantomProvider } from '../../wallet';
import * as config from '../../config';
import { WebRtcGhostSync } from '../webrtc';

import { MagicBlockGhostSignalTransport } from './MagicBlockGhostSignalTransport';
import { TANK_MOVEMENT_IDL } from './TankMovementIdl';

const PROGRAM_ID = new PublicKey(
  'Aaxx2EcXQA5My5isrPw35FWPGUve4jaiW8u3ER9c9tRu',
);
const BASE_RPC = 'https://rpc.magicblock.app/devnet';
const ROUTER_RPC = 'https://devnet-router.magicblock.app';
const MAGIC_CONTEXT_ID = new PublicKey(
  'MagicContext1111111111111111111111111111111',
);
const MAINNET_ER_ENDPOINTS = [
  'https://as.magicblock.app',
  'https://eu.magicblock.app',
  'https://us.magicblock.app',
  'https://mainnet-tee.magicblock.app',
] as const;
const MATCH_SEED = Buffer.from('match');
const TERRAIN_SEED = Buffer.from('terrain');
const SESSION_TARGET_BALANCE = 0.05 * LAMPORTS_PER_SOL;
const UNITS_PER_PIXEL = 1000 / 64;
const SEND_INTERVAL_MS = 16;
const POLL_INTERVAL_MS = 1000;
const LOCAL_PREDICTION_EPSILON = 1 / UNITS_PER_PIXEL;
const REMOTE_CATCH_UP_SPEED_MULTIPLIER = 1.25;
const ENEMY_REPLAY_SPEED_MULTIPLIER = 1.25;
const ENEMY_REPLAY_SNAP_DISTANCE = 64;
const REMOTE_INPUT_BATCH_PLAYBACK_SECONDS = 0;
const REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD = 4;
const LOCAL_RECONCILE_SPEED_MULTIPLIER = 2;
const MAX_INPUT_BATCH_FRAMES = 16;
const MAX_BATCH_DISTANCE = 2000;
const MAX_FIRE_EVENTS_PER_BATCH = 4;
const MAX_FIRE_AGE_MS = 500;
const MATCH_ACCOUNT_BASE_SIZE = 188;
const INPUT_RECEIPT_SIZE = 113;
const MAX_PROJECTILES_PER_PLAYER = 4;
const PROJECTILE_SNAPSHOT_SIZE = 12;
const MATCH_ACCOUNT_PROJECTILES_OFFSET =
  MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE * 2;
const MATCH_ACCOUNT_SIZE =
  MATCH_ACCOUNT_PROJECTILES_OFFSET +
  PROJECTILE_SNAPSHOT_SIZE * MAX_PROJECTILES_PER_PLAYER * 2 +
  2;
const MAX_BOARD_MUTATIONS = 256;
const BOARD_MUTATION_SIZE = 2;
const MATCH_ACCOUNT_WITH_BOARD_SIZE =
  MATCH_ACCOUNT_SIZE + MAX_BOARD_MUTATIONS * BOARD_MUTATION_SIZE + 2;
const MAX_ENEMY_FIRE_EVENTS = 16;
const ENEMY_FIRE_EVENT_SIZE = 27;
const MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET = MATCH_ACCOUNT_WITH_BOARD_SIZE;
const MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE =
  MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET +
  MAX_ENEMY_FIRE_EVENTS * ENEMY_FIRE_EVENT_SIZE +
  2 +
  8;
const ENEMY_SPAWN_COUNT = 3;
const MAX_ENEMY_TOTAL = 20;
const MAX_ACTIVE_ENEMIES = 6;
const ENEMY_STATE_SIZE = 21;
const MATCH_ACCOUNT_ENEMIES_OFFSET =
  MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE +
  ENEMY_SPAWN_COUNT * 8 +
  1 +
  MAX_ENEMY_TOTAL;
const MATCH_ACCOUNT_WITH_ENEMIES_SIZE =
  MATCH_ACCOUNT_ENEMIES_OFFSET +
  MAX_ACTIVE_ENEMIES * ENEMY_STATE_SIZE +
  1 +
  8 * 4;
const BOARD_CELL_SIZE_PX = 16;
const TERRAIN_CHUNK_BYTES = 512;
const REMOTE_PROJECTILE_CATCH_UP_MULTIPLIER = 2;
const BASE_WALL_TERRAIN_REGIONS = [
  { x: 0, y: 0, width: 128, height: 32 },
  { x: 0, y: 32, width: 32, height: 64 },
  { x: 96, y: 32, width: 32, height: 64 },
] as const;

enum MatchSyncState {
  Idle,
  Starting,
  Waiting,
  Ready,
  Failed,
}

interface DelegationStatus {
  isDelegated: boolean;
  fqdn?: string;
}

interface MatchPlayerState {
  authority: PublicKey;
  x: number;
  y: number;
  direction: number;
  sequence: number;
  joined: boolean;
}

interface MatchAccountState {
  matchId: number;
  epoch: number;
  phase: number;
  players: [MatchPlayerState, MatchPlayerState];
  inputReceipts: [MatchInputReceipt, MatchInputReceipt];
  boardMutations: BoardMutation[];
  enemies: MatchEnemySnapshot[];
  enemyFireEvents: EnemyFireEvent[];
  simulationTick: number;
  tick: number;
}

interface MatchEnemySnapshot {
  id: number;
  x: number;
  y: number;
  direction: number;
}

export interface BoardMutation {
  x: number;
  y: number;
}

interface EnemyFireEvent {
  sequence: number;
  enemyId: number;
  x: number;
  y: number;
  direction: number;
  simulationTick: number;
}

interface MatchInputFrame {
  direction: number;
  distance: number;
  fire: boolean;
  fireAgeMs: number;
  queuedAtMs?: number;
}

interface MatchInputReceipt {
  batchSequence: number;
  startX: number;
  startY: number;
  frames: MatchInputFrame[];
}

interface InputLatencyProbe {
  sequence: number;
  startedAtMs: number;
  resolve: (elapsedMs: number) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

interface RemoteWaypoint {
  x: number;
  y: number;
  direction: number;
  sequence: number;
  teleport: boolean;
  remainingDistance?: number;
  remainingTime?: number;
  fire?: boolean;
}

interface EnemyMovementSegment {
  x: number;
  y: number;
  direction: number;
}

interface EnemyReplayState {
  authorityX: number;
  authorityY: number;
  authorityDirection: number;
  initialized: boolean;
  segments: EnemyMovementSegment[];
}

export class MagicBlockMatchSync {
  private readonly log = new Logger('MagicBlockMatch', Logger.Level.Info);
  private readonly baseConnection = new Connection(BASE_RPC, 'confirmed');
  private readonly routerConnection = new ConnectionMagicRouter(
    ROUTER_RPC,
    'confirmed',
  );
  private readonly instructionCoder = new BorshInstructionCoder(
    TANK_MOVEMENT_IDL,
  );
  private readonly localPlayerIndex: number;
  private readonly observerMode: boolean;
  private readonly enabled: boolean;
  private state = MatchSyncState.Idle;
  private matchId: number = null;
  private matchPda: PublicKey = null;
  private terrainPda: PublicKey = null;
  private session: Keypair = null;
  private erConnection: Connection = null;
  private target: MatchAccountState = null;
  private accountSubscription: number = null;
  private lastPollAt = 0;
  private polling = false;
  private sending = false;
  private sequence = 0;
  private lastLocalX = 0;
  private lastLocalY = 0;
  private lastSendAt = 0;
  private localBulletWallDamage = 1;
  private remoteStateInitialized = false;
  private readonly remoteWaypoints: RemoteWaypoint[] = [];
  private lastQueuedRemoteSequence = -1;
  private readonly observerRemoteStateInitialized: [boolean, boolean] = [
    false,
    false,
  ];
  private readonly observerRemoteWaypoints: [RemoteWaypoint[], RemoteWaypoint[]] = [
    [],
    [],
  ];
  private readonly observerLastQueuedRemoteSequence: [number, number] = [-1, -1];
  private localTankIdentity: PlayerTank = null;
  private localTankWasRemoved = false;
  private pendingRespawnTank: PlayerTank = null;
  private readonly pendingInputFrames: MatchInputFrame[] = [];
  private readonly knownBoardMutations = new Set<string>();
  private readonly remoteBoardMutations: BoardMutation[] = [];
  private knownBoardMutationEpoch = -1;
  private readonly pendingEnemyFireEvents: EnemyFireEvent[] = [];
  private readonly debugDisableEnemyShooting: boolean;
  private playerMirrorBulletsSuppressed = false;
  private lastEnemyFireSequence = 0;
  private capturedLocalX = 0;
  private capturedLocalY = 0;
  private lastCapturedDirection: number = null;
  private currentLevelNumber = 1;
  private statusContainer: HTMLDivElement = null;
  private statusMessageElement: HTMLDivElement = null;
  private joinButtonElement: HTMLButtonElement = null;
  private latencyButtonElement: HTMLButtonElement = null;
  private inputLatencyButtonElement: HTMLButtonElement = null;
  private mainnetLatencyButtonElement: HTMLButtonElement = null;
  private inputLatencyProbe: InputLatencyProbe = null;
  private erEndpoint: string = null;
  private readonly initializedEnemies = new Set<number>();
  private readonly enemyReplayStates = new Map<number, EnemyReplayState>();
  private ghostSignalTransport: MagicBlockGhostSignalTransport = null;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.enabled = params.get('mode') === 'match';
    this.observerMode = params.get('observer') === '1';
    this.localPlayerIndex =
      !this.observerMode && params.get('join') === '1' ? 1 : 0;
    this.debugDisableEnemyShooting = params.get('debugNoEnemyShooting') === '1';
    this.matchId = this.parseMatchId(params.get('match'));
    if (this.enabled) {
      this.showStatus(
        this.observerMode
          ? 'Opening MagicBlock observer...'
          : this.localPlayerIndex === 0
          ? 'Preparing MagicBlock match...'
          : 'Joining MagicBlock match...',
      );
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getLocalPlayerIndex(): number {
    return this.localPlayerIndex;
  }

  public isObserver(): boolean {
    return this.enabled && this.observerMode;
  }

  public isRemoteTank(partyIndex: number): boolean {
    return this.enabled && (this.observerMode || partyIndex !== this.localPlayerIndex);
  }

  public update(
    tanks: PlayerTank[],
    deltaTime: number,
    levelNumber: number,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemySpeedClasses: number[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): void {
    if (!this.enabled || this.state === MatchSyncState.Failed) {
      return;
    }

    const firstTank = tanks[0];
    const secondTank = tanks[1];
    const localTank = tanks[this.localPlayerIndex];
    const remoteTank = tanks[1 - this.localPlayerIndex];
    const requiredTank = this.observerMode ? firstTank : localTank;
    if (requiredTank === null || requiredTank === undefined) {
      if (this.state === MatchSyncState.Ready) {
        this.localTankWasRemoved = true;
      }
      return;
    }

    if (this.state === MatchSyncState.Idle) {
      if (firstTank === null || firstTank === undefined || secondTank === null || secondTank === undefined) {
        return;
      }
      this.currentLevelNumber = levelNumber;
      this.lastLocalX = requiredTank.position.x;
      this.lastLocalY = requiredTank.position.y;
      this.capturedLocalX = requiredTank.position.x;
      this.capturedLocalY = requiredTank.position.y;
      this.lastCapturedDirection = this.fromGameRotation(requiredTank.rotation);
      this.localTankIdentity = requiredTank;
      this.state = MatchSyncState.Starting;
      void this.start(
        firstTank,
        secondTank,
        fieldWidth,
        fieldHeight,
        enemySpawns,
        enemySpeedClasses,
        basePosition,
        terrainRegions,
      ).catch(this.fail);
      return;
    }

    if (this.state !== MatchSyncState.Ready || this.target === null) {
      return;
    }

    if (this.observerMode) {
      this.applyObserverState(tanks, deltaTime);
      this.refreshIfStale();
      return;
    }

    if (this.localTankIdentity !== localTank) {
      if (this.localTankWasRemoved) {
        this.pendingInputFrames.length = 0;
        this.capturedLocalX = localTank.position.x;
        this.capturedLocalY = localTank.position.y;
        this.lastCapturedDirection = this.fromGameRotation(localTank.rotation);
        this.pendingRespawnTank = localTank;
      }
      this.localTankIdentity = localTank;
      this.localTankWasRemoved = false;
    }

    if (this.target.phase !== 1) {
      this.pendingInputFrames.length = 0;
      this.applyRemoteState(remoteTank, deltaTime);
      return;
    }

    this.captureLocalInput(localTank);
    this.localBulletWallDamage = localTank.attributes.bulletWallDamage;
    this.applyRemoteState(remoteTank, deltaTime);
    this.capturePendingBoardMutations(localTank);

    if (this.pendingRespawnTank !== null) {
      if (!this.sending) {
        void this.respawnLocalPlayer(this.pendingRespawnTank).catch(
          this.handleMovementError,
        );
      }
      return;
    }

    this.reconcileLocalState(localTank, deltaTime);

    this.refreshIfStale();

    if (!this.sending && Date.now() - this.lastSendAt >= SEND_INTERVAL_MS) {
      void this.sendPendingInputBatch().catch(this.handleMovementError);
    }
  }

  public recordLocalFire(tank: PlayerTank): void {
    if (
      this.observerMode ||
      this.state !== MatchSyncState.Ready ||
      tank !== this.localTankIdentity ||
      this.pendingRespawnTank !== null
    ) {
      return;
    }

    const direction = this.fromGameRotation(tank.rotation);
    this.enqueueInputFrame(direction, 0, true);
    this.lastCapturedDirection = direction;
  }

  public recordBoardCellDestroyed(centerX: number, centerY: number): void {
    // Local bullet terrain damage is cosmetic only. Authoritative board
    // mutations must come from the ER/server state, otherwise a replayed mirror
    // bullet can submit the same wall destruction as a second canonical hit.
  }

  public drainRemoteBoardMutations(): BoardMutation[] {
    return this.remoteBoardMutations.splice(0);
  }

  public applyEnemyState(
    tanks: EnemyTank[],
    playerTanks: PlayerTank[],
    basePosition: { x: number; y: number },
    deltaTime: number,
  ): void {
    if (this.state !== MatchSyncState.Ready || this.target === null) {
      return;
    }
    const activeEnemyIds = new Set(
      this.target.enemies.map((snapshot) => snapshot.id),
    );
    Array.from(this.enemyReplayStates.keys()).forEach((enemyId) => {
      if (!activeEnemyIds.has(enemyId)) {
        this.enemyReplayStates.delete(enemyId);
        this.initializedEnemies.delete(enemyId);
      }
    });
    this.target.enemies.forEach((snapshot) => {
      const tank = tanks.find((candidate) => candidate.partyIndex === snapshot.id);
      if (tank === undefined) {
        return;
      }
      const x = this.fromChainUnits(snapshot.x);
      const y = this.fromChainUnits(snapshot.y);
      const replayState = this.getEnemyReplayState(snapshot, x, y);
      this.queueEnemyMovementSegment(snapshot, replayState, x, y);
      this.applyEnemyReplay(tank, replayState, tanks, playerTanks, basePosition, deltaTime);
      tank.updateMatrix(true);
      // A chain snapshot can create an enemy after the world's update pass.
      // CollisionSystem registers/initializes that collider on the next frame.
      if (tank.collider.isInitialized()) {
        tank.collider.update();
      }
    });
    this.applyPendingEnemyFireEvents(tanks);
  }

  public getActiveEnemyIds(): number[] {
    return this.target?.enemies.map((enemy) => enemy.id) ?? [];
  }

  public setPlayerMirrorBulletsSuppressed(suppressed: boolean): void {
    this.playerMirrorBulletsSuppressed = suppressed;
  }

  private getEnemyReplayState(
    snapshot: MatchEnemySnapshot,
    x: number,
    y: number,
  ): EnemyReplayState {
    let replayState = this.enemyReplayStates.get(snapshot.id);
    if (replayState === undefined) {
      replayState = {
        authorityX: x,
        authorityY: y,
        authorityDirection: snapshot.direction,
        initialized: false,
        segments: [],
      };
      this.enemyReplayStates.set(snapshot.id, replayState);
    }
    return replayState;
  }

  private queueEnemyMovementSegment(
    snapshot: MatchEnemySnapshot,
    replayState: EnemyReplayState,
    x: number,
    y: number,
  ): void {
    const deltaX = x - replayState.authorityX;
    const deltaY = y - replayState.authorityY;
    const distance = Math.hypot(deltaX, deltaY);
    if (
      distance <= LOCAL_PREDICTION_EPSILON &&
      snapshot.direction === replayState.authorityDirection
    ) {
      return;
    }
    replayState.segments.push({
      x,
      y,
      direction: this.directionFromDelta(
        replayState.authorityX,
        replayState.authorityY,
        x,
        y,
        snapshot.direction,
      ),
    });
    replayState.authorityX = x;
    replayState.authorityY = y;
    replayState.authorityDirection = snapshot.direction;
    if (replayState.segments.length > REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD) {
      replayState.segments.splice(
        0,
        replayState.segments.length - REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD,
      );
    }
  }

  private applyEnemyReplay(
    tank: EnemyTank,
    replayState: EnemyReplayState,
    enemyTanks: EnemyTank[],
    playerTanks: PlayerTank[],
    basePosition: { x: number; y: number },
    deltaTime: number,
  ): void {
    if (!replayState.initialized) {
      tank.position.set(replayState.authorityX, replayState.authorityY);
      tank.rotation = this.toGameRotation(replayState.authorityDirection);
      replayState.segments.length = 0;
      replayState.initialized = true;
      this.initializedEnemies.add(tank.partyIndex);
      return;
    }

    const authorityDistance = Math.hypot(
      replayState.authorityX - tank.position.x,
      replayState.authorityY - tank.position.y,
    );
    if (authorityDistance > ENEMY_REPLAY_SNAP_DISTANCE) {
      tank.position.set(replayState.authorityX, replayState.authorityY);
      tank.rotation = this.toGameRotation(replayState.authorityDirection);
      replayState.segments.length = 0;
      return;
    }

    let movementBudget =
      tank.attributes.moveSpeed * ENEMY_REPLAY_SPEED_MULTIPLIER * deltaTime;
    while (
      movementBudget > LOCAL_PREDICTION_EPSILON &&
      replayState.segments.length > 0
    ) {
      const segment = replayState.segments[0];
      const deltaX = segment.x - tank.position.x;
      const deltaY = segment.y - tank.position.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance <= LOCAL_PREDICTION_EPSILON) {
        tank.position.set(segment.x, segment.y);
        tank.rotation = this.toGameRotation(segment.direction);
        replayState.segments.shift();
        continue;
      }
      const direction = this.directionFromDelta(
        tank.position.x,
        tank.position.y,
        segment.x,
        segment.y,
        segment.direction,
      );
      tank.rotate(this.toGameRotation(direction));
      const step = Math.min(distance, movementBudget);
      const nextPosition = this.positionAfterMove(
        tank.position.x,
        tank.position.y,
        direction,
        step,
      );
      if (
        this.clientTankPositionBlocked(
          tank,
          nextPosition.x,
          nextPosition.y,
          enemyTanks,
          playerTanks,
          basePosition,
        )
      ) {
        replayState.segments.shift();
        break;
      }
      this.moveTankInDirection(tank, direction, step);
      movementBudget -= step;
      if (step >= distance - LOCAL_PREDICTION_EPSILON) {
        tank.position.set(segment.x, segment.y);
        tank.rotation = this.toGameRotation(segment.direction);
        replayState.segments.shift();
      }
    }
    if (replayState.segments.length === 0) {
      tank.rotation = this.toGameRotation(replayState.authorityDirection);
    }
  }

  private applyPendingEnemyFireEvents(tanks: EnemyTank[]): void {
    if (this.pendingEnemyFireEvents.length === 0) {
      return;
    }
    if (this.debugDisableEnemyShooting) {
      this.pendingEnemyFireEvents.length = 0;
      return;
    }
    const remaining: EnemyFireEvent[] = [];
    this.pendingEnemyFireEvents.forEach((event) => {
      const tank = tanks.find(
        (candidate) =>
          candidate !== null &&
          candidate !== undefined &&
          candidate.partyIndex === event.enemyId,
      );
      if (tank === undefined) {
        remaining.push(event);
        return;
      }
      const bullet = tank.fireFromNetwork(
        this.fromChainUnits(event.x),
        this.fromChainUnits(event.y),
        this.toGameRotation(event.direction),
      );
      bullet?.setLocalDamageDisabled(true);
    });
    this.pendingEnemyFireEvents.length = 0;
    this.pendingEnemyFireEvents.push(...remaining);
  }

  private positionAfterMove(
    x: number,
    y: number,
    direction: number,
    distance: number,
  ): { x: number; y: number } {
    if (direction === 0) {
      return { x, y: y - distance };
    }
    if (direction === 1) {
      return { x: x + distance, y };
    }
    if (direction === 2) {
      return { x, y: y + distance };
    }
    return { x: x - distance, y };
  }

  private clientTankPositionBlocked(
    movingTank: EnemyTank,
    x: number,
    y: number,
    enemyTanks: EnemyTank[],
    playerTanks: PlayerTank[],
    basePosition: { x: number; y: number },
  ): boolean {
    if (
      this.rectsOverlap(
        x,
        y,
        movingTank.size.width,
        movingTank.size.height,
        basePosition.x,
        basePosition.y,
        config.BASE_DEFAULT_SIZE.width,
        config.BASE_DEFAULT_SIZE.height,
      )
    ) {
      return true;
    }
    if (
      playerTanks.some((playerTank) =>
        playerTank !== null &&
        playerTank !== undefined &&
        this.rectsOverlap(
            x,
            y,
            movingTank.size.width,
            movingTank.size.height,
            playerTank.position.x,
            playerTank.position.y,
            playerTank.size.width,
            playerTank.size.height,
          ),
      )
    ) {
      return true;
    }
    return enemyTanks.some((enemyTank) => {
      return (
        enemyTank !== null &&
        enemyTank !== undefined &&
        enemyTank !== movingTank &&
        this.rectsOverlap(
          x,
          y,
          movingTank.size.width,
          movingTank.size.height,
          enemyTank.position.x,
          enemyTank.position.y,
          enemyTank.size.width,
          enemyTank.size.height,
        )
      );
    });
  }

  private rectsOverlap(
    firstX: number,
    firstY: number,
    firstWidth: number,
    firstHeight: number,
    secondX: number,
    secondY: number,
    secondWidth: number,
    secondHeight: number,
  ): boolean {
    return (
      firstX < secondX + secondWidth &&
      firstX + firstWidth > secondX &&
      firstY < secondY + secondHeight &&
      firstY + firstHeight > secondY
    );
  }

  private directionFromDelta(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fallbackDirection: number,
  ): number {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 1 : 3;
    }
    if (Math.abs(deltaY) > LOCAL_PREDICTION_EPSILON) {
      return deltaY > 0 ? 2 : 0;
    }
    return fallbackDirection;
  }

  private async start(
    firstTank: PlayerTank,
    secondTank: PlayerTank,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemySpeedClasses: number[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): Promise<void> {
    const provider = getPhantomProvider();
    if (provider === null) {
      throw new Error('Phantom is required for a MagicBlock match.');
    }
    const wallet = await provider.connect();
    const walletPublicKey = new PublicKey(wallet.publicKey.toString());

    if (this.localPlayerIndex === 0 && this.matchId === null) {
      this.matchId = this.createMatchId();
      const url = new URL(window.location.href);
      url.searchParams.set('magicblock', '1');
      url.searchParams.set('mode', 'match');
      url.searchParams.set('match', this.matchId.toString());
      url.searchParams.delete('join');
      window.history.replaceState(null, '', url.toString());
    }
    if (this.matchId === null) {
      throw new Error('The player-two link is missing its match ID.');
    }

    this.matchPda = this.deriveMatchPda(this.matchId);
    this.terrainPda = this.deriveTerrainPda(this.matchId);

    if (this.observerMode) {
      await this.startObserver();
      return;
    }

    this.session = this.loadOrCreateSession();
    await this.fundSession(walletPublicKey);

    if (this.localPlayerIndex === 0) {
      await this.startHost(
        firstTank,
        secondTank,
        fieldWidth,
        fieldHeight,
        enemySpawns,
        enemySpeedClasses,
        basePosition,
        terrainRegions,
      );
    } else {
      await this.startJoiner();
    }
  }

  private async startHost(
    firstTank: PlayerTank,
    secondTank: PlayerTank,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemySpeedClasses: number[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): Promise<void> {
    let account = await this.baseConnection.getAccountInfo(this.matchPda);
    if (account === null) {
      await this.createMatch(
        firstTank,
        secondTank,
        fieldWidth,
        fieldHeight,
        enemySpawns,
        enemySpeedClasses,
        basePosition,
        terrainRegions,
      );
      account = await this.baseConnection.getAccountInfo(this.matchPda);
    }
    if (account === null) {
      throw new Error('The match account was not created.');
    }

    if (account.owner.equals(PROGRAM_ID)) {
      this.state = MatchSyncState.Waiting;
      this.showJoinControl();
      await this.waitForSecondPlayer();
      await this.delegateTerrain();
      await this.delegateMatch();
    } else if (!account.owner.equals(DELEGATION_PROGRAM_ID)) {
      throw new Error('The match PDA has an unexpected owner.');
    }

    const delegation = await this.waitForDelegation();
    await this.connectToEr(delegation);
    if (this.target.phase === 0) {
      await this.startMatch();
      this.updateTarget(await this.fetchMatchState(this.erConnection));
      await this.scheduleMatchCrank();
    }
    this.finishReady();
  }

  private async startJoiner(): Promise<void> {
    let account = await this.baseConnection.getAccountInfo(this.matchPda);
    if (account === null) {
      throw new Error('Match not found. Ask player one for a new link.');
    }
    if (account.owner.equals(PROGRAM_ID)) {
      const state = this.decodeMatchState(account.data);
      if (!state.players[1].joined) {
        await this.joinMatch();
      } else if (!state.players[1].authority.equals(this.session.publicKey)) {
        throw new Error('This match already has a second player.');
      }
    } else if (!account.owner.equals(DELEGATION_PROGRAM_ID)) {
      throw new Error('The match PDA has an unexpected owner.');
    }

    this.state = MatchSyncState.Waiting;
    this.showStatus('Joined; waiting for player one to start...');
    const delegation = await this.waitForDelegation();
    await this.connectToEr(delegation);
    while (this.target.phase !== 1) {
      await this.delay(500);
      this.updateTarget(await this.fetchMatchState(this.erConnection));
    }
    this.finishReady();
  }

  private async startObserver(): Promise<void> {
    const account = await this.baseConnection.getAccountInfo(this.matchPda);
    if (account === null) {
      throw new Error('Match not found. Ask player one for an observer link.');
    }
    if (
      !account.owner.equals(PROGRAM_ID) &&
      !account.owner.equals(DELEGATION_PROGRAM_ID)
    ) {
      throw new Error('The match PDA has an unexpected owner.');
    }

    this.state = MatchSyncState.Waiting;
    this.showStatus('Observer waiting for MagicBlock ER...');
    const delegation = await this.waitForDelegation();
    await this.connectToEr(delegation);
    this.finishObserverReady();
  }

  private async createMatch(
    firstTank: PlayerTank,
    secondTank: PlayerTank,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemySpeedClasses: number[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): Promise<void> {
    const paddedEnemySpawns = Array.from(
      { length: ENEMY_SPAWN_COUNT },
      (_, index) => enemySpawns[index] ?? { x: 0, y: 0 },
    );
    const paddedSpeedClasses = Array.from(
      { length: MAX_ENEMY_TOTAL },
      (_, index) => enemySpeedClasses[index] ?? 0,
    );
    const terrain = this.encodeTerrain(
      fieldWidth,
      fieldHeight,
      this.withBaseWallTerrainRegions(terrainRegions, basePosition),
    );
    const data = this.instructionCoder.encode('createMatch', {
      matchId: new BN(this.matchId),
      mapId: this.currentLevelNumber,
      fieldWidth: this.toChainUnits(fieldWidth - 64),
      fieldHeight: this.toChainUnits(fieldHeight - 64),
      spawns: [
        {
          x: this.toChainUnits(firstTank.position.x),
          y: this.toChainUnits(firstTank.position.y),
        },
        {
          x: this.toChainUnits(secondTank.position.x),
          y: this.toChainUnits(secondTank.position.y),
        },
      ],
      enemySpawns: paddedEnemySpawns.map((spawn) => ({
        x: this.toChainUnits(spawn.x),
        y: this.toChainUnits(spawn.y),
      })),
      enemyTotal: Math.min(enemySpeedClasses.length, MAX_ENEMY_TOTAL),
      enemySpeedClasses: paddedSpeedClasses,
      terrainWidth: terrain.width,
      terrainHeight: terrain.height,
      basePosition: {
        x: this.toChainUnits(basePosition.x),
        y: this.toChainUnits(basePosition.y),
      },
      debugDisableEnemyShooting: this.debugDisableEnemyShooting,
    });
    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
          { pubkey: this.terrainPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      }),
      false,
      'createMatch',
    );
    await this.uploadTerrain(terrain.bytes, terrain.steelBytes);
  }

  private encodeTerrain(
    fieldWidth: number,
    fieldHeight: number,
    regions: TerrainRegionConfig[],
  ): { width: number; height: number; bytes: Uint8Array; steelBytes: Uint8Array } {
    const width = Math.ceil(fieldWidth / BOARD_CELL_SIZE_PX);
    const height = Math.ceil(fieldHeight / BOARD_CELL_SIZE_PX);
    if (width > 108 || height > 108) {
      throw new Error(`Map terrain grid ${width}x${height} exceeds 108x108.`);
    }
    const bytes = new Uint8Array(Math.ceil((width * height) / 8));
    const steelBytes = new Uint8Array(bytes.length);
    const solidTypes = new Set([
      TerrainType.Brick,
      TerrainType.BrickSuper,
      TerrainType.Steel,
      TerrainType.Water,
    ]);
    regions.filter((region) => solidTypes.has(region.type)).forEach((region) => {
      const minX = Math.max(0, Math.floor(region.x / BOARD_CELL_SIZE_PX));
      const minY = Math.max(0, Math.floor(region.y / BOARD_CELL_SIZE_PX));
      const maxX = Math.min(
        width,
        Math.ceil((region.x + region.width) / BOARD_CELL_SIZE_PX),
      );
      const maxY = Math.min(
        height,
        Math.ceil((region.y + region.height) / BOARD_CELL_SIZE_PX),
      );
      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          const bitIndex = y * width + x;
          bytes[bitIndex >> 3] |= 1 << (bitIndex & 7);
          if (region.type === TerrainType.Steel) {
            steelBytes[bitIndex >> 3] |= 1 << (bitIndex & 7);
          }
        }
      }
    });
    return { width, height, bytes, steelBytes };
  }

  private withBaseWallTerrainRegions(
    regions: TerrainRegionConfig[],
    basePosition: { x: number; y: number },
  ): TerrainRegionConfig[] {
    return [
      ...regions,
      ...BASE_WALL_TERRAIN_REGIONS.map((region) => ({
        type: TerrainType.Brick,
        x: basePosition.x + region.x,
        y: basePosition.y + region.y,
        width: region.width,
        height: region.height,
      })),
    ];
  }

  private async uploadTerrain(bytes: Uint8Array, steelBytes: Uint8Array): Promise<void> {
    for (let offset = 0; offset < bytes.length; offset += TERRAIN_CHUNK_BYTES) {
      const chunk = Array.from(
        bytes.subarray(offset, offset + TERRAIN_CHUNK_BYTES),
      );
      const steelChunk = Array.from(
        steelBytes.subarray(offset, offset + TERRAIN_CHUNK_BYTES),
      );
      await this.sendWithSession(
        this.baseConnection,
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
            { pubkey: this.matchPda, isSigner: false, isWritable: true },
            { pubkey: this.terrainPda, isSigner: false, isWritable: true },
          ],
          data: this.instructionCoder.encode('initializeTerrainChunk', {
            matchId: new BN(this.matchId),
            offset,
            bytes: chunk,
            steelBytes: steelChunk,
          }),
        }),
        false,
        `initializeTerrainChunk(${offset})`,
      );
    }
    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
          { pubkey: this.terrainPda, isSigner: false, isWritable: true },
        ],
        data: this.instructionCoder.encode('finalizeTerrain', {
          matchId: new BN(this.matchId),
        }),
      }),
      false,
      'finalizeTerrain',
    );
    this.log.info(`Uploaded ${bytes.length} bytes of authoritative terrain.`);
  }

  private async joinMatch(): Promise<void> {
    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
        ],
        data: this.instructionCoder.encode('joinMatch', {
          matchId: new BN(this.matchId),
        }),
      }),
      false,
      'joinMatch',
    );
  }

  private async waitForSecondPlayer(): Promise<void> {
    while (true) {
      const state = await this.fetchMatchState(this.baseConnection);
      if (state.players[1].joined) {
        return;
      }
      await this.delay(1000);
    }
  }

  private async delegateMatch(): Promise<void> {
    const account = await this.baseConnection.getAccountInfo(this.matchPda);
    if (account === null) {
      throw new Error('The match account does not exist.');
    }
    if (account.owner.equals(DELEGATION_PROGRAM_ID)) {
      this.log.info('Match account already delegated; skipping delegateMatch.');
      return;
    }
    if (!account.owner.equals(PROGRAM_ID)) {
      throw new Error('The match PDA has an unexpected owner.');
    }

    const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
      this.matchPda,
      PROGRAM_ID,
    );
    const delegationRecord = delegationRecordPdaFromDelegatedAccount(
      this.matchPda,
    );
    const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(
      this.matchPda,
    );
    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: buffer, isSigner: false, isWritable: true },
          { pubkey: delegationRecord, isSigner: false, isWritable: true },
          { pubkey: delegationMetadata, isSigner: false, isWritable: true },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: this.instructionCoder.encode('delegateMatch', {
          matchId: new BN(this.matchId),
        }),
      }),
      false,
      'delegateMatch',
    );
  }

  private async delegateTerrain(): Promise<void> {
    const account = await this.baseConnection.getAccountInfo(this.terrainPda);
    if (account === null) {
      throw new Error('The terrain account does not exist.');
    }
    if (account.owner.equals(DELEGATION_PROGRAM_ID)) {
      this.log.info('Terrain account already delegated; skipping delegateTerrain.');
      return;
    }
    if (!account.owner.equals(PROGRAM_ID)) {
      throw new Error('The terrain PDA has an unexpected owner.');
    }

    const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
      this.terrainPda,
      PROGRAM_ID,
    );
    const delegationRecord = delegationRecordPdaFromDelegatedAccount(
      this.terrainPda,
    );
    const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(
      this.terrainPda,
    );
    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: buffer, isSigner: false, isWritable: true },
          { pubkey: delegationRecord, isSigner: false, isWritable: true },
          { pubkey: delegationMetadata, isSigner: false, isWritable: true },
          { pubkey: this.terrainPda, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: this.instructionCoder.encode('delegateTerrain', {
          matchId: new BN(this.matchId),
        }),
      }),
      false,
      'delegateTerrain',
    );
  }

  private async startMatch(): Promise<void> {
    await this.sendWithSession(
      this.erConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
          { pubkey: this.terrainPda, isSigner: false, isWritable: true },
        ],
        data: this.instructionCoder.encode('startMatch', {
          matchId: new BN(this.matchId),
        }),
      }),
      true,
      'startMatch',
    );
  }

  private async scheduleMatchCrank(): Promise<void> {
    await this.sendWithSession(
      this.erConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
          { pubkey: this.terrainPda, isSigner: false, isWritable: false },
          { pubkey: MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
          { pubkey: MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: this.instructionCoder.encode('scheduleMatchCrank', {
          matchId: new BN(this.matchId),
          epoch: new BN(this.target.epoch),
        }),
      }),
      true,
      'scheduleMatchCrank',
    );
    this.log.info('Scheduled authoritative enemy crank at 20 Hz.');
  }

  private async connectToEr(delegation: DelegationStatus): Promise<void> {
    if (!delegation.fqdn) {
      throw new Error('MagicBlock router did not return an ER endpoint.');
    }
    this.erEndpoint = delegation.fqdn;
    this.erConnection = new Connection(delegation.fqdn, 'confirmed');
    this.updateTarget(await this.waitForErMatchState());
    this.accountSubscription = this.erConnection.onAccountChange(
      this.matchPda,
      (account) => {
        try {
          this.updateTarget(this.decodeMatchState(account.data));
          this.lastPollAt = Date.now();
        } catch (error) {
          this.handleRefreshError(error as Error);
        }
      },
      'processed',
    );
    this.log.info(`Match ${this.matchId} connected to ${delegation.fqdn}`);
  }

  private async waitForErMatchState(): Promise<MatchAccountState> {
    let lastError: Error = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        return await this.fetchMatchState(this.erConnection);
      } catch (error) {
        lastError = error as Error;
        await this.delay(250);
      }
    }
    throw new Error(
      `Match was delegated but did not become readable on the ER: ${lastError?.message ?? 'unknown error'}`,
    );
  }

  private finishReady(): void {
    const local = this.target.players[this.localPlayerIndex];
    this.sequence = local.sequence;
    this.lastLocalX = this.fromChainUnits(local.x);
    this.lastLocalY = this.fromChainUnits(local.y);
    this.pendingInputFrames.length = 0;
    this.capturedLocalX = this.lastLocalX;
    this.capturedLocalY = this.lastLocalY;
    this.remoteWaypoints.length = 0;
    this.lastQueuedRemoteSequence = -1;
    this.pendingEnemyFireEvents.length = 0;
    this.lastEnemyFireSequence = 0;
    this.knownBoardMutations.clear();
    this.remoteBoardMutations.length = 0;
    this.knownBoardMutationEpoch = this.target.epoch;
    this.queueRemoteSnapshot(this.target.players[1 - this.localPlayerIndex]);
    this.queueBoardMutations(this.target.boardMutations);
    this.queueEnemyFireEvents(this.target.enemyFireEvents);
    this.state = MatchSyncState.Ready;
    this.joinButtonElement?.remove();
    this.joinButtonElement = null;
    this.showStatus(
      `MagicBlock match live - player ${this.localPlayerIndex + 1}\nER: ${this.formatErEndpoint()}`,
    );
    this.showLatencyControl();
    this.showInputLatencyControl();
    this.showMainnetLatencyControl();
    this.configureGhostSignalTransport();
  }

  private finishObserverReady(): void {
    this.pendingInputFrames.length = 0;
    this.remoteWaypoints.length = 0;
    this.lastQueuedRemoteSequence = -1;
    this.observerRemoteWaypoints.forEach((waypoints) => {
      waypoints.length = 0;
    });
    this.observerRemoteStateInitialized[0] = false;
    this.observerRemoteStateInitialized[1] = false;
    this.observerLastQueuedRemoteSequence[0] = -1;
    this.observerLastQueuedRemoteSequence[1] = -1;
    this.pendingEnemyFireEvents.length = 0;
    this.lastEnemyFireSequence = 0;
    this.knownBoardMutations.clear();
    this.remoteBoardMutations.length = 0;
    this.knownBoardMutationEpoch = this.target.epoch;
    this.target.players.forEach((player, index) => {
      this.queueObserverSnapshot(index, player);
    });
    this.queueBoardMutations(this.target.boardMutations);
    this.queueEnemyFireEvents(this.target.enemyFireEvents);
    this.state = MatchSyncState.Ready;
    this.joinButtonElement?.remove();
    this.joinButtonElement = null;
    this.showStatus(
      `MagicBlock observer live\nER: ${this.formatErEndpoint()}`,
    );
    this.showLatencyControl();
    this.showMainnetLatencyControl();
  }

  private configureGhostSignalTransport(): void {
    if (
      this.erConnection === null ||
      this.session === null ||
      this.target === null
    ) {
      return;
    }

    const remoteAuthority = this.target.players[1 - this.localPlayerIndex].authority;
    this.ghostSignalTransport = new MagicBlockGhostSignalTransport(
      this.erConnection,
      this.session,
      remoteAuthority,
      this.matchId.toString(),
      this.localPlayerIndex,
    );
    WebRtcGhostSync.getInstance().setSignalTransport(this.ghostSignalTransport);
    this.log.info('MagicBlock WebRTC ghost signaling enabled.');
  }

  private captureLocalInput(tank: PlayerTank): void {
    const visualDirection = this.fromGameRotation(tank.rotation);
    if (visualDirection !== this.lastCapturedDirection) {
      this.enqueueInputFrame(visualDirection, 0);
      this.lastCapturedDirection = visualDirection;
    }

    const deltaX = tank.position.x - this.capturedLocalX;
    const deltaY = tank.position.y - this.capturedLocalY;
    const horizontalDistance = Math.round(Math.abs(deltaX) * UNITS_PER_PIXEL);
    const verticalDistance = Math.round(Math.abs(deltaY) * UNITS_PER_PIXEL);
    let lastMovementDirection = visualDirection;

    if (horizontalDistance > 0) {
      lastMovementDirection = deltaX > 0 ? 1 : 3;
      this.enqueueInputFrame(lastMovementDirection, horizontalDistance);
      this.capturedLocalX +=
        Math.sign(deltaX) * (horizontalDistance / UNITS_PER_PIXEL);
    }
    if (verticalDistance > 0) {
      lastMovementDirection = deltaY > 0 ? 2 : 0;
      this.enqueueInputFrame(lastMovementDirection, verticalDistance);
      this.capturedLocalY +=
        Math.sign(deltaY) * (verticalDistance / UNITS_PER_PIXEL);
    }

    if (
      (horizontalDistance > 0 || verticalDistance > 0) &&
      lastMovementDirection !== visualDirection
    ) {
      this.enqueueInputFrame(visualDirection, 0);
    }
  }

  private capturePendingBoardMutations(tank: PlayerTank): void {
    // Board mutations are no longer client-authoritative. Keep this hook as a
    // no-op so callers do not force empty movement sends for cosmetic damage.
  }

  private enqueueInputFrame(
    direction: number,
    distance: number,
    fire = false,
  ): void {
    let remaining = distance;
    do {
      const frameDistance = Math.min(1000, remaining);
      const last = this.pendingInputFrames[this.pendingInputFrames.length - 1];
      if (
        !fire &&
        !last?.fire &&
        last !== undefined &&
        last.direction === direction &&
        last.distance + frameDistance <= 1000
      ) {
        last.distance += frameDistance;
      } else if (
        fire ||
        frameDistance > 0 ||
        last === undefined ||
        last.direction !== direction
      ) {
        this.pendingInputFrames.push({
          direction,
          distance: frameDistance,
          fire,
          fireAgeMs: 0,
          queuedAtMs: fire ? performance.now() : undefined,
        });
      }
      remaining -= frameDistance;
    } while (remaining > 0);
  }

  private takeInputBatch(): MatchInputFrame[] {
    const batch: MatchInputFrame[] = [];
    let totalDistance = 0;
    let fireEvents = 0;
    while (
      this.pendingInputFrames.length > 0 &&
      batch.length < MAX_INPUT_BATCH_FRAMES
    ) {
      const next = this.pendingInputFrames[0];
      if (
        batch.length > 0 &&
        (totalDistance + next.distance > MAX_BATCH_DISTANCE ||
          (next.fire && fireEvents >= MAX_FIRE_EVENTS_PER_BATCH))
      ) {
        break;
      }
      batch.push(this.pendingInputFrames.shift());
      totalDistance += next.distance;
      if (next.fire) {
        fireEvents += 1;
      }
    }
    return batch;
  }

  private async sendPendingInputBatch(): Promise<void> {
    if (this.pendingInputFrames.length === 0) {
      return;
    }

    const frames = this.takeInputBatch();
    const encodedAtMs = performance.now();
    const wireFrames = frames.map((frame) => ({
      ...frame,
      fireAgeMs: frame.fire
        ? Math.min(
            MAX_FIRE_AGE_MS,
            Math.max(
              0,
              Math.round(encodedAtMs - (frame.queuedAtMs ?? encodedAtMs)),
            ),
          )
        : 0,
    }));
    const boardMutations: BoardMutation[] = [];
    const nextSequence = this.sequence + 1;
    this.sending = true;
    this.lastSendAt = Date.now();
    try {
      await this.sendWithSession(
        this.erConnection,
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            {
              pubkey: this.session.publicKey,
              isSigner: true,
              isWritable: false,
            },
            { pubkey: this.matchPda, isSigner: false, isWritable: true },
          ],
          data: this.instructionCoder.encode('submitInputBatch', {
            matchId: new BN(this.matchId),
            epoch: new BN(this.target.epoch),
            frames: wireFrames.map((frame) => ({
              direction: this.toAnchorDirection(frame.direction),
              distance: frame.distance,
              fire: frame.fire,
              fireAgeMs: frame.fireAgeMs,
            })),
            projectiles: [],
            boardMutations,
            bulletWallDamage: this.localBulletWallDamage,
            sequence: new BN(nextSequence),
          }),
        }),
        true,
      );
      this.applyFramesToAuthoritativeCursor(frames);
      this.sequence = nextSequence;
    } catch (error) {
      const accepted = await this.recoverInputBatch(nextSequence);
      if (accepted) {
        return;
      }
      const rejected = (error as Error).message.startsWith('Transaction failed');
      if (!accepted && !rejected) {
        this.pendingInputFrames.unshift(...frames);
      }
      throw error;
    } finally {
      this.sending = false;
    }
  }

  private async testInputUpdateLatency(): Promise<{
    elapsedMs: number;
    submitMs: number;
    sequence: number;
  }> {
    if (
      this.state !== MatchSyncState.Ready ||
      this.target === null ||
      this.erConnection === null
    ) {
      throw new Error('MagicBlock match is not ready.');
    }
    const localState = this.target.players[this.localPlayerIndex];
    if (this.sending || this.pendingInputFrames.length > 0) {
      throw new Error('Release controls and wait for pending input first.');
    }
    if (localState.sequence < this.sequence) {
      throw new Error('Waiting for the previous input update to appear.');
    }

    const startedAtMs = performance.now();
    this.sequence = localState.sequence;
    const nextSequence = localState.sequence + 1;
    const observed = this.waitForInputLatencyProbe(nextSequence, startedAtMs);
    this.sending = true;
    this.lastSendAt = Date.now();
    try {
      await this.sendWithSession(
        this.erConnection,
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            {
              pubkey: this.session.publicKey,
              isSigner: true,
              isWritable: false,
            },
            { pubkey: this.matchPda, isSigner: false, isWritable: true },
          ],
          data: this.instructionCoder.encode('submitInputBatch', {
            matchId: new BN(this.matchId),
            epoch: new BN(this.target.epoch),
            frames: [
              {
                direction: this.toAnchorDirection(localState.direction),
                distance: 0,
                fire: false,
                fireAgeMs: 0,
              },
            ],
            projectiles: [],
            boardMutations: [],
            bulletWallDamage: this.localBulletWallDamage,
            sequence: new BN(nextSequence),
          }),
        }),
        true,
        'input update latency probe',
      );
      const submitMs = Math.round(performance.now() - startedAtMs);
      this.sequence = nextSequence;
      return {
        elapsedMs: await observed,
        submitMs,
        sequence: nextSequence,
      };
    } catch (error) {
      this.cancelInputLatencyProbe((error as Error).message);
      throw error;
    } finally {
      this.sending = false;
    }
  }

  private async recoverInputBatch(attemptedSequence: number): Promise<boolean> {
    try {
      const next = await this.fetchMatchState(this.erConnection);
      this.updateTarget(next);
      if (next.phase !== 1) {
        this.pendingInputFrames.length = 0;
        return true;
      }
      const local = next.players[this.localPlayerIndex];
      if (local.sequence < attemptedSequence) {
        return false;
      }
      this.sequence = local.sequence;
      this.lastLocalX = this.fromChainUnits(local.x);
      this.lastLocalY = this.fromChainUnits(local.y);
      return true;
    } catch (error) {
      this.handleRefreshError(error as Error);
      return false;
    }
  }

  private applyFramesToAuthoritativeCursor(frames: MatchInputFrame[]): void {
    frames.forEach((frame) => {
      const pixels = frame.distance / UNITS_PER_PIXEL;
      if (frame.direction === 0) {
        this.lastLocalY -= pixels;
      } else if (frame.direction === 1) {
        this.lastLocalX += pixels;
      } else if (frame.direction === 2) {
        this.lastLocalY += pixels;
      } else {
        this.lastLocalX -= pixels;
      }
    });
  }

  private async respawnLocalPlayer(tank: PlayerTank): Promise<void> {
    this.sending = true;
    this.lastSendAt = Date.now();
    await this.sendWithSession(
      this.erConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
          { pubkey: this.matchPda, isSigner: false, isWritable: true },
        ],
        data: this.instructionCoder.encode('respawnPlayer', {
          matchId: new BN(this.matchId),
          epoch: new BN(this.target.epoch),
        }),
      }),
      true,
    );

    const next = await this.fetchMatchState(this.erConnection);
    this.updateTarget(next);
    const local = next.players[this.localPlayerIndex];
    this.sequence = local.sequence;
    this.lastLocalX = this.fromChainUnits(local.x);
    this.lastLocalY = this.fromChainUnits(local.y);
    this.pendingInputFrames.length = 0;
    this.capturedLocalX = tank.position.x;
    this.capturedLocalY = tank.position.y;
    this.lastCapturedDirection = this.fromGameRotation(tank.rotation);
    if (this.pendingRespawnTank === tank) {
      this.pendingRespawnTank = null;
    }
    this.sending = false;
  }

  private applyRemoteState(tank: PlayerTank, deltaTime: number): void {
    if (tank === null || tank === undefined) {
      return;
    }
    if (this.playerMirrorBulletsSuppressed) {
      tank.bullets.slice().forEach((bullet) => bullet.nullify());
    }

    this.remoteStateInitialized = this.applyWaypointState(
      tank,
      deltaTime,
      this.remoteWaypoints,
      this.remoteStateInitialized,
    );
  }

  private applyWaypointState(
    tank: PlayerTank,
    deltaTime: number,
    waypoints: RemoteWaypoint[],
    initialized: boolean,
  ): boolean {
    if (waypoints.length === 0) {
      return initialized;
    }

    let nextInitialized = initialized;
    if (!nextInitialized) {
      const initial = waypoints.shift();
      tank.position.set(initial.x, initial.y);
      tank.rotation = this.toGameRotation(initial.direction);
      nextInitialized = true;
    }

    let movementBudget =
      tank.attributes.moveSpeed *
      (waypoints.length > REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD
        ? REMOTE_CATCH_UP_SPEED_MULTIPLIER
        : 1) *
      deltaTime;

    while (movementBudget > 0 && waypoints.length > 0) {
      const waypoint = waypoints[0];
      if (waypoint.teleport) {
        this.consumeRemoteWaypoint(tank, waypoint);
        waypoints.shift();
        continue;
      }
      if (
        waypoint.remainingDistance !== undefined &&
        waypoint.remainingTime !== undefined
      ) {
        tank.rotation = this.toGameRotation(waypoint.direction);
        if (waypoint.remainingDistance <= LOCAL_PREDICTION_EPSILON) {
          this.consumeRemoteWaypoint(tank, waypoint);
          waypoints.shift();
          continue;
        }
        const inputStep = Math.min(
          waypoint.remainingDistance,
          waypoint.remainingTime > 0
            ? (waypoint.remainingDistance / waypoint.remainingTime) * deltaTime
            : movementBudget,
          movementBudget,
        );
        this.moveTankInDirection(tank, waypoint.direction, inputStep);
        waypoint.remainingDistance -= inputStep;
        waypoint.remainingTime = Math.max(0, waypoint.remainingTime - deltaTime);
        movementBudget -= inputStep;
        if (waypoint.remainingDistance <= LOCAL_PREDICTION_EPSILON) {
          this.consumeRemoteWaypoint(tank, waypoint);
          waypoints.shift();
        }
        continue;
      }
      const deltaX = waypoint.x - tank.position.x;
      const deltaY = waypoint.y - tank.position.y;
      const distance = Math.hypot(deltaX, deltaY);
      tank.rotation = this.toGameRotation(waypoint.direction);

      if (distance <= LOCAL_PREDICTION_EPSILON) {
        this.consumeRemoteWaypoint(tank, waypoint);
        waypoints.shift();
        continue;
      }

      const step = Math.min(distance, movementBudget);
      const scale = step / distance;
      tank.position.set(
        tank.position.x + deltaX * scale,
        tank.position.y + deltaY * scale,
      );
      movementBudget -= step;

      if (step >= distance) {
        this.consumeRemoteWaypoint(tank, waypoint);
        waypoints.shift();
      }
    }

    tank.updateMatrix(true);
    if (tank.collider.isInitialized()) {
      tank.collider.update();
    }
    tank.setNeedsPaint();
    return nextInitialized;
  }

  private applyObserverState(tanks: PlayerTank[], deltaTime: number): void {
    this.target.players.forEach((state, index) => {
      if (!state.joined) {
        return;
      }
      const tank = tanks[index];
      if (tank === null || tank === undefined) {
        return;
      }
      this.observerRemoteStateInitialized[index] = this.applyWaypointState(
        tank,
        deltaTime,
        this.observerRemoteWaypoints[index],
        this.observerRemoteStateInitialized[index],
      );
    });
  }

  private applyServerPlayerState(
    tank: PlayerTank,
    state: MatchPlayerState,
  ): void {
    if (tank === null || tank === undefined) {
      return;
    }

    tank.position.set(
      this.fromChainUnits(state.x),
      this.fromChainUnits(state.y),
    );
    tank.rotation = this.toGameRotation(state.direction);
    tank.updateMatrix(true);
    if (tank.collider.isInitialized()) {
      tank.collider.update();
    }
    tank.setNeedsPaint();
  }

  private refreshIfStale(): void {
    if (!this.polling && Date.now() - this.lastPollAt >= POLL_INTERVAL_MS) {
      void this.refreshTarget().catch(this.handleRefreshError);
    }
  }

  private updateTarget(next: MatchAccountState): void {
    if (this.knownBoardMutationEpoch !== next.epoch) {
      this.knownBoardMutations.clear();
      this.remoteBoardMutations.length = 0;
      this.knownBoardMutationEpoch = next.epoch;
    }
    this.target = next;
    this.resolveInputLatencyProbe(next);
    this.queueBoardMutations(next.boardMutations);
    this.queueEnemyFireEvents(next.enemyFireEvents);
    if (this.state === MatchSyncState.Ready) {
      if (this.observerMode) {
        next.players.forEach((player, index) => {
          this.queueObserverReceipt(index, player, next.inputReceipts[index]);
        });
        return;
      }
      const remoteIndex = 1 - this.localPlayerIndex;
      this.queueRemoteReceipt(
        next.players[remoteIndex],
        next.inputReceipts[remoteIndex],
      );
    }
  }

  private resolveInputLatencyProbe(next: MatchAccountState): void {
    const probe = this.inputLatencyProbe;
    if (probe === null) {
      return;
    }
    if (next.players[this.localPlayerIndex].sequence < probe.sequence) {
      return;
    }
    window.clearTimeout(probe.timeoutId);
    this.inputLatencyProbe = null;
    probe.resolve(Math.round(performance.now() - probe.startedAtMs));
  }

  private waitForInputLatencyProbe(
    sequence: number,
    startedAtMs: number,
  ): Promise<number> {
    if (this.inputLatencyProbe !== null) {
      this.cancelInputLatencyProbe('A previous input update test was replaced.');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (this.inputLatencyProbe?.sequence === sequence) {
          this.inputLatencyProbe = null;
        }
        reject(new Error('Timed out waiting for the match account update.'));
      }, 5000);
      this.inputLatencyProbe = {
        sequence,
        startedAtMs,
        resolve,
        reject,
        timeoutId,
      };
      if (this.target !== null) {
        this.resolveInputLatencyProbe(this.target);
      }
    });
  }

  private cancelInputLatencyProbe(message: string): void {
    if (this.inputLatencyProbe === null) {
      return;
    }
    window.clearTimeout(this.inputLatencyProbe.timeoutId);
    const { reject } = this.inputLatencyProbe;
    this.inputLatencyProbe = null;
    reject(new Error(message));
  }

  private queueBoardMutations(mutations: BoardMutation[]): void {
    mutations.forEach((mutation) => {
      const key = this.boardMutationKey(mutation);
      if (this.knownBoardMutations.has(key)) {
        return;
      }
      this.knownBoardMutations.add(key);
      this.remoteBoardMutations.push(mutation);
    });
  }

  private queueEnemyFireEvents(events: EnemyFireEvent[]): void {
    events.forEach((event) => {
      if (event.sequence <= this.lastEnemyFireSequence) {
        return;
      }
      this.pendingEnemyFireEvents.push(event);
      this.lastEnemyFireSequence = event.sequence;
    });
  }

  private boardMutationKey(mutation: BoardMutation): string {
    return `${mutation.x}:${mutation.y}`;
  }

  private queueRemoteSnapshot(state: MatchPlayerState): void {
    if (!state.joined) {
      return;
    }
    this.queueSnapshotToWaypoints(state, this.remoteWaypoints);
    this.lastQueuedRemoteSequence = state.sequence;
  }

  private queueObserverSnapshot(
    index: number,
    state: MatchPlayerState,
  ): void {
    if (!state.joined) {
      return;
    }
    this.queueSnapshotToWaypoints(state, this.observerRemoteWaypoints[index]);
    this.observerLastQueuedRemoteSequence[index] = state.sequence;
  }

  private queueSnapshotToWaypoints(
    state: MatchPlayerState,
    waypoints: RemoteWaypoint[],
  ): void {
    waypoints.push({
      x: this.fromChainUnits(state.x),
      y: this.fromChainUnits(state.y),
      direction: state.direction,
      sequence: state.sequence,
      teleport: true,
    });
  }

  private queueRemoteReceipt(
    state: MatchPlayerState,
    receipt: MatchInputReceipt,
  ): void {
    if (!state.joined || state.sequence <= this.lastQueuedRemoteSequence) {
      return;
    }
    this.lastQueuedRemoteSequence = this.queueReceiptToWaypoints(
      state,
      receipt,
      this.remoteWaypoints,
      this.lastQueuedRemoteSequence,
    );
  }

  private queueObserverReceipt(
    index: number,
    state: MatchPlayerState,
    receipt: MatchInputReceipt,
  ): void {
    const lastQueuedSequence = this.observerLastQueuedRemoteSequence[index];
    if (!state.joined || state.sequence <= lastQueuedSequence) {
      return;
    }
    this.observerLastQueuedRemoteSequence[index] = this.queueReceiptToWaypoints(
      state,
      receipt,
      this.observerRemoteWaypoints[index],
      lastQueuedSequence,
    );
  }

  private queueReceiptToWaypoints(
    state: MatchPlayerState,
    receipt: MatchInputReceipt,
    waypoints: RemoteWaypoint[],
    lastQueuedSequence: number,
  ): number {
    const missedBatch =
      lastQueuedSequence >= 0 &&
      receipt.batchSequence !== lastQueuedSequence + 1;
    let x = receipt.startX;
    let y = receipt.startY;

    if (missedBatch) {
      waypoints.push({
        x: this.fromChainUnits(x),
        y: this.fromChainUnits(y),
        direction: receipt.frames[0]?.direction ?? state.direction,
        sequence: receipt.batchSequence,
        teleport: true,
      });
    }

    const frameDistances = receipt.frames.map((frame) => {
      return frame.distance / UNITS_PER_PIXEL;
    });
    const totalDistance = frameDistances.reduce((total, distance) => {
      return total + distance;
    }, 0);

    receipt.frames.forEach((frame, index) => {
      if (frame.direction === 0) {
        y -= frame.distance;
      } else if (frame.direction === 1) {
        x += frame.distance;
      } else if (frame.direction === 2) {
        y += frame.distance;
      } else {
        x -= frame.distance;
      }
      waypoints.push({
        x: this.fromChainUnits(x),
        y: this.fromChainUnits(y),
        direction: frame.direction,
        sequence: receipt.batchSequence,
        teleport: false,
        remainingDistance: frameDistances[index],
        remainingTime:
          totalDistance > 0
            ? REMOTE_INPUT_BATCH_PLAYBACK_SECONDS *
              (frameDistances[index] / totalDistance)
            : 0,
        fire: frame.fire,
      });
    });

    if (receipt.frames.length === 0) {
      waypoints.push({
        x: this.fromChainUnits(state.x),
        y: this.fromChainUnits(state.y),
        direction: state.direction,
        sequence: state.sequence,
        teleport: true,
      });
    }
    return state.sequence;
  }

  private consumeRemoteWaypoint(
    tank: PlayerTank,
    waypoint: RemoteWaypoint,
  ): void {
    tank.position.set(waypoint.x, waypoint.y);
    tank.rotation = this.toGameRotation(waypoint.direction);
    if (waypoint.fire) {
      if (this.playerMirrorBulletsSuppressed) {
        return;
      }
      const bullet = tank.fireFromNetwork(
        waypoint.x,
        waypoint.y,
        this.toGameRotation(waypoint.direction),
      );
      bullet?.setLocalDamageDisabled(true);
    }
  }

  private reconcileLocalState(tank: PlayerTank, deltaTime: number): void {
    const state = this.target.players[this.localPlayerIndex];
    if (
      this.sending ||
      this.pendingInputFrames.length > 0 ||
      state.sequence < this.sequence
    ) {
      return;
    }

    // The tank keeps moving locally between 50 ms submissions. Pulling it
    // toward the latest confirmed position during that window erases the
    // prediction before it can be sent and makes the sprite shake in place.
    // Reconcile only once all locally predicted movement has been submitted.
    const unsentDistance = Math.hypot(
      tank.position.x - this.lastLocalX,
      tank.position.y - this.lastLocalY,
    );
    if (unsentDistance > LOCAL_PREDICTION_EPSILON) {
      return;
    }
    const x = this.fromChainUnits(state.x);
    const y = this.fromChainUnits(state.y);
    const distance = Math.hypot(x - tank.position.x, y - tank.position.y);
    if (distance < 2) {
      return;
    }
    this.moveTankTowards(
      tank,
      x,
      y,
      tank.attributes.moveSpeed *
        LOCAL_RECONCILE_SPEED_MULTIPLIER *
        deltaTime,
    );
    this.capturedLocalX = tank.position.x;
    this.capturedLocalY = tank.position.y;
    tank.updateMatrix(true);
    tank.collider.update();
  }

  private moveTankTowards(
    tank: Tank,
    targetX: number,
    targetY: number,
    maxDistance: number,
  ): void {
    const deltaX = targetX - tank.position.x;
    const deltaY = targetY - tank.position.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) {
      return;
    }
    const scale = Math.min(1, maxDistance / distance);
    tank.position.set(
      tank.position.x + deltaX * scale,
      tank.position.y + deltaY * scale,
    );
  }

  private moveTankInDirection(
    tank: Tank,
    direction: number,
    distance: number,
  ): void {
    if (direction === 0) {
      tank.position.subY(distance);
    } else if (direction === 1) {
      tank.position.addX(distance);
    } else if (direction === 2) {
      tank.position.addY(distance);
    } else {
      tank.position.subX(distance);
    }
  }

  private async refreshTarget(): Promise<void> {
    this.polling = true;
    this.lastPollAt = Date.now();
    try {
      this.updateTarget(await this.fetchMatchState(this.erConnection));
    } finally {
      this.polling = false;
    }
  }

  private async fetchMatchState(
    connection: Connection,
  ): Promise<MatchAccountState> {
    const account = await connection.getAccountInfo(this.matchPda, 'confirmed');
    if (account === null) {
      throw new Error('Match state is unavailable.');
    }
    return this.decodeMatchState(account.data);
  }

  private decodeMatchState(data: Buffer): MatchAccountState {
    if (data.length < MATCH_ACCOUNT_BASE_SIZE) {
      throw new Error('Match state returned invalid account data.');
    }
    const players: [MatchPlayerState, MatchPlayerState] = [
      this.decodePlayer(data, 79),
      this.decodePlayer(data, 129),
    ];
    const hasBatchReceipts =
      data.length >= MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE * 2;
    return {
      matchId: this.readU64(data, 8),
      epoch: this.readU64(data, 16),
      phase: data.readUInt8(56),
      players,
      inputReceipts: hasBatchReceipts
        ? [
            this.decodeInputReceipt(data, MATCH_ACCOUNT_BASE_SIZE),
            this.decodeInputReceipt(
              data,
              MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE,
            ),
          ]
        : [
            this.createSnapshotReceipt(players[0]),
            this.createSnapshotReceipt(players[1]),
          ],
      boardMutations:
        data.length >= MATCH_ACCOUNT_WITH_BOARD_SIZE
          ? this.decodeBoardMutations(data)
          : [],
      enemies:
        data.length >= MATCH_ACCOUNT_WITH_ENEMIES_SIZE
          ? this.decodeEnemies(data)
          : [],
      enemyFireEvents:
        data.length >= MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE
          ? this.decodeEnemyFireEvents(data)
          : [],
      simulationTick:
        data.length >= MATCH_ACCOUNT_WITH_ENEMIES_SIZE
          ? this.readU64(
              data,
              MATCH_ACCOUNT_ENEMIES_OFFSET +
                MAX_ACTIVE_ENEMIES * ENEMY_STATE_SIZE +
                1,
            )
          : 0,
      tick: this.readU64(data, 179),
    };
  }

  private decodeEnemies(data: Buffer): MatchEnemySnapshot[] {
    const enemies: MatchEnemySnapshot[] = [];
    for (let index = 0; index < MAX_ACTIVE_ENEMIES; index += 1) {
      const offset = MATCH_ACCOUNT_ENEMIES_OFFSET + index * ENEMY_STATE_SIZE;
      if (data.readUInt8(offset + 11) === 0) {
        continue;
      }
      enemies.push({
        id: data.readUInt16LE(offset),
        x: data.readInt32LE(offset + 2),
        y: data.readInt32LE(offset + 6),
        direction: data.readUInt8(offset + 10),
      });
    }
    return enemies;
  }

  private decodeEnemyFireEvents(data: Buffer): EnemyFireEvent[] {
    const countOffset =
      MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET +
      MAX_ENEMY_FIRE_EVENTS * ENEMY_FIRE_EVENT_SIZE;
    const count = Math.min(MAX_ENEMY_FIRE_EVENTS, data.readUInt16LE(countOffset));
    const events: EnemyFireEvent[] = [];
    for (let index = 0; index < count; index += 1) {
      const offset =
        MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET + index * ENEMY_FIRE_EVENT_SIZE;
      events.push({
        sequence: this.readU64(data, offset),
        enemyId: data.readUInt16LE(offset + 8),
        x: data.readInt32LE(offset + 10),
        y: data.readInt32LE(offset + 14),
        direction: data.readUInt8(offset + 18),
        simulationTick: this.readU64(data, offset + 19),
      });
    }
    return events
      .filter((event) => event.sequence > 0)
      .sort((first, second) => first.sequence - second.sequence);
  }

  private decodeBoardMutations(data: Buffer): BoardMutation[] {
    const count = Math.min(
      MAX_BOARD_MUTATIONS,
      data.readUInt16LE(
        MATCH_ACCOUNT_SIZE + MAX_BOARD_MUTATIONS * BOARD_MUTATION_SIZE,
      ),
    );
    const mutations: BoardMutation[] = [];
    for (let index = 0; index < count; index += 1) {
      const offset = MATCH_ACCOUNT_SIZE + index * BOARD_MUTATION_SIZE;
      mutations.push({
        x: data.readUInt8(offset),
        y: data.readUInt8(offset + 1),
      });
    }
    return mutations;
  }

  private decodeInputReceipt(data: Buffer, offset: number): MatchInputReceipt {
    const len = Math.min(
      MAX_INPUT_BATCH_FRAMES,
      data.readUInt8(offset + INPUT_RECEIPT_SIZE - 1),
    );
    const frames: MatchInputFrame[] = [];
    for (let index = 0; index < len; index += 1) {
      const frameOffset = offset + 16 + index * 6;
      frames.push({
        direction: data.readUInt8(frameOffset),
        distance: data.readUInt16LE(frameOffset + 1),
        fire: data.readUInt8(frameOffset + 3) !== 0,
        fireAgeMs: data.readUInt16LE(frameOffset + 4),
      });
    }
    return {
      batchSequence: this.readU64(data, offset),
      startX: data.readInt32LE(offset + 8),
      startY: data.readInt32LE(offset + 12),
      frames,
    };
  }

  private createSnapshotReceipt(state: MatchPlayerState): MatchInputReceipt {
    return {
      batchSequence: state.sequence,
      startX: state.x,
      startY: state.y,
      frames: [],
    };
  }

  private decodePlayer(data: Buffer, offset: number): MatchPlayerState {
    return {
      authority: new PublicKey(data.subarray(offset, offset + 32)),
      x: data.readInt32LE(offset + 32),
      y: data.readInt32LE(offset + 36),
      direction: data.readUInt8(offset + 40),
      sequence: this.readU64(data, offset + 41),
      joined: data.readUInt8(offset + 49) !== 0,
    };
  }

  private async waitForDelegation(): Promise<DelegationStatus> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const status = (await this.routerConnection.getDelegationStatus(
        this.matchPda,
      )) as DelegationStatus;
      if (status.isDelegated) {
        return status;
      }
      await this.delay(1000);
    }
    throw new Error('Timed out waiting for MagicBlock delegation.');
  }

  private async fundSession(walletPublicKey: PublicKey): Promise<void> {
    const balance = await this.baseConnection.getBalance(
      this.session.publicKey,
      'confirmed',
    );
    if (balance >= SESSION_TARGET_BALANCE) {
      return;
    }
    const provider = getPhantomProvider();
    if (provider === null) {
      throw new Error('Phantom disconnected before session funding.');
    }
    const latest = await this.baseConnection.getLatestBlockhash('confirmed');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: this.session.publicKey,
        lamports: SESSION_TARGET_BALANCE - balance,
      }),
    );
    transaction.feePayer = walletPublicKey;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    const signed = await provider.signTransaction(transaction);
    const signature = await this.baseConnection.sendRawTransaction(
      signed.serialize(),
    );
    await this.baseConnection.confirmTransaction(
      { signature, ...latest },
      'confirmed',
    );
  }

  private async sendWithSession(
    connection: Connection,
    instruction: TransactionInstruction,
    skipPreflight: boolean,
    label = 'transaction',
  ): Promise<string> {
    const commitment = skipPreflight ? 'processed' : 'confirmed';
    const latest = await connection.getLatestBlockhash(commitment);
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.session.publicKey;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.sign(this.session);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight },
    );
    const confirmation = await connection.confirmTransaction(
      { signature, ...latest },
      commitment,
    );
    if (confirmation.value.err !== null) {
      throw new Error(
        `${label} failed (${signature}): ${JSON.stringify(confirmation.value.err)}`,
      );
    }
    return signature;
  }

  private deriveMatchPda(matchId: number): PublicKey {
    return PublicKey.findProgramAddressSync(
      [MATCH_SEED, new BN(matchId).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID,
    )[0];
  }

  private deriveTerrainPda(matchId: number): PublicKey {
    return PublicKey.findProgramAddressSync(
      [TERRAIN_SEED, new BN(matchId).toArrayLike(Buffer, 'le', 8)],
      PROGRAM_ID,
    )[0];
  }

  private loadOrCreateSession(): Keypair {
    const key = `battlecity.magicblock.devnet.match.${this.matchId}.${this.localPlayerIndex}`;
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      try {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem(key);
      }
    }
    const session = Keypair.generate();
    window.localStorage.setItem(key, JSON.stringify(Array.from(session.secretKey)));
    return session;
  }

  private showJoinControl(): void {
    const url = this.createMatchLink('join');
    const button = this.ensureStatusButton('join');
    button.type = 'button';
    button.textContent = 'Copy player-two link';
    button.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(url.toString());
        button.textContent = 'Player-two link copied';
        window.setTimeout(() => {
          button.textContent = 'Copy player-two link';
        }, 2000);
      } catch {
        button.textContent = 'Copy failed - check DevTools';
      }
    };
    this.log.info(`Player-two link: ${url.toString()}`);
    this.showObserverControl();
  }

  private showObserverControl(): void {
    const url = this.createMatchLink('observer');
    const button = this.ensureStatusButton('observer');
    button.type = 'button';
    button.textContent = 'Copy observer link';
    button.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(url.toString());
        button.textContent = 'Observer link copied';
        window.setTimeout(() => {
          button.textContent = 'Copy observer link';
        }, 2000);
      } catch {
        button.textContent = 'Copy failed - check DevTools';
      }
    };
    this.log.info(`Observer link: ${url.toString()}`);
  }

  private createMatchLink(kind: 'join' | 'observer'): URL {
    const url = new URL(window.location.href);
    url.searchParams.set('magicblock', '1');
    url.searchParams.set('mode', 'match');
    url.searchParams.set('match', this.matchId.toString());
    url.searchParams.set('level', this.currentLevelNumber.toString());
    if (kind === 'join') {
      url.searchParams.set('join', '1');
      url.searchParams.delete('observer');
    } else {
      url.searchParams.set('observer', '1');
      url.searchParams.delete('join');
      url.searchParams.delete('ghostMirror');
      url.searchParams.delete('ghostmirror');
      url.searchParams.delete('ghosmirror');
      return url;
    }
    if (
      url.searchParams.has('ghostMirror') ||
      url.searchParams.has('ghostmirror') ||
      url.searchParams.has('ghosmirror')
    ) {
      url.searchParams.delete('ghostmirror');
      url.searchParams.delete('ghosmirror');
      url.searchParams.set('ghostMirror', '1');
    }
    return url;
  }

  private showStatus(message: string): void {
    this.ensureStatusMessage().textContent = message;
  }

  private showLatencyControl(): void {
    const button = this.ensureStatusButton('latency');
    button.type = 'button';
    button.textContent = 'Ping MagicBlock';
    button.onclick = async (): Promise<void> => {
      button.disabled = true;
      button.textContent = 'Pinging MagicBlock...';
      const startedAt = performance.now();
      try {
        if (this.erConnection === null || this.matchPda === null) {
          throw new Error('MagicBlock ER is not connected.');
        }
        const account = await this.erConnection.getAccountInfo(
          this.matchPda,
          'processed',
        );
        if (account === null) {
          throw new Error('Match account was not readable on the ER.');
        }
        const elapsedMs = Math.round(performance.now() - startedAt);
        button.textContent = `Ping MagicBlock (${elapsedMs} ms)`;
        this.showStatus(
          `MagicBlock ER read latency: ${elapsedMs} ms\nER: ${this.formatErEndpoint()}`,
        );
        this.log.info(`MagicBlock ER read latency: ${elapsedMs} ms`);
      } catch (error) {
        button.textContent = 'Ping MagicBlock failed';
        this.showStatus('MagicBlock latency ping failed - check console');
        this.log.warn('MagicBlock latency ping failed.', error);
      } finally {
        button.disabled = false;
      }
    };
  }

  private showInputLatencyControl(): void {
    const button = this.ensureStatusButton('input-latency');
    button.type = 'button';
    button.textContent = 'Test input update';
    button.onclick = async (): Promise<void> => {
      button.disabled = true;
      button.textContent = 'Testing input update...';
      try {
        const result = await this.testInputUpdateLatency();
        button.textContent = `Input update (${result.elapsedMs} ms)`;
        this.showStatus(
          `MagicBlock input update latency: ${result.elapsedMs} ms\n` +
            `ER submit/processed: ${result.submitMs} ms\n` +
            `Observed sequence: ${result.sequence}\n` +
            `ER: ${this.formatErEndpoint()}`,
        );
        this.log.info(
          `MagicBlock input update latency: ${result.elapsedMs} ms ` +
            `(submit ${result.submitMs} ms, sequence ${result.sequence})`,
        );
      } catch (error) {
        const message = (error as Error).message;
        button.textContent = 'Input update test failed';
        this.showStatus(`MagicBlock input update test failed\n${message}`);
        this.log.warn('MagicBlock input update test failed.', error);
      } finally {
        button.disabled = false;
      }
    };
  }

  private showMainnetLatencyControl(): void {
    const button = this.ensureStatusButton('mainnet-latency');
    button.type = 'button';
    button.textContent = 'Ping mainnet ERs';
    button.onclick = async (): Promise<void> => {
      button.disabled = true;
      button.textContent = 'Pinging mainnet ERs...';
      const results: string[] = [];
      try {
        for (const endpoint of MAINNET_ER_ENDPOINTS) {
          const startedAt = performance.now();
          try {
            const connection = new Connection(endpoint, 'confirmed');
            await connection.getLatestBlockhash('processed');
            const elapsedMs = Math.round(performance.now() - startedAt);
            results.push(`${new URL(endpoint).host}: ${elapsedMs} ms`);
          } catch (error) {
            results.push(`${new URL(endpoint).host}: failed`);
            this.log.warn(`Mainnet ER latency ping failed for ${endpoint}.`, error);
          }
        }
        const successfulResults = results
          .map((result) => {
            const match = result.match(/^(.*): (\d+) ms$/);
            return match === null
              ? null
              : { host: match[1], elapsedMs: Number(match[2]) };
          })
          .filter(
            (
              result,
            ): result is {
              host: string;
              elapsedMs: number;
            } => result !== null,
          )
          .sort((a, b) => a.elapsedMs - b.elapsedMs);
        const fastest = successfulResults[0];
        button.textContent =
          fastest === undefined
            ? 'Mainnet ER ping failed'
            : `Fastest mainnet: ${fastest.elapsedMs} ms`;
        this.showStatus(
          `Mainnet ER latency\n${results.join('\n')}\nCurrent devnet ER: ${this.formatErEndpoint()}`,
        );
      } finally {
        button.disabled = false;
      }
    };
  }

  private ensureStatusContainer(): HTMLDivElement {
    if (this.statusContainer !== null) {
      return this.statusContainer;
    }
    const container = document.createElement('div');
    container.className = 'magicblock-match-status';
    Object.assign(container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '1000',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'stretch',
      maxWidth: '320px',
    });
    document.body.appendChild(container);
    this.statusContainer = container;
    return container;
  }

  private formatErEndpoint(): string {
    if (this.erEndpoint === null) {
      return 'not connected';
    }
    try {
      return new URL(this.erEndpoint).host;
    } catch {
      return this.erEndpoint;
    }
  }

  private ensureStatusMessage(): HTMLDivElement {
    if (this.statusMessageElement !== null) {
      return this.statusMessageElement;
    }
    const element = document.createElement('div');
    element.className = 'magicblock-match-status-message';
    element.setAttribute('aria-live', 'polite');
    this.applyStatusChildStyle(element, false);
    this.ensureStatusContainer().appendChild(element);
    this.statusMessageElement = element;
    return element;
  }

  private ensureStatusButton(
    kind: 'join' | 'observer' | 'latency' | 'input-latency' | 'mainnet-latency',
  ): HTMLButtonElement {
    const existing =
      kind === 'join'
        ? this.joinButtonElement
        : kind === 'observer'
          ? null
        : kind === 'latency'
          ? this.latencyButtonElement
          : kind === 'input-latency'
            ? this.inputLatencyButtonElement
            : this.mainnetLatencyButtonElement;
    if (existing !== null) {
      return existing;
    }
    const button = document.createElement('button');
    button.className = `magicblock-match-${kind}-button`;
    this.applyStatusChildStyle(button, true);
    this.ensureStatusContainer().appendChild(button);
    if (kind === 'join') {
      this.joinButtonElement = button;
    } else if (kind === 'observer') {
      // Observer link is shown only while hosting before delegation; it does not
      // need to be kept after the host panel is rebuilt.
    } else if (kind === 'latency') {
      this.latencyButtonElement = button;
    } else if (kind === 'input-latency') {
      this.inputLatencyButtonElement = button;
    } else {
      this.mainnetLatencyButtonElement = button;
    }
    return button;
  }

  private applyStatusChildStyle(element: HTMLElement, isButton: boolean): void {
    Object.assign(element.style, {
      minHeight: '44px',
      padding: '10px 14px',
      border: '2px solid #55e6c1',
      borderRadius: '6px',
      background: '#09131f',
      color: '#fff',
      font: '600 14px system-ui, sans-serif',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
      cursor: isButton ? 'pointer' : 'default',
      textAlign: 'left',
      whiteSpace: 'pre-line',
    });
  }

  private createMatchId(): number {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] || 1;
  }

  private parseMatchId(value: string | null): number | null {
    if (value === null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private readU64(data: Buffer, offset: number): number {
    return data.readUInt32LE(offset) + data.readUInt32LE(offset + 4) * 0x100000000;
  }

  private toChainUnits(value: number): number {
    return Math.max(0, Math.min(65535, Math.round(value * UNITS_PER_PIXEL)));
  }

  private fromChainUnits(value: number): number {
    return value / UNITS_PER_PIXEL;
  }

  private toAnchorDirection(direction: number): object {
    return [{ up: {} }, { right: {} }, { down: {} }, { left: {} }][direction];
  }

  private toGameRotation(direction: number): Rotation {
    return (
      [Rotation.Up, Rotation.Right, Rotation.Down, Rotation.Left][direction] ??
      Rotation.Down
    );
  }

  private fromGameRotation(rotation: Rotation): number {
    return [Rotation.Up, Rotation.Right, Rotation.Down, Rotation.Left].indexOf(
      rotation,
    );
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  private fail = (error: Error): void => {
    this.state = MatchSyncState.Failed;
    this.showStatus('MagicBlock match failed - check console');
    this.log.error('Match setup failed.', error);
  };

  private handleMovementError = (error: Error): void => {
    this.sending = false;
    this.log.warn('Authoritative movement update failed; retrying.', error);
  };

  private handleRefreshError = (error: Error): void => {
    this.polling = false;
    this.log.warn('Match refresh failed; retrying.', error);
  };
}
