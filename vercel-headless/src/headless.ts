import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
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
import { getMap } from '../../cloudflare-game-worker/src/maps';

declare const process: any;

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
const ARCHIVE_INTERVAL_MS = 2000;
const MAX_BODY_BYTES = 1024 * 1024;
const INSTANCE_ID = randomBytes(8).toString('hex');
const matches = new Map<string, VercelMatch>();
const sockets = new WebSocketServer({ noServer: true });

class VercelMatch {
  private simulation: EngineBattleCitySimulation;
  private readonly startedAt = Date.now();
  private matchStarted = false;
  private resultSubmitted = false;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;
  private nextTickAt = 0;
  private readonly playerSockets = new Map<SimulationPlayerIndex, WebSocket>();
  private readonly activePlayers = new Set<SimulationPlayerIndex>();
  private readonly spectatorSockets = new Map<string, WebSocket>();
  private readonly frameHistory: SimulationHostFramePacket[] = [];
  private readonly pendingArchiveFrames: SimulationHostFramePacket[] = [];
  private archiveStartPromise: Promise<void> | null = null;
  private archiveFlushPromise: Promise<void> | null = null;
  private archiveStarted = false;
  private archiveCompleted = false;
  private archiveDisabled = false;
  private archiveFlushTimer: NodeJS.Timeout | null = null;
  private pendingRunState: EngineSimulationRunState | null = null;
  private readonly stageReadyPlayers = new Set<SimulationPlayerIndex>();
  private readonly configuredStagePlayers = new Set<SimulationPlayerIndex>();
  private readonly simulationOptions: Partial<SimulationOptions>;
  private readonly matchCategory: string | undefined;

  public constructor(
    public readonly matchId: string,
    public level: number,
    body: MatchStartRequest,
  ) {
    this.matchCategory = body.category;
    this.simulationOptions = {
      extraLives: body.extraLives,
      initialPlayerTiers: body.initialPlayerTiers,
      playerRunConsumables: body.playerRunConsumables,
      runBoosts: body.runBoosts,
      disableEnemyShooting: body.disableEnemyShooting === true,
    };
    this.simulation = this.createSimulation(this.level);
  }

  public connect(slot: SimulationPlayerIndex, socket: WebSocket): void {
    if (this.stopped) {
      socket.close(1013, 'match is stopped');
      return;
    }
    const reconnecting = this.matchStarted;
    this.playerSockets.get(slot)?.close(1012, 'replaced by reconnect');
    this.playerSockets.set(slot, socket);
    if (this.pendingRunState === null && !reconnecting) this.activePlayers.add(slot);
    socket.on('message', (data) => this.receive(slot, socket, String(data)));
    socket.on('close', () => this.disconnect(slot, socket));
    socket.on('error', () => this.disconnect(slot, socket));
    if (this.pendingRunState === null && this.playerSockets.size === 2 && !this.matchStarted) {
      this.matchStarted = true;
      this.startTicking();
    }
    setImmediate(() => this.broadcastReady(reconnecting ? slot : null));
  }

  public connectObserver(observerId: string, socket: WebSocket): void {
    if (this.stopped) {
      socket.close(1013, 'match is stopped');
      return;
    }
    const existing = this.spectatorSockets.get(observerId);
    if (existing !== undefined && existing !== socket && existing.readyState === WebSocket.OPEN) {
      existing.close(1012, 'replaced by reconnect');
    }
    this.spectatorSockets.set(observerId, socket);
    socket.on('message', (data) => this.receiveObserver(socket, String(data)));
    socket.on('close', () => this.disconnectSpectator(observerId, socket));
    socket.on('error', () => this.disconnectSpectator(observerId, socket));
    const serverSeq = this.simulation.seq;
    this.sendObserver(socket, {
      type: 'webrtc-ready',
      ready: this.matchStarted,
      syncPlayer: null,
      serverFrameSeq: serverSeq,
      serverRegion: getRegion(),
    });
    this.sendObserverReplay(socket, serverSeq);
  }

