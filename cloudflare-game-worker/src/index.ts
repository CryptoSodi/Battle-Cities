import { DurableObject } from 'cloudflare:workers';
import {
  EngineBattleCitySimulation,
  EngineSimulationRunState,
} from '../../scripts/engine-battle-city-simulation';
import type {
  SimulationClientPacket,
  SimulationHostFramePacket,
  SimulationInputPacket,
  SimulationOptions,
  SimulationPlayerIndex,
  SimulationRunConsumables,
  SimulationTankTier,
} from '../../shared/src/simulationProtocol';
import { getMap } from './maps';
import { latencyPage } from './latency-page';

interface SecretBindings {
  BROADCASTER_SERVICE_TOKEN: string;
  WEBSOCKET_TICKET_SECRET: string;
}

type WorkerEnv = Cloudflare.Env & SecretBindings;

interface MatchStartRequest extends Partial<SimulationOptions> {
  matchId: string;
  level: number;
  category?: string;
}

interface TicketPayload {
  matchId: string;
  playerSlot: SimulationPlayerIndex;
  expiresAt: number;
  nonce: string;
}

interface ObserverTicketPayload {
  matchId: string;
  observerId: string;
}

const MATCH_ROUTE = /^\/matches\/(match-[0-9a-z-]+)$/i;
const PLAYER_ROUTE = /^\/matches\/(match-[0-9a-z-]+)\/players\/([01])$/i;
const PLAYER_CONFIG_ROUTE = /^\/matches\/(match-[0-9a-z-]+)\/players\/([12])$/i;
const OBSERVER_ROUTE = /^\/matches\/(match-[0-9a-z-]+)\/observers\/([a-z0-9]{8})$/i;
const MAX_FRAME_HISTORY = 60 * 60;
const ARCHIVE_BATCH_FRAMES = 30;

export class BattleCityMatch extends DurableObject<WorkerEnv> {
  private simulation: EngineBattleCitySimulation | null = null;
  private matchId = '';
  private level = 1;
  private startedAt = 0;
  private matchStarted = false;
  private resultSubmitted = false;
  private stopped = false;
  private timer: number | null = null;
  private nextTickAt = 0;
  private readonly sockets = new Map<SimulationPlayerIndex, WebSocket>();
  private readonly activePlayers = new Set<SimulationPlayerIndex>();
  private readonly spectatorSockets = new Map<string, WebSocket>();
  private readonly frameHistory: SimulationHostFramePacket[] = [];
  private readonly pendingArchiveFrames: SimulationHostFramePacket[] = [];
  private archiveStartPromise: Promise<void> | null = null;
  private archiveFlushPromise: Promise<void> | null = null;
  private archiveStarted = false;
  private archiveCompleted = false;
  private archiveDisabled = false;
  private archivedThroughSeq = 0;
  private category = 'live';
  private simulationOptions: Partial<SimulationOptions> = {};
  private pendingRunState: EngineSimulationRunState | null = null;
  private readonly stageReadyPlayers = new Set<SimulationPlayerIndex>();
  private readonly configuredStagePlayers = new Set<SimulationPlayerIndex>();

