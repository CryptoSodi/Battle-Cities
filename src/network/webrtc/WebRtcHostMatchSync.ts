import { Rotation } from '../../game';
import type { GameUpdateArgs } from '../../game';
import { EnemyTank, PlayerTank, TankState } from '../../gameObjects';
import { LevelPlayInputContext } from '../../input';
import { PowerupType } from '../../powerup';

import { HttpGhostSignalTransport } from './HttpGhostSignalTransport';
import { WebRtcDataPacket, WebRtcGhostSync } from './WebRtcGhostSync';

const INPUT_HEARTBEAT_MS = 150;
const REMOTE_INPUT_TIMEOUT_MS = 500;
const MAX_ENEMY_TICKS_PER_UPDATE = 2;
const MAX_PLAYER_TICKS_PER_UPDATE = 2;
const NETWORK_PROBE_INTERVAL_SECONDS = 0.5;
const JITTER_SMOOTHING = 0.2;

interface WebRtcInputPacket {
  type: 'webrtc-input';
  player: 0 | 1;
  seq: number;
  tick: number;
  direction: Rotation | null;
  moving: boolean;
  fire: boolean;
  elapsedSeconds: number;
}

interface WebRtcEnemyFrame {
  partyIndex: number;
  rotation: Rotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
}

interface WebRtcPlayerFrame {
  partyIndex: 0 | 1;
  rotation: Rotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: Rotation;
}

interface WebRtcPowerupFrame {
  id: number;
  kind: PowerupType;
  x: number;
  y: number;
}

interface WebRtcPowerupPickupFrame {
  seq: number;
  type: PowerupType;
  partyIndex: number;
  x: number;
  y: number;
}

interface WebRtcHostFramePacket {
  type: 'webrtc-host-frame';
  seq: number;
  tick: number;
  deltaTime: number;
  sharedElapsedSeconds: number;
  playerOneElapsedSeconds: number;
  playerTwoElapsedSeconds: number;
  players: WebRtcPlayerFrame[];
  powerup: WebRtcPowerupFrame | null;
  powerupPickup: WebRtcPowerupPickupFrame | null;
  activeEnemyIds: number[];
  enemies: WebRtcEnemyFrame[];
}

interface WebRtcPingPacket {
  type: 'webrtc-ping';
  id: number;
  sentAt: number;
  senderPlayerIndex: number;
}

interface WebRtcPongPacket {
  type: 'webrtc-pong';
  id: number;
  sentAt: number;
  senderPlayerIndex: number;
}

function log(message: string, data?: any): void {
  if (data === undefined) {
    console.log(`[webrtc-match] ${message}`);
    return;
  }

  console.log(`[webrtc-match] ${message}`, data);
}

