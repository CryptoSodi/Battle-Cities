import { Logger } from '../../core';
import { Rotation } from '../../game';
import { Bullet, EnemyTank, PlayerTank, Tank, TankState } from '../../gameObjects';
import { TankDeathReason } from '../../tank';
import { PowerupType } from '../../powerup';
import { TerrainRegionConfig, TerrainType } from '../../terrain';

const UNITS_PER_PIXEL = 1000 / 64;
const BOARD_CELL_SIZE_PX = 16;
const INPUT_HEARTBEAT_MS = 250;
const REMOTE_CATCH_UP_MULTIPLIER = 1.25;
const LOCAL_RECONCILE_MULTIPLIER = 2;
const PROJECTILE_CATCH_UP_MULTIPLIER = 2;
const PLAYER_SNAP_EPSILON_PX = 0.5;
const LOCAL_PLAYER_HARD_RECONCILE_DISTANCE_PX = 48;
const REMOTE_PLAYER_SMOOTHING_SPEED = 18;
const REMOTE_PLAYER_HARD_SNAP_DISTANCE_PX = 128;
const BASE_WALL_TERRAIN_REGIONS = [
  { x: 0, y: 0, width: 128, height: 32 },
  { x: 0, y: 32, width: 32, height: 64 },
  { x: 96, y: 32, width: 32, height: 64 },
] as const;

enum LocalSyncState {
  Disabled,
  Idle,
  Connecting,
  Waiting,
  Ready,
  Finished,
  Failed,
}

interface LocalPlayerSnapshot {
  x: number;
  y: number;
  direction: number;
  moving?: boolean;
  sequence: number;
  connected: boolean;
  alive: boolean;
  lives: number;
  health: number;
  score: number;
  kills: number;
  stunned: boolean;
  tier: number;
}

interface LocalEnemySnapshot {
  id: number;
  x: number;
  y: number;
  direction: number;
  tier: number;
  health: number;
}

interface LocalProjectileSnapshot {
  id: number;
  owner: 'player' | 'enemy';
  ownerId: number;
  x: number;
  y: number;
  direction: number;
}

export interface LocalBoardMutation {
  x: number;
  y: number;
}

export interface LocalPowerupSnapshot {
  id: number;
  kind: PowerupType;
  x: number;
  y: number;
}

export type LocalGameEvent =
  | { kind: 'enemy_died'; eventId: number; id: number; killer: number }
  | { kind: 'player_died'; eventId: number; player: number }
  | { kind: 'base_died'; eventId: number }
  | { kind: 'match_won'; eventId: number }
  | { kind: 'match_lost'; eventId: number }
  | {
      kind: 'powerup_picked';
      eventId: number;
      player: number;
      powerup: PowerupType;
      x: number;
      y: number;
    };

interface LocalSnapshot {
  type: 'snapshot';
  tick: number;
  phase: 'waiting' | 'active' | 'won' | 'lost';
  players: [LocalPlayerSnapshot, LocalPlayerSnapshot];
  enemies: LocalEnemySnapshot[];
  projectiles: LocalProjectileSnapshot[];
  boardMutations: LocalBoardMutation[];
  events: LocalGameEvent[];
  baseAlive: boolean;
  powerup: LocalPowerupSnapshot | null;
}

interface LegacyLocalSnapshotFields {
  board_mutations?: LocalBoardMutation[];
  base_alive?: boolean;
}

interface LocalWelcome {
  type: 'welcome';
  player: number;
}

interface LocalError {
  type: 'error';
  message: string;
}

interface RenderedProjectile {
  bullet: Bullet;
  targetX: number;
  targetY: number;
  direction: number;
}

type LocalServerMessage = LocalSnapshot | LocalWelcome | LocalError;