  public constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/start') {
      return this.startMatch(await request.json<MatchStartRequest>());
    }
    if (request.method === 'GET' && url.pathname === '/status') {
      return Response.json(this.status());
    }
    if (request.method === 'DELETE' && url.pathname === '/stop') {
      this.stop();
      return Response.json(this.status());
    }
    if (request.method === 'PUT' && url.pathname === '/configure-player') {
      return this.configureStagePlayer(await request.json<{
        playerSlot: SimulationPlayerIndex;
        tankTier: SimulationTankTier;
        runConsumables: SimulationRunConsumables;
        replaceConnection?: boolean;
      }>());
    }
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const observerId = request.headers.get('x-battlecity-observer-id') || '';
      if (observerId !== '') {
        if (!/^[a-z0-9]{8}$/.test(observerId)) {
          return new Response('Invalid observer ID', { status: 400 });
        }
        return this.connectObserver(observerId);
      }
      const slot = Number(request.headers.get('x-battlecity-player-slot'));
      if (slot !== 0 && slot !== 1) return new Response('Invalid player slot', { status: 400 });
      return this.connect(slot);
    }
    return new Response('Not found', { status: 404 });
  }

  private startMatch(body: MatchStartRequest): Response {
    if (this.simulation !== null) {
      return Response.json({ ...this.status(), error: 'Match already exists' }, { status: 409 });
    }
    this.matchId = body.matchId;
    this.level = Math.max(1, Math.floor(body.level || 1));
    this.startedAt = Date.now();
    this.category = body.category || 'live';
    this.simulationOptions = {
      extraLives: body.extraLives,
      initialPlayerTiers: body.initialPlayerTiers,
      playerRunConsumables: body.playerRunConsumables,
      runBoosts: body.runBoosts,
      disableEnemyShooting: body.disableEnemyShooting === true,
    };
    this.simulation = new EngineBattleCitySimulation(getMap(this.level), {
      seed: seedFromMatchId(this.matchId),
      level: this.level,
      ...this.simulationOptions,
    });
    return Response.json(this.status(), { status: 201 });
  }

  private connect(slot: SimulationPlayerIndex): Response {
    if (this.simulation === null || this.stopped) return new Response('Match is not running', { status: 409 });
    const reconnecting = this.matchStarted;
    this.sockets.get(slot)?.close(1012, 'replaced by reconnect');
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.set(slot, server);
    if (this.pendingRunState === null && !reconnecting) this.activePlayers.add(slot);
    server.addEventListener('message', (event) => this.receive(slot, server, event.data));
    server.addEventListener('close', () => this.disconnect(slot, server));
    server.addEventListener('error', () => this.disconnect(slot, server));
    if (this.pendingRunState === null && this.sockets.size === 2 && !this.matchStarted) {
      this.matchStarted = true;
      this.startTicking();
    }
    setTimeout(() => this.broadcastReady(reconnecting ? slot : null), 0);
    return new Response(null, { status: 101, webSocket: client });
  }

  private connectObserver(observerId: string): Response {
    if (this.simulation === null || this.stopped) return new Response('Match is not running', { status: 409 });
    const existing = this.spectatorSockets.get(observerId);
    if (existing !== undefined && existing.readyState === WebSocket.OPEN) {
      existing.close(1012, 'replaced by reconnect');
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.spectatorSockets.set(observerId, server);
    server.addEventListener('message', (event) => this.receiveObserver(server, event.data));
    server.addEventListener('close', () => this.disconnectSpectator(observerId, server));
    server.addEventListener('error', () => this.disconnectSpectator(observerId, server));
    const serverSeq = this.simulation?.seq ?? 0;
    this.sendObserver(server, {
      type: 'webrtc-ready',
      ready: this.matchStarted,
      syncPlayer: null,
      serverFrameSeq: serverSeq,
    });
    this.sendObserverReplay(server, serverSeq);
    return new Response(null, { status: 101, webSocket: client });
  }

  private receiveObserver(socket: WebSocket, data: string | ArrayBuffer): void {
    if (typeof data !== 'string') return;
    let packet: SimulationClientPacket;
    try {
      packet = JSON.parse(data) as SimulationClientPacket;
    } catch {
      return;
    }
    if (packet.type === 'webrtc-ping') {
      this.sendObserver(socket, {
        type: 'webrtc-pong',
        id: (packet as { id?: number }).id,
        sentAt: (packet as { sentAt?: number }).sentAt,
        senderPlayerIndex: -1,
      });
    }
  }

  private disconnectSpectator(observerId: string, socket: WebSocket): void {
    if (this.spectatorSockets.get(observerId) !== socket) return;
    this.spectatorSockets.delete(observerId);
  }

  private sendObserverReplay(socket: WebSocket, serverSeq: number): void {
    if (serverSeq <= 0 || this.frameHistory.length === 0) return;
    const oldest = this.frameHistory[0].seq;
    if (oldest > 1) {
      this.sendObserver(socket, { type: 'webrtc-replay-unavailable', oldestAvailableSeq: oldest, serverSeq });
      return;
    }
    this.sendObserver(socket, { type: 'webrtc-replay-start', fromSeq: 1, targetSeq: serverSeq });
    this.frameHistory.forEach((frame) => {
      if (frame.seq <= serverSeq) this.sendObserver(socket, frame);
    });
    this.sendObserver(socket, { type: 'webrtc-replay-complete', targetSeq: serverSeq });
  }

  private queueArchiveFrame(frame: SimulationHostFramePacket): void {
    if (this.archiveDisabled || this.archiveCompleted) return;
    this.pendingArchiveFrames.push(frame);
    if (this.pendingArchiveFrames.length >= ARCHIVE_BATCH_FRAMES) {
      this.ctx.waitUntil(this.flushArchiveFrames(false));
    }
  }

  private async ensureArchiveStarted(): Promise<void> {
    if (this.archiveStarted) return;
    if (this.archiveStartPromise !== null) return this.archiveStartPromise;
    this.archiveStartPromise = (async () => {
      const response = await this.archiveFetch(
        `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/start`,
        {
          gameType: 'websocket',
          category: this.category,
          level: this.level,
          seed: seedFromMatchId(this.matchId),
          simulationConfig: { seed: seedFromMatchId(this.matchId) },
          players: [],
          startedAt: new Date(this.startedAt).toISOString(),
        },
      );
      if (!response.ok) throw new Error(`archive startup failed (${response.status})`);
      this.archiveStarted = true;
    })().finally(() => {
      this.archiveStartPromise = null;
    });
    return this.archiveStartPromise;
  }

  private async flushArchiveFrames(flushAll: boolean): Promise<void> {
    if (this.archiveDisabled || this.archiveCompleted) return;
    if (this.archiveFlushPromise !== null) return this.archiveFlushPromise;
    const operation = (async () => {
      while (
        this.pendingArchiveFrames.length >= ARCHIVE_BATCH_FRAMES ||
        (flushAll && this.pendingArchiveFrames.length > 0)
      ) {
        try {
          await this.ensureArchiveStarted();
        } catch (error) {
          this.archiveDisabled = true;
          console.warn(`[worker] archive disabled`, { matchId: this.matchId, error });
          return;
        }
        const batch = this.pendingArchiveFrames.splice(
          0,
          Math.min(ARCHIVE_BATCH_FRAMES, this.pendingArchiveFrames.length),
        );
        try {
          const response = await this.archiveFetch(
            `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/frames`,
            { frames: batch },
          );
          if (!response.ok) throw new Error(`archive frames failed (${response.status})`);
          this.archivedThroughSeq = batch[batch.length - 1].seq;
        } catch (error) {
          this.pendingArchiveFrames.unshift(...batch);
          this.archiveDisabled = true;
          console.error(`[batch] archive disabled frames match=${this.matchId}`, error);
          return;
        }
      }
    })();
    this.archiveFlushPromise = operation.finally(() => {
      if (this.archiveFlushPromise === operation) this.archiveFlushPromise = null;
    });
    return this.archiveFlushPromise;
  }

  private async completeArchiveFrames(): Promise<void> {
    if (this.archiveCompleted) return;
    // A transient mid-match archive hiccup must not forfeit the full replay:
    // the in-memory frameHistory is the authoritative copy, so re-enable and
    // dump the whole thing before marking the archive complete.
    this.archiveDisabled = false;
    try {
      await this.ensureArchiveStarted();
      await this.flushArchiveFrames(true);
      await this.flushFullFrameHistory();
      const response = await this.archiveFetch(
        `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/complete`,
        { result: { terminal: true }, completedAt: new Date().toISOString() },
      );
      this.archiveCompleted = response.ok;
      if (!response.ok) console.warn(`[worker] archive complete failed match=${this.matchId}`);
    } catch (error) {
      this.archiveDisabled = true;
      console.warn(`[worker] archive complete disabled match=${this.matchId}`, error);
    }
  }

  private async flushFullFrameHistory(): Promise<void> {
    if (this.frameHistory.length === 0) return;
    for (let offset = 0; offset < this.frameHistory.length; offset += ARCHIVE_BATCH_FRAMES) {
      const batch = this.frameHistory
        .slice(offset, offset + ARCHIVE_BATCH_FRAMES)
        .filter((frame) => frame.seq > this.archivedThroughSeq);
      if (batch.length === 0) continue;
      const response = await this.archiveFetch(
        `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/frames`,
        { frames: batch },
      );
      if (!response.ok) throw new Error(`archive history flush failed (${response.status})`);
      this.archivedThroughSeq = batch[batch.length - 1].seq;
    }
  }

  private async archiveFetch(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.env.API_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.apiHeaders(),
      body: JSON.stringify(body),
    });
  }

  private receive(slot: SimulationPlayerIndex, socket: WebSocket, data: string | ArrayBuffer): void {
    if (typeof data !== 'string') return;
    let packet: SimulationClientPacket;
    try {
      packet = JSON.parse(data) as SimulationClientPacket;
    } catch {
      return;
    }
    if (packet.type === 'webrtc-ping') {
      this.send(socket, {
        type: 'webrtc-pong',
        id: packet.id,
        sentAt: packet.sentAt,
        senderPlayerIndex: -1,
      });
      return;
    }
    if (packet.type === 'webrtc-input') {
      if (this.activePlayers.has(slot) && packet.player === slot) {
        this.simulation?.acceptInput(packet as SimulationInputPacket);
      }
      return;
    }
    if (
      packet.type === 'webrtc-stage-ready' &&
      packet.player === slot &&
      this.pendingRunState !== null &&
      packet.stageNumber === this.pendingRunState.stageNumber
    ) {
      this.stageReadyPlayers.add(slot);
      this.tryStartNextStage();
      return;
    }
    if (packet.type === 'webrtc-client-debug' && packet.player === slot) {
      this.simulation?.setEnemyShootingDisabled(packet.disableEnemyShooting);
      return;
    }
    if (packet.type === 'webrtc-resume' && packet.player === slot) {
      this.replay(socket, packet.lastAppliedFrameSeq);
      return;
    }
    if (packet.type === 'webrtc-client-ready' && packet.player === slot) {
      this.activePlayers.add(slot);
      this.send(socket, { type: 'webrtc-replay-ready', appliedSeq: packet.appliedSeq });
    }
  }

  private startTicking(): void {
    if (this.timer !== null || this.simulation === null) return;
    const interval = 1000 / this.simulation.tickRate;
    this.nextTickAt = performance.now() + interval;
    this.timer = setInterval(() => {
      const simulation = this.simulation;
      if (simulation === null || !this.matchStarted) return;
      const now = performance.now();
      let catchUp = 0;
      while (now >= this.nextTickAt && catchUp < 4) {
        const frame = simulation.step();
        this.frameHistory.push(frame);
        if (this.frameHistory.length > MAX_FRAME_HISTORY) this.frameHistory.shift();
        this.broadcast(frame);
        this.queueArchiveFrame(frame);
        this.nextTickAt += interval;
        catchUp += 1;
        const hitStop = simulation.consumeHitStopSeconds();
        if (hitStop > 0) this.nextTickAt += hitStop * 1000;
        if (simulation.isTerminal() && !this.resultSubmitted) {
          this.resultSubmitted = true;
          this.stopTicking();
          this.ctx.waitUntil(this.submitResult());
          this.ctx.waitUntil(this.completeArchiveFrames());
          break;
        } else if (simulation.isComplete() && this.pendingRunState === null) {
          this.beginStageTransition();
          break;
        }
      }
    }, Math.max(4, interval / 2)) as unknown as number;
  }

  private stopTicking(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private replay(socket: WebSocket, lastAppliedSeq: number): void {
    const serverSeq = this.simulation?.seq ?? 0;
    const oldest = this.frameHistory[0]?.seq ?? serverSeq + 1;
    if (!Number.isInteger(lastAppliedSeq) || lastAppliedSeq + 1 < oldest) {
      this.send(socket, { type: 'webrtc-replay-unavailable', oldestAvailableSeq: oldest, serverSeq });
      return;
    }
    this.send(socket, { type: 'webrtc-replay-start', fromSeq: lastAppliedSeq + 1, targetSeq: serverSeq });
    this.frameHistory.forEach((frame) => {
      if (frame.seq > lastAppliedSeq) this.send(socket, frame);
    });
    this.send(socket, { type: 'webrtc-replay-complete', targetSeq: serverSeq });
  }

  private disconnect(slot: SimulationPlayerIndex, socket: WebSocket): void {
    if (this.sockets.get(slot) !== socket) return;
    this.sockets.delete(slot);
    this.activePlayers.delete(slot);
    this.broadcastReady(slot);
  }

  private beginStageTransition(): void {
    const simulation = this.simulation;
    if (simulation === null || this.pendingRunState !== null) return;
    this.pendingRunState = simulation.createNextStageRunState();
    this.level = this.pendingRunState.stageNumber;
    this.matchStarted = false;
    this.activePlayers.clear();
    this.stageReadyPlayers.clear();
    this.configuredStagePlayers.clear();
    this.stopTicking();
    const openSlots = this.pendingRunState.lives
      .map((lives, slot) => lives > 0 ? null : slot)
      .filter((slot): slot is SimulationPlayerIndex => slot !== null);
    this.broadcastReady(null);
    this.ctx.waitUntil(this.publishStageTransition(openSlots));
  }

  private configureStagePlayer(body: {
    playerSlot: SimulationPlayerIndex;
    tankTier: SimulationTankTier;
    runConsumables: SimulationRunConsumables;
    replaceConnection?: boolean;
  }): Response {
    const runState = this.pendingRunState;
    if (runState === null || (body.playerSlot !== 0 && body.playerSlot !== 1)) {
      return new Response('No stage transition is active', { status: 409 });
    }
    runState.tankTiers[body.playerSlot] = body.tankTier;
    runState.playerRunConsumables[body.playerSlot] = {
      powerups: [...(body.runConsumables?.powerups ?? [])],
      powerupCounts: [...(body.runConsumables?.powerupCounts ?? [])],
    };
    this.configuredStagePlayers.add(body.playerSlot);
    if (body.replaceConnection === true) {
      this.sockets.get(body.playerSlot)?.close(1012, 'stage player replaced');
      this.sockets.delete(body.playerSlot);
      this.stageReadyPlayers.delete(body.playerSlot);
    }
    return Response.json({ ok: true });
  }

  private tryStartNextStage(): void {
    const runState = this.pendingRunState;
    if (runState === null || this.stageReadyPlayers.size === 0) return;
    const connectedSlots = [...this.sockets.keys()];
    if (!connectedSlots.every((slot) => this.stageReadyPlayers.has(slot))) return;
    connectedSlots.forEach((slot) => {
      if (runState.lives[slot] <= 0 && this.configuredStagePlayers.has(slot)) {
        runState.lives[slot] = 3;
        runState.scores[slot] = 0;
      }
    });
    this.ctx.waitUntil(this.startNextStage(runState));
  }

  private async startNextStage(runState: EngineSimulationRunState): Promise<void> {
    const response = await fetch(
      `${this.env.API_BASE_URL}/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/stage-started`,
      {
        method: 'POST',
        headers: this.apiHeaders(),
        body: JSON.stringify({ stageNumber: runState.stageNumber }),
      },
    );
    if (!response.ok || this.pendingRunState !== runState) return;
    this.simulation = new EngineBattleCitySimulation(getMap(runState.stageNumber), {
      seed: seedFromMatchId(`${this.matchId}:stage:${runState.stageNumber}`),
      level: runState.stageNumber,
      ...this.simulationOptions,
      runState,
    });
    this.pendingRunState = null;
    this.matchStarted = true;
    this.activePlayers.clear();
    this.stageReadyPlayers.forEach((slot) => this.activePlayers.add(slot));
    this.stageReadyPlayers.clear();
    this.configuredStagePlayers.clear();
    this.broadcastReady(null);
    this.startTicking();
  }

  private async publishStageTransition(openSlots: SimulationPlayerIndex[]): Promise<void> {
    const runState = this.pendingRunState;
    if (runState === null) return;
    const response = await fetch(
      `${this.env.API_BASE_URL}/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/stage`,
      {
        method: 'POST',
        headers: this.apiHeaders(),
        body: JSON.stringify({
          stageNumber: runState.stageNumber,
          openSlots,
          scores: runState.scores.map((score, playerSlot) => ({ playerSlot, score })),
        }),
      },
    );
    if (!response.ok) console.error('stage transition publication failed', { matchId: this.matchId, status: response.status });
  }

  private stop(): void {
    this.stopped = true;
    this.matchStarted = false;
    this.stopTicking();
    this.sockets.forEach((socket) => socket.close(1000, 'match stopped'));
    this.sockets.clear();
    this.activePlayers.clear();
    this.spectatorSockets.forEach((socket) => socket.close(1000, 'match stopped'));
    this.spectatorSockets.clear();
  }

  private broadcastReady(syncPlayer: SimulationPlayerIndex | null): void {
    this.broadcast({
      type: 'webrtc-ready',
      ready: this.matchStarted && this.sockets.size === 2,
      syncPlayer,
      serverFrameSeq: this.simulation?.seq ?? 0,
    });
  }

  private broadcast(packet: unknown): void {
    this.sockets.forEach((socket) => this.send(socket, packet));
    this.spectatorSockets.forEach((socket) => this.sendObserver(socket, packet));
  }

  private sendObserver(socket: WebSocket, packet: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(packet));
    } catch {
      // The close event owns connection cleanup.
    }
  }

  private send(socket: WebSocket, packet: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(packet));
    } catch {
      // The close event owns connection cleanup.
    }
  }

  private status(): Record<string, unknown> {
    return {
      ok: this.simulation !== null,
      id: this.matchId,
      level: this.level,
      status: this.stopped || this.resultSubmitted
        ? 'stopped'
        : this.pendingRunState === null ? 'running' : 'transition',
      tick: this.simulation?.tick ?? 0,
      frameSeq: this.simulation?.seq ?? 0,
      connectedPlayers: [...this.sockets.keys()],
      matchStarted: this.matchStarted,
      startedAt: this.startedAt > 0 ? new Date(this.startedAt).toISOString() : null,
      runtime: 'cloudflare-durable-object',
    };
  }

  private async submitResult(): Promise<void> {
    const scores = (this.simulation?.getScores() ?? [0, 0]).map((score, playerSlot) => ({
      playerSlot,
      score,
    }));
    const response = await fetch(
      `${this.env.API_BASE_URL}/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/result`,
      {
        method: 'POST',
        headers: this.apiHeaders(),
        body: JSON.stringify({ scores }),
      },
    );
    if (!response.ok) {
      this.resultSubmitted = false;
      console.error('authoritative result submission failed', {
        matchId: this.matchId,
        status: response.status,
      });
    }
  }

  private apiHeaders(): HeadersInit {
    return {
      authorization: `Bearer ${this.env.BROADCASTER_SERVICE_TOKEN}`,
      'content-type': 'application/json',
    };
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws-latency.html') {
      return new Response(latencyPage, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300',
          'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self' ws: wss:",
          'x-content-type-options': 'nosniff',
        },
      });
    }
    if (url.pathname === '/ws-latency') return latencySocket(request);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, runtime: 'cloudflare-worker-websocket' });
    }
    if (request.method === 'POST' && url.pathname === '/matches') {
      if (!authorizedServiceRequest(request, env)) return new Response('Forbidden', { status: 403 });
      const body = await request.json<MatchStartRequest>();
      if (!/^match-[0-9a-z-]+$/i.test(body.matchId || '')) return new Response('Invalid match ID', { status: 400 });
      return env.MATCHES.getByName(body.matchId).fetch(new Request('https://match/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }));
    }
    const player = url.pathname.match(PLAYER_ROUTE);
    if (player !== null && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const matchId = player[1].toLowerCase();
      const playerSlot = Number(player[2]) as SimulationPlayerIndex;
      const ticket = await verifyTicket(url.searchParams.get('ticket') || '', env.WEBSOCKET_TICKET_SECRET);
      if (ticket === null || ticket.matchId !== matchId || ticket.playerSlot !== playerSlot) {
        return new Response('Invalid or expired ticket', { status: 403 });
      }
      const headers = new Headers(request.headers);
      headers.set('x-battlecity-player-slot', String(playerSlot));
      return env.MATCHES.getByName(matchId).fetch(new Request('https://match/connect', { headers }));
    }
    const observer = url.pathname.match(OBSERVER_ROUTE);
    if (observer !== null && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const matchId = observer[1].toLowerCase();
      const observerId = observer[2].toLowerCase();
      const ticket = await verifyObserverTicket(url.searchParams.get('ticket') || '', env.WEBSOCKET_TICKET_SECRET);
      if (ticket === null || ticket.matchId !== matchId || ticket.observerId !== observerId) {
        return new Response('Invalid or expired ticket', { status: 403 });
      }
      const headers = new Headers(request.headers);
      headers.set('x-battlecity-observer-id', observerId);
      return env.MATCHES.getByName(matchId).fetch(new Request('https://match/connect', { headers }));
    }
    const playerConfig = url.pathname.match(PLAYER_CONFIG_ROUTE);
    if (playerConfig !== null && request.method === 'PUT') {
      if (!authorizedServiceRequest(request, env)) return new Response('Forbidden', { status: 403 });
      const body = await request.json<Record<string, unknown>>();
      return env.MATCHES.getByName(playerConfig[1].toLowerCase()).fetch(
        new Request('https://match/configure-player', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, playerSlot: Number(playerConfig[2]) - 1 }),
        }),
      );
    }
    const match = url.pathname.match(MATCH_ROUTE);
    if (match !== null && (request.method === 'GET' || request.method === 'DELETE')) {
      if (!authorizedServiceRequest(request, env)) return new Response('Forbidden', { status: 403 });
      return env.MATCHES.getByName(match[1].toLowerCase()).fetch(
        new Request(
          request.method === 'DELETE' ? 'https://match/stop' : 'https://match/status',
          { method: request.method },
        ),
      );
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<WorkerEnv>;

function latencySocket(request: Request): Response {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const cf = request.cf;
  server.send(JSON.stringify({
    type: 'latency-hello',
    colo: cf?.colo ?? null,
    city: cf?.city ?? null,
    region: cf?.region ?? null,
    country: cf?.country ?? null,
  }));
  server.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    try {
      const packet = JSON.parse(event.data);
      if (packet.type === 'latency-ping') {
        server.send(JSON.stringify({ type: 'latency-pong', id: packet.id, sentAt: packet.sentAt }));
      }
    } catch {
      // Ignore malformed diagnostic packets.
    }
  });
  return new Response(null, { status: 101, webSocket: client });
}

