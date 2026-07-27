import { Rotation } from '../../game';
import type { GameUpdateArgs } from '../../game';
import { EnemyTank, PlayerTank, TankState } from '../../gameObjects';
import { LevelPlayInputContext } from '../../input';
import { PowerupType } from '../../powerup';
import { TankTier } from '../../tank';

import { HttpGhostSignalTransport } from './HttpGhostSignalTransport';
import { WebRtcDataPacket, WebRtcGhostSync } from './WebRtcGhostSync';
import { getApiUrl } from '../api';
import { getApiBaseUrl } from '../api';
import type { MultiplayerRuntimeConfig } from '@battlecities/shared';
import { applyRemotePlayerInput } from './applyRemotePlayerInput';

const INPUT_HEARTBEAT_MS = 150;
const REMOTE_INPUT_TIMEOUT_MS = 500;
const MAX_ENEMY_TICKS_PER_UPDATE = 2;
const MAX_PLAYER_TICKS_PER_UPDATE = 2;
const NETWORK_PROBE_INTERVAL_SECONDS = 0.5;
const JITTER_SMOOTHING = 0.2;
const OBSERVER_HEARTBEAT_MS = 5000;
const OBSERVER_DISCOVERY_MS = 2000;
const REPLAY_FRAMES_PER_HOST_TICK = 8;
const REPLAY_READY_MAX_LAG = 2;

type WebRtcLinkId = 0 | 1 | string;

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
  x: number;
  y: number;
  rotation: Rotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: Rotation;
  initialSync?: boolean;
}

interface WebRtcPlayerFrame {
  partyIndex: 0 | 1;
  tier: TankTier;
  x: number;
  y: number;
  rotation: Rotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: Rotation;
  initialSync?: boolean;
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
  playerScores: [number, number];
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

interface WebRtcReadyPacket {
  type: 'webrtc-ready';
  ready: boolean;
  syncPlayer?: 0 | 1 | null;
  serverFrameSeq?: number;
}

interface WebRtcResumePacket {
  type: 'webrtc-resume';
  player: 0 | 1;
  lastAppliedFrameSeq: number;
}

interface WebRtcReplayStartPacket {
  type: 'webrtc-replay-start';
  fromSeq: number;
  targetSeq: number;
}

interface WebRtcReplayCompletePacket {
  type: 'webrtc-replay-complete';
  targetSeq: number;
}

interface WebRtcReplayReadyPacket {
  type: 'webrtc-replay-ready';
  appliedSeq: number;
}

interface WebRtcReplayUnavailablePacket {
  type: 'webrtc-replay-unavailable';
  oldestAvailableSeq: number;
  serverSeq: number;
}

interface WebRtcClientReadyPacket {
  type: 'webrtc-client-ready';
  player: 0 | 1;
  appliedSeq: number;
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

function createObserverId(): string {
  return createRoomId();
}

function observerLinkId(observerId: string): string {
  return `observer:${observerId}`;
}

function isObserverLink(linkId: WebRtcLinkId): linkId is string {
  return typeof linkId === 'string';
}

export class WebRtcHostMatchSync {
  private readonly enabled: boolean;
  private readonly broadcaster: boolean;
  private readonly headlessBroadcaster: boolean;
  private readonly observer: boolean;
  private readonly observerId: string;
  private readonly room: string;
  private readonly localPlayerIndex: number;
  private readonly signalingBaseUrl: string;
  private readonly authorizationToken: string;
  private readonly disableEnemyShooting: boolean;
  private readonly links = new Map<WebRtcLinkId, WebRtcGhostSync>();
  private readonly connectedPlayers = new Set<number>();
  private readonly activePlayers = new Set<number>();
  private readonly syncingPlayers = new Set<number>();
  private readonly frameHistory: WebRtcHostFramePacket[] = [];
  private readonly frameHistoryBySeq = new Map<number, WebRtcHostFramePacket>();
  private readonly replaySessions = new Map<
    number,
    { nextSeq: number; targetSeq: number }
  >();
  private readonly pendingActivations = new Map<number, number>();
  private inputSeq = 0;
  private frameSeq = 0;
  private tick = 0;
  private lastInputAt = 0;
  private lastDirection: Rotation | null = null;
  private lastMoving = false;
  private readonly latestRemoteInputs = new Map<number, WebRtcInputPacket>();
  private readonly latestRemoteInputReceivedAt = new Map<number, number>();
  private readonly lastAppliedRemoteFireSeqs = new Map<number, number>();
  private latestHostFrame: WebRtcHostFramePacket = null;
  private activeReplayFrame: WebRtcHostFramePacket = null;
  private readonly recoveryFrames = new Map<number, WebRtcHostFramePacket>();
  private readonly clientFrameCache = new Map<number, WebRtcHostFramePacket>();
  private readonly pendingAppliedFrameSeqs: number[] = [];
  private lastAppliedHostFrameSeq = 0;
  private replayTargetSeq = 0;
  private replayDeliveryComplete = false;
  private lastReadyAckSeq = -1;
  private clientSyncing = false;
  private recoveryUnavailable = false;
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
  private readonly latestEnemyFire = new Map<
    number,
    { x: number; y: number; rotation: Rotation }
  >();
  private readonly lastEnemyPositions = new Map<
    number,
    { x: number; y: number }
  >();
  private started = false;
  private matchStarted = false;
  private connected = false;
  private ready = false;
  private localElapsedSeconds = 0;
  private readonly playerElapsedSeconds = new Map<number, number>();
  private sharedElapsedSeconds = 0;
  private hasSynchronizedClock = false;
  private probeTimer = 0;
  private probeSeq = 0;
  private lastRttMs: number = null;
  private rttMs: number = null;
  private jitterMs: number = null;
  private statusElement: HTMLElement = null;
  private readonly joinButtons = new Map<number, HTMLButtonElement>();
  private clockElement: HTMLElement = null;
  private sharedClockValue: HTMLElement = null;
  private playerOneClockValue: HTMLElement = null;
  private playerTwoClockValue: HTMLElement = null;
  private rttValue: HTMLElement = null;
  private jitterValue: HTMLElement = null;
  private observerHeartbeatTimer: number = null;
  private observerDiscoveryTimer: number = null;
  private authoritativeScores: [number, number] = [0, 0];
  private resultSubmissionStarted = false;