  private queueArchiveFrame(frame: SimulationHostFramePacket): void {
    if (this.archiveDisabled || this.archiveCompleted) return;
    this.pendingArchiveFrames.push(frame);
    if (this.pendingArchiveFrames.length >= ARCHIVE_BATCH_FRAMES) {
      void this.flushArchiveFrames(false);
    }
  }

  private scheduleArchiveFlush(): void {
    if (this.archiveDisabled || this.archiveCompleted) return;
    if (this.archiveFlushTimer !== null) return;
    this.archiveFlushTimer = setTimeout(() => {
      this.archiveFlushTimer = null;
      void this.flushArchiveFrames(true);
    }, ARCHIVE_INTERVAL_MS);
  }

  private async ensureArchiveStarted(): Promise<void> {
    if (this.archiveStarted) return;
    if (this.archiveStartPromise !== null) return this.archiveStartPromise;
    this.archiveStartPromise = (async () => {
      const response = await apiRequest(
        `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/start`,
        {
          gameType: 'websocket',
          category: this.matchCategory ?? 'live',
          level: this.level,
          seed: seedFromMatchId(this.matchId),
          simulationConfig: {
            seed: seedFromMatchId(this.matchId),
          },
          players: [],
          startedAt: new Date(this.startedAt).toISOString(),
        },
      );
      if (!response.ok) {
        throw new Error(`archive startup failed (${response.status})`);
      }
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
          console.warn(`[headless] archive disabled match=${this.matchId}`, error);
          return;
        }
        const batch = this.pendingArchiveFrames.splice(
          0,
          Math.min(ARCHIVE_BATCH_FRAMES, this.pendingArchiveFrames.length),
        );
        try {
          const response = await apiRequest(
            `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/frames`,
            { frames: batch },
          );
          if (!response.ok) {
            throw new Error(`archive frames failed (${response.status})`);
          }
        } catch (error) {
          this.pendingArchiveFrames.unshift(...batch);
          this.archiveDisabled = true;
          console.warn(`[broadcast] archive disabled match=${this.matchId}`, error);
          return;
        }
      }
    })();
    this.archiveFlushPromise = operation.finally(() => {
      if (this.archiveFlushPromise === operation) this.archiveFlushPromise = null;
    });
    return this.archiveFlushPromise;
  }

  private async completeArchive(result: Record<string, unknown>): Promise<void> {
    if (this.archiveCompleted || this.archiveDisabled) return;
    try {
      await this.ensureArchiveStarted();
      await this.flushArchiveFrames(true);
      const response = await apiRequest(
        `/api/multiplayer/archives/${encodeURIComponent(this.matchId)}/complete`,
        {
          result,
          completedAt: new Date().toISOString(),
        },
      );
      this.archiveCompleted = response.ok;
      if (!response.ok) console.warn(`[broadcast] archive complete failed match=${this.matchId}`);
    } catch (error) {
      this.archiveDisabled = true;
      console.warn(`[broadcast] archive complete disabled match=${this.matchId}`, error);
    }
  }

  private receiveObserver(socket: WebSocket, raw: string): void {
    let packet: SimulationClientPacket;
    try {
      packet = JSON.parse(raw) as SimulationClientPacket;
    } catch {
      return;
    }
    if (packet.type === 'webrtc-ping') {
      this.sendObserver(socket, {
        type: 'webrtc-pong',
        id: (packet as { id?: number }).id,
        sentAt: (packet as { sentAt?: number }).sentAt,
        senderPlayerIndex: -1,
        serverRegion: getRegion(),
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

  public configureStagePlayer(body: {
    playerSlot: SimulationPlayerIndex;
    tankTier: SimulationTankTier;
    runConsumables: SimulationRunConsumables;
    replaceConnection?: boolean;
  }): boolean {
    const runState = this.pendingRunState;
    if (runState === null || (body.playerSlot !== 0 && body.playerSlot !== 1)) return false;
    runState.tankTiers[body.playerSlot] = body.tankTier;
    runState.playerRunConsumables[body.playerSlot] = {
      powerups: [...(body.runConsumables?.powerups ?? [])],
      powerupCounts: [...(body.runConsumables?.powerupCounts ?? [])],
    };
    this.configuredStagePlayers.add(body.playerSlot);
    if (body.replaceConnection === true) {
      this.playerSockets.get(body.playerSlot)?.close(1012, 'stage player replaced');
      this.playerSockets.delete(body.playerSlot);
      this.stageReadyPlayers.delete(body.playerSlot);
    }
    return true;
  }

  public stop(): void {
    this.stopped = true;
    this.matchStarted = false;
    this.stopTicking();
    if (this.archiveFlushTimer !== null) {
      clearTimeout(this.archiveFlushTimer);
      this.archiveFlushTimer = null;
    }
    this.playerSockets.forEach((socket) => socket.close(1000, 'match stopped'));
    this.playerSockets.clear();
    this.activePlayers.clear();
    this.spectatorSockets.forEach((socket) => socket.close(1000, 'match stopped'));
    this.spectatorSockets.clear();
  }

  public status(): Record<string, unknown> {
    return {
      ok: !this.stopped,
      id: this.matchId,
      level: this.level,
      status: this.stopped || this.resultSubmitted
        ? 'stopped'
        : this.pendingRunState === null ? 'running' : 'transition',
      tick: this.simulation.tick,
      frameSeq: this.simulation.seq,
      connectedPlayers: [...this.playerSockets.keys()],
      matchStarted: this.matchStarted,
      startedAt: new Date(this.startedAt).toISOString(),
      runtime: 'vercel-fluid-websocket',
      region: getRegion(),
      instanceId: INSTANCE_ID,
    };
  }

  private createSimulation(level: number, runState?: EngineSimulationRunState): EngineBattleCitySimulation {
    return new EngineBattleCitySimulation(getMap(level), {
      seed: seedFromMatchId(
        runState === undefined ? this.matchId : `${this.matchId}:stage:${level}`,
      ),
      level,
      ...this.simulationOptions,
      runState,
    });
  }

  private receive(slot: SimulationPlayerIndex, socket: WebSocket, raw: string): void {
    let packet: SimulationClientPacket;
    try {
      packet = JSON.parse(raw) as SimulationClientPacket;
    } catch {
      return;
    }
    if (packet.type === 'webrtc-ping') {
      this.send(socket, {
        type: 'webrtc-pong',
        id: packet.id,
        sentAt: packet.sentAt,
        senderPlayerIndex: -1,
        serverRegion: getRegion(),
      });
      return;
    }
    if (packet.type === 'webrtc-input') {
      if (this.activePlayers.has(slot) && packet.player === slot) {
        this.simulation.acceptInput(packet as SimulationInputPacket);
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
      this.simulation.setEnemyShootingDisabled(packet.disableEnemyShooting);
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

  private disconnect(slot: SimulationPlayerIndex, socket: WebSocket): void {
    if (this.playerSockets.get(slot) !== socket) return;
    this.playerSockets.delete(slot);
    this.activePlayers.delete(slot);
    this.broadcastReady(slot);
  }

  private startTicking(): void {
    if (this.timer !== null || this.stopped) return;
    const interval = 1000 / this.simulation.tickRate;
    this.nextTickAt = performance.now() + interval;
    this.timer = setInterval(() => {
      if (!this.matchStarted || this.stopped) return;
      const now = performance.now();
      let catchUp = 0;
      while (now >= this.nextTickAt && catchUp < 4) {
        const frame = this.simulation.step();
        this.frameHistory.push(frame);
        if (this.frameHistory.length > MAX_FRAME_HISTORY) this.frameHistory.shift();
        this.broadcast(frame);
        this.queueArchiveFrame(frame);
        this.scheduleArchiveFlush();
        this.nextTickAt += interval;
        catchUp += 1;
        const hitStop = this.simulation.consumeHitStopSeconds();
        if (hitStop > 0) this.nextTickAt += hitStop * 1000;
        if (this.simulation.isTerminal() && !this.resultSubmitted) {
          this.resultSubmitted = true;
          this.stopTicking();
          void this.submitResult();
          void this.completeArchive({ result: { terminal: true } });
          break;
        }
        if (this.simulation.isComplete() && this.pendingRunState === null) {
          this.beginStageTransition();
          break;
        }
      }
    }, Math.max(4, interval / 2));
  }

  private stopTicking(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private replay(socket: WebSocket, lastAppliedSeq: number): void {
    const serverSeq = this.simulation.seq;
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

  private beginStageTransition(): void {
    if (this.pendingRunState !== null) return;
    this.pendingRunState = this.simulation.createNextStageRunState();
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
    void this.publishStageTransition(openSlots);
  }

  private tryStartNextStage(): void {
    const runState = this.pendingRunState;
    if (runState === null || this.stageReadyPlayers.size === 0) return;
    const connectedSlots = [...this.playerSockets.keys()];
    if (!connectedSlots.every((slot) => this.stageReadyPlayers.has(slot))) return;
    connectedSlots.forEach((slot) => {
      if (runState.lives[slot] <= 0 && this.configuredStagePlayers.has(slot)) {
        runState.lives[slot] = 3;
        runState.scores[slot] = 0;
      }
    });
    void this.startNextStage(runState);
  }

  private async startNextStage(runState: EngineSimulationRunState): Promise<void> {
    const response = await apiRequest(
      `/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/stage-started`,
      { stageNumber: runState.stageNumber },
    );
    if (!response.ok || this.pendingRunState !== runState) return;
    this.simulation = this.createSimulation(runState.stageNumber, runState);
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
    const response = await apiRequest(
      `/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/stage`,
      {
        stageNumber: runState.stageNumber,
        openSlots,
        scores: runState.scores.map((score, playerSlot) => ({ playerSlot, score })),
      },
    );
    if (!response.ok) {
      console.error('stage transition publication failed', {
        matchId: this.matchId,
        status: response.status,
      });
    }
  }

  private async submitResult(): Promise<void> {
    const scores = this.simulation.getScores().map((score, playerSlot) => ({
      playerSlot,
      score,
    }));
    const response = await apiRequest(
      `/api/multiplayer/matches/${encodeURIComponent(this.matchId)}/result`,
      { scores },
    );
    if (!response.ok) {
      this.resultSubmitted = false;
      console.error('authoritative result submission failed', {
        matchId: this.matchId,
        status: response.status,
      });
    }
  }

  private broadcastReady(syncPlayer: SimulationPlayerIndex | null): void {
    this.broadcast({
      type: 'webrtc-ready',
      ready: this.matchStarted && this.playerSockets.size === 2,
      syncPlayer,
      serverFrameSeq: this.simulation.seq,
      serverRegion: getRegion(),
    });
  }

  private broadcast(packet: unknown): void {
    this.playerSockets.forEach((socket) => this.send(socket, packet));
    this.spectatorSockets.forEach((socket) => this.sendObserver(socket, packet));
  }

  private sendObserver(socket: WebSocket, packet: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(packet), (error) => {
      if (error && socket.readyState === WebSocket.OPEN) {
        console.warn('websocket spectator send failed', { observerId: this.matchId, error });
      }
    });
  }

  private send(socket: WebSocket, packet: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(packet), (error) => {
      if (error && socket.readyState === WebSocket.OPEN) {
        console.warn('websocket send failed', { matchId: this.matchId, error });
      }
    });
  }
}

const server = createServer(async (request, response) => {
  try {
    await handleHttp(request, response);
  } catch (error) {
    console.error('Vercel headless request failed', error);
    sendJson(response, 500, { ok: false, error: 'Internal server error' });
  }
});

server.on('upgrade', (request, socket, head) => {
  const url = requestUrl(request);
  const route = resolveRoute(url);
  if (route === '/ws-latency') {
    sockets.handleUpgrade(request, socket, head, (websocket) => connectLatencySocket(websocket));
    return;
  }
  const player = route.match(PLAYER_ROUTE);
  if (player !== null) {
    const matchId = player[1].toLowerCase();
    const slot = Number(player[2]) as SimulationPlayerIndex;
    const ticket = verifyTicket(url.searchParams.get('ticket') || '');
    if (ticket === null || ticket.matchId !== matchId || ticket.playerSlot !== slot) {
      return rejectUpgrade(socket, 403, 'Invalid or expired ticket');
    }
    const match = matches.get(matchId);
    if (match === undefined) {
      return rejectUpgrade(socket, 409, `Match is not present on Vercel instance ${INSTANCE_ID}`);
    }
    sockets.handleUpgrade(request, socket, head, (websocket) => match.connect(slot, websocket));
    return;
  }
  const observer = route.match(OBSERVER_ROUTE);
  if (observer !== null) {
    const matchId = observer[1].toLowerCase();
    const observerId = observer[2].toLowerCase();
    const ticket = verifyObserverTicket(url.searchParams.get('ticket') || '');
    if (ticket === null || ticket.matchId !== matchId || ticket.observerId !== observerId) {
      return rejectUpgrade(socket, 403, 'Invalid or expired ticket');
    }
    const match = matches.get(matchId);
    if (match === undefined) {
      return rejectUpgrade(socket, 409, `Match is not present on this Vercel instance`);
    }
    sockets.handleUpgrade(request, socket, head, (websocket) => match.connectObserver(observerId, websocket));
    return;
  }
  return rejectUpgrade(socket, 404, 'Not found');
});

function connectLatencySocket(socket: WebSocket): void {
  socket.on('message', (data) => {
    let packet: { type?: unknown; sequence?: unknown; sentAt?: unknown; id?: unknown; message?: unknown };
    try {
      packet = JSON.parse(String(data)) as { type?: unknown; sequence?: unknown; sentAt?: unknown; id?: unknown; message?: unknown };
    } catch {
      return;
    }
    if (packet.type === 'ping') {
      socket.send(JSON.stringify({
        type: 'pong',
        sequence: packet.sequence,
        sentAt: packet.sentAt,
        serverRegion: getRegion(),
        runtime: 'vercel-fluid-websocket',
      }));
      return;
    }
    if (packet.type === 'echo' && typeof packet.message === 'string') {
      socket.send(JSON.stringify({
        type: 'echo',
        id: packet.id,
        message: packet.message.slice(0, 256),
        serverRegion: getRegion(),
      }));
    }
  });
}

async function handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = requestUrl(request);
  const route = resolveRoute(url);
  if (request.method === 'GET' && (route === '/' || route === '/health')) {
    sendJson(response, 200, {
      ok: true,
      runtime: 'vercel-fluid-websocket',
      region: getRegion(),
      instanceId: INSTANCE_ID,
      activeMatches: matches.size,
    });
    return;
  }
  if (!authorized(request)) {
    sendJson(response, 403, { ok: false, error: 'Forbidden' });
    return;
  }
  if (request.method === 'POST' && route === '/matches') {
    const body = await readJsonBody(request) as MatchStartRequest;
    if (!/^match-[0-9a-z-]+$/i.test(body?.matchId || '')) {
      sendJson(response, 400, { ok: false, error: 'Invalid match ID' });
      return;
    }
    const matchId = body.matchId.toLowerCase();
    const existing = matches.get(matchId);
    if (existing !== undefined) {
      sendJson(response, 409, existing.status());
      return;
    }
    const match = new VercelMatch(
      matchId,
      Math.max(1, Math.floor(Number(body.level) || 1)),
      body,
    );
    matches.set(matchId, match);
    sendJson(response, 201, match.status());
    return;
  }
  const playerConfig = route.match(PLAYER_CONFIG_ROUTE);
  if (request.method === 'PUT' && playerConfig !== null) {
    const match = matches.get(playerConfig[1].toLowerCase());
    if (match === undefined) {
      sendJson(response, 404, { ok: false, error: 'Match not found on this instance' });
      return;
    }
    const body = await readJsonBody(request);
    const ok = match.configureStagePlayer({
      ...body,
      playerSlot: Number(playerConfig[2]) - 1,
    });
    sendJson(response, ok ? 200 : 409, ok
      ? { ok: true }
      : { ok: false, error: 'No stage transition is active' });
    return;
  }
  const matchRoute = route.match(MATCH_ROUTE);
  if (matchRoute !== null && request.method === 'GET') {
    const match = matches.get(matchRoute[1].toLowerCase());
    sendJson(response, match === undefined ? 404 : 200, match?.status() ?? {
      ok: false,
      error: 'Match not found on this instance',
      instanceId: INSTANCE_ID,
    });
    return;
  }
  if (matchRoute !== null && request.method === 'DELETE') {
    const matchId = matchRoute[1].toLowerCase();
    const match = matches.get(matchId);
    match?.stop();
    matches.delete(matchId);
    sendJson(response, match === undefined ? 404 : 200, {
      ok: match !== undefined,
      id: matchId,
      status: 'stopped',
      instanceId: INSTANCE_ID,
    });
    return;
  }
  sendJson(response, 404, { ok: false, error: 'Not found' });
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`);
}

function resolveRoute(url: URL): string {
  const rewritten = url.searchParams.get('__headless');
  if (rewritten !== null) return `/${rewritten.replace(/^\/+/, '')}`;
  const direct = url.pathname.replace(/^\/api\/headless/, '');
  return direct === '' ? '/' : direct;
}

function authorized(request: IncomingMessage): boolean {
  const configured = String(process.env.BROADCASTER_SERVICE_TOKEN || '').trim();
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return safeEquals(configured, supplied);
}

function verifyTicket(ticket: string): TicketPayload | null {
  const secret = String(process.env.WEBSOCKET_TICKET_SECRET || '').trim();
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined || secret.length < 32) return null;
  try {
    const expected = createHmac('sha256', secret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TicketPayload;
    return parsed.expiresAt >= Date.now() &&
      /^match-[0-9a-z-]+$/i.test(parsed.matchId) &&
      (parsed.playerSlot === 0 || parsed.playerSlot === 1)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function verifyObserverTicket(ticket: string): ObserverTicketPayload | null {
  const secret = String(process.env.WEBSOCKET_TICKET_SECRET || '').trim();
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined || secret.length < 32) return null;
  try {
    const expected = createHmac('sha256', secret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
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

async function readJsonBody(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BODY_BYTES) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  const reason = status === 403 ? 'Forbidden' : status === 409 ? 'Conflict' : 'Not Found';
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\n` +
    'Content-Type: text/plain; charset=utf-8\r\n' +
    'Connection: close\r\n' +
    `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n` +
    message,
  );
  socket.destroy();
}

async function apiRequest(path: string, body: unknown): Promise<Response> {
  const baseUrl = String(process.env.API_BASE_URL || 'https://api.battlecities.com')
    .trim()
    .replace(/\/+$/, '');
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${String(process.env.BROADCASTER_SERVICE_TOKEN || '').trim()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function safeEquals(left: string, right: string): boolean {
  if (left === '' || right === '') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getRegion(): string {
  return String(process.env.VERCEL_REGION || process.env.BATTLECITY_REGION || 'unknown');
}

function seedFromMatchId(matchId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < matchId.length; index += 1) {
    hash ^= matchId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export default server;