export class LocalServerMatchSync {
  private readonly log = new Logger('LocalServerMatch', Logger.Level.Info);
  private readonly enabled: boolean;
  private readonly localPlayerIndex: number;
  private readonly endpoint: string;
  private readonly debugDisableEnemyShooting: boolean;
  private state: LocalSyncState;
  private roomId: string = null;
  private socket: WebSocket = null;
  private target: LocalSnapshot = null;
  private sequence = 0;
  private fireSequence = 0;
  private lastInputAt = 0;
  private lastDirection = -1;
  private lastMoving = false;
  private statusElement: HTMLElement = null;
  private playerTanks: PlayerTank[] = [];
  private readonly initializedPlayers = new Set<number>();
  private readonly initializedEnemies = new Set<number>();
  private readonly renderedProjectiles = new Map<string, RenderedProjectile>();
  private readonly knownBoardMutations = new Set<string>();
  private readonly remoteBoardMutations: LocalBoardMutation[] = [];
  private readonly processedEventIds = new Set<number>();
  private readonly pendingMatchEvents: LocalGameEvent[] = [];

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.enabled = params.get('mode') === 'local';
    this.localPlayerIndex = params.get('join') === '1' ? 1 : 0;
    this.debugDisableEnemyShooting = params.get('debugNoEnemyShooting') === '1';
    this.roomId = this.parseRoomId(params.get('match'));
    const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.endpoint =
      params.get('server') ??
      `${socketProtocol}//${window.location.host}/local-game`;
    this.state = this.enabled ? LocalSyncState.Idle : LocalSyncState.Disabled;
    if (this.enabled) {
      this.showStatus('Connecting to local Rust server...');
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isWaitingForStart(): boolean {
    return (
      this.enabled &&
      (this.state === LocalSyncState.Idle ||
        this.state === LocalSyncState.Connecting ||
        this.state === LocalSyncState.Waiting ||
        this.target?.phase === 'waiting')
    );
  }

  public getLocalPlayerIndex(): number {
    return this.localPlayerIndex;
  }

  public isRemoteTank(partyIndex: number): boolean {
    return this.enabled && partyIndex !== this.localPlayerIndex;
  }

  public recordLocalFire(): void {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      (this.state !== LocalSyncState.Waiting && this.state !== LocalSyncState.Ready)
    ) {
      return;
    }
    this.fireSequence += 1;
    this.socket.send(
      JSON.stringify({ type: 'fire', sequence: this.fireSequence }),
    );
  }

  public drainRemoteBoardMutations(): LocalBoardMutation[] {
    return this.remoteBoardMutations.splice(0);
  }

  public drainMatchEvents(): LocalGameEvent[] {
    return this.pendingMatchEvents.splice(0);
  }

  public getActiveEnemyIds(): number[] {
    return this.target?.enemies.map((enemy) => enemy.id) ?? [];
  }

  public getPowerup(): LocalPowerupSnapshot | null {
    if (this.target?.powerup === null || this.target?.powerup === undefined) {
      return null;
    }
    return {
      ...this.target.powerup,
      x: this.fromServerUnits(this.target.powerup.x),
      y: this.fromServerUnits(this.target.powerup.y),
    };
  }

  public update(
    tanks: PlayerTank[],
    deltaTime: number,
    levelNumber: number,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemyTiers: number[],
    enemyDrops: boolean[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): void {
    if (!this.enabled || this.state === LocalSyncState.Failed) {
      return;
    }
    this.playerTanks = tanks;
    const localTank = tanks[this.localPlayerIndex];
    const remoteTank = tanks[1 - this.localPlayerIndex];
    if (this.state === LocalSyncState.Idle) {
      const firstTank = tanks[0];
      const secondTank = tanks[1];
      if (firstTank === undefined || secondTank === undefined) {
        return;
      }
      this.state = LocalSyncState.Connecting;
      void this.start(
        firstTank,
        secondTank,
        levelNumber,
        fieldWidth,
        fieldHeight,
        enemySpawns,
        enemyTiers,
        enemyDrops,
        basePosition,
        terrainRegions,
      ).catch(this.fail);
      return;
    }

    // Capture the freshly applied local input before reconciliation writes the
    // previous authoritative rotation back to the tank.
    if (localTank !== undefined && localTank !== null) {
      this.sendLocalInput(localTank);
    }
    if (this.target === null) {
      return;
    }
    this.processPlayerDeathEvents(tanks);
    if (localTank !== undefined && localTank !== null) {
      this.applyPlayerState(localTank, this.localPlayerIndex, deltaTime);
    }
    if (remoteTank !== undefined && remoteTank !== null) {
      this.applyPlayerState(remoteTank, 1 - this.localPlayerIndex, deltaTime);
    }
    this.sequence = Math.max(
      this.sequence,
      this.target.players[this.localPlayerIndex].sequence,
    );
  }

  public applyEnemyState(tanks: EnemyTank[], deltaTime: number): void {
    if (this.target === null) {
      return;
    }
    this.processEnemyDeathEvents(tanks);
    this.target.enemies.forEach((snapshot) => {
      const tank = tanks.find((candidate) => candidate.partyIndex === snapshot.id);
      if (tank === undefined) {
        return;
      }
      tank.setNetworkControlled(true);
      tank.applyNetworkHealth(snapshot.health);
      const targetX = this.fromServerUnits(snapshot.x);
      const targetY = this.fromServerUnits(snapshot.y);
      if (!this.initializedEnemies.has(snapshot.id)) {
        tank.position.set(targetX, targetY);
        this.initializedEnemies.add(snapshot.id);
      } else {
        this.moveTankTowards(
          tank,
          targetX,
          targetY,
          tank.attributes.moveSpeed * REMOTE_CATCH_UP_MULTIPLIER * deltaTime,
        );
      }
      tank.rotation = this.toGameRotation(snapshot.direction);
      tank.updateMatrix(true);
      if (tank.collider.isInitialized()) {
        tank.collider.update();
      }
    });
    this.applyProjectileState(tanks, deltaTime);
  }

  private sendLocalInput(tank: PlayerTank): void {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      (this.state !== LocalSyncState.Waiting && this.state !== LocalSyncState.Ready)
    ) {
      return;
    }
    const direction = this.fromGameRotation(tank.rotation);
    const moving = tank.state === TankState.Moving;
    const now = Date.now();
    if (
      direction === this.lastDirection &&
      moving === this.lastMoving &&
      now - this.lastInputAt < INPUT_HEARTBEAT_MS
    ) {
      return;
    }
    this.sequence += 1;
    this.socket.send(
      JSON.stringify({ type: 'input', sequence: this.sequence, direction, moving }),
    );
    this.lastDirection = direction;
    this.lastMoving = moving;
    this.lastInputAt = now;
  }