  constructor(
    runtime: MultiplayerRuntimeConfig | null = null,
    location = window.location,
  ) {
    const params = new URLSearchParams(location.search);
    this.enabled = runtime !== null || params.get('mode') === 'webrtc';
    this.broadcaster =
      runtime === null && this.enabled && params.get('broadcaster') === '1';
    this.headlessBroadcaster =
      this.broadcaster && params.get('headless') === '1';
    this.observer = runtime === null &&
      this.enabled && !this.broadcaster && params.get('observer') === '1';
    const requestedObserverId = normalizeRoom(params.get('observerId') || '');
    this.observerId = this.observer
      ? /^[a-z0-9]{8}$/.test(requestedObserverId)
        ? requestedObserverId
        : createObserverId()
      : '';
    this.localPlayerIndex = runtime?.playerSlot ??
      (params.get('join') === '1' || params.get('player') === '2' ? 1 : 0);
    this.signalingBaseUrl = runtime?.signalingBaseUrl || getApiBaseUrl();
    this.authorizationToken = runtime?.joinToken ||
      (this.broadcaster ? params.get('serviceToken') || '' : '');
    this.disableEnemyShooting =
      params.get('debugNoEnemyShooting') === '1' ||
      params.get('webrtcNoEnemyShooting') === '1';

    let room = runtime?.matchId || normalizeRoom(params.get('match') || '');
    if (this.enabled && this.broadcaster && room === '') {
      room = createRoomId();
      params.set('mode', 'webrtc');
      params.set('match', room);
      params.set('broadcaster', '1');
      params.delete('host');
      params.delete('join');
      params.delete('player');
      params.delete('observer');
      params.delete('observerId');
      window.history.replaceState(
        null,
        '',
        `${location.pathname}?${params.toString()}${location.hash}`,
      );
    }
    if (this.observer && params.get('observerId') !== this.observerId) {
      params.set('observerId', this.observerId);
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
    return this.isBroadcaster();
  }

  public isBroadcaster(): boolean {
    return this.isEnabled() && this.broadcaster;
  }

  public isHeadlessBroadcaster(): boolean {
    return this.isEnabled() && this.headlessBroadcaster;
  }

  public isObserver(): boolean {
    return this.isEnabled() && this.observer;
  }

  public isConnected(): boolean {
    return this.isEnabled() && this.connected && this.ready;
  }

  public isWaitingForPeer(): boolean {
    return this.isEnabled() && !this.ready;
  }

  public getLocalPlayerIndex(): number {
    return this.localPlayerIndex;
  }

  public getSharedElapsedSeconds(): number {
    return this.sharedElapsedSeconds;
  }

  public getPlayerScore(playerIndex: 0 | 1): number | null {
    const score = (this.activeReplayFrame ?? this.latestHostFrame)
      ?.playerScores?.[playerIndex];
    return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : null;
  }

  public async completeAuthoritativeMatch(): Promise<void> {
    if (
      !this.isHeadlessBroadcaster() ||
      this.authorizationToken === '' ||
      this.resultSubmissionStarted
    ) {
      return;
    }
    this.resultSubmissionStarted = true;
    const response = await fetch(
      getApiUrl(
        `/api/multiplayer/matches/${encodeURIComponent(this.room)}/result`,
      ),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.authorizationToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          scores: this.authoritativeScores.map((score, playerSlot) => ({
            playerSlot,
            score,
          })),
        }),
      },
    );
    if (!response.ok) {
      this.resultSubmissionStarted = false;
      throw new Error(`Authoritative result submission failed: ${response.status}`);
    }
  }

  public shouldHoldClientSimulation(): boolean {
    return (
      this.isEnabled() &&
      !this.broadcaster &&
      !this.observer &&
      this.clientSyncing &&
      this.activeReplayFrame === null
    );
  }

  public beginCatchUpStep(): number | null {
    if (
      !this.clientSyncing ||
      this.recoveryUnavailable ||
      this.activeReplayFrame !== null
    ) {
      return null;
    }
    const nextSeq = this.lastAppliedHostFrameSeq + 1;
    const frame = this.recoveryFrames.get(nextSeq);
    if (frame === undefined) {
      this.maybeAcknowledgeReplay();
      return null;
    }
    this.activeReplayFrame = frame;
    return frame.deltaTime;
  }

  public endCatchUpStep(): void {
    if (this.activeReplayFrame === null) {
      return;
    }
    const appliedSeq = this.activeReplayFrame.seq;
    this.recoveryFrames.delete(appliedSeq);
    this.clientFrameCache.delete(appliedSeq);
    this.lastAppliedHostFrameSeq = appliedSeq;
    this.activeReplayFrame = null;
    if (appliedSeq % 30 === 0 || appliedSeq >= this.replayTargetSeq) {
      this.showClientStatus();
    }
    this.maybeAcknowledgeReplay();
  }

  public isRemoteTank(partyIndex: number): boolean {
    return (
      this.isEnabled() &&
      (this.broadcaster || this.observer || partyIndex !== this.localPlayerIndex)
    );
  }

  public shouldDisableEnemyShooting(): boolean {
    return this.isHost() && this.disableEnemyShooting;
  }

  public handlePlayerTank(tank: PlayerTank, updateArgs: GameUpdateArgs): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    if (this.broadcaster) {
      this.applyRemoteInput(tank, updateArgs.deltaTime);
      return true;
    }

    if (this.observer) {
      return true;
    }

    if (this.clientSyncing) {
      return true;
    }

    if (tank.partyIndex === this.localPlayerIndex) {
      this.sendLocalInput(
        updateArgs,
        this.localPlayerIndex as 0 | 1,
      );
    }

