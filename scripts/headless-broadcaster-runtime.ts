import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RTCDataChannel, RTCPeerConnection } from 'werift';

import {
  SimulationClientPacket,
  SimulationClientReadyPacket,
  SimulationHostFramePacket,
  SimulationInputPacket,
  SimulationMapDto,
  SimulationPlayerIndex,
  SimulationReadyPacket,
  SimulationResumePacket,
  SimulationOptions,
  SimulationPowerupType,
  SimulationRunConsumables,
  SimulationTankTier,
} from '../shared/src';
import { EngineBattleCitySimulation } from './engine-battle-city-simulation';

const HOST = process.env.BROADCASTER_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.BROADCASTER_PORT || '7777', 10);
const API_URL = String(process.env.BROADCASTER_API_URL || 'http://127.0.0.1:3000');
const PUBLIC_URL = String(process.env.BROADCASTER_PUBLIC_URL || `http://${HOST}:${PORT}`);
const CLIENT_URL = String(process.env.BROADCASTER_CLIENT_URL || 'https://battlecities.com');
const SERVICE_TOKEN = String(process.env.BROADCASTER_SERVICE_TOKEN || '');
const FRAME_REPLAY_PER_TICK = 8;
const OBSERVER_DISCOVERY_MS = 2000;
const MAX_CATCH_UP_TICKS = 4;

type LinkId = SimulationPlayerIndex | `observer:${string}`;

interface SignalCode {
  type: 'battlecity-ghost-signal';
  version: 1;
  room: string;
  signalSessionId: string;
  createdAt: number;
  fromPlayerIndex: number;
  description: { type: 'offer' | 'answer'; sdp: string };
}

interface ReplaySession {
  nextSeq: number;
  targetSeq: number;
}

interface MatchStatus {
  id: string;
  level: number;
  status: 'running' | 'stopped';
  tick: number;
  frameSeq: number;
  connectedPlayers: number[];
  observerCount: number;
  matchStarted: boolean;
  startedAt: string;
  statusUrl: string;
  workerUrl: string;
}

class WebRtcPeerLink {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private signalSessionId = '';
  private lastAnswerId = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closed = false;

  public constructor(
    public readonly room: string,
    private readonly onPacket: (packet: SimulationClientPacket) => void,
    private readonly onConnection: (connected: boolean) => void,
  ) {}

  public start(): void {
    void this.startOfferCycle();
  }

  public send(packet: unknown): boolean {
    if (this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 1024 * 1024) return false;
    this.channel.send(JSON.stringify(packet));
    return true;
  }

  public isConnected(): boolean {
    return this.channel?.readyState === 'open';
  }

  public close(): void {
    this.closed = true;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.resetPeer();
  }