function authorizedServiceRequest(request: Request, env: WorkerEnv): boolean {
  return request.headers.get('authorization') === `Bearer ${env.BROADCASTER_SERVICE_TOKEN}`;
}

async function verifyTicket(ticket: string, secret: string): Promise<TicketPayload | null> {
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined || secret.length < 32) return null;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as TicketPayload;
    return parsed.expiresAt >= Date.now() &&
        /^match-[0-9a-z-]+$/i.test(parsed.matchId) &&
        (parsed.playerSlot === 0 || parsed.playerSlot === 1)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function verifyObserverTicket(ticket: string, secret: string): Promise<ObserverTicketPayload | null> {
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined || secret.length < 32) return null;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
      matchId?: unknown;
      kind?: unknown;
      observerId?: unknown;
      expiresAt?: unknown;
    };
    if (
      parsed.kind !== 'observer' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now() ||
      typeof parsed.matchId !== 'string' ||
      !/^match-[0-9a-z-]+$/i.test(parsed.matchId) ||
      typeof parsed.observerId !== 'string' ||
      !/^[a-z0-9]{8}$/.test(parsed.observerId)
    ) {
      return null;
    }
    return { matchId: parsed.matchId.toLowerCase(), observerId: parsed.observerId };
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function seedFromMatchId(matchId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < matchId.length; index += 1) {
    hash ^= matchId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