    return true;
  }

  public updateMatch(
    players: PlayerTank[],
    enemies: EnemyTank[],
    activeEnemyIds: number[],
    powerup: WebRtcPowerupFrame | null,
    powerupPickup: WebRtcPowerupPickupFrame | null,
    playerScores: [number, number],
    deltaTime: number,
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    if (this.broadcaster) {
      this.authoritativeScores = [
        Math.max(0, Math.floor(playerScores[0] || 0)),
        Math.max(0, Math.floor(playerScores[1] || 0)),
      ];
    }

    this.start();
    this.tick += 1;
    if (this.ready && !this.clientSyncing) {
      this.localElapsedSeconds += deltaTime;
      this.updateNetworkProbe(deltaTime);
    }

    if (this.broadcaster) {
      if (!this.matchStarted) {
        this.updateClock();
        return;
      }
      this.sharedElapsedSeconds += deltaTime;
      this.observePlayers(players);
      this.observeEnemies(enemies);
      this.sendHostFrame(
        players,
        enemies,
        activeEnemyIds,
        powerup,
        powerupPickup,
        playerScores,
        deltaTime,
      );
      this.updateClock();
      return;
    }

    if (this.activeReplayFrame !== null) {
      this.updateClock();
      return;
    }

    const appliedSeq = this.pendingAppliedFrameSeqs.shift();
    if (appliedSeq !== undefined) {
      this.lastAppliedHostFrameSeq = appliedSeq;
      this.clientFrameCache.delete(appliedSeq);
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
    if (this.broadcaster) {
      this.observePlayers(players);
      this.observeEnemies(enemies);
      players.forEach((tank) => {
        if (tank === null || tank === undefined) {
          return;
        }
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
    const frame = this.activeReplayFrame ?? this.latestHostFrame;
    if (frame === null) {
      return;
    }
    players.forEach((tank) => {
      if (tank !== null && tank !== undefined) {
        tank.setNetworkControlled(true);
      }
    });
    if (this.activeReplayFrame !== null) {
      this.applyReplayPlayerFrames(players, frame.players ?? []);
      this.applyReplayEnemyFrames(enemies, frame.enemies ?? []);
      return;
    }
    this.applyPlayerFrames(players);
    this.applyEnemyFrames(enemies);
  }

  public getActiveEnemyIds(): number[] {
    return (
      this.activeReplayFrame?.activeEnemyIds ??
      this.latestHostFrame?.activeEnemyIds ??
      []
    );
  }

  public getPowerup(): WebRtcPowerupFrame | null {
    return this.activeReplayFrame?.powerup ?? this.latestHostFrame?.powerup ?? null;
  }

  public getPowerupPickup(): WebRtcPowerupPickupFrame | null {
    return (
      this.activeReplayFrame?.powerupPickup ??
      this.latestHostFrame?.powerupPickup ??
      null
    );
  }

  private configure(): void {
    if (this.broadcaster) {
      this.configureLink(0);
      this.configureLink(1);
      this.startObserverDiscovery();
    } else if (this.observer) {
      this.startObserverHeartbeat();
    } else {
      this.configureLink(this.localPlayerIndex as 0 | 1);
    }
    this.start();
    if (this.broadcaster) {
      if (!this.headlessBroadcaster) {
        this.showPlayerControls();
      }
    }
    if (!this.headlessBroadcaster) {
      this.ensureClockElement();
    }
    log('mode enabled', {
      role: this.broadcaster
        ? 'broadcaster'
        : this.observer
          ? 'observer'
        : `player-${this.localPlayerIndex + 1}`,
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      disableEnemyShooting: this.disableEnemyShooting,
      headless: this.headlessBroadcaster,
      ...(this.broadcaster
        ? {
            playerOneUrl: this.createPlayerUrl(0),
            playerTwoUrl: this.createPlayerUrl(1),
            observerUrl: this.createObserverUrl(),
          }
        : {}),
    });
  }

  private configureLink(linkId: WebRtcLinkId): void {
    if (this.links.has(linkId)) {
      return;
    }
    const sync = new WebRtcGhostSync();
    const signalingRoom =
      isObserverLink(linkId)
        ? `${this.room}-o-${linkId.slice('observer:'.length)}`
        : `${this.room}-p${linkId + 1}`;
    const signalingIndex = this.broadcaster ? 0 : 1;
    sync.configureDirect(true, signalingRoom, signalingIndex);
    sync.setSignalTransport(
      new HttpGhostSignalTransport(
        signalingRoom,
        signalingIndex,
        this.signalingBaseUrl,
        this.authorizationToken,
      ),
    );
    sync.subscribePackets((packet) => {
      this.acceptPacket(packet, linkId);
    });
    sync.subscribeConnection((connected) => {
      this.handleConnection(linkId, connected);
    });
    this.links.set(linkId, sync);
    if (this.started) {
      sync.start();
    }
  }

  private start(): void {
    if (this.started || !this.isEnabled()) {
      return;
    }
    this.started = true;
    this.links.forEach((sync) => sync.start());
  }

  private handleConnection(
    linkId: WebRtcLinkId,
    isConnected: boolean,
  ): void {
    if (this.broadcaster) {
      if (isObserverLink(linkId) && isConnected) {
        this.sendToLink(linkId, {
          type: 'webrtc-ready',
          ready: this.matchStarted,
          syncPlayer: null,
          serverFrameSeq: this.frameSeq,
        } satisfies WebRtcReadyPacket);
        return;
      }
      if (isObserverLink(linkId)) {
        return;
      }

      const reconnectingPlayer = this.matchStarted && isConnected;
      if (isConnected) {
        this.connectedPlayers.add(linkId);
        if (!this.matchStarted) {
          this.activePlayers.add(linkId);
        } else {
          this.syncingPlayers.add(linkId);
          this.activePlayers.delete(linkId);
        }
      } else {
        this.connectedPlayers.delete(linkId);
        this.activePlayers.delete(linkId);
        this.replaySessions.delete(linkId);
        this.pendingActivations.delete(linkId);
        if (this.matchStarted) {
          this.syncingPlayers.add(linkId);
        }
      }

      if (!this.matchStarted && this.connectedPlayers.size === 2) {
        this.matchStarted = true;
        this.activePlayers.add(0);
        this.activePlayers.add(1);
        this.syncingPlayers.clear();
      }
      this.connected = this.connectedPlayers.size === 2;
      this.ready = this.matchStarted;
      this.broadcast({
        type: 'webrtc-ready',
        ready: this.matchStarted,
        syncPlayer: reconnectingPlayer ? linkId : null,
        serverFrameSeq: this.frameSeq,
      } satisfies WebRtcReadyPacket);
      const waitingFor = [0, 1]
        .filter((index) => !this.connectedPlayers.has(index))
        .map((index) => `player ${index + 1}`)
        .join(' and ');
      this.showStatus(
        this.matchStarted
          ? waitingFor === ''
            ? `Broadcaster connected\nPlayers 1 and 2 active`
            : `Match running\nWaiting for ${waitingFor} to reconnect`
          : `Broadcaster waiting for ${waitingFor}\nRoom: ${this.room}`,
      );
      return;
    }

    this.connected = isConnected;
    if (!isConnected) {
      this.probeTimer = 0;
      this.lastRttMs = null;
      this.rttMs = null;
      this.jitterMs = null;
      if (!this.observer && this.ready && this.lastAppliedHostFrameSeq > 0) {
        this.beginClientSync();
      } else if (!this.ready) {
        this.ready = false;
      }
    } else if (!this.observer && this.clientSyncing) {
      this.sendResumeRequest();
    }
    this.showClientStatus();
  }

  private beginClientSync(): void {
    this.clientSyncing = true;
    this.recoveryUnavailable = false;
    this.replayDeliveryComplete = false;
    this.lastReadyAckSeq = -1;
    this.replayTargetSeq = this.lastAppliedHostFrameSeq;
    this.pendingPlayerTicks.clear();
    this.pendingEnemyTicks.clear();
    this.pendingAppliedFrameSeqs.length = 0;
    this.clientFrameCache.forEach((frame, seq) => {
      if (seq > this.lastAppliedHostFrameSeq) {
        this.recoveryFrames.set(seq, frame);
      }
    });
  }

  private sendResumeRequest(): void {
    this.sendToPlayer(this.localPlayerIndex as 0 | 1, {
      type: 'webrtc-resume',
      player: this.localPlayerIndex as 0 | 1,
      lastAppliedFrameSeq: this.lastAppliedHostFrameSeq,
    } satisfies WebRtcResumePacket);
  }

  private handleResumeRequest(
    playerIndex: 0 | 1,
    packet: WebRtcResumePacket,
  ): void {
    if (
      packet.player !== playerIndex ||
      !this.connectedPlayers.has(playerIndex) ||
      !Number.isInteger(packet.lastAppliedFrameSeq) ||
      packet.lastAppliedFrameSeq < 0 ||
      packet.lastAppliedFrameSeq > this.frameSeq
    ) {
      return;
    }

    if (this.activePlayers.has(playerIndex)) {
      this.sendToPlayer(playerIndex, {
        type: 'webrtc-replay-ready',
        appliedSeq: packet.lastAppliedFrameSeq,
      } satisfies WebRtcReplayReadyPacket);
      return;
    }

    const oldestAvailableSeq = this.frameHistory[0]?.seq ?? this.frameSeq + 1;
    if (packet.lastAppliedFrameSeq < oldestAvailableSeq - 1) {
      this.sendToPlayer(playerIndex, {
        type: 'webrtc-replay-unavailable',
        oldestAvailableSeq,
        serverSeq: this.frameSeq,
      } satisfies WebRtcReplayUnavailablePacket);
      return;
    }

    if (packet.lastAppliedFrameSeq === this.frameSeq) {
      this.activatePlayer(playerIndex, packet.lastAppliedFrameSeq);
      return;
    }

    this.syncingPlayers.add(playerIndex);
    this.activePlayers.delete(playerIndex);
    this.replaySessions.set(playerIndex, {
      nextSeq: packet.lastAppliedFrameSeq + 1,
      targetSeq: this.frameSeq,
    });
    this.sendToPlayer(playerIndex, {
      type: 'webrtc-replay-start',
      fromSeq: packet.lastAppliedFrameSeq + 1,
      targetSeq: this.frameSeq,
    } satisfies WebRtcReplayStartPacket);
  }

  private handleClientReady(
    playerIndex: 0 | 1,
    packet: WebRtcClientReadyPacket,
  ): void {
    if (
      packet.player !== playerIndex ||
      !this.syncingPlayers.has(playerIndex) ||
      !Number.isInteger(packet.appliedSeq) ||
      packet.appliedSeq < 0 ||
      packet.appliedSeq > this.frameSeq
    ) {
      return;
    }
    if (this.frameSeq - packet.appliedSeq <= REPLAY_READY_MAX_LAG) {
      this.activatePlayer(playerIndex, packet.appliedSeq);
      return;
    }

    this.replaySessions.set(playerIndex, {
      nextSeq: packet.appliedSeq + 1,
      targetSeq: this.frameSeq,
    });
    this.sendToPlayer(playerIndex, {
      type: 'webrtc-replay-start',
      fromSeq: packet.appliedSeq + 1,
      targetSeq: this.frameSeq,
    } satisfies WebRtcReplayStartPacket);
  }

  private activatePlayer(playerIndex: 0 | 1, appliedSeq: number): void {
    const confirmationSent = this.sendToPlayer(playerIndex, {
      type: 'webrtc-replay-ready',
      appliedSeq,
    } satisfies WebRtcReplayReadyPacket);
    if (!confirmationSent) {
      this.pendingActivations.set(playerIndex, appliedSeq);
      return;
    }
    this.syncingPlayers.delete(playerIndex);
    this.replaySessions.delete(playerIndex);
    this.pendingActivations.delete(playerIndex);
    this.activePlayers.add(playerIndex);
    this.latestRemoteInputs.delete(playerIndex);
    this.latestRemoteInputReceivedAt.delete(playerIndex);
    this.lastAppliedRemoteFireSeqs.delete(playerIndex);
  }

  private maybeAcknowledgeReplay(): void {
    if (
      !this.clientSyncing ||
      !this.replayDeliveryComplete ||
      this.activeReplayFrame !== null ||
      this.lastAppliedHostFrameSeq < this.replayTargetSeq ||
      this.recoveryFrames.has(this.lastAppliedHostFrameSeq + 1) ||
      this.lastReadyAckSeq === this.lastAppliedHostFrameSeq
    ) {
      return;
    }
    this.lastReadyAckSeq = this.lastAppliedHostFrameSeq;
    this.sendToPlayer(this.localPlayerIndex as 0 | 1, {
      type: 'webrtc-client-ready',
      player: this.localPlayerIndex as 0 | 1,
      appliedSeq: this.lastAppliedHostFrameSeq,
    } satisfies WebRtcClientReadyPacket);
  }

  private showClientStatus(): void {
    if (this.observer) {
      this.showStatus(
        this.ready
          ? 'WebRTC observer connected'
          : this.connected
            ? 'Observer waiting for match to start'
            : `Observer connecting to broadcaster\nRoom: ${this.room}`,
      );
      return;
    }
    const playerNumber = this.localPlayerIndex + 1;
    this.showStatus(
      this.recoveryUnavailable
        ? `Player ${playerNumber} recovery unavailable\nAuthoritative replay history is incomplete`
        : this.clientSyncing
          ? `Player ${playerNumber} synchronizing\nFrame ${this.lastAppliedHostFrameSeq} / ${this.replayTargetSeq}`
      : this.ready
        ? `WebRTC match ready - player ${playerNumber}`
        : this.connected
          ? `Player ${playerNumber} waiting for other player`
          : `Player ${playerNumber} connecting to broadcaster\nRoom: ${this.room}`,
    );
  }

  private sendToPlayer(
    playerIndex: 0 | 1,
    packet: WebRtcDataPacket,
  ): boolean {
    return this.sendToLink(playerIndex, packet);
  }

  private sendToLink(
    linkId: WebRtcLinkId,
    packet: WebRtcDataPacket,
  ): boolean {
    return this.links.get(linkId)?.sendWebRtcPacket(packet) ?? false;
  }

  private broadcast(packet: WebRtcDataPacket): void {
    this.links.forEach((sync) => sync.sendWebRtcPacket(packet));
  }

  private startObserverHeartbeat(): void {
    const heartbeat = async (): Promise<void> => {
      try {
        const response = await fetch(this.observerRegistryUrl().toString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ observerId: this.observerId }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error || `Observer registration failed: ${response.status}`);
        }
        const linkId = observerLinkId(this.observerId);
        if (!this.links.has(linkId)) {
          this.configureLink(linkId);
          this.start();
        }
      } catch (error) {
        this.showStatus(`Observer admission failed\n${(error as Error).message}`);
        log('observer heartbeat failed', error);
      } finally {
        this.observerHeartbeatTimer = window.setTimeout(
          heartbeat,
          OBSERVER_HEARTBEAT_MS,
        );
      }
    };

    void heartbeat();
  }

  private startObserverDiscovery(): void {
    const discover = async (): Promise<void> => {
      try {
        const response = await fetch(this.observerRegistryUrl().toString(), {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Observer discovery failed: ${response.status}`);
        }
        const body = (await response.json()) as {
          observers?: string[];
        };
        const activeLinks = new Set(
          (body.observers ?? []).map((observerId) => observerLinkId(observerId)),
        );
        activeLinks.forEach((linkId) => this.configureLink(linkId));
        Array.from(this.links.entries()).forEach(([linkId, sync]) => {
          if (isObserverLink(linkId) && !activeLinks.has(linkId)) {
            sync.stop();
            this.links.delete(linkId);
          }
        });
      } catch (error) {
        log('observer discovery failed', error);
      } finally {
        this.observerDiscoveryTimer = window.setTimeout(
          discover,
          OBSERVER_DISCOVERY_MS,
        );
      }
    };

    void discover();
  }

  private observerRegistryUrl(): URL {
    return new URL(
      getApiUrl(
        `/api/webrtc/matches/${encodeURIComponent(this.room)}/observers`,
      ),
    );
  }

  private acceptPacket(
    packet: WebRtcDataPacket,
    linkId: WebRtcLinkId,
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    if (packet.type === 'webrtc-ping') {
      const ping = packet as WebRtcPingPacket;
      if (
        !Number.isFinite(ping.id) ||
        !Number.isFinite(ping.sentAt)
      ) {
        return;
      }
      this.sendToLink(linkId, {
        type: 'webrtc-pong',
        id: ping.id,
        sentAt: ping.sentAt,
        senderPlayerIndex: this.broadcaster
          ? -1
          : this.localPlayerIndex,
      } satisfies WebRtcPongPacket);
      return;
    }

    if (packet.type === 'webrtc-pong') {
      const pong = packet as WebRtcPongPacket;
      if (
        this.broadcaster ||
        pong.id !== this.probeSeq ||
        !Number.isFinite(pong.sentAt)
      ) {
        return;
      }
      this.applyNetworkProbe(performance.now() - pong.sentAt);
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-ready') {
      const ready = packet as WebRtcReadyPacket;
      this.ready = ready.ready === true;
      if (
        !this.observer &&
        ready.syncPlayer === this.localPlayerIndex &&
        !this.clientSyncing
      ) {
        this.beginClientSync();
      }
      if (this.ready && !this.observer && this.connected) {
        this.sendResumeRequest();
      }
      this.showClientStatus();
      return;
    }

    if (this.broadcaster && packet.type === 'webrtc-resume') {
      if (isObserverLink(linkId)) {
        return;
      }
      this.handleResumeRequest(linkId, packet as WebRtcResumePacket);
      return;
    }

    if (this.broadcaster && packet.type === 'webrtc-client-ready') {
      if (isObserverLink(linkId)) {
        return;
      }
      this.handleClientReady(linkId, packet as WebRtcClientReadyPacket);
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-replay-start') {
      const replay = packet as WebRtcReplayStartPacket;
      if (!this.clientSyncing) {
        this.beginClientSync();
      }
      this.replayTargetSeq = Math.max(this.replayTargetSeq, replay.targetSeq);
      this.replayDeliveryComplete = false;
      this.lastReadyAckSeq = -1;
      this.showClientStatus();
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-replay-complete') {
      const replay = packet as WebRtcReplayCompletePacket;
      this.replayTargetSeq = Math.max(this.replayTargetSeq, replay.targetSeq);
      this.replayDeliveryComplete = true;
      this.maybeAcknowledgeReplay();
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-replay-ready') {
      const replay = packet as WebRtcReplayReadyPacket;
      if (replay.appliedSeq > this.lastAppliedHostFrameSeq) {
        return;
      }
      this.clientSyncing = false;
      this.recoveryUnavailable = false;
      this.replayDeliveryComplete = false;
      this.replayTargetSeq = replay.appliedSeq;
      Array.from(this.recoveryFrames.values())
        .filter((frame) => frame.seq > this.lastAppliedHostFrameSeq)
        .sort((a, b) => a.seq - b.seq)
        .forEach((frame) => this.queueLiveFrame(frame, false));
      this.recoveryFrames.clear();
      this.showClientStatus();
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-replay-unavailable') {
      const unavailable = packet as WebRtcReplayUnavailablePacket;
      this.beginClientSync();
      this.recoveryUnavailable = true;
      this.replayTargetSeq = unavailable.serverSeq;
      this.showClientStatus();
      return;
    }

    if (this.broadcaster && packet.type === 'webrtc-input') {
      const input = packet as WebRtcInputPacket;
      if (
        isObserverLink(linkId) ||
        !this.activePlayers.has(linkId) ||
        input.player !== linkId ||
        input.seq <=
          (this.latestRemoteInputs.get(linkId)?.seq ?? 0)
      ) {
        return;
      }
      this.latestRemoteInputs.set(linkId, input);
      this.latestRemoteInputReceivedAt.set(linkId, Date.now());
      if (Number.isFinite(input.elapsedSeconds)) {
        this.playerElapsedSeconds.set(
          linkId,
          input.elapsedSeconds,
        );
      }
      return;
    }

    if (!this.broadcaster && packet.type === 'webrtc-host-frame') {
      const frame = packet as WebRtcHostFramePacket;
      if (!Number.isInteger(frame.seq) || frame.seq <= 0) {
        return;
      }
      this.clientFrameCache.set(frame.seq, frame);
      if (this.clientSyncing) {
        if (frame.seq > this.lastAppliedHostFrameSeq) {
          this.recoveryFrames.set(frame.seq, frame);
        }
        if (frame.seq > (this.latestHostFrame?.seq ?? 0)) {
          this.latestHostFrame = frame;
          this.sharedElapsedSeconds = frame.sharedElapsedSeconds;
        }
        return;
      }
      if (frame.seq <= (this.latestHostFrame?.seq ?? 0)) {
        return;
      }
      const isInitialObserverFrame =
        this.observer && this.latestHostFrame === null;
      this.latestHostFrame = frame;
      this.queueLiveFrame(frame, isInitialObserverFrame);
      if (Number.isFinite(frame.sharedElapsedSeconds)) {
        this.sharedElapsedSeconds = frame.sharedElapsedSeconds;
        if (!this.hasSynchronizedClock) {
          this.localElapsedSeconds = frame.sharedElapsedSeconds;
          this.hasSynchronizedClock = true;
        }
      }
    }
  }

  private queueLiveFrame(
    frame: WebRtcHostFramePacket,
    initialSync: boolean,
  ): void {
    this.pendingAppliedFrameSeqs.push(frame.seq);
    (frame.players ?? []).forEach((playerFrame) => {
      let ticks = this.pendingPlayerTicks.get(playerFrame.partyIndex);
      if (ticks === undefined) {
        ticks = [];
        this.pendingPlayerTicks.set(playerFrame.partyIndex, ticks);
      }
      ticks.push(initialSync ? { ...playerFrame, initialSync: true } : playerFrame);
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
      ticks.push(initialSync ? { ...enemyFrame, initialSync: true } : enemyFrame);
    });
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

    this.sendToPlayer(player, {
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
    const input = this.latestRemoteInputs.get(tank.partyIndex);
    const receivedAt =
      this.latestRemoteInputReceivedAt.get(tank.partyIndex) ?? 0;
    if (
      input === undefined ||
      Date.now() - receivedAt > REMOTE_INPUT_TIMEOUT_MS
    ) {
      tank.idle(false);
      return;
    }

    const lastFireSeq =
      this.lastAppliedRemoteFireSeqs.get(tank.partyIndex) ?? 0;
    this.lastAppliedRemoteFireSeqs.set(
      tank.partyIndex,
      applyRemotePlayerInput(tank, input, deltaTime, lastFireSeq),
    );
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
    playerScores: [number, number],
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
      playerScores: playerScores.map((score) => {
        return Math.max(0, Math.floor(score));
      }) as [number, number],
      sharedElapsedSeconds: this.sharedElapsedSeconds,
      playerOneElapsedSeconds: this.playerElapsedSeconds.get(0) ?? 0,
      playerTwoElapsedSeconds: this.playerElapsedSeconds.get(1) ?? 0,
      players: players
        .filter((tank) => tank !== null && tank !== undefined)
        .map((tank) => this.createPlayerFrame(tank)),
      powerup,
      powerupPickup,
      activeEnemyIds,
      enemies: enemies.map((tank) => this.createEnemyFrame(tank)),
    };

    this.frameHistory.push(frame);
    this.frameHistoryBySeq.set(frame.seq, frame);
    this.broadcast(frame);
    this.pumpReplaySessions();
    this.pumpPendingActivations();
  }

  private pumpPendingActivations(): void {
    this.pendingActivations.forEach((appliedSeq, playerIndex) => {
      this.activatePlayer(playerIndex as 0 | 1, appliedSeq);
    });
  }

  private pumpReplaySessions(): void {
    this.replaySessions.forEach((session, playerIndex) => {
      let sent = 0;
      while (
        session.nextSeq <= session.targetSeq &&
        sent < REPLAY_FRAMES_PER_HOST_TICK
      ) {
        const frame = this.frameHistoryBySeq.get(session.nextSeq);
        if (frame === undefined) {
          this.sendToPlayer(playerIndex as 0 | 1, {
            type: 'webrtc-replay-unavailable',
            oldestAvailableSeq: this.frameHistory[0]?.seq ?? this.frameSeq + 1,
            serverSeq: this.frameSeq,
          } satisfies WebRtcReplayUnavailablePacket);
          this.replaySessions.delete(playerIndex);
          return;
        }
        if (!this.sendToPlayer(playerIndex as 0 | 1, frame)) {
          break;
        }
        session.nextSeq += 1;
        sent += 1;
      }
      if (session.nextSeq > session.targetSeq) {
        const completionSent = this.sendToPlayer(playerIndex as 0 | 1, {
          type: 'webrtc-replay-complete',
          targetSeq: session.targetSeq,
        } satisfies WebRtcReplayCompletePacket);
        if (completionSent) {
          this.replaySessions.delete(playerIndex);
        }
      }
    });
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
      tier: tank.type.tier,
      x: tank.position.x,
      y: tank.position.y,
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

    const fire = this.latestEnemyFire.get(tank.partyIndex);
    return {
      partyIndex: tank.partyIndex,
      x: tank.position.x,
      y: tank.position.y,
      rotation: tank.rotation,
      moving: tank.state === TankState.Moving,
      deltaX,
      deltaY,
      alive: tank.isAlive(),
      fireSeq: this.enemyFireSeqs.get(tank.partyIndex) ?? 0,
      fireX: fire?.x ?? tank.position.x,
      fireY: fire?.y ?? tank.position.y,
      fireRotation: fire?.rotation ?? tank.rotation,
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
            frame.initialSync && Number.isFinite(frame.x)
              ? frame.x - tank.position.x
              : Number.isFinite(frame.deltaX)
                ? frame.deltaX
                : 0,
            frame.initialSync && Number.isFinite(frame.y)
              ? frame.y - tank.position.y
              : Number.isFinite(frame.deltaY)
                ? frame.deltaY
                : 0,
          );

          const lastFireSeq =
            this.lastEnemyFireSeqs.get(frame.partyIndex) ?? 0;
          if (
            tank.collider.isInitialized() &&
            frame.fireSeq > lastFireSeq
          ) {
            this.lastEnemyFireSeqs.set(frame.partyIndex, frame.fireSeq);
            tank.fireFromNetwork(
              Number.isFinite(frame.fireX) ? frame.fireX : tank.position.x,
              Number.isFinite(frame.fireY) ? frame.fireY : tank.position.y,
              frame.fireRotation ?? frame.rotation,
            );
          }
        });
      if (ticks.length === 0) {
        this.pendingEnemyTicks.delete(partyIndex);
      }
    });
  }

  private applyReplayEnemyFrames(
    enemies: EnemyTank[],
    frames: WebRtcEnemyFrame[],
  ): void {
    frames.forEach((frame) => {
      const tank = enemies.find(
        (candidate) => candidate.partyIndex === frame.partyIndex,
      );
      if (tank === undefined) {
        return;
      }
      tank.setNetworkControlled(true);
      tank.applyNetworkMovement(
        frame.rotation,
        frame.moving,
        Number.isFinite(frame.deltaX) ? frame.deltaX : 0,
        Number.isFinite(frame.deltaY) ? frame.deltaY : 0,
      );
      const lastFireSeq = this.lastEnemyFireSeqs.get(frame.partyIndex) ?? 0;
      if (tank.collider.isInitialized() && frame.fireSeq > lastFireSeq) {
        this.lastEnemyFireSeqs.set(frame.partyIndex, frame.fireSeq);
        tank.fireFromNetwork(
          Number.isFinite(frame.fireX) ? frame.fireX : tank.position.x,
          Number.isFinite(frame.fireY) ? frame.fireY : tank.position.y,
          frame.fireRotation ?? frame.rotation,
        );
      }
    });
  }

  private applyPlayerFrames(players: PlayerTank[]): void {
    this.pendingPlayerTicks.forEach((ticks, partyIndex) => {
      const tank = players.find((candidate) => {
        return (
          candidate !== null &&
          candidate !== undefined &&
          candidate.partyIndex === partyIndex
        );
      });
      if (tank === undefined || ticks.length === 0) {
        return;
      }
      tank.setNetworkControlled(true);
      ticks.splice(0, MAX_PLAYER_TICKS_PER_UPDATE).forEach((frame) => {
        tank.setNetworkTier(frame.tier ?? TankTier.A);
        tank.applyNetworkMovement(
          frame.rotation,
          frame.moving,
          frame.initialSync && Number.isFinite(frame.x)
            ? frame.x - tank.position.x
            : Number.isFinite(frame.deltaX)
              ? frame.deltaX
              : 0,
          frame.initialSync && Number.isFinite(frame.y)
            ? frame.y - tank.position.y
            : Number.isFinite(frame.deltaY)
              ? frame.deltaY
              : 0,
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

  private applyReplayPlayerFrames(
    players: PlayerTank[],
    frames: WebRtcPlayerFrame[],
  ): void {
    frames.forEach((frame) => {
      const tank = players.find((candidate) => {
        return (
          candidate !== null &&
          candidate !== undefined &&
          candidate.partyIndex === frame.partyIndex
        );
      });
      if (tank === undefined) {
        return;
      }
      tank.setNetworkControlled(true);
      tank.setNetworkTier(frame.tier ?? TankTier.A);
      tank.applyNetworkMovement(
        frame.rotation,
        frame.moving,
        Number.isFinite(frame.deltaX) ? frame.deltaX : 0,
        Number.isFinite(frame.deltaY) ? frame.deltaY : 0,
      );
      const lastFireSeq = this.lastPlayerFireSeqs.get(frame.partyIndex) ?? 0;
      if (tank.collider.isInitialized() && frame.fireSeq > lastFireSeq) {
        this.lastPlayerFireSeqs.set(frame.partyIndex, frame.fireSeq);
        tank.fireFromNetwork(frame.fireX, frame.fireY, frame.fireRotation);
      }
    });
  }

  private observePlayers(players: PlayerTank[]): void {
    players.forEach((tank) => {
      if (tank === null || tank === undefined) {
        return;
      }
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
        this.latestEnemyFire.set(tank.partyIndex, {
          x: tank.position.x,
          y: tank.position.y,
          rotation: tank.rotation,
        });
        this.enemyFireSeqs.set(
          tank.partyIndex,
          (this.enemyFireSeqs.get(tank.partyIndex) ?? 0) + 1,
        );
      });
    });
  }

  private updateClock(): void {
    if (this.headlessBroadcaster) {
      return;
    }
    this.ensureClockElement();
    const playerOneElapsed = this.broadcaster
      ? this.playerElapsedSeconds.get(0) ?? 0
      : this.latestHostFrame?.playerOneElapsedSeconds ?? 0;
    const playerTwoElapsed = this.broadcaster
      ? this.playerElapsedSeconds.get(1) ?? 0
      : this.latestHostFrame?.playerTwoElapsedSeconds ?? 0;

    this.sharedClockValue.textContent = this.formatClock(
      this.sharedElapsedSeconds,
    );
    this.playerOneClockValue.textContent = this.formatClock(playerOneElapsed);
    this.playerTwoClockValue.textContent = this.formatClock(playerTwoElapsed);
    this.rttValue.textContent = this.formatMilliseconds(this.rttMs);
    this.jitterValue.textContent = this.formatMilliseconds(this.jitterMs);
  }

  private updateNetworkProbe(deltaTime: number): void {
    if (this.broadcaster) {
      return;
    }
    this.probeTimer += deltaTime;
    if (this.probeTimer < NETWORK_PROBE_INTERVAL_SECONDS) {
      return;
    }
    this.probeTimer = 0;
    this.probeSeq += 1;
    const linkId: WebRtcLinkId = this.observer
      ? observerLinkId(this.observerId)
      : (this.localPlayerIndex as 0 | 1);
    this.sendToLink(linkId, {
      type: 'webrtc-ping',
      id: this.probeSeq,
      sentAt: performance.now(),
      senderPlayerIndex: this.observer ? -1 : this.localPlayerIndex,
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
      top: '104px',
      zIndex: '1000',
      width: '176px',
      padding: '10px 12px',
      border: '1px solid var(--mb-accent, #55e6c1)',
      borderRadius: '6px',
      background: 'rgba(9, 19, 31, 0.78)',
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

  private createPlayerUrl(playerIndex: 0 | 1): string {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'webrtc');
    params.set('match', this.room);
    params.set('player', (playerIndex + 1).toString());
    params.delete('broadcaster');
    params.delete('join');
    params.delete('host');
    params.delete('observer');
    params.delete('headless');

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  private createObserverUrl(): string {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'webrtc');
    params.set('match', this.room);
    params.set('observer', '1');
    params.delete('broadcaster');
    params.delete('join');
    params.delete('host');
    params.delete('player');
    params.delete('observerId');
    params.delete('headless');

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  private showPlayerControls(): void {
    ([0, 1] as const).forEach((playerIndex) => {
      const url = this.createPlayerUrl(playerIndex);
      const button = this.ensureJoinButton(playerIndex);
      const label = `Copy WebRTC player-${playerIndex + 1} link`;
      button.type = 'button';
      button.textContent = label;
      button.onclick = async (): Promise<void> => {
        try {
          await navigator.clipboard.writeText(url);
          button.textContent = `WebRTC player-${playerIndex + 1} link copied`;
          window.setTimeout(() => {
            button.textContent = label;
          }, 2000);
        } catch {
          button.textContent = 'Copy failed - check DevTools';
        }
      };
      log(`player-${playerIndex + 1} link: ${url}`);
    });
    const observerUrl = this.createObserverUrl();
    const observerButton = this.ensureJoinButton('observer');
    const observerLabel = 'Copy WebRTC observer link';
    observerButton.type = 'button';
    observerButton.textContent = observerLabel;
    observerButton.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(observerUrl);
        observerButton.textContent = 'WebRTC observer link copied';
        window.setTimeout(() => {
          observerButton.textContent = observerLabel;
        }, 2000);
      } catch {
        observerButton.textContent = 'Copy failed - check DevTools';
      }
    };
    log(`observer link: ${observerUrl}`);
  }

  private showStatus(message: string): void {
    if (this.headlessBroadcaster) {
      log(message.replace(/\n/g, ' '));
      return;
    }
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
      bottom: this.broadcaster ? '184px' : '16px',
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

  private ensureJoinButton(
    linkId: 0 | 1 | 'observer',
  ): HTMLButtonElement {
    const buttonIndex = linkId === 'observer' ? 2 : linkId;
    const existing = this.joinButtons.get(buttonIndex);
    if (existing !== undefined) {
      return existing;
    }

    const button = document.createElement('button');
    button.className = 'webrtc-match-copy-link';
    button.setAttribute('aria-live', 'polite');
    Object.assign(button.style, {
      position: 'fixed',
      right: '16px',
      bottom: `${16 + (2 - buttonIndex) * 56}px`,
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
    this.joinButtons.set(buttonIndex, button);

    return button;
  }
}