  private async startOfferCycle(): Promise<void> {
    if (this.closed) return;
    this.resetPeer();
    this.signalSessionId = `${this.room}-0-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.peer = peer;
    peer.connectionStateChange.subscribe((state) => {
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.onConnection(false);
        this.scheduleReconnect();
      }
    });
    const channel = peer.createDataChannel('battlecity-ghost', { ordered: true });
    this.attachChannel(channel);
    try {
      await peer.setLocalDescription(await peer.createOffer());
      if (peer.localDescription === undefined) throw new Error('WebRTC offer is missing');
      const code = encodeSignal({
        type: 'battlecity-ghost-signal',
        version: 1,
        room: this.room,
        signalSessionId: this.signalSessionId,
        createdAt: Date.now(),
        fromPlayerIndex: 0,
        description: {
          type: peer.localDescription.type as 'offer',
          sdp: peer.localDescription.sdp,
        },
      });
      await publishSignal(this.room, 0, 'offer', code);
      this.schedulePoll(0);
    } catch (error) {
      console.error(`[broadcaster] offer failed for ${this.room}`, error);
      this.scheduleReconnect();
    }
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.onConnection(true);
    channel.onclose = () => {
      this.onConnection(false);
      this.scheduleReconnect();
    };
    channel.onMessage.subscribe((message) => {
      try {
        const text = Buffer.isBuffer(message) ? message.toString('utf8') : message;
        const packet = JSON.parse(text) as SimulationClientPacket;
        if (packet !== null && typeof packet === 'object' && typeof packet.type === 'string') {
          this.onPacket(packet);
        }
      } catch (error) {
        console.warn(`[broadcaster] invalid packet in ${this.room}`, error);
      }
    });
  }

  private schedulePoll(delay = 750): void {
    if (this.closed || this.isConnected()) return;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.pollAnswer(), delay);
  }

  private async pollAnswer(): Promise<void> {
    if (this.closed || this.isConnected()) return;
    try {
      const record = await readSignal(this.room, 1, 'answer', this.lastAnswerId);
      if (record !== null) {
        this.lastAnswerId = record.id;
        const answer = decodeSignal(record.code);
        if (
          answer.room === this.room &&
          answer.signalSessionId === this.signalSessionId &&
          answer.description.type === 'answer'
        ) await this.peer?.setRemoteDescription(answer.description);
      }
    } catch (error) {
      console.warn(`[broadcaster] answer poll failed for ${this.room}`, error);
    } finally {
      this.schedulePoll();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.startOfferCycle();
    }, 1200);
  }

  private resetPeer(): void {
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.channel?.close();
    this.peer?.close();
    this.channel = null;
    this.peer = null;
  }
}

class MatchRuntime {
  private readonly simulation: EngineBattleCitySimulation;
  private readonly links = new Map<LinkId, WebRtcPeerLink>();
  private readonly connectedPlayers = new Set<SimulationPlayerIndex>();
  private readonly connectedObservers = new Set<`observer:${string}`>();
  private readonly activePlayers = new Set<SimulationPlayerIndex>();
  private readonly syncingPlayers = new Set<SimulationPlayerIndex>();
  private readonly frameHistory: SimulationHostFramePacket[] = [];
  private readonly frameBySeq = new Map<number, SimulationHostFramePacket>();
  private readonly replaySessions = new Map<SimulationPlayerIndex, ReplaySession>();
  private readonly startedAt = new Date();
  private readonly tickIntervalMs: number;
  private tickTimer: NodeJS.Timeout;
  private observerTimer: NodeJS.Timeout;
  private nextTickAt: number;
  private matchStarted = false;
  private stopped = false;
  private resultSubmissionStarted = false;

  public constructor(
    public readonly id: string,
    public readonly level: number,
    simulationOptions: Pick<
      SimulationOptions,
      | 'extraLives'
      | 'initialPlayerTiers'
      | 'playerRunConsumables'
      | 'runBoosts'
    > = {},
  ) {
    this.simulation = new EngineBattleCitySimulation(loadMap(level), {
      ...simulationOptions,
      seed: seedFromMatchId(id),
      level,
      disableEnemyShooting: process.env.BROADCASTER_DISABLE_ENEMY_SHOOTING === '1',
    });
    this.configureLink(0, `${id}-p1`);
    this.configureLink(1, `${id}-p2`);
    this.tickIntervalMs = 1000 / this.simulation.tickRate;
    this.nextTickAt = performance.now() + this.tickIntervalMs;
    this.tickTimer = setTimeout(() => this.runTickLoop(), this.tickIntervalMs);
    this.observerTimer = setInterval(() => void this.discoverObservers(), OBSERVER_DISCOVERY_MS);
    void this.discoverObservers();
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.tickTimer);
    clearInterval(this.observerTimer);
    this.links.forEach((link) => link.close());
    this.links.clear();
  }

  public status(): MatchStatus {
    const statusUrl = new URL(`/matches/${this.id}`, PUBLIC_URL).toString();
    return {
      id: this.id,
      level: this.level,
      status: this.stopped ? 'stopped' : 'running',
      tick: this.simulation.tick,
      frameSeq: this.simulation.seq,
      connectedPlayers: Array.from(this.connectedPlayers.values()),
      observerCount: this.connectedObservers.size,
      matchStarted: this.matchStarted,
      startedAt: this.startedAt.toISOString(),
      statusUrl,
      workerUrl: statusUrl,
    };
  }

  private tick(): void {
    if (this.stopped || !this.matchStarted) return;
    const frame = this.simulation.step();
    this.frameHistory.push(frame);
    this.frameBySeq.set(frame.seq, frame);
    this.broadcast(frame);
    this.pumpReplays();
    const hitStopSeconds = this.simulation.consumeHitStopSeconds();
    if (hitStopSeconds > 0) {
      this.nextTickAt =
        Math.max(this.nextTickAt, performance.now()) +
        hitStopSeconds * 1000;
    }
    if (this.simulation.isComplete() && !this.resultSubmissionStarted) {
      this.resultSubmissionStarted = true;
      void this.submitResult();
    }
  }

  private runTickLoop(): void {
    if (this.stopped) return;
    const now = performance.now();
    let ticks = 0;
    while (now >= this.nextTickAt && ticks < MAX_CATCH_UP_TICKS) {
      this.tick();
      this.nextTickAt += this.tickIntervalMs;
      ticks += 1;
    }
    const delay = Math.max(0, this.nextTickAt - performance.now());
    this.tickTimer = setTimeout(() => this.runTickLoop(), delay);
  }

  private configureLink(linkId: LinkId, room: string): void {
    if (this.links.has(linkId)) return;
    const link = new WebRtcPeerLink(
      room,
      (packet) => this.acceptPacket(linkId, packet),
      (connected) => this.handleConnection(linkId, connected),
    );
    this.links.set(linkId, link);
    link.start();
  }

  private handleConnection(linkId: LinkId, connected: boolean): void {
    if (isObserver(linkId)) {
      if (connected) {
        this.connectedObservers.add(linkId);
        this.send(linkId, this.readyPacket(null));
        const latest = this.frameHistory[this.frameHistory.length - 1];
        if (latest !== undefined) this.send(linkId, latest);
      } else {
        this.connectedObservers.delete(linkId);
      }
      return;
    }
    const wasConnected = this.connectedPlayers.has(linkId);
    const reconnecting = this.matchStarted && connected;
    if (connected) {
      this.connectedPlayers.add(linkId);
      if (!this.matchStarted) this.activePlayers.add(linkId);
      else {
        this.activePlayers.delete(linkId);
        this.syncingPlayers.add(linkId);
      }
    } else {
      this.connectedPlayers.delete(linkId);
      this.activePlayers.delete(linkId);
      this.replaySessions.delete(linkId);
      if (this.matchStarted) this.syncingPlayers.add(linkId);
    }
    if (connected && !wasConnected) {
      console.log(
        `[broadcaster] player connected match=${this.id} slot=${linkId + 1}` +
        ` connection=${reconnecting ? 'reconnect' : 'initial'}` +
        ` players=${this.connectedPlayers.size}/2 tick=${this.simulation.tick}`,
      );
    } else if (!connected && wasConnected) {
      console.log(
        `[broadcaster] player disconnected match=${this.id} slot=${linkId + 1}` +
        ` players=${this.connectedPlayers.size}/2 tick=${this.simulation.tick}`,
      );
    }
    if (!this.matchStarted && this.connectedPlayers.size === 2) {
      this.matchStarted = true;
      this.activePlayers.add(0);
      this.activePlayers.add(1);
      this.syncingPlayers.clear();
      console.log(
        `[broadcaster] match started match=${this.id}` +
        ` players=2/2 tick=${this.simulation.tick}`,
      );
    }
    this.broadcast(this.readyPacket(reconnecting ? linkId : null));
  }

  private acceptPacket(linkId: LinkId, packet: SimulationClientPacket): void {
    if (packet.type === 'webrtc-ping') {
      if (Number.isFinite(packet.id) && Number.isFinite(packet.sentAt)) {
        this.send(linkId, { type: 'webrtc-pong', id: packet.id, sentAt: packet.sentAt, senderPlayerIndex: -1 });
      }
      return;
    }
    if (isObserver(linkId)) return;
    if (packet.type === 'webrtc-input') {
      if (this.activePlayers.has(linkId) && packet.player === linkId) {
        this.simulation.acceptInput(packet as SimulationInputPacket);
      }
      return;
    }
    if (packet.type === 'webrtc-resume') this.handleResume(linkId, packet as SimulationResumePacket);
    else if (packet.type === 'webrtc-client-ready') {
      this.handleClientReady(linkId, packet as SimulationClientReadyPacket);
    }
  }

  private handleResume(player: SimulationPlayerIndex, packet: SimulationResumePacket): void {
    if (
      packet.player !== player || !this.connectedPlayers.has(player) ||
      !Number.isInteger(packet.lastAppliedFrameSeq) || packet.lastAppliedFrameSeq < 0 ||
      packet.lastAppliedFrameSeq > this.simulation.seq
    ) return;
    if (this.activePlayers.has(player)) {
      this.send(player, { type: 'webrtc-replay-ready', appliedSeq: packet.lastAppliedFrameSeq });
      return;
    }
    if (packet.lastAppliedFrameSeq === this.simulation.seq) {
      this.activatePlayer(player, packet.lastAppliedFrameSeq);
      return;
    }
    this.replaySessions.set(player, {
      nextSeq: packet.lastAppliedFrameSeq + 1,
      targetSeq: this.simulation.seq,
    });
    this.send(player, {
      type: 'webrtc-replay-start',
      fromSeq: packet.lastAppliedFrameSeq + 1,
      targetSeq: this.simulation.seq,
    });
  }

  private handleClientReady(player: SimulationPlayerIndex, packet: SimulationClientReadyPacket): void {
    if (
      packet.player !== player || !this.syncingPlayers.has(player) ||
      !Number.isInteger(packet.appliedSeq) || packet.appliedSeq < 0 ||
      packet.appliedSeq > this.simulation.seq
    ) return;
    if (this.simulation.seq - packet.appliedSeq <= 2) {
      this.activatePlayer(player, packet.appliedSeq);
      return;
    }
    this.replaySessions.set(player, { nextSeq: packet.appliedSeq + 1, targetSeq: this.simulation.seq });
    this.send(player, {
      type: 'webrtc-replay-start',
      fromSeq: packet.appliedSeq + 1,
      targetSeq: this.simulation.seq,
    });
  }

  private activatePlayer(player: SimulationPlayerIndex, appliedSeq: number): void {
    if (!this.send(player, { type: 'webrtc-replay-ready', appliedSeq })) return;
    this.syncingPlayers.delete(player);
    this.replaySessions.delete(player);
    this.activePlayers.add(player);
    console.log(
      `[broadcaster] player active match=${this.id} slot=${player + 1}` +
      ` appliedSeq=${appliedSeq} serverSeq=${this.simulation.seq}`,
    );
  }

  private pumpReplays(): void {
    this.replaySessions.forEach((session, player) => {
      let sent = 0;
      while (session.nextSeq <= session.targetSeq && sent < FRAME_REPLAY_PER_TICK) {
        const frame = this.frameBySeq.get(session.nextSeq);
        if (frame === undefined || !this.send(player, frame)) break;
        session.nextSeq += 1;
        sent += 1;
      }
      if (session.nextSeq > session.targetSeq && this.send(player, {
        type: 'webrtc-replay-complete',
        targetSeq: session.targetSeq,
      })) this.replaySessions.delete(player);
    });
  }

  private readyPacket(syncPlayer: SimulationPlayerIndex | null): SimulationReadyPacket {
    return {
      type: 'webrtc-ready',
      ready: this.matchStarted,
      syncPlayer,
      serverFrameSeq: this.simulation.seq,
    };
  }

  private send(linkId: LinkId, packet: unknown): boolean {
    return this.links.get(linkId)?.send(packet) ?? false;
  }

  private broadcast(packet: unknown): void {
    this.links.forEach((link) => link.send(packet));
  }

  private async discoverObservers(): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await apiFetch(`/api/webrtc/matches/${encodeURIComponent(this.id)}/observers`);
      if (!response.ok) return;
      const body = await response.json() as { observers?: string[] };
      const observerIds = body.observers ?? [];
      const activeObserverIds = new Set(observerIds);
      for (const observerId of observerIds) {
        if (/^[a-z0-9]{8}$/.test(observerId)) {
          this.configureLink(`observer:${observerId}`, `${this.id}-o-${observerId}`);
        }
      }
      Array.from(this.links.keys()).filter(isObserver).forEach((linkId) => {
        const observerId = linkId.slice('observer:'.length);
        if (!activeObserverIds.has(observerId)) {
          this.links.get(linkId)?.close();
          this.links.delete(linkId);
          this.connectedObservers.delete(linkId);
        }
      });
    } catch (error) {
      console.warn(`[broadcaster] observer discovery failed for ${this.id}`, error);
    }
  }

  private async submitResult(): Promise<void> {
    try {
      const response = await apiFetch(
        `/api/multiplayer/matches/${encodeURIComponent(this.id)}/result`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            scores: this.simulation.getScores().map((score, playerSlot) => ({
              playerSlot,
              score,
            })),
          }),
        },
      );
      if (!response.ok) throw new Error(`result submission failed (${response.status})`);
    } catch (error) {
      this.resultSubmissionStarted = false;
      console.error(`[broadcaster] result submission failed for ${this.id}`, error);
    }
  }
}

const matches = new Map<string, MatchRuntime>();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || HOST}`);
  try {
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/monitor')) {
      html(response, monitorHtml());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/monitor/config') {
      json(response, 200, { clientUrl: CLIENT_URL, refreshMs: 2000 });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, { ok: true, activeMatches: matches.size, runtime: 'typescript-node' });
      return;
    }
    if (!authorized(request)) {
      json(response, 401, { error: 'Unauthorized.' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/matches') {
      json(response, 200, { matches: Array.from(matches.values()).map((match) => match.status()) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/matches') {
      const body = await readJson(request);
      const matchId = normalizeMatchId(body.matchId) || randomBytes(4).toString('hex');
      const level = Math.max(1, Math.min(35, Number.parseInt(String(body.level), 10) || 1));
      if (matches.has(matchId)) {
        json(response, 409, { error: 'Match is already running.', ...matches.get(matchId)!.status() });
        return;
      }
      const match = new MatchRuntime(
        matchId,
        level,
        parseSimulationOptions(body),
      );
      matches.set(matchId, match);
      json(response, 201, match.status());
      return;
    }
    const route = url.pathname.match(/^\/matches\/([a-z0-9-]+)$/);
    if (route !== null) {
      const match = matches.get(route[1]);
      if (match === undefined) {
        json(response, 404, { error: 'Match not found.' });
        return;
      }
      if (request.method === 'GET') {
        json(response, 200, match.status());
        return;
      }
      if (request.method === 'DELETE') {
        match.stop();
        matches.delete(route[1]);
        json(response, 202, match.status());
        return;
      }
    }
    json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    json(response, 500, { error: error instanceof Error ? error.message : 'Internal server error.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[broadcaster] pure Node runtime listening at http://${HOST}:${PORT}`);
});

function shutdown(): void {
  matches.forEach((match) => match.stop());
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function publishSignal(room: string, player: number, kind: 'offer' | 'answer', code: string): Promise<void> {
  const response = await apiFetch(
    `/api/webrtc/matches/${encodeURIComponent(room)}/players/${player}/signals/${kind}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) },
  );
  if (!response.ok) throw new Error(`signal publish failed (${response.status})`);
}

async function readSignal(
  room: string,
  player: number,
  kind: 'offer' | 'answer',
  after: number,
): Promise<{ id: number; code: string } | null> {
  const response = await apiFetch(
    `/api/webrtc/matches/${encodeURIComponent(room)}/players/${player}/signals/${kind}?after=${after}`,
  );
  if (!response.ok) throw new Error(`signal read failed (${response.status})`);
  const body = await response.json() as { signal?: { id: number; code: string } | null };
  return body.signal ?? null;
}

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(new URL(path, API_URL), {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${SERVICE_TOKEN}`, accept: 'application/json' },
  });
}

function encodeSignal(signal: SignalCode): string {
  return Buffer.from(JSON.stringify(signal), 'utf8').toString('base64');
}

function decodeSignal(code: string): SignalCode {
  const signal = JSON.parse(Buffer.from(code.trim(), 'base64').toString('utf8')) as SignalCode;
  if (signal.type !== 'battlecity-ghost-signal' || signal.version !== 1) {
    throw new Error('Unsupported WebRTC signal code');
  }
  return signal;
}

function loadMap(level: number): SimulationMapDto {
  const file = resolve(process.cwd(), 'data', 'maps', 'original', `${String(level).padStart(2, '0')}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as SimulationMapDto;
}

function seedFromMatchId(matchId: string): number {
  return createHash('sha256').update(matchId).digest().readUInt32LE(0);
}

function normalizeMatchId(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

function parseSimulationOptions(
  body: Record<string, unknown>,
): Pick<
  SimulationOptions,
  | 'extraLives'
  | 'initialPlayerTiers'
  | 'playerRunConsumables'
  | 'runBoosts'
> {
  const options: Pick<
    SimulationOptions,
    | 'extraLives'
    | 'initialPlayerTiers'
    | 'playerRunConsumables'
    | 'runBoosts'
  > = {};
  const extraLives = Number(body.extraLives);
  if (Number.isFinite(extraLives)) {
    options.extraLives = Math.max(0, Math.min(20, Math.floor(extraLives)));
  }

  if (
    Array.isArray(body.initialPlayerTiers) &&
    body.initialPlayerTiers.length === 2 &&
    body.initialPlayerTiers.every(isTankTier)
  ) {
    options.initialPlayerTiers = body.initialPlayerTiers as [
      SimulationTankTier,
      SimulationTankTier,
    ];
  }

  if (
    body.runBoosts !== null &&
    typeof body.runBoosts === 'object' &&
    !Array.isArray(body.runBoosts)
  ) {
    const boosts = body.runBoosts as Record<string, unknown>;
    options.runBoosts = {
      hull: finiteNumber(boosts.hull),
      armor: finiteNumber(boosts.armor),
      engine: finiteNumber(boosts.engine),
      salvage: finiteNumber(boosts.salvage),
    };
  }

  if (
    Array.isArray(body.playerRunConsumables) &&
    body.playerRunConsumables.length === 2
  ) {
    const consumables = body.playerRunConsumables.map(
      parseRunConsumables,
    );
    if (consumables.every((value) => value !== null)) {
      options.playerRunConsumables = consumables as [
        SimulationRunConsumables,
        SimulationRunConsumables,
      ];
    }
  }
  return options;
}

function parseRunConsumables(value: unknown): SimulationRunConsumables | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  if (
    !Array.isArray(source.powerups) ||
    source.powerups.length > 4 ||
    !source.powerups.every(isPowerupType)
  ) {
    return null;
  }
  const rawCounts = Array.isArray(source.powerupCounts)
    ? source.powerupCounts
    : [];
  return {
    powerups: source.powerups as SimulationPowerupType[],
    powerupCounts: source.powerups.map((_, index) => {
      const count = Number(rawCounts[index] ?? 1);
      return Number.isFinite(count)
        ? Math.max(0, Math.min(99, Math.floor(count)))
        : 1;
    }),
  };
}

function isPowerupType(value: unknown): value is SimulationPowerupType {
  return (
    value === 'defence' ||
    value === 'freeze' ||
    value === 'life' ||
    value === 'shield' ||
    value === 'speed' ||
    value === 'upgrade' ||
    value === 'zoomout' ||
    value === 'wipeout'
  );
}

function isTankTier(value: unknown): value is SimulationTankTier {
  return value === 'a' || value === 'b' || value === 'c' || value === 'd';
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isObserver(linkId: LinkId): linkId is `observer:${string}` {
  return typeof linkId === 'string';
}

function authorized(request: IncomingMessage): boolean {
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (SERVICE_TOKEN === '' || supplied === '') return false;
  const left = Buffer.from(SERVICE_TOKEN, 'utf8');
  const right = Buffer.from(supplied, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
  });
  response.end(data);
}

function html(response: ServerResponse, body: string): void {
  const data = Buffer.from(body);
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(data);
}

function monitorHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Battle Cities Broadcaster Monitor</title>
  <style>
    :root {
      color-scheme: dark;
      --background: #090b0d;
      --surface: #111519;
      --surface-raised: #171c21;
      --border: #303840;
      --text: #f4f7f9;
      --muted: #aab4bd;
      --accent: #54e0c1;
      --accent-strong: #21b997;
      --success: #62df56;
      --warning: #ffc247;
      --danger: #ff6b6b;
      --focus: #8cf1dc;
      --radius: 6px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      min-height: 100vh;
      background: var(--background);
      color: var(--text);
      letter-spacing: 0;
    }
    button, input { font: inherit; letter-spacing: 0; }
    button, a {
      min-height: 40px;
      border-radius: var(--radius);
    }
    button:focus-visible, a:focus-visible, input:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .topbar {
      min-height: 72px;
      border-bottom: 1px solid var(--border);
      background: #0d1013;
    }
    .topbar-inner, main {
      width: min(100%, 1440px);
      margin: 0 auto;
      padding-inline: 24px;
    }
    .topbar-inner {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .brand { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
    h1 { margin: 0; font-size: 21px; line-height: 1.2; font-weight: 760; }
    .brand-label { color: var(--accent); font: 700 12px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; }
    .service-state { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; white-space: nowrap; }
    .state-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--warning); }
    .state-dot.online { background: var(--success); }
    main { padding-block: 24px 40px; }
    .toolbar {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .summary { display: flex; align-items: baseline; gap: 10px; }
    .summary strong { font-size: 24px; font-variant-numeric: tabular-nums; }
    .summary span { color: var(--muted); font-size: 13px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      padding: 0 14px;
      background: var(--surface-raised);
      color: var(--text);
      cursor: pointer;
      font-weight: 680;
    }
    .button:hover { border-color: var(--accent); }
    .button.primary { border-color: var(--accent-strong); background: var(--accent-strong); color: #05110e; }
    .button[disabled] { cursor: wait; opacity: .65; }
    .table-shell { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
    table { width: 100%; min-width: 900px; border-collapse: collapse; background: var(--surface); }
    th, td { height: 58px; padding: 0 16px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
    th { height: 44px; background: #0e1215; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:hover { background: var(--surface-raised); }
    .match-id { font: 700 13px/1 ui-monospace, SFMono-Regular, Consolas, monospace; color: var(--accent); }
    .number { font-variant-numeric: tabular-nums; }
    .status { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; }
    .status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--warning); }
    .status.live::before { background: var(--success); }
    .view-button { min-width: 72px; }
    .state-panel {
      min-height: 220px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--muted);
      text-align: center;
      padding: 32px;
    }
    .state-panel strong { display: block; color: var(--text); margin-bottom: 6px; }
    .skeleton { width: min(520px, 80%); height: 14px; border-radius: 3px; background: var(--surface-raised); }
    .skeleton + .skeleton { width: min(380px, 65%); margin-top: 12px; }
    @media (prefers-reduced-motion: no-preference) {
      .skeleton { animation: pulse 1.2s ease-in-out infinite alternate; }
      @keyframes pulse { to { opacity: .45; } }
    }
    .auth {
      width: min(440px, calc(100% - 32px));
      margin: 12vh auto 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 24px;
    }
    .auth h2 { margin: 0 0 20px; font-size: 18px; }
    .field { display: grid; gap: 6px; margin-bottom: 16px; }
    label { color: var(--muted); font-size: 13px; font-weight: 650; }
    input {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--background);
      color: var(--text);
      padding: 0 12px;
    }
    .auth .button { width: 100%; }
    .form-error { min-height: 20px; color: var(--danger); font-size: 13px; margin: 8px 0; }
    .viewer { margin-top: 24px; border-top: 1px solid var(--border); padding-top: 20px; }
    .viewer-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .viewer-title { min-width: 0; }
    .viewer-title h2 { margin: 0; font-size: 16px; }
    .viewer-title span { display: block; margin-top: 4px; color: var(--muted); font: 12px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; }
    .viewer-actions { display: flex; gap: 8px; }
    .viewer-frame {
      display: block;
      width: 100%;
      min-height: 560px;
      aspect-ratio: 16 / 10;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #000;
    }
    [hidden] { display: none !important; }
    @media (max-width: 640px) {
      .topbar-inner, main { padding-inline: 16px; }
      .brand { display: block; }
      .brand-label { display: block; margin-top: 4px; }
      .toolbar, .viewer-header { align-items: stretch; flex-direction: column; }
      .viewer-actions { width: 100%; }
      .viewer-actions .button { flex: 1; }
      .viewer-frame { min-height: 420px; aspect-ratio: auto; }
    }
  </style>
</head>
<body>
  <section id="auth" class="auth" aria-labelledby="auth-title">
    <h2 id="auth-title">Broadcaster access</h2>
    <form id="auth-form">
      <div class="field">
        <label for="service-token">Service token</label>
        <input id="service-token" name="service-token" type="password" autocomplete="current-password" required>
      </div>
      <p id="auth-error" class="form-error" role="alert"></p>
      <button class="button primary" type="submit">Open monitor</button>
    </form>
  </section>

  <div id="monitor" hidden>
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand"><h1>Battle Cities</h1><span class="brand-label">Broadcaster Monitor</span></div>
        <div class="service-state"><span id="service-dot" class="state-dot"></span><span id="service-label">Connecting</span></div>
      </div>
    </header>
    <main>
      <div class="toolbar">
        <div class="summary"><strong id="match-count">0</strong><span>active matches</span></div>
        <button id="refresh" class="button" type="button">Refresh</button>
      </div>
      <div id="loading" class="state-panel" aria-live="polite">
        <div><div class="skeleton"></div><div class="skeleton"></div></div>
      </div>
      <div id="error" class="state-panel" hidden>
        <div><strong>Could not load matches</strong><span id="error-message">Check the service connection and retry.</span><br><br><button id="retry" class="button" type="button">Retry</button></div>
      </div>
      <div id="empty" class="state-panel" hidden><div><strong>No active matches</strong>The next match will appear here automatically.</div></div>
      <div id="matches" class="table-shell" hidden>
        <table>
          <thead><tr><th>Match</th><th>State</th><th>Level</th><th>Players</th><th>Observers</th><th>Tick</th><th>Started</th><th></th></tr></thead>
          <tbody id="match-rows"></tbody>
        </table>
      </div>
      <section id="viewer" class="viewer" hidden aria-labelledby="viewer-heading">
        <div class="viewer-header">
          <div class="viewer-title"><h2 id="viewer-heading">Observer</h2><span id="viewer-match"></span></div>
          <div class="viewer-actions">
            <a id="open-observer" class="button" target="_blank" rel="noopener noreferrer">Open</a>
            <button id="close-viewer" class="button" type="button">Close</button>
          </div>
        </div>
        <iframe id="observer-frame" class="viewer-frame" title="Battle Cities match observer" allow="fullscreen"></iframe>
      </section>
    </main>
  </div>

  <script>
    (function () {
      var token = sessionStorage.getItem('battlecities-broadcaster-token') || '';
      var config = { clientUrl: 'https://battlecities.com', refreshMs: 2000 };
      var refreshTimer = null;
      var loadingRequest = false;
      var auth = document.getElementById('auth');
      var monitor = document.getElementById('monitor');
      var form = document.getElementById('auth-form');
      var tokenInput = document.getElementById('service-token');
      var authError = document.getElementById('auth-error');
      var loading = document.getElementById('loading');
      var error = document.getElementById('error');
      var empty = document.getElementById('empty');
      var matches = document.getElementById('matches');
      var rows = document.getElementById('match-rows');
      var refresh = document.getElementById('refresh');
      var viewer = document.getElementById('viewer');
      var observerFrame = document.getElementById('observer-frame');

      fetch('/monitor/config').then(function (response) { return response.json(); }).then(function (value) { config = value; });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        token = tokenInput.value.trim();
        authError.textContent = '';
        loadMatches(true);
      });
      refresh.addEventListener('click', function () { loadMatches(false); });
      document.getElementById('retry').addEventListener('click', function () { loadMatches(false); });
      document.getElementById('close-viewer').addEventListener('click', closeViewer);

      function loadMatches(authenticating) {
        if (!token || loadingRequest) return;
        loadingRequest = true;
        refresh.disabled = true;
        if (!matches.hidden || !empty.hidden || !error.hidden) loading.hidden = true;
        else loading.hidden = false;
        fetch('/matches', { headers: { authorization: 'Bearer ' + token, accept: 'application/json' } })
          .then(function (response) {
            if (response.status === 401) throw new Error('AUTH');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function (body) {
            sessionStorage.setItem('battlecities-broadcaster-token', token);
            auth.hidden = true;
            monitor.hidden = false;
            setServiceState(true);
            renderMatches(body.matches || []);
            scheduleRefresh();
          })
          .catch(function (failure) {
            setServiceState(false);
            if (failure.message === 'AUTH') {
              sessionStorage.removeItem('battlecities-broadcaster-token');
              auth.hidden = false;
              monitor.hidden = true;
              authError.textContent = 'The service token was rejected.';
              tokenInput.focus();
            } else if (!authenticating) {
              showState('error');
              document.getElementById('error-message').textContent = 'The broadcaster did not respond. Retry in a moment.';
              scheduleRefresh();
            } else {
              authError.textContent = 'The broadcaster did not respond.';
            }
          })
          .finally(function () {
            loadingRequest = false;
            refresh.disabled = false;
          });
      }

      function renderMatches(list) {
        document.getElementById('match-count').textContent = String(list.length);
        rows.replaceChildren();
        if (list.length === 0) {
          showState('empty');
          return;
        }
        list.forEach(function (match) {
          var row = document.createElement('tr');
          appendCell(row, match.id, 'match-id');
          var state = document.createElement('td');
          var status = document.createElement('span');
          status.className = 'status' + (match.matchStarted ? ' live' : '');
          status.textContent = match.matchStarted ? 'Live' : 'Waiting';
          state.appendChild(status);
          row.appendChild(state);
          appendCell(row, String(match.level), 'number');
          appendCell(row, String(match.connectedPlayers.length) + ' / 2', 'number');
          appendCell(row, String(match.observerCount), 'number');
          appendCell(row, formatNumber(match.tick), 'number');
          appendCell(row, formatTime(match.startedAt), 'number');
          var actionCell = document.createElement('td');
          var button = document.createElement('button');
          button.className = 'button primary view-button';
          button.type = 'button';
          button.textContent = 'View';
          button.addEventListener('click', function () { viewMatch(match); });
          actionCell.appendChild(button);
          row.appendChild(actionCell);
          rows.appendChild(row);
        });
        showState('matches');
      }

      function appendCell(row, value, className) {
        var cell = document.createElement('td');
        cell.textContent = value;
        if (className) cell.className = className;
        row.appendChild(cell);
      }

      function viewMatch(match) {
        var observerUrl = new URL(config.clientUrl);
        observerUrl.searchParams.set('mode', 'webrtc');
        observerUrl.searchParams.set('observer', '1');
        observerUrl.searchParams.set('match', match.id);
        observerUrl.searchParams.set('level', String(match.level));
        document.getElementById('viewer-match').textContent = match.id;
        document.getElementById('open-observer').href = observerUrl.toString();
        observerFrame.src = observerUrl.toString();
        viewer.hidden = false;
        viewer.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }

      function closeViewer() {
        viewer.hidden = true;
        observerFrame.src = 'about:blank';
      }

      function showState(name) {
        loading.hidden = name !== 'loading';
        error.hidden = name !== 'error';
        empty.hidden = name !== 'empty';
        matches.hidden = name !== 'matches';
      }

      function setServiceState(online) {
        document.getElementById('service-dot').className = 'state-dot' + (online ? ' online' : '');
        document.getElementById('service-label').textContent = online ? 'Service online' : 'Connection lost';
      }

      function formatNumber(value) { return Number(value || 0).toLocaleString(); }
      function formatTime(value) {
        var date = new Date(value);
        return Number.isNaN(date.getTime()) ? '--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      function scheduleRefresh() {
        if (refreshTimer !== null) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () { loadMatches(false); }, Math.max(1000, Number(config.refreshMs) || 2000));
      }

      if (token) {
        tokenInput.value = token;
        loadMatches(true);
      } else {
        tokenInput.focus();
      }
    }());
  </script>
</body>
</html>`;
}