  private async start(
    firstTank: PlayerTank,
    secondTank: PlayerTank,
    levelNumber: number,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemyTiers: number[],
    enemyDrops: boolean[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): Promise<void> {
    if (this.localPlayerIndex === 0 && this.roomId === null) {
      this.roomId = this.createRoomId();
      const current = new URL(window.location.href);
      current.searchParams.set('mode', 'local');
      current.searchParams.set('match', this.roomId);
      current.searchParams.delete('join');
      window.history.replaceState(null, '', current.toString());
    }
    if (this.roomId === null) {
      throw new Error('The local player-two link is missing its room ID.');
    }
    const terrain = this.encodeTerrain(
      fieldWidth,
      fieldHeight,
      this.withBaseWallTerrainRegions(terrainRegions, basePosition),
    );
    this.socket = await this.openSocket();
    this.socket.addEventListener('message', this.handleMessage);
    this.socket.addEventListener('close', this.handleClose);
    this.socket.addEventListener('error', this.handleSocketError);
    this.socket.send(
      JSON.stringify({
        type: 'join',
        room: this.roomId,
        player: this.localPlayerIndex,
        config: {
          fieldWidth: this.toServerUnits(fieldWidth - 64),
          fieldHeight: this.toServerUnits(fieldHeight - 64),
          spawns: [firstTank, secondTank].map((tank) => ({
            x: this.toServerUnits(tank.position.x),
            y: this.toServerUnits(tank.position.y),
          })),
          enemySpawns: enemySpawns.map((spawn) => ({
            x: this.toServerUnits(spawn.x),
            y: this.toServerUnits(spawn.y),
          })),
          enemyTiers,
          enemyDrops,
          terrainWidth: terrain.width,
          terrainHeight: terrain.height,
          terrain: Array.from(terrain.cells),
          basePosition: {
            x: this.toServerUnits(basePosition.x),
            y: this.toServerUnits(basePosition.y),
          },
          debugDisableEnemyShooting: this.debugDisableEnemyShooting,
        },
      }),
    );
    if (this.localPlayerIndex === 0) {
      this.showJoinControl(levelNumber);
    } else {
      this.showStatus('Joined local room; waiting for player one...');
    }
    this.log.info(`Connected player ${this.localPlayerIndex + 1} to ${this.endpoint}`);
  }

  private openSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      const handleOpen = (): void => {
        socket.removeEventListener('error', handleError);
        resolve(socket);
      };
      const handleError = (): void => {
        socket.removeEventListener('open', handleOpen);
        reject(new Error(`Could not connect to ${this.endpoint}. Start the Rust local server first.`));
      };
      socket.addEventListener('open', handleOpen, { once: true });
      socket.addEventListener('error', handleError, { once: true });
    });
  }

  private handleMessage = (event: MessageEvent): void => {
    let message: LocalServerMessage;
    try {
      message = JSON.parse(String(event.data)) as LocalServerMessage;
    } catch (error) {
      this.fail(new Error(`Local server returned invalid JSON: ${(error as Error).message}`));
      return;
    }
    if (message.type === 'error') {
      this.fail(new Error(message.message));
      return;
    }
    if (message.type === 'welcome') {
      if (message.player !== this.localPlayerIndex) {
        this.fail(new Error('Local server assigned the wrong player slot.'));
      }
      return;
    }
    const snapshot = message as LocalSnapshot & LegacyLocalSnapshotFields;
    snapshot.boardMutations = snapshot.boardMutations ?? snapshot.board_mutations ?? [];
    snapshot.events = snapshot.events ?? [];
    snapshot.enemies = snapshot.enemies ?? [];
    snapshot.projectiles = snapshot.projectiles ?? [];
    snapshot.powerup = snapshot.powerup ?? null;
    snapshot.baseAlive = snapshot.baseAlive ?? snapshot.base_alive ?? true;
    this.target = snapshot;
    this.queueBoardMutations(snapshot.boardMutations);
    this.queueMatchEvents(snapshot.events);
    if (message.phase === 'active') {
      if (this.state !== LocalSyncState.Ready) {
        this.state = LocalSyncState.Ready;
        this.showStatus(`Local Rust match live - player ${this.localPlayerIndex + 1}`);
      }
    } else if (message.phase === 'waiting') {
      this.state = LocalSyncState.Waiting;
    } else {
      this.state = LocalSyncState.Finished;
      this.showStatus(message.phase === 'won' ? 'Local match won' : 'Local match lost');
    }
  };

  private processPlayerDeathEvents(tanks: PlayerTank[]): void {
    this.target.events.forEach((event) => {
      if (event.kind !== 'player_died' || this.processedEventIds.has(event.eventId)) {
        return;
      }
      const tank = tanks[event.player];
      if (tank !== undefined && tank !== null && tank.isAlive()) {
        tank.die(TankDeathReason.Bullet);
      }
      this.processedEventIds.add(event.eventId);
    });
  }

  private processEnemyDeathEvents(tanks: EnemyTank[]): void {
    this.target.events.forEach((event) => {
      if (event.kind !== 'enemy_died' || this.processedEventIds.has(event.eventId)) {
        return;
      }
      const tank = tanks.find((candidate) => candidate.partyIndex === event.id);
      if (tank !== undefined && tank.isAlive()) {
        if (tank.type.hasDrop) {
          tank.hit.notify(null);
          tank.discardDrop();
        }
        tank.die(
          event.killer === 255
            ? TankDeathReason.WipeoutPowerup
            : TankDeathReason.Bullet,
          event.killer === 255 ? null : event.killer,
        );
      }
      this.processedEventIds.add(event.eventId);
    });
  }

  private queueMatchEvents(events: LocalGameEvent[]): void {
    events.forEach((event) => {
      if (
        (event.kind === 'base_died' ||
          event.kind === 'match_won' ||
          event.kind === 'match_lost' ||
          event.kind === 'powerup_picked') &&
        !this.processedEventIds.has(event.eventId)
      ) {
        this.processedEventIds.add(event.eventId);
        this.pendingMatchEvents.push(
          event.kind === 'powerup_picked'
            ? {
                ...event,
                x: this.fromServerUnits(event.x),
                y: this.fromServerUnits(event.y),
              }
            : event,
        );
      }
    });
  }

  private applyProjectileState(enemies: EnemyTank[], deltaTime: number): void {
    const liveKeys = new Set(
      this.target.projectiles.map((projectile) => this.projectileKey(projectile)),
    );
    Array.from(this.renderedProjectiles.entries()).forEach(([key, rendered]) => {
      if (!liveKeys.has(key) || rendered.bullet.isSpent()) {
        rendered.bullet.nullify();
        this.renderedProjectiles.delete(key);
      }
    });
    this.target.projectiles.forEach((snapshot) => {
      const key = this.projectileKey(snapshot);
      let rendered = this.renderedProjectiles.get(key);
      if (rendered === undefined) {
        const owner =
          snapshot.owner === 'player'
            ? this.playerTanks[snapshot.ownerId]
            : enemies.find((enemy) => enemy.partyIndex === snapshot.ownerId);
        if (owner === undefined || owner === null) {
          return;
        }
        const bullet = owner.fireFromNetwork(
          owner.position.x,
          owner.position.y,
          this.toGameRotation(snapshot.direction),
        );
        if (bullet === null) {
          return;
        }
        bullet.setNetworkControlled(true);
        rendered = {
          bullet,
          targetX: this.fromServerUnits(snapshot.x),
          targetY: this.fromServerUnits(snapshot.y),
          direction: snapshot.direction,
        };
        this.renderedProjectiles.set(key, rendered);
      } else {
        rendered.targetX = this.fromServerUnits(snapshot.x);
        rendered.targetY = this.fromServerUnits(snapshot.y);
        rendered.direction = snapshot.direction;
      }
      const distance = Math.hypot(
        rendered.targetX - rendered.bullet.position.x,
        rendered.targetY - rendered.bullet.position.y,
      );
      const step = Math.min(
        distance,
        rendered.bullet.speed * PROJECTILE_CATCH_UP_MULTIPLIER * deltaTime,
      );
      if (distance > 0) {
        rendered.bullet.position.set(
          rendered.bullet.position.x +
            (rendered.targetX - rendered.bullet.position.x) * (step / distance),
          rendered.bullet.position.y +
            (rendered.targetY - rendered.bullet.position.y) * (step / distance),
        );
      }
      rendered.bullet.rotation = this.toGameRotation(rendered.direction);
      rendered.bullet.updateMatrix(true);
      if (rendered.bullet.collider.isInitialized()) {
        rendered.bullet.collider.update();
      }
    });
  }

  private applyPlayerState(tank: Tank, playerIndex: number, deltaTime: number): void {
    const snapshot = this.target.players[playerIndex];
    if (!snapshot.alive) {
      return;
    }
    if (
      playerIndex === this.localPlayerIndex &&
      snapshot.sequence < this.sequence
    ) {
      return;
    }
    const targetX = this.fromServerUnits(snapshot.x);
    const targetY = this.fromServerUnits(snapshot.y);
    const distance = Math.hypot(targetX - tank.position.x, targetY - tank.position.y);
    if (
      playerIndex === this.localPlayerIndex &&
      distance <= LOCAL_PLAYER_HARD_RECONCILE_DISTANCE_PX
    ) {
      tank.rotation = this.toGameRotation(snapshot.direction);
      tank.updateMatrix(true);
      if (tank.collider.isInitialized()) {
        tank.collider.update();
      }
      return;
    }
    if (playerIndex !== this.localPlayerIndex) {
      this.applyRemotePlayerPosition(tank, playerIndex, targetX, targetY, distance, deltaTime);
    } else if (distance > REMOTE_PLAYER_HARD_SNAP_DISTANCE_PX) {
      tank.position.set(targetX, targetY);
    } else if (distance <= PLAYER_SNAP_EPSILON_PX) {
      tank.position.set(targetX, targetY);
    } else {
      this.moveTankTowards(
        tank,
        targetX,
        targetY,
        tank.attributes.moveSpeed * LOCAL_RECONCILE_MULTIPLIER * deltaTime,
      );
    }
    tank.rotation = this.toGameRotation(snapshot.direction);
    tank.state = snapshot.moving === true ? TankState.Moving : TankState.Idle;
    tank.updateMatrix(true);
    if (tank.collider.isInitialized()) {
      tank.collider.update();
    }
  }

  private applyRemotePlayerPosition(
    tank: Tank,
    playerIndex: number,
    targetX: number,
    targetY: number,
    distance: number,
    deltaTime: number,
  ): void {
    if (
      !this.initializedPlayers.has(playerIndex) ||
      distance > REMOTE_PLAYER_HARD_SNAP_DISTANCE_PX ||
      distance <= PLAYER_SNAP_EPSILON_PX
    ) {
      tank.position.set(targetX, targetY);
      this.initializedPlayers.add(playerIndex);
      return;
    }
    const alpha = 1 - Math.exp(-REMOTE_PLAYER_SMOOTHING_SPEED * deltaTime);
    const desiredStepX = (targetX - tank.position.x) * alpha;
    const desiredStepY = (targetY - tank.position.y) * alpha;
    const desiredStepDistance = Math.hypot(desiredStepX, desiredStepY);
    const maxStepDistance = tank.attributes.moveSpeed * deltaTime;
    if (desiredStepDistance <= maxStepDistance || desiredStepDistance === 0) {
      tank.position.set(
        tank.position.x + desiredStepX,
        tank.position.y + desiredStepY,
      );
      return;
    }
    const scale = maxStepDistance / desiredStepDistance;
    tank.position.set(
      tank.position.x + desiredStepX * scale,
      tank.position.y + desiredStepY * scale,
    );
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

  private encodeTerrain(
    fieldWidth: number,
    fieldHeight: number,
    regions: TerrainRegionConfig[],
  ): { width: number; height: number; cells: Uint8Array } {
    const width = Math.ceil(fieldWidth / BOARD_CELL_SIZE_PX);
    const height = Math.ceil(fieldHeight / BOARD_CELL_SIZE_PX);
    if (width > 108 || height > 108) {
      throw new Error(`Map terrain grid ${width}x${height} exceeds 108x108.`);
    }
    const cells = new Uint8Array(width * height);
    const kind = (type: TerrainType): number => {
      if (type === TerrainType.Brick || type === TerrainType.BrickSuper) {
        return 1;
      }
      if (type === TerrainType.Steel) {
        return 2;
      }
      if (type === TerrainType.Water) {
        return 3;
      }
      return 0;
    };
    regions.forEach((region) => {
      const cellKind = kind(region.type);
      if (cellKind === 0) {
        return;
      }
      const minX = Math.max(0, Math.floor(region.x / BOARD_CELL_SIZE_PX));
      const minY = Math.max(0, Math.floor(region.y / BOARD_CELL_SIZE_PX));
      const maxX = Math.min(width, Math.ceil((region.x + region.width) / BOARD_CELL_SIZE_PX));
      const maxY = Math.min(height, Math.ceil((region.y + region.height) / BOARD_CELL_SIZE_PX));
      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          cells[y * width + x] = cellKind;
        }
      }
    });
    return { width, height, cells };
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

  private queueBoardMutations(mutations: LocalBoardMutation[] = []): void {
    mutations.forEach((mutation) => {
      const key = `${mutation.x}:${mutation.y}`;
      if (!this.knownBoardMutations.has(key)) {
        this.knownBoardMutations.add(key);
        this.remoteBoardMutations.push(mutation);
      }
    });
  }

  private projectileKey(projectile: LocalProjectileSnapshot): string {
    return `${projectile.owner}:${projectile.ownerId}:${projectile.id}`;
  }

  private handleClose = (): void => {
    if (this.state !== LocalSyncState.Failed) {
      this.fail(new Error('Connection to the local Rust server closed.'));
    }
  };

  private handleSocketError = (): void => {
    this.log.warn('Local Rust server websocket reported an error.');
  };

  private showJoinControl(levelNumber: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'local');
    url.searchParams.set('match', this.roomId);
    url.searchParams.set('join', '1');
    url.searchParams.set('level', levelNumber.toString());
    const button = this.ensureStatusElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.textContent = 'Copy local player-two link';
    button.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(url.toString());
        button.textContent = 'Local Rust player-two link copied';
      } catch (error) {
        this.log.error('Could not copy local player-two link.', error);
        button.textContent = 'Copy failed - check console';
      }
    };
    this.log.info(`Local Rust player-two link: ${url.toString()}`);
  }

  private showStatus(message: string): void {
    this.ensureStatusElement('div').textContent = message;
  }

  private ensureStatusElement(tagName: 'button' | 'div'): HTMLElement {
    if (this.statusElement?.tagName.toLowerCase() === tagName) {
      return this.statusElement;
    }
    this.statusElement?.remove();
    const element = document.createElement(tagName);
    element.className = 'local-server-match-status';
    element.setAttribute('aria-live', 'polite');
    Object.assign(element.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '1000',
      minHeight: '44px', padding: '10px 14px', border: '2px solid #55e6c1',
      borderRadius: '6px', background: '#09131f', color: '#fff',
      font: '600 14px system-ui, sans-serif',
      cursor: tagName === 'button' ? 'pointer' : 'default',
    });
    document.body.appendChild(element);
    this.statusElement = element;
    return element;
  }

  private createRoomId(): string {
    const values = new Uint32Array(2);
    window.crypto.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }

  private parseRoomId(value: string | null): string | null {
    return value !== null && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
  }

  private toServerUnits(value: number): number {
    return Math.round(value * UNITS_PER_PIXEL);
  }

  private fromServerUnits(value: number): number {
    return value / UNITS_PER_PIXEL;
  }

  private fromGameRotation(rotation: Rotation): number {
    return [Rotation.Up, Rotation.Right, Rotation.Down, Rotation.Left].indexOf(rotation);
  }

  private toGameRotation(direction: number): Rotation {
    return [Rotation.Up, Rotation.Right, Rotation.Down, Rotation.Left][direction];
  }

  private fail = (error: Error): void => {
    this.state = LocalSyncState.Failed;
    this.showStatus('Local Rust match failed - check console');
    this.log.error('Local match setup failed.', error);
  };
}