function normalizeRoom(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function createRoomId(): string {
  const bytes = new Uint8Array(4);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class WebRtcHostMatchSync {
  private readonly enabled: boolean;
  private readonly host: boolean;
  private readonly room: string;
  private readonly localPlayerIndex: number;
  private readonly disableEnemyShooting: boolean;
  private readonly sync = WebRtcGhostSync.getInstance();
  private inputSeq = 0;
  private frameSeq = 0;
  private tick = 0;
  private lastInputAt = 0;
  private lastDirection: Rotation | null = null;
  private lastMoving = false;
  private latestRemoteInput: WebRtcInputPacket = null;
  private latestRemoteInputReceivedAt = 0;
  private lastAppliedRemoteFireSeq = 0;
  private latestHostFrame: WebRtcHostFramePacket = null;
  private readonly pendingPlayerTicks = new Map<
    number,
    WebRtcPlayerFrame[]
  >();
  private readonly pendingEnemyTicks = new Map<
    number,
    WebRtcEnemyFrame[]
  >();
  private readonly observedEnemies = new WeakSet<EnemyTank>();
  private readonly observedPlayers = new WeakSet<PlayerTank>();
  private readonly playerFireSeqs = new Map<number, number>();
  private readonly lastPlayerFireSeqs = new Map<number, number>();
  private readonly latestPlayerFire = new Map<
    number,
    { x: number; y: number; rotation: Rotation }
  >();
  private readonly lastPlayerPositions = new Map<
    number,
    { tank: PlayerTank; x: number; y: number }
  >();
  private readonly enemyFireSeqs = new Map<number, number>();
  private readonly lastEnemyFireSeqs = new Map<number, number>();
  private readonly lastEnemyPositions = new Map<
    number,
    { x: number; y: number }
  >();
  private started = false;
  private connected = false;
  private localElapsedSeconds = 0;
  private remoteElapsedSeconds = 0;
  private sharedElapsedSeconds = 0;
  private hasSynchronizedClock = false;
  private probeTimer = 0;
  private probeSeq = 0;
  private lastRttMs: number = null;
  private rttMs: number = null;
  private jitterMs: number = null;
  private statusElement: HTMLElement = null;
  private joinButton: HTMLButtonElement = null;
  private clockElement: HTMLElement = null;
  private sharedClockValue: HTMLElement = null;
  private playerOneClockValue: HTMLElement = null;
  private playerTwoClockValue: HTMLElement = null;
  private rttValue: HTMLElement = null;
  private jitterValue: HTMLElement = null;

  constructor(location = window.location) {
    const params = new URLSearchParams(location.search);
    this.enabled = params.get('mode') === 'webrtc';
    this.host = this.enabled && params.get('join') !== '1';
    this.localPlayerIndex = this.host ? 0 : 1;
    this.disableEnemyShooting =
      params.get('debugNoEnemyShooting') === '1' ||
      params.get('webrtcNoEnemyShooting') === '1';

    let room = normalizeRoom(params.get('match') || '');
    if (this.enabled && this.host && room === '') {
      room = createRoomId();
      params.set('mode', 'webrtc');
      params.set('match', room);
      params.set('host', '1');
      params.delete('join');
      window.history.replaceState(
        null,
        '',
        `${location.pathname}?${params.toString()}${location.hash}`,
      );
    }
    this.room = room;

    if (this.enabled && this.room !== '') {
      this.configure();
    } else if (this.enabled) {
      log('disabled: missing match room for joiner');
    }
  }

  public isEnabled(): boolean {
    return this.enabled && this.room !== '';
  }

  public isHost(): boolean {
    return this.isEnabled() && this.host;
  }

  public isConnected(): boolean {
    return this.isEnabled() && this.connected;
  }

  public isWaitingForPeer(): boolean {
    return this.isEnabled() && !this.connected;
  }

  public getLocalPlayerIndex(): number {
    return this.localPlayerIndex;
  }

  public isRemoteTank(partyIndex: number): boolean {
    return this.isEnabled() && partyIndex !== this.localPlayerIndex;
  }

  public shouldDisableEnemyShooting(): boolean {
    return this.isHost() && this.disableEnemyShooting;
  }

  public handlePlayerTank(tank: PlayerTank, updateArgs: GameUpdateArgs): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    if (this.host) {
      if (tank.partyIndex === 0) {
        return false;
      }

      this.applyRemoteInput(tank, updateArgs.deltaTime);
      return true;
    }

    if (tank.partyIndex === 1) {
      this.sendLocalInput(updateArgs, 1);
    }

    return true;
  }

  public updateMatch(
    players: PlayerTank[],
    enemies: EnemyTank[],
    activeEnemyIds: number[],
    powerup: WebRtcPowerupFrame | null,
    powerupPickup: WebRtcPowerupPickupFrame | null,
    deltaTime: number,
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    this.start();
    this.tick += 1;
    if (this.connected) {
      this.localElapsedSeconds += deltaTime;
      this.updateNetworkProbe(deltaTime);
    }

    if (this.host) {
      if (this.connected) {
        this.sharedElapsedSeconds += deltaTime;
      }
      this.observePlayers(players);
      this.observeEnemies(enemies);
      this.sendHostFrame(
        players,
        enemies,
        activeEnemyIds,
        powerup,
        powerupPickup,
        deltaTime,
      );
      this.updateClock();
      return;
    }

    this.updateClock();
  }

  public prepareNetworkTicks(
    players: PlayerTank[],
    enemies: EnemyTank[],
  ): void {
    if (!this.isEnabled()) {
      return;
    }
    if (this.host) {
      this.observePlayers(players);
      this.observeEnemies(enemies);
      players.forEach((tank) => {
        const previous = this.lastPlayerPositions.get(tank.partyIndex);
        if (previous?.tank !== tank) {
          this.lastPlayerPositions.set(tank.partyIndex, {
            tank,
            x: tank.position.x,
            y: tank.position.y,
          });
        }
      });
      enemies.forEach((tank) => {
        if (!this.lastEnemyPositions.has(tank.partyIndex)) {
          this.lastEnemyPositions.set(tank.partyIndex, {
            x: tank.position.x,
            y: tank.position.y,
          });
        }
      });
      return;
    }
    if (this.latestHostFrame === null) {
      return;
    }
    players.forEach((tank) => tank.setNetworkControlled(true));
    this.applyPlayerFrames(players);
    this.applyEnemyFrames(enemies);
  }

  public getActiveEnemyIds(): number[] {
    return this.latestHostFrame?.activeEnemyIds ?? [];
  }

  public getPowerup(): WebRtcPowerupFrame | null {
    return this.latestHostFrame?.powerup ?? null;
  }

  public getPowerupPickup(): WebRtcPowerupPickupFrame | null {
    return this.latestHostFrame?.powerupPickup ?? null;
  }

  private configure(): void {
    this.sync.configureDirect(true, this.room, this.localPlayerIndex);
    this.sync.setSignalTransport(
      new HttpGhostSignalTransport(this.room, this.localPlayerIndex),
    );
    this.sync.subscribePackets((packet) => this.acceptPacket(packet));
    this.sync.subscribeConnection((connected) => {
      this.connected = connected;
      if (!connected) {
        this.probeTimer = 0;
        this.lastRttMs = null;
        this.rttMs = null;
        this.jitterMs = null;
      }
      this.showStatus(
        connected
          ? `WebRTC match connected - player ${this.localPlayerIndex + 1}`
          : this.host
            ? `WebRTC host waiting for player two\nRoom: ${this.room}`
            : `WebRTC player two connecting\nRoom: ${this.room}`,
      );
    });
    this.start();
    if (this.host) {
      this.showJoinControl();
    }
    this.ensureClockElement();
    log('mode enabled', {
      role: this.host ? 'host' : 'joiner',
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      disableEnemyShooting: this.disableEnemyShooting,
      joinUrl: this.createJoinUrl(),
    });
  }

  private start(): void {
    if (this.started || !this.isEnabled()) {
      return;
    }
    this.started = true;
    this.sync.start();
  }

  private acceptPacket(packet: WebRtcDataPacket): void {
    if (!this.isEnabled()) {
      return;
    }

    if (packet.type === 'webrtc-ping') {
      const ping = packet as WebRtcPingPacket;
      if (
        ping.senderPlayerIndex === this.localPlayerIndex ||
        !Number.isFinite(ping.id) ||
        !Number.isFinite(ping.sentAt)
      ) {
        return;
      }
      this.sync.sendWebRtcPacket({
        type: 'webrtc-pong',
        id: ping.id,
        sentAt: ping.sentAt,
        senderPlayerIndex: this.localPlayerIndex,
      } satisfies WebRtcPongPacket);
      return;
    }

    if (packet.type === 'webrtc-pong') {
      const pong = packet as WebRtcPongPacket;
      if (
        pong.senderPlayerIndex === this.localPlayerIndex ||
        pong.id !== this.probeSeq ||
        !Number.isFinite(pong.sentAt)
      ) {
        return;
      }
      this.applyNetworkProbe(performance.now() - pong.sentAt);
      return;
    }

    if (this.host && packet.type === 'webrtc-input') {
      const input = packet as WebRtcInputPacket;
      if (
        input.player !== 1 ||
        input.seq <= (this.latestRemoteInput?.seq ?? 0)
      ) {
        return;
      }
      this.latestRemoteInput = input;
      this.latestRemoteInputReceivedAt = Date.now();
      if (Number.isFinite(input.elapsedSeconds)) {
        this.remoteElapsedSeconds = input.elapsedSeconds;
      }
      return;
    }

    if (!this.host && packet.type === 'webrtc-host-frame') {
      const frame = packet as WebRtcHostFramePacket;
      if (frame.seq <= (this.latestHostFrame?.seq ?? 0)) {
        return;
      }
      this.latestHostFrame = frame;
      if (Number.isFinite(frame.sharedElapsedSeconds)) {
        this.sharedElapsedSeconds = frame.sharedElapsedSeconds;
        if (!this.hasSynchronizedClock) {
          this.localElapsedSeconds = frame.sharedElapsedSeconds;
          this.hasSynchronizedClock = true;
        }
      }
      (frame.players ?? []).forEach((playerFrame) => {
        let ticks = this.pendingPlayerTicks.get(playerFrame.partyIndex);
        if (ticks === undefined) {
          ticks = [];
          this.pendingPlayerTicks.set(playerFrame.partyIndex, ticks);
        }
        ticks.push(playerFrame);
      });
      const activeEnemyIds = new Set(frame.activeEnemyIds);
      Array.from(this.pendingEnemyTicks.keys()).forEach((partyIndex) => {
        if (!activeEnemyIds.has(partyIndex)) {
          this.pendingEnemyTicks.delete(partyIndex);
        }
      });
      frame.enemies.forEach((enemyFrame) => {
        let ticks = this.pendingEnemyTicks.get(enemyFrame.partyIndex);
        if (ticks === undefined) {
          ticks = [];
          this.pendingEnemyTicks.set(enemyFrame.partyIndex, ticks);
        }
        ticks.push(enemyFrame);
      });
    }
  }

  private sendLocalInput(
    updateArgs: GameUpdateArgs,
    player: 0 | 1,
  ): void {
    const input = this.readInput(updateArgs);
    const now = Date.now();
    if (
      !input.fire &&
      input.direction === this.lastDirection &&
      input.moving === this.lastMoving &&
      now - this.lastInputAt < INPUT_HEARTBEAT_MS
    ) {
      return;
    }

    this.inputSeq += 1;
    this.lastInputAt = now;
    this.lastDirection = input.direction;
    this.lastMoving = input.moving;

    this.sync.sendWebRtcPacket({
      type: 'webrtc-input',
      player,
      seq: this.inputSeq,
      tick: this.tick,
      direction: input.direction,
      moving: input.moving,
      fire: input.fire,
      elapsedSeconds: this.localElapsedSeconds,
    } satisfies WebRtcInputPacket);
  }

  private applyRemoteInput(tank: PlayerTank, deltaTime: number): void {
    const input = this.latestRemoteInput;
    if (
      input === null ||
      Date.now() - this.latestRemoteInputReceivedAt > REMOTE_INPUT_TIMEOUT_MS
    ) {
      tank.idle(false);
      return;
    }

    if (input.fire && input.seq > this.lastAppliedRemoteFireSeq) {
      this.lastAppliedRemoteFireSeq = input.seq;
      tank.fire();
    }

    if (input.direction !== null) {
      tank.rotate(input.direction);
    }
    if (input.moving && input.direction !== null) {
      tank.move(deltaTime);
      return;
    }

    tank.idle();
  }

  private readInput(updateArgs: GameUpdateArgs): {
    direction: Rotation | null;
    moving: boolean;
    fire: boolean;
  } {
    const inputMethod = updateArgs.inputManager.getActiveMethod();
    const direction = this.readDirection(updateArgs);

    return {
      direction,
      moving: direction !== null,
      fire:
        inputMethod.isDownAny(LevelPlayInputContext.Fire) ||
        inputMethod.isHoldAny(LevelPlayInputContext.RapidFire),
    };
  }

  private readDirection(updateArgs: GameUpdateArgs): Rotation | null {
    const inputMethod = updateArgs.inputManager.getActiveMethod();
    const directions: [number[], Rotation][] = [
      [LevelPlayInputContext.MoveUp, Rotation.Up],
      [LevelPlayInputContext.MoveDown, Rotation.Down],
      [LevelPlayInputContext.MoveLeft, Rotation.Left],
      [LevelPlayInputContext.MoveRight, Rotation.Right],
    ];

    let bestIndex = -1;
    let bestRotation: Rotation = null;
    for (const [controls, rotation] of directions) {
      const index = inputMethod.getHoldLastIndex(controls);
      if (index > bestIndex) {
        bestIndex = index;
        bestRotation = rotation;
      }
    }

    return bestRotation;
  }

  private sendHostFrame(
    players: PlayerTank[],
    enemies: EnemyTank[],
    activeEnemyIds: number[],
    powerup: WebRtcPowerupFrame | null,
    powerupPickup: WebRtcPowerupPickupFrame | null,
    deltaTime: number,
  ): void {
    const activeEnemyIdSet = new Set(activeEnemyIds);
    Array.from(this.lastEnemyPositions.keys()).forEach((partyIndex) => {
      if (!activeEnemyIdSet.has(partyIndex)) {
        this.lastEnemyPositions.delete(partyIndex);
      }
    });
    const frame: WebRtcHostFramePacket = {
      type: 'webrtc-host-frame',
      seq: ++this.frameSeq,
      tick: this.tick,
      deltaTime: Math.min(Math.max(deltaTime, 0), 0.1),
      sharedElapsedSeconds: this.sharedElapsedSeconds,
      playerOneElapsedSeconds: this.localElapsedSeconds,
      playerTwoElapsedSeconds: this.remoteElapsedSeconds,
      players: players.map((tank) => this.createPlayerFrame(tank)),
      powerup,
      powerupPickup,
      activeEnemyIds,
      enemies: enemies.map((tank) => this.createEnemyFrame(tank)),
    };

    this.sync.sendWebRtcPacket(frame);
  }

  private createPlayerFrame(tank: PlayerTank): WebRtcPlayerFrame {
    const previousPosition = this.lastPlayerPositions.get(tank.partyIndex);
    const sameTank = previousPosition?.tank === tank;
    const deltaX = sameTank ? tank.position.x - previousPosition.x : 0;
    const deltaY = sameTank ? tank.position.y - previousPosition.y : 0;
    this.lastPlayerPositions.set(tank.partyIndex, {
      tank,
      x: tank.position.x,
      y: tank.position.y,
    });
    const fire = this.latestPlayerFire.get(tank.partyIndex);

    return {
      partyIndex: tank.partyIndex as 0 | 1,
      rotation: tank.rotation,
      moving: tank.state === TankState.Moving,
      deltaX,
      deltaY,
      alive: tank.isAlive(),
      fireSeq: this.playerFireSeqs.get(tank.partyIndex) ?? 0,
      fireX: fire?.x ?? tank.position.x,
      fireY: fire?.y ?? tank.position.y,
      fireRotation: fire?.rotation ?? tank.rotation,
    };
  }

  private createEnemyFrame(tank: EnemyTank): WebRtcEnemyFrame {
    const previousPosition = this.lastEnemyPositions.get(tank.partyIndex);
    const deltaX =
      previousPosition === undefined
        ? 0
        : tank.position.x - previousPosition.x;
    const deltaY =
      previousPosition === undefined
        ? 0
        : tank.position.y - previousPosition.y;
    this.lastEnemyPositions.set(tank.partyIndex, {
      x: tank.position.x,
      y: tank.position.y,
    });

    return {
      partyIndex: tank.partyIndex,
      rotation: tank.rotation,
      moving: tank.state === TankState.Moving,
      deltaX,
      deltaY,
      alive: tank.isAlive(),
      fireSeq: this.enemyFireSeqs.get(tank.partyIndex) ?? 0,
    };
  }

  private applyEnemyFrames(enemies: EnemyTank[]): void {
    this.pendingEnemyTicks.forEach((ticks, partyIndex) => {
      const tank = enemies.find((candidate) => {
        return candidate.partyIndex === partyIndex;
      });
      if (tank === undefined || ticks.length === 0) {
        return;
      }
      tank.setNetworkControlled(true);
      ticks
        .splice(0, MAX_ENEMY_TICKS_PER_UPDATE)
        .forEach((frame) => {
          tank.applyNetworkMovement(
            frame.rotation,
            frame.moving,
            Number.isFinite(frame.deltaX) ? frame.deltaX : 0,
            Number.isFinite(frame.deltaY) ? frame.deltaY : 0,
          );

          const lastFireSeq =
            this.lastEnemyFireSeqs.get(frame.partyIndex) ?? 0;
          if (
            tank.collider.isInitialized() &&
            frame.fireSeq > lastFireSeq
          ) {
            this.lastEnemyFireSeqs.set(frame.partyIndex, frame.fireSeq);
            tank.fire(true);
          }
        });
      if (ticks.length === 0) {
        this.pendingEnemyTicks.delete(partyIndex);
      }
    });
  }

  private applyPlayerFrames(players: PlayerTank[]): void {
    this.pendingPlayerTicks.forEach((ticks, partyIndex) => {
      const tank = players.find((candidate) => {
        return candidate.partyIndex === partyIndex;
      });
      if (tank === undefined || ticks.length === 0) {
        return;
      }
      tank.setNetworkControlled(true);
      ticks.splice(0, MAX_PLAYER_TICKS_PER_UPDATE).forEach((frame) => {
        tank.applyNetworkMovement(
          frame.rotation,
          frame.moving,
          Number.isFinite(frame.deltaX) ? frame.deltaX : 0,
          Number.isFinite(frame.deltaY) ? frame.deltaY : 0,
        );

        const lastFireSeq =
          this.lastPlayerFireSeqs.get(frame.partyIndex) ?? 0;
        if (
          tank.collider.isInitialized() &&
          frame.fireSeq > lastFireSeq
        ) {
          this.lastPlayerFireSeqs.set(frame.partyIndex, frame.fireSeq);
          tank.fireFromNetwork(
            frame.fireX,
            frame.fireY,
            frame.fireRotation,
          );
        }
      });
      if (ticks.length === 0) {
        this.pendingPlayerTicks.delete(partyIndex);
      }
    });
  }

  private observePlayers(players: PlayerTank[]): void {
    players.forEach((tank) => {
      if (this.observedPlayers.has(tank)) {
        return;
      }
      this.observedPlayers.add(tank);
      tank.fired.addListener(() => {
        this.playerFireSeqs.set(
          tank.partyIndex,
          (this.playerFireSeqs.get(tank.partyIndex) ?? 0) + 1,
        );
        this.latestPlayerFire.set(tank.partyIndex, {
          x: tank.position.x,
          y: tank.position.y,
          rotation: tank.rotation,
        });
      });
    });
  }

  private observeEnemies(enemies: EnemyTank[]): void {
    enemies.forEach((tank) => {
      if (this.observedEnemies.has(tank)) {
        return;
      }
      this.observedEnemies.add(tank);
      tank.fired.addListener(() => {
        this.enemyFireSeqs.set(
          tank.partyIndex,
          (this.enemyFireSeqs.get(tank.partyIndex) ?? 0) + 1,
        );
      });
    });
  }

  private updateClock(): void {
    this.ensureClockElement();
    const playerOneElapsed = this.host
      ? this.localElapsedSeconds
      : this.latestHostFrame?.playerOneElapsedSeconds ??
        this.remoteElapsedSeconds;
    const playerTwoElapsed = this.host
      ? this.remoteElapsedSeconds
      : this.localElapsedSeconds;

    this.sharedClockValue.textContent = this.formatClock(
      this.sharedElapsedSeconds,
    );
    this.playerOneClockValue.textContent = this.formatClock(playerOneElapsed);
    this.playerTwoClockValue.textContent = this.formatClock(playerTwoElapsed);
    this.rttValue.textContent = this.formatMilliseconds(this.rttMs);
    this.jitterValue.textContent = this.formatMilliseconds(this.jitterMs);
  }

  private updateNetworkProbe(deltaTime: number): void {
    this.probeTimer += deltaTime;
    if (this.probeTimer < NETWORK_PROBE_INTERVAL_SECONDS) {
      return;
    }
    this.probeTimer = 0;
    this.probeSeq += 1;
    this.sync.sendWebRtcPacket({
      type: 'webrtc-ping',
      id: this.probeSeq,
      sentAt: performance.now(),
      senderPlayerIndex: this.localPlayerIndex,
    } satisfies WebRtcPingPacket);
  }

  private applyNetworkProbe(sampleRttMs: number): void {
    if (!Number.isFinite(sampleRttMs) || sampleRttMs < 0) {
      return;
    }
    if (this.lastRttMs !== null) {
      const sampleJitter = Math.abs(sampleRttMs - this.lastRttMs);
      this.jitterMs =
        this.jitterMs === null
          ? sampleJitter
          : this.jitterMs +
            (sampleJitter - this.jitterMs) * JITTER_SMOOTHING;
    }
    this.lastRttMs = sampleRttMs;
    this.rttMs =
      this.rttMs === null
        ? sampleRttMs
        : this.rttMs + (sampleRttMs - this.rttMs) * JITTER_SMOOTHING;
  }

  private formatMilliseconds(value: number): string {
    return value === null || !Number.isFinite(value)
      ? '-- ms'
      : `${value.toFixed(1)} ms`;
  }

  private formatClock(elapsedSeconds: number): string {
    if (!Number.isFinite(elapsedSeconds)) {
      elapsedSeconds = 0;
    }
    const totalMilliseconds = Math.max(
      0,
      Math.floor(elapsedSeconds * 1000),
    );
    const minutes = Math.floor(totalMilliseconds / 60000);
    const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
    const milliseconds = totalMilliseconds % 1000;

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  private ensureClockElement(): HTMLElement {
    if (this.clockElement !== null) {
      return this.clockElement;
    }

    const element = document.createElement('aside');
    element.className = 'webrtc-match-clock';
    element.setAttribute('aria-label', 'WebRTC match clocks');
    Object.assign(element.style, {
      position: 'fixed',
      left: '12px',
      top: '12px',
      zIndex: '1000',
      width: '176px',
      padding: '10px 12px',
      border: '1px solid var(--mb-accent, #55e6c1)',
      borderRadius: '6px',
      background: 'var(--mb-panel, #09131f)',
      color: 'var(--mb-text, #ffffff)',
      font: '600 13px system-ui, sans-serif',
      fontVariantNumeric: 'tabular-nums',
      pointerEvents: 'none',
    });

    const addClockRow = (label: string): HTMLElement => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'baseline',
        gap: '12px',
        minHeight: '22px',
      });

      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      labelElement.style.fontWeight = '500';

      const valueElement = document.createElement('time');
      valueElement.textContent = '00:00.000';
      valueElement.style.fontFamily =
        'ui-monospace, SFMono-Regular, Consolas, monospace';

      row.append(labelElement, valueElement);
      element.appendChild(row);
      return valueElement;
    };

    this.sharedClockValue = addClockRow('Shared');
    this.playerOneClockValue = addClockRow('Player 1');
    this.playerTwoClockValue = addClockRow('Player 2');
    this.rttValue = addClockRow('RTT');
    this.jitterValue = addClockRow('Jitter');

    document.body.appendChild(element);
    this.clockElement = element;
    return element;
  }

  private createJoinUrl(): string {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'webrtc');
    params.set('match', this.room);
    params.set('join', '1');
    params.delete('host');

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  private showJoinControl(): void {
    const url = this.createJoinUrl();
    const button = this.ensureJoinButton();
    button.type = 'button';
    button.textContent = 'Copy WebRTC player-two link';
    button.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = 'WebRTC player-two link copied';
        window.setTimeout(() => {
          button.textContent = 'Copy WebRTC player-two link';
        }, 2000);
      } catch {
        button.textContent = 'Copy failed - check DevTools';
      }
    };
    log(`player-two link: ${url}`);
  }

  private showStatus(message: string): void {
    this.ensureStatusElement().textContent = message;
  }

  private ensureStatusElement(): HTMLElement {
    if (this.statusElement !== null) {
      return this.statusElement;
    }

    const element = document.createElement('div');
    element.className = 'webrtc-match-status';
    element.setAttribute('aria-live', 'polite');
    Object.assign(element.style, {
      position: 'fixed',
      right: '16px',
      bottom: this.host ? '72px' : '16px',
      zIndex: '1000',
      maxWidth: '320px',
      minHeight: '44px',
      whiteSpace: 'pre-line',
      padding: '10px 14px',
      border: '2px solid #55e6c1',
      borderRadius: '6px',
      background: '#09131f',
      color: '#fff',
      font: '600 14px system-ui, sans-serif',
    });
    document.body.appendChild(element);
    this.statusElement = element;

    return element;
  }

  private ensureJoinButton(): HTMLButtonElement {
    if (this.joinButton !== null) {
      return this.joinButton;
    }

    const button = document.createElement('button');
    button.className = 'webrtc-match-copy-link';
    button.setAttribute('aria-live', 'polite');
    Object.assign(button.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '1000',
      minHeight: '44px',
      padding: '10px 14px',
      border: '2px solid #55e6c1',
      borderRadius: '6px',
      background: '#09131f',
      color: '#fff',
      font: '600 14px system-ui, sans-serif',
      cursor: 'pointer',
    });
    document.body.appendChild(button);
    this.joinButton = button;

    return button;
  }
}
