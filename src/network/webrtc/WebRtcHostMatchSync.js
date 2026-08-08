"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcHostMatchSync = void 0;
const game_1 = require("../../game");
const gameObjects_1 = require("../../gameObjects");
const input_1 = require("../../input");
const tank_1 = require("../../tank");
const HttpGhostSignalTransport_1 = require("./HttpGhostSignalTransport");
const WebRtcGhostSync_1 = require("./WebRtcGhostSync");
const api_1 = require("../api");
const api_2 = require("../api");
const applyRemotePlayerInput_1 = require("./applyRemotePlayerInput");
const OrderedInputBuffer_1 = require("./OrderedInputBuffer");
const WebSocketMatchLink_1 = require("../websocket/WebSocketMatchLink");
const ArchiveMatchLink_1 = require("../websocket/ArchiveMatchLink");
const REMOTE_INPUT_TIMEOUT_MS = 500;
const MAX_ENEMY_TICKS_PER_UPDATE = 2;
const MAX_PLAYER_TICKS_PER_UPDATE = 2;
const PLAYER_TICK_CATCH_UP_BACKLOG = 6;
const NETWORK_PROBE_INTERVAL_SECONDS = 0.5;
const JITTER_SMOOTHING = 0.2;
const OBSERVER_HEARTBEAT_MS = 5000;
const OBSERVER_DISCOVERY_MS = 2000;
const REPLAY_FRAMES_PER_HOST_TICK = 8;
const REPLAY_READY_MAX_LAG = 2;
function log(message, data) {
    if (data === undefined) {
        console.log(`[webrtc-match] ${message}`);
        return;
    }
    console.log(`[webrtc-match] ${message}`, data);
}
function normalizeRoom(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}
function createRoomId() {
    const bytes = new Uint8Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
function createObserverId() {
    return createRoomId();
}
function observerLinkId(observerId) {
    return `observer:${observerId}`;
}
function isObserverLink(linkId) {
    return typeof linkId === 'string';
}
function isPowerSlot(value) {
    return (value === undefined ||
        value === null ||
        (Number.isInteger(value) && value >= 0 && value < 4));
}
class WebRtcHostMatchSync {
    constructor(runtime = null, location = window.location) {
        this.ticket = '';
        this.links = new Map();
        this.connectedPlayers = new Set();
        this.activePlayers = new Set();
        this.syncingPlayers = new Set();
        this.enemyShootingDisabledPlayers = new Set();
        this.frameHistory = [];
        this.frameHistoryBySeq = new Map();
        this.replaySessions = new Map();
        this.pendingActivations = new Map();
        this.inputSeq = 0;
        this.frameSeq = 0;
        this.tick = 0;
        this.remoteInputBuffers = new Map();
        this.lastAppliedRemoteFireSeqs = new Map();
        this.pendingRemoteFireSeqs = new Map();
        this.lastProcessedRemoteInputSeqs = new Map();
        this.pendingRemotePowerSlots = new Map();
        this.latestHostFrame = null;
        this.activeReplayFrame = null;
        this.consumedMatchResultSeq = 0;
        this.recoveryFrames = new Map();
        this.clientFrameCache = new Map();
        this.pendingAppliedFrameSeqs = [];
        this.lastAppliedHostFrameSeq = 0;
        this.replayTargetSeq = 0;
        this.replayDeliveryComplete = false;
        this.lastReadyAckSeq = -1;
        this.clientSyncing = false;
        this.recoveryUnavailable = false;
        this.pendingPlayerTicks = new Map();
        this.pendingEnemyTicks = new Map();
        this.pendingEnemyDeaths = [];
        this.pendingEnemyDeathSeqs = new Set();
        this.lastAppliedEnemyDeathSeq = 0;
        this.pendingPowerupPickups = [];
        this.lastQueuedPowerupPickupSeq = 0;
        this.observedEnemies = new WeakSet();
        this.observedPlayers = new WeakSet();
        this.playerFireSeqs = new Map();
        this.lastPlayerFireSeqs = new Map();
        this.latestPlayerFire = new Map();
        this.lastPlayerPositions = new Map();
        this.enemyFireSeqs = new Map();
        this.lastEnemyFireSeqs = new Map();
        this.latestEnemyFire = new Map();
        this.queuedEnemyDeaths = [];
        this.enemyDeathSeq = 0;
        this.lastEnemyPositions = new Map();
        this.started = false;
        this.matchStarted = false;
        this.connected = false;
        this.ready = false;
        this.localElapsedSeconds = 0;
        this.playerElapsedSeconds = new Map();
        this.sharedElapsedSeconds = 0;
        this.hasSynchronizedClock = false;
        this.probeTimer = 0;
        this.probeSeq = 0;
        this.lastRttMs = null;
        this.rttMs = null;
        this.jitterMs = null;
        this.networkStatsElement = null;
        this.rttValueElement = null;
        this.jitterValueElement = null;
        this.joinButtons = new Map();
        this.observerHeartbeatTimer = null;
        this.observerDiscoveryTimer = null;
        this.authoritativeScores = [0, 0];
        this.resultSubmissionStarted = false;
        this.expectedStageNumber = 1;
        this.stageWaiting = false;
        this.stageReadySentFor = 0;
        const params = new URLSearchParams(location.search);
        this.transportMode = runtime?.mode ??
            (params.get('mode') === 'websocket' || params.get('mode') === 'archive'
                ? params.get('mode')
                : 'webrtc');
        this.enabled = runtime !== null || ['webrtc', 'websocket', 'archive'].includes(params.get('mode') || '');
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
        this.signalingBaseUrl = runtime?.signalingBaseUrl || (0, api_2.getApiBaseUrl)();
        this.websocketUrl = runtime?.websocketUrl || params.get('websocketUrl') || '';
        this.ticket = params.get('ticket') || '';
        this.authorizationToken = runtime?.joinToken ||
            (this.broadcaster ? params.get('serviceToken') || '' : '');
        this.disableEnemyShooting =
            params.get('noEnemyShooting') === '1' ||
                params.get('debugNoEnemyShooting') === '1' ||
                params.get('webrtcNoEnemyShooting') === '1';
        this.networkStatsEnabled = params.get('webrtcStats') === '1';
        this.serverGhostEnabled =
            params.get('serverGhost') === '1' ||
                params.get('webrtcServerGhost') === '1' ||
                params.get('ghostMirror') === '1' ||
                params.get('ghostmirror') === '1' ||
                params.get('ghosmirror') === '1';
        this.expectedStageNumber = Math.max(1, Math.floor(runtime?.level ?? (Number(params.get('level')) || 1)));
        this.stageWaiting = runtime !== null && this.expectedStageNumber > 1;
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
            window.history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
        }
        if (this.observer && params.get('observerId') !== this.observerId) {
            params.set('observerId', this.observerId);
            window.history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
        }
        this.room = room;
        if (this.enabled && this.room !== '') {
            this.configure();
        }
        else if (this.enabled) {
            log('disabled: missing match room for joiner');
        }
    }
    isEnabled() {
        return this.enabled && this.room !== '';
    }
    activatePlayerRuntime(runtime) {
        if (this.broadcaster || this.observer) {
            throw new Error('Cannot replace a broadcaster or observer runtime.');
        }
        const sameConnection = this.isEnabled() &&
            this.room === runtime.matchId &&
            this.localPlayerIndex === runtime.playerSlot &&
            this.transportMode === runtime.mode &&
            (runtime.mode === 'websocket'
                ? this.websocketUrl === runtime.websocketUrl
                : this.signalingBaseUrl === runtime.signalingBaseUrl);
        if (sameConnection) {
            this.expectedStageNumber = Math.max(1, Math.floor(runtime.level));
            return;
        }
        this.resetPlayerRuntime();
        this.enabled = true;
        this.broadcaster = false;
        this.headlessBroadcaster = false;
        this.observer = false;
        this.observerId = '';
        this.room = runtime.matchId;
        this.localPlayerIndex = runtime.playerSlot;
        this.signalingBaseUrl = runtime.signalingBaseUrl;
        this.websocketUrl = runtime.websocketUrl || '';
        this.transportMode = runtime.mode;
        this.authorizationToken = runtime.joinToken;
        this.expectedStageNumber = Math.max(1, Math.floor(runtime.level));
        this.stageWaiting = this.expectedStageNumber > 1;
        this.configure();
    }
    deactivatePlayerRuntime() {
        if (this.broadcaster || this.observer) {
            return;
        }
        this.resetPlayerRuntime();
    }
    isHost() {
        return this.isBroadcaster();
    }
    isBroadcaster() {
        return this.isEnabled() && this.broadcaster;
    }
    isHeadlessBroadcaster() {
        return this.isEnabled() && this.headlessBroadcaster;
    }
    isObserver() {
        return this.isEnabled() && this.observer;
    }
    isConnected() {
        return this.isEnabled() && this.connected && this.ready;
    }
    isWaitingForPeer() {
        return this.isEnabled() && !this.ready;
    }
    getLocalPlayerIndex() {
        return this.localPlayerIndex;
    }
    isServerGhostEnabled() {
        return (this.isEnabled() &&
            !this.broadcaster &&
            !this.observer &&
            this.serverGhostEnabled);
    }
    getLocalServerTankSnapshot() {
        if (!this.isServerGhostEnabled() || !this.connected) {
            return null;
        }
        const frame = this.latestHostFrame?.players?.find((candidate) => {
            return candidate.partyIndex === this.localPlayerIndex;
        });
        if (frame === undefined ||
            !frame.alive ||
            !Number.isFinite(frame.x) ||
            !Number.isFinite(frame.y)) {
            return null;
        }
        return {
            partyIndex: frame.partyIndex,
            tier: frame.tier ?? tank_1.TankTier.A,
            x: frame.x,
            y: frame.y,
            rotation: frame.rotation,
            moving: frame.moving,
            fireSeq: Number.isFinite(frame.fireSeq)
                ? Math.max(0, Math.floor(frame.fireSeq))
                : 0,
            fireX: Number.isFinite(frame.fireX) ? frame.fireX : frame.x,
            fireY: Number.isFinite(frame.fireY) ? frame.fireY : frame.y,
            fireRotation: frame.fireRotation ?? frame.rotation,
        };
    }
    getSharedElapsedSeconds() {
        return this.sharedElapsedSeconds;
    }
    getPlayerScore(playerIndex) {
        const score = (this.activeReplayFrame ?? this.latestHostFrame)
            ?.playerScores?.[playerIndex];
        return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : null;
    }
    syncAuthoritativePlayerLives(session) {
        if (!this.isEnabled() || this.broadcaster)
            return;
        const lives = (this.activeReplayFrame ?? this.latestHostFrame)?.playerLives;
        if (!Array.isArray(lives) || lives.length !== 2)
            return;
        lives.forEach((count, playerIndex) => {
            if (Number.isFinite(count)) {
                session.getPlayer(playerIndex).setLivesCount(count);
            }
        });
    }
    consumeMatchResult() {
        const frame = this.activeReplayFrame ?? this.latestHostFrame;
        if (frame === null ||
            frame.seq <= this.consumedMatchResultSeq ||
            (frame.matchResult !== 'win' && frame.matchResult !== 'loss')) {
            return null;
        }
        this.consumedMatchResultSeq = frame.seq;
        return {
            result: frame.matchResult,
            playerScores: frame.playerScores,
            playerKillCounts: frame.playerKillCounts,
        };
    }
    async completeAuthoritativeMatch() {
        if (!this.isHeadlessBroadcaster() ||
            this.authorizationToken === '' ||
            this.resultSubmissionStarted) {
            return;
        }
        this.resultSubmissionStarted = true;
        const response = await fetch((0, api_1.getApiUrl)(`/api/multiplayer/matches/${encodeURIComponent(this.room)}/result`), {
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
        });
        if (!response.ok) {
            this.resultSubmissionStarted = false;
            throw new Error(`Authoritative result submission failed: ${response.status}`);
        }
    }
    shouldHoldClientSimulation() {
        return (this.isEnabled() &&
            !this.broadcaster &&
            ((this.clientSyncing && this.activeReplayFrame === null) ||
                this.stageWaiting));
    }
    prepareStage(stageNumber) {
        if (!this.isEnabled() || this.broadcaster || this.observer) {
            return;
        }
        this.expectedStageNumber = Math.max(1, Math.floor(stageNumber));
        this.stageWaiting = true;
        this.stageReadySentFor = 0;
        this.latestHostFrame = null;
        this.pendingPlayerTicks.clear();
        this.pendingEnemyTicks.clear();
        this.pendingEnemyDeaths.length = 0;
        this.pendingEnemyDeathSeqs.clear();
        this.pendingPowerupPickups.length = 0;
        this.lastAppliedEnemyDeathSeq = 0;
        this.lastQueuedPowerupPickupSeq = 0;
        this.lastPlayerFireSeqs.clear();
        this.lastEnemyFireSeqs.clear();
        this.lastPlayerPositions.clear();
        this.lastEnemyPositions.clear();
        this.sendStageReady();
    }
    beginCatchUpStep() {
        if (!this.clientSyncing ||
            this.recoveryUnavailable ||
            this.activeReplayFrame !== null) {
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
    endCatchUpStep() {
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
    isRemoteTank(partyIndex) {
        return (this.isEnabled() &&
            (this.broadcaster || this.observer || partyIndex !== this.localPlayerIndex));
    }
    shouldDisableEnemyShooting() {
        return (this.isHost() &&
            (this.disableEnemyShooting ||
                this.enemyShootingDisabledPlayers.size > 0));
    }
    handlePlayerTank(tank, updateArgs) {
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
            tank.setNetworkControlled(true);
            this.sendLocalInput(updateArgs, this.localPlayerIndex);
        }
        return true;
    }
    updateMatch(players, enemies, activeEnemyIds, powerup, powerupPickup, playerLives, playerScores, playerKillCounts, matchResult, deltaTime) {
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
        if (this.stageWaiting) {
            this.sendStageReady();
        }
        if (this.broadcaster) {
            if (!this.matchStarted) {
                return;
            }
            this.sharedElapsedSeconds += deltaTime;
            this.observePlayers(players);
            this.observeEnemies(enemies);
            this.sendHostFrame(players, enemies, activeEnemyIds, powerup, powerupPickup, playerLives, playerScores, playerKillCounts, matchResult, deltaTime);
            return;
        }
        if (this.activeReplayFrame !== null) {
            return;
        }
        const appliedSeq = this.pendingAppliedFrameSeqs.shift();
        if (appliedSeq !== undefined) {
            this.lastAppliedHostFrameSeq = appliedSeq;
            this.clientFrameCache.delete(appliedSeq);
        }
    }
    prepareNetworkTicks(players, enemies) {
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
            if (tank === null || tank === undefined) {
                return;
            }
            tank.setNetworkControlled(this.observer || tank.partyIndex !== this.localPlayerIndex);
        });
        if (this.activeReplayFrame !== null) {
            this.applyReplayPlayerFrames(players, frame.players ?? []);
            this.applyReplayEnemyFrames(enemies, frame.enemies ?? []);
            return;
        }
        this.applyPlayerFrames(players);
        this.applyEnemyFrames(enemies);
    }
    getActiveEnemyIds() {
        return (this.activeReplayFrame?.activeEnemyIds ??
            this.latestHostFrame?.activeEnemyIds ??
            []);
    }
    getReplayEnemySpawns() {
        return this.activeReplayFrame?.enemies ?? null;
    }
    isApplyingCatchUpFrame() {
        return this.activeReplayFrame !== null;
    }
    observeAuthoritativePlayerTank(tank) {
        if (this.broadcaster) {
            this.observePlayers([tank]);
        }
    }
    observeAuthoritativeEnemyTank(tank) {
        if (this.broadcaster) {
            this.observeEnemies([tank]);
        }
    }
    drainEnemyDeaths() {
        if (this.activeReplayFrame !== null) {
            this.queueEnemyDeaths(this.activeReplayFrame.enemyDeaths ?? []);
        }
        const deaths = this.pendingEnemyDeaths.splice(0, this.pendingEnemyDeaths.length);
        deaths.forEach((death) => {
            this.pendingEnemyDeathSeqs.delete(death.seq);
            this.lastAppliedEnemyDeathSeq = Math.max(this.lastAppliedEnemyDeathSeq, death.seq);
        });
        return deaths;
    }
    consumeRemotePowerSlot(playerIndex) {
        if (!this.broadcaster) {
            return null;
        }
        const slots = this.pendingRemotePowerSlots.get(playerIndex);
        if (slots === undefined || slots.length === 0) {
            return null;
        }
        const slot = slots.shift();
        if (slots.length === 0) {
            this.pendingRemotePowerSlots.delete(playerIndex);
        }
        return slot ?? null;
    }
    getPowerup() {
        return this.activeReplayFrame?.powerup ?? this.latestHostFrame?.powerup ?? null;
    }
    getPowerupPickup() {
        const replayPickup = this.activeReplayFrame?.powerupPickup ?? null;
        if (replayPickup !== null) {
            this.lastQueuedPowerupPickupSeq = Math.max(this.lastQueuedPowerupPickupSeq, replayPickup.seq);
            return replayPickup;
        }
        return this.pendingPowerupPickups.shift() ?? null;
    }
    queuePowerupPickup(pickup) {
        if (pickup === null ||
            !Number.isInteger(pickup.seq) ||
            pickup.seq <= this.lastQueuedPowerupPickupSeq) {
            return;
        }
        this.lastQueuedPowerupPickupSeq = pickup.seq;
        this.pendingPowerupPickups.push(pickup);
    }
    configure() {
        if (this.broadcaster) {
            this.configureLink(0);
            this.configureLink(1);
            this.startObserverDiscovery();
        }
        else if (this.observer) {
            if (this.transportMode === 'archive') {
                this.configureLink(observerLinkId(this.observerId));
            }
            else {
                this.startObserverHeartbeat();
            }
        }
        else {
            this.configureLink(this.localPlayerIndex);
        }
        this.start();
        if (this.broadcaster) {
            if (!this.headlessBroadcaster) {
                this.showPlayerControls();
            }
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
    resetPlayerRuntime() {
        this.links.forEach((sync) => sync.stop());
        this.links.clear();
        this.connectedPlayers.clear();
        this.activePlayers.clear();
        this.syncingPlayers.clear();
        this.enemyShootingDisabledPlayers.clear();
        this.frameHistory.length = 0;
        this.frameHistoryBySeq.clear();
        this.replaySessions.clear();
        this.pendingActivations.clear();
        this.remoteInputBuffers.clear();
        this.lastAppliedRemoteFireSeqs.clear();
        this.pendingRemoteFireSeqs.clear();
        this.lastProcessedRemoteInputSeqs.clear();
        this.pendingRemotePowerSlots.clear();
        this.recoveryFrames.clear();
        this.clientFrameCache.clear();
        this.pendingAppliedFrameSeqs.length = 0;
        this.pendingPlayerTicks.clear();
        this.pendingEnemyTicks.clear();
        this.pendingEnemyDeaths.length = 0;
        this.pendingEnemyDeathSeqs.clear();
        this.pendingPowerupPickups.length = 0;
        this.playerFireSeqs.clear();
        this.lastPlayerFireSeqs.clear();
        this.latestPlayerFire.clear();
        this.lastPlayerPositions.clear();
        this.enemyFireSeqs.clear();
        this.lastEnemyFireSeqs.clear();
        this.latestEnemyFire.clear();
        this.queuedEnemyDeaths.length = 0;
        this.lastEnemyPositions.clear();
        this.playerElapsedSeconds.clear();
        this.observedEnemies = new WeakSet();
        this.observedPlayers = new WeakSet();
        this.inputSeq = 0;
        this.frameSeq = 0;
        this.tick = 0;
        this.latestHostFrame = null;
        this.activeReplayFrame = null;
        this.consumedMatchResultSeq = 0;
        this.lastAppliedHostFrameSeq = 0;
        this.replayTargetSeq = 0;
        this.replayDeliveryComplete = false;
        this.lastReadyAckSeq = -1;
        this.clientSyncing = false;
        this.recoveryUnavailable = false;
        this.lastAppliedEnemyDeathSeq = 0;
        this.lastQueuedPowerupPickupSeq = 0;
        this.enemyDeathSeq = 0;
        this.started = false;
        this.matchStarted = false;
        this.connected = false;
        this.ready = false;
        this.localElapsedSeconds = 0;
        this.sharedElapsedSeconds = 0;
        this.hasSynchronizedClock = false;
        this.probeTimer = 0;
        this.probeSeq = 0;
        this.lastRttMs = null;
        this.rttMs = null;
        this.jitterMs = null;
        this.authoritativeScores = [0, 0];
        this.resultSubmissionStarted = false;
        this.expectedStageNumber = 1;
        this.stageWaiting = false;
        this.stageReadySentFor = 0;
        this.enabled = false;
        this.room = '';
        this.authorizationToken = '';
        this.websocketUrl = '';
        this.networkStatsElement?.remove();
        this.networkStatsElement = null;
        this.rttValueElement = null;
        this.jitterValueElement = null;
    }
    configureLink(linkId) {
        if (this.links.has(linkId)) {
            return;
        }
        if (this.transportMode === 'websocket') {
            if (this.broadcaster || linkId !== this.localPlayerIndex) {
                if (this.observer && this.websocketUrl !== '' && isObserverLink(linkId)) {
                    const sync = new WebSocketMatchLink_1.WebSocketMatchLink(this.websocketUrl);
                    sync.subscribePackets((packet) => this.acceptPacket(packet, linkId));
                    sync.subscribeConnection((connected) => this.handleConnection(linkId, connected));
                    this.links.set(linkId, sync);
                    if (this.started)
                        sync.start();
                }
                return;
            }
            const sync = new WebSocketMatchLink_1.WebSocketMatchLink(this.websocketUrl);
            sync.subscribePackets((packet) => this.acceptPacket(packet, linkId));
            sync.subscribeConnection((connected) => this.handleConnection(linkId, connected));
            this.links.set(linkId, sync);
            if (this.started)
                sync.start();
            return;
        }
        if (this.transportMode === 'archive') {
            if (this.observer && isObserverLink(linkId)) {
                const sync = new ArchiveMatchLink_1.ArchiveMatchLink((0, api_2.getApiBaseUrl)(), this.room, this.ticket);
                sync.subscribePackets((packet) => this.acceptPacket(packet, linkId));
                sync.subscribeConnection((connected) => this.handleConnection(linkId, connected));
                this.links.set(linkId, sync);
                if (this.started)
                    sync.start();
            }
            return;
        }
        const sync = new WebRtcGhostSync_1.WebRtcGhostSync();
        const signalingRoom = isObserverLink(linkId)
            ? `${this.room}-o-${linkId.slice('observer:'.length)}`
            : `${this.room}-p${linkId + 1}`;
        const signalingIndex = this.broadcaster ? 0 : 1;
        sync.configureDirect(true, signalingRoom, signalingIndex);
        sync.setSignalTransport(new HttpGhostSignalTransport_1.HttpGhostSignalTransport(signalingRoom, signalingIndex, this.signalingBaseUrl, this.authorizationToken));
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
    start() {
        if (this.started || !this.isEnabled()) {
            return;
        }
        this.started = true;
        this.links.forEach((sync) => sync.start());
        if (this.networkStatsEnabled &&
            !this.headlessBroadcaster &&
            !this.broadcaster) {
            this.ensureNetworkStatsElement();
        }
    }
    handleConnection(linkId, isConnected) {
        if (this.broadcaster) {
            if (isObserverLink(linkId) && isConnected) {
                this.sendToLink(linkId, {
                    type: 'webrtc-ready',
                    ready: this.matchStarted,
                    syncPlayer: null,
                    serverFrameSeq: this.frameSeq,
                });
                if (this.frameSeq > 0) {
                    this.replaySessions.set(linkId, {
                        nextSeq: 1,
                        targetSeq: this.frameSeq,
                    });
                    this.sendToLink(linkId, {
                        type: 'webrtc-replay-start',
                        fromSeq: 1,
                        targetSeq: this.frameSeq,
                    });
                }
                return;
            }
            if (isObserverLink(linkId)) {
                this.replaySessions.delete(linkId);
                return;
            }
            const reconnectingPlayer = this.matchStarted && isConnected;
            if (isConnected) {
                this.connectedPlayers.add(linkId);
                if (!this.matchStarted) {
                    this.activePlayers.add(linkId);
                }
                else {
                    this.syncingPlayers.add(linkId);
                    this.activePlayers.delete(linkId);
                }
            }
            else {
                this.connectedPlayers.delete(linkId);
                this.activePlayers.delete(linkId);
                this.enemyShootingDisabledPlayers.delete(linkId);
                this.replaySessions.delete(linkId);
                this.pendingActivations.delete(linkId);
                this.remoteInputBuffers.delete(linkId);
                this.pendingRemoteFireSeqs.delete(linkId);
                this.pendingRemotePowerSlots.delete(linkId);
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
            });
            const waitingFor = [0, 1]
                .filter((index) => !this.connectedPlayers.has(index))
                .map((index) => `player ${index + 1}`)
                .join(' and ');
            this.showStatus(this.matchStarted
                ? waitingFor === ''
                    ? `Broadcaster connected\nPlayers 1 and 2 active`
                    : `Match running\nWaiting for ${waitingFor} to reconnect`
                : `Broadcaster waiting for ${waitingFor}\nRoom: ${this.room}`);
            return;
        }
        this.connected = isConnected;
        if (!isConnected) {
            this.probeTimer = 0;
            this.lastRttMs = null;
            this.rttMs = null;
            this.jitterMs = null;
            this.updateNetworkStatsElement();
            if (!this.observer && this.ready && this.lastAppliedHostFrameSeq > 0) {
                this.beginClientSync();
            }
            else if (!this.ready) {
                this.ready = false;
            }
        }
        else if (!this.observer) {
            this.sendClientDebugSettings();
            if (this.clientSyncing) {
                this.sendResumeRequest();
            }
        }
        this.showClientStatus();
    }
    beginClientSync() {
        this.clientSyncing = true;
        this.recoveryUnavailable = false;
        this.replayDeliveryComplete = false;
        this.lastReadyAckSeq = -1;
        this.replayTargetSeq = this.lastAppliedHostFrameSeq;
        this.pendingPlayerTicks.clear();
        this.pendingEnemyTicks.clear();
        this.pendingEnemyDeaths.length = 0;
        this.pendingEnemyDeathSeqs.clear();
        this.pendingAppliedFrameSeqs.length = 0;
        this.clientFrameCache.forEach((frame, seq) => {
            if (seq > this.lastAppliedHostFrameSeq) {
                this.recoveryFrames.set(seq, frame);
            }
        });
    }
    sendResumeRequest() {
        this.sendToPlayer(this.localPlayerIndex, {
            type: 'webrtc-resume',
            player: this.localPlayerIndex,
            lastAppliedFrameSeq: this.lastAppliedHostFrameSeq,
        });
    }
    sendClientDebugSettings() {
        this.sendToPlayer(this.localPlayerIndex, {
            type: 'webrtc-client-debug',
            player: this.localPlayerIndex,
            disableEnemyShooting: this.disableEnemyShooting,
        });
    }
    handleResumeRequest(playerIndex, packet) {
        if (packet.player !== playerIndex ||
            !this.connectedPlayers.has(playerIndex) ||
            !Number.isInteger(packet.lastAppliedFrameSeq) ||
            packet.lastAppliedFrameSeq < 0 ||
            packet.lastAppliedFrameSeq > this.frameSeq) {
            return;
        }
        if (this.activePlayers.has(playerIndex)) {
            this.sendToPlayer(playerIndex, {
                type: 'webrtc-replay-ready',
                appliedSeq: packet.lastAppliedFrameSeq,
            });
            return;
        }
        const oldestAvailableSeq = this.frameHistory[0]?.seq ?? this.frameSeq + 1;
        if (packet.lastAppliedFrameSeq < oldestAvailableSeq - 1) {
            this.sendToPlayer(playerIndex, {
                type: 'webrtc-replay-unavailable',
                oldestAvailableSeq,
                serverSeq: this.frameSeq,
            });
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
        });
    }
    handleClientReady(playerIndex, packet) {
        if (packet.player !== playerIndex ||
            !this.syncingPlayers.has(playerIndex) ||
            !Number.isInteger(packet.appliedSeq) ||
            packet.appliedSeq < 0 ||
            packet.appliedSeq > this.frameSeq) {
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
        });
    }
    activatePlayer(playerIndex, appliedSeq) {
        const confirmationSent = this.sendToPlayer(playerIndex, {
            type: 'webrtc-replay-ready',
            appliedSeq,
        });
        if (!confirmationSent) {
            this.pendingActivations.set(playerIndex, appliedSeq);
            return;
        }
        this.syncingPlayers.delete(playerIndex);
        this.replaySessions.delete(playerIndex);
        this.pendingActivations.delete(playerIndex);
        this.activePlayers.add(playerIndex);
        this.remoteInputBuffers.delete(playerIndex);
        this.lastAppliedRemoteFireSeqs.delete(playerIndex);
        this.pendingRemoteFireSeqs.delete(playerIndex);
        this.pendingRemotePowerSlots.delete(playerIndex);
    }
    maybeAcknowledgeReplay() {
        if (!this.clientSyncing ||
            !this.replayDeliveryComplete ||
            this.activeReplayFrame !== null ||
            this.lastAppliedHostFrameSeq < this.replayTargetSeq ||
            this.recoveryFrames.has(this.lastAppliedHostFrameSeq + 1) ||
            this.lastReadyAckSeq === this.lastAppliedHostFrameSeq) {
            return;
        }
        if (this.observer) {
            this.finishClientSync(this.lastAppliedHostFrameSeq);
            return;
        }
        this.lastReadyAckSeq = this.lastAppliedHostFrameSeq;
        this.sendToPlayer(this.localPlayerIndex, {
            type: 'webrtc-client-ready',
            player: this.localPlayerIndex,
            appliedSeq: this.lastAppliedHostFrameSeq,
        });
    }
    finishClientSync(appliedSeq) {
        this.clientSyncing = false;
        this.recoveryUnavailable = false;
        this.replayDeliveryComplete = false;
        this.replayTargetSeq = appliedSeq;
        Array.from(this.recoveryFrames.values())
            .filter((frame) => frame.seq > this.lastAppliedHostFrameSeq)
            .sort((a, b) => a.seq - b.seq)
            .forEach((frame) => this.queueLiveFrame(frame, false));
        this.recoveryFrames.clear();
        this.showClientStatus();
    }
    showClientStatus() {
        if (this.observer) {
            this.showStatus(this.ready
                ? 'WebRTC observer connected'
                : this.connected
                    ? 'Observer waiting for match to start'
                    : `Observer connecting to broadcaster\nRoom: ${this.room}`);
            return;
        }
        const playerNumber = this.localPlayerIndex + 1;
        this.showStatus(this.recoveryUnavailable
            ? `Player ${playerNumber} recovery unavailable\nAuthoritative replay history is incomplete`
            : this.clientSyncing
                ? `Player ${playerNumber} synchronizing\nFrame ${this.lastAppliedHostFrameSeq} / ${this.replayTargetSeq}`
                : this.ready
                    ? `WebRTC match ready - player ${playerNumber}`
                    : this.connected
                        ? `Player ${playerNumber} waiting for other player`
                        : `Player ${playerNumber} connecting to broadcaster\nRoom: ${this.room}`);
    }
    sendToPlayer(playerIndex, packet) {
        return this.sendToLink(playerIndex, packet);
    }
    sendToLink(linkId, packet) {
        return this.links.get(linkId)?.sendWebRtcPacket(packet) ?? false;
    }
    broadcast(packet) {
        this.links.forEach((sync) => sync.sendWebRtcPacket(packet));
    }
    startObserverHeartbeat() {
        const heartbeat = async () => {
            try {
                const response = await fetch(this.observerRegistryUrl().toString(), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ observerId: this.observerId }),
                });
                if (!response.ok) {
                    const body = (await response.json());
                    throw new Error(body.error || `Observer registration failed: ${response.status}`);
                }
                const linkId = observerLinkId(this.observerId);
                if (!this.links.has(linkId)) {
                    this.configureLink(linkId);
                    this.start();
                }
            }
            catch (error) {
                this.showStatus(`Observer admission failed\n${error.message}`);
                log('observer heartbeat failed', error);
            }
            finally {
                this.observerHeartbeatTimer = window.setTimeout(heartbeat, OBSERVER_HEARTBEAT_MS);
            }
        };
        void heartbeat();
    }
    startObserverDiscovery() {
        const discover = async () => {
            try {
                const response = await fetch(this.observerRegistryUrl().toString(), {
                    headers: { accept: 'application/json' },
                });
                if (!response.ok) {
                    throw new Error(`Observer discovery failed: ${response.status}`);
                }
                const body = (await response.json());
                const activeLinks = new Set((body.observers ?? []).map((observerId) => observerLinkId(observerId)));
                activeLinks.forEach((linkId) => this.configureLink(linkId));
                Array.from(this.links.entries()).forEach(([linkId, sync]) => {
                    if (isObserverLink(linkId) && !activeLinks.has(linkId)) {
                        sync.stop();
                        this.links.delete(linkId);
                    }
                });
            }
            catch (error) {
                log('observer discovery failed', error);
            }
            finally {
                this.observerDiscoveryTimer = window.setTimeout(discover, OBSERVER_DISCOVERY_MS);
            }
        };
        void discover();
    }
    observerRegistryUrl() {
        return new URL((0, api_1.getApiUrl)(`/api/webrtc/matches/${encodeURIComponent(this.room)}/observers`));
    }
    acceptPacket(packet, linkId) {
        if (!this.isEnabled()) {
            return;
        }
        if (packet.type === 'webrtc-ping') {
            const ping = packet;
            if (!Number.isFinite(ping.id) ||
                !Number.isFinite(ping.sentAt)) {
                return;
            }
            this.sendToLink(linkId, {
                type: 'webrtc-pong',
                id: ping.id,
                sentAt: ping.sentAt,
                senderPlayerIndex: this.broadcaster
                    ? -1
                    : this.localPlayerIndex,
            });
            return;
        }
        if (packet.type === 'webrtc-pong') {
            const pong = packet;
            if (this.broadcaster ||
                pong.id !== this.probeSeq ||
                !Number.isFinite(pong.sentAt)) {
                return;
            }
            this.applyNetworkProbe(performance.now() - pong.sentAt);
            return;
        }
        if (!this.broadcaster && packet.type === 'webrtc-ready') {
            const ready = packet;
            this.ready = ready.ready === true;
            if (ready.syncPlayer === this.localPlayerIndex) {
                this.stageWaiting = false;
            }
            if (!this.observer &&
                ready.syncPlayer === this.localPlayerIndex &&
                !this.clientSyncing) {
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
            this.handleResumeRequest(linkId, packet);
            return;
        }
        if (this.broadcaster && packet.type === 'webrtc-client-ready') {
            if (isObserverLink(linkId)) {
                return;
            }
            this.handleClientReady(linkId, packet);
            return;
        }
        if (this.broadcaster && packet.type === 'webrtc-client-debug') {
            const debug = packet;
            if (isObserverLink(linkId) || debug.player !== linkId) {
                return;
            }
            if (debug.disableEnemyShooting === true) {
                this.enemyShootingDisabledPlayers.add(linkId);
            }
            else {
                this.enemyShootingDisabledPlayers.delete(linkId);
            }
            return;
        }
        if (!this.broadcaster && packet.type === 'webrtc-replay-start') {
            const replay = packet;
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
            const replay = packet;
            this.replayTargetSeq = Math.max(this.replayTargetSeq, replay.targetSeq);
            this.replayDeliveryComplete = true;
            this.maybeAcknowledgeReplay();
            return;
        }
        if (!this.broadcaster && packet.type === 'webrtc-replay-ready') {
            const replay = packet;
            if (replay.appliedSeq > this.lastAppliedHostFrameSeq) {
                return;
            }
            this.finishClientSync(replay.appliedSeq);
            return;
        }
        if (!this.broadcaster && packet.type === 'webrtc-replay-unavailable') {
            const unavailable = packet;
            this.beginClientSync();
            this.recoveryUnavailable = true;
            this.replayTargetSeq = unavailable.serverSeq;
            this.showClientStatus();
            return;
        }
        if (this.broadcaster && packet.type === 'webrtc-input') {
            const input = packet;
            if (isObserverLink(linkId) ||
                !this.activePlayers.has(linkId) ||
                input.player !== linkId ||
                !isPowerSlot(input.powerSlot)) {
                return;
            }
            if (!this.getRemoteInputBuffer(linkId).accept(input)) {
                return;
            }
            if (input.fire) {
                let fireSeqs = this.pendingRemoteFireSeqs.get(linkId);
                if (fireSeqs === undefined) {
                    fireSeqs = [];
                    this.pendingRemoteFireSeqs.set(linkId, fireSeqs);
                }
                if (fireSeqs.length < 16) {
                    fireSeqs.push(input.seq);
                }
            }
            if (input.powerSlot !== null && input.powerSlot !== undefined) {
                let slots = this.pendingRemotePowerSlots.get(linkId);
                if (slots === undefined) {
                    slots = [];
                    this.pendingRemotePowerSlots.set(linkId, slots);
                }
                if (slots.length < 16) {
                    slots.push(input.powerSlot);
                }
            }
            if (Number.isFinite(input.elapsedSeconds)) {
                this.playerElapsedSeconds.set(linkId, input.elapsedSeconds);
            }
            return;
        }
        if (!this.broadcaster && packet.type === 'webrtc-host-frame') {
            const frame = packet;
            if (!Number.isInteger(frame.seq) || frame.seq <= 0) {
                return;
            }
            const frameStage = Math.max(1, Math.floor(frame.stageNumber || 1));
            if (frameStage < this.expectedStageNumber) {
                return;
            }
            if (frameStage === this.expectedStageNumber) {
                this.stageWaiting = false;
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
            const isInitialObserverFrame = this.observer && this.latestHostFrame === null;
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
    queueLiveFrame(frame, initialSync) {
        this.pendingAppliedFrameSeqs.push(frame.seq);
        this.queueEnemyDeaths(frame.enemyDeaths ?? []);
        this.queuePowerupPickup(frame.powerupPickup);
        (frame.players ?? []).forEach((playerFrame) => {
            let ticks = this.pendingPlayerTicks.get(playerFrame.partyIndex);
            if (ticks === undefined) {
                ticks = [];
                this.pendingPlayerTicks.set(playerFrame.partyIndex, ticks);
            }
            if (playerFrame.initialSync === true) {
                ticks.length = 0;
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
    sendStageReady() {
        if (!this.connected ||
            (!this.ready && !this.stageWaiting) ||
            this.stageReadySentFor === this.expectedStageNumber) {
            return;
        }
        if (this.sendToPlayer(this.localPlayerIndex, {
            type: 'webrtc-stage-ready',
            player: this.localPlayerIndex,
            stageNumber: this.expectedStageNumber,
        })) {
            this.stageReadySentFor = this.expectedStageNumber;
        }
    }
    sendLocalInput(updateArgs, player) {
        const input = this.readInput(updateArgs);
        this.inputSeq += 1;
        const packet = {
            type: 'webrtc-input',
            player,
            seq: this.inputSeq,
            tick: this.tick,
            direction: input.direction,
            moving: input.moving,
            fire: input.fire,
            powerSlot: input.powerSlot,
            elapsedSeconds: this.localElapsedSeconds,
        };
        this.sendToPlayer(player, packet);
    }
    applyRemoteInput(tank, deltaTime) {
        const inputBuffer = this.remoteInputBuffers.get(tank.partyIndex);
        if (inputBuffer === undefined ||
            inputBuffer.isStale(Date.now(), REMOTE_INPUT_TIMEOUT_MS)) {
            tank.idle(false);
            return;
        }
        const input = inputBuffer.consumeNext();
        if (input === null) {
            tank.idle(false);
            return;
        }
        const fireSeqs = this.pendingRemoteFireSeqs.get(tank.partyIndex);
        const shouldFire = fireSeqs !== undefined && fireSeqs.length > 0 && fireSeqs[0] <= input.seq;
        if (shouldFire) {
            while (fireSeqs.length > 0 && fireSeqs[0] <= input.seq) {
                fireSeqs.shift();
            }
        }
        const appliedInput = shouldFire && !input.fire
            ? { ...input, fire: true }
            : input;
        const lastFireSeq = this.lastAppliedRemoteFireSeqs.get(tank.partyIndex) ?? 0;
        const appliedFireSeq = (0, applyRemotePlayerInput_1.applyRemotePlayerInput)(tank, appliedInput, deltaTime, lastFireSeq);
        this.lastAppliedRemoteFireSeqs.set(tank.partyIndex, appliedFireSeq);
        this.lastProcessedRemoteInputSeqs.set(tank.partyIndex, input.seq);
    }
    getRemoteInputBuffer(playerIndex) {
        let inputBuffer = this.remoteInputBuffers.get(playerIndex);
        if (inputBuffer === undefined) {
            inputBuffer = new OrderedInputBuffer_1.OrderedInputBuffer();
            this.remoteInputBuffers.set(playerIndex, inputBuffer);
        }
        return inputBuffer;
    }
    readInput(updateArgs) {
        const inputMethod = updateArgs.inputManager.getActiveMethod();
        const direction = this.readDirection(updateArgs);
        return {
            direction,
            moving: direction !== null,
            fire: inputMethod.isDownAny(input_1.LevelPlayInputContext.Fire) ||
                inputMethod.isHoldAny(input_1.LevelPlayInputContext.RapidFire),
            powerSlot: this.readPowerSlot(updateArgs),
        };
    }
    readPowerSlot(updateArgs) {
        const inputMethod = updateArgs.inputManager.getActiveMethod();
        const controls = [
            input_1.LevelPlayInputContext.PowerOne,
            input_1.LevelPlayInputContext.PowerTwo,
            input_1.LevelPlayInputContext.PowerThree,
            input_1.LevelPlayInputContext.PowerFour,
        ];
        const slot = controls.findIndex((control) => {
            return inputMethod.isDownAny(control);
        });
        return slot >= 0 ? slot : null;
    }
    readDirection(updateArgs) {
        const inputMethod = updateArgs.inputManager.getActiveMethod();
        const directions = [
            [input_1.LevelPlayInputContext.MoveUp, game_1.Rotation.Up],
            [input_1.LevelPlayInputContext.MoveDown, game_1.Rotation.Down],
            [input_1.LevelPlayInputContext.MoveLeft, game_1.Rotation.Left],
            [input_1.LevelPlayInputContext.MoveRight, game_1.Rotation.Right],
        ];
        let bestIndex = -1;
        let bestRotation = null;
        for (const [controls, rotation] of directions) {
            const index = inputMethod.getHoldLastIndex(controls);
            if (index > bestIndex) {
                bestIndex = index;
                bestRotation = rotation;
            }
        }
        return bestRotation;
    }
    sendHostFrame(players, enemies, activeEnemyIds, powerup, powerupPickup, playerLives, playerScores, playerKillCounts, matchResult, deltaTime) {
        const activeEnemyIdSet = new Set(activeEnemyIds);
        Array.from(this.lastEnemyPositions.keys()).forEach((partyIndex) => {
            if (!activeEnemyIdSet.has(partyIndex)) {
                this.lastEnemyPositions.delete(partyIndex);
            }
        });
        const frame = {
            type: 'webrtc-host-frame',
            seq: ++this.frameSeq,
            tick: this.tick,
            lastProcessedInputSeq: [
                this.lastProcessedRemoteInputSeqs.get(0) ?? 0,
                this.lastProcessedRemoteInputSeqs.get(1) ?? 0,
            ],
            deltaTime: Math.min(Math.max(deltaTime, 0), 0.1),
            stageNumber: this.expectedStageNumber,
            matchResult,
            playerLives: playerLives.map((lives) => {
                return Math.max(0, Math.floor(lives));
            }),
            playerScores: playerScores.map((score) => {
                return Math.max(0, Math.floor(score));
            }),
            playerKillCounts,
            sharedElapsedSeconds: this.sharedElapsedSeconds,
            playerOneElapsedSeconds: this.playerElapsedSeconds.get(0) ?? 0,
            playerTwoElapsedSeconds: this.playerElapsedSeconds.get(1) ?? 0,
            players: players
                .filter((tank) => tank !== null && tank !== undefined)
                .map((tank) => this.createPlayerFrame(tank)),
            powerup,
            powerupPickup,
            activeEnemyIds,
            enemyDeaths: this.queuedEnemyDeaths.splice(0, this.queuedEnemyDeaths.length),
            enemies: enemies.map((tank) => this.createEnemyFrame(tank)),
        };
        this.frameHistory.push(frame);
        this.frameHistoryBySeq.set(frame.seq, frame);
        this.broadcast(frame);
        this.pumpReplaySessions();
        this.pumpPendingActivations();
    }
    pumpPendingActivations() {
        this.pendingActivations.forEach((appliedSeq, playerIndex) => {
            this.activatePlayer(playerIndex, appliedSeq);
        });
    }
    pumpReplaySessions() {
        this.replaySessions.forEach((session, linkId) => {
            let sent = 0;
            while (session.nextSeq <= session.targetSeq &&
                sent < REPLAY_FRAMES_PER_HOST_TICK) {
                const frame = this.frameHistoryBySeq.get(session.nextSeq);
                if (frame === undefined) {
                    this.sendToLink(linkId, {
                        type: 'webrtc-replay-unavailable',
                        oldestAvailableSeq: this.frameHistory[0]?.seq ?? this.frameSeq + 1,
                        serverSeq: this.frameSeq,
                    });
                    this.replaySessions.delete(linkId);
                    return;
                }
                if (!this.sendToLink(linkId, frame)) {
                    break;
                }
                session.nextSeq += 1;
                sent += 1;
            }
            if (session.nextSeq > session.targetSeq) {
                const completionSent = this.sendToLink(linkId, {
                    type: 'webrtc-replay-complete',
                    targetSeq: session.targetSeq,
                });
                if (completionSent) {
                    this.replaySessions.delete(linkId);
                }
            }
        });
    }
    createPlayerFrame(tank) {
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
            partyIndex: tank.partyIndex,
            tier: tank.type.tier,
            x: tank.position.x,
            y: tank.position.y,
            rotation: tank.rotation,
            moving: tank.state === gameObjects_1.TankState.Moving,
            deltaX,
            deltaY,
            alive: tank.isAlive(),
            fireSeq: this.playerFireSeqs.get(tank.partyIndex) ?? 0,
            fireX: fire?.x ?? tank.position.x,
            fireY: fire?.y ?? tank.position.y,
            fireRotation: fire?.rotation ?? tank.rotation,
            initialSync: !sameTank,
        };
    }
    createEnemyFrame(tank) {
        const previousPosition = this.lastEnemyPositions.get(tank.partyIndex);
        const deltaX = previousPosition === undefined
            ? 0
            : tank.position.x - previousPosition.x;
        const deltaY = previousPosition === undefined
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
            moving: tank.state === gameObjects_1.TankState.Moving,
            deltaX,
            deltaY,
            alive: tank.isAlive(),
            fireSeq: this.enemyFireSeqs.get(tank.partyIndex) ?? 0,
            fireX: fire?.x ?? tank.position.x,
            fireY: fire?.y ?? tank.position.y,
            fireRotation: fire?.rotation ?? tank.rotation,
        };
    }
    applyEnemyFrames(enemies) {
        this.pendingEnemyTicks.forEach((ticks, partyIndex) => {
            const tank = enemies.find((candidate) => {
                return candidate.partyIndex === partyIndex;
            });
            if (tank === undefined || ticks.length === 0) {
                return;
            }
            tank.setNetworkControlled(true);
            ticks
                .splice(0, this.observer ? ticks.length : MAX_ENEMY_TICKS_PER_UPDATE)
                .forEach((frame) => {
                const useAbsolutePosition = this.observer || frame.initialSync === true;
                tank.applyNetworkMovement(frame.rotation, frame.moving, useAbsolutePosition && Number.isFinite(frame.x)
                    ? frame.x - tank.position.x
                    : Number.isFinite(frame.deltaX)
                        ? frame.deltaX
                        : 0, useAbsolutePosition && Number.isFinite(frame.y)
                    ? frame.y - tank.position.y
                    : Number.isFinite(frame.deltaY)
                        ? frame.deltaY
                        : 0);
                const lastFireSeq = this.lastEnemyFireSeqs.get(frame.partyIndex) ?? 0;
                if (tank.collider.isInitialized() &&
                    frame.fireSeq > lastFireSeq) {
                    this.lastEnemyFireSeqs.set(frame.partyIndex, frame.fireSeq);
                    tank.fireFromNetwork(Number.isFinite(frame.fireX) ? frame.fireX : tank.position.x, Number.isFinite(frame.fireY) ? frame.fireY : tank.position.y, frame.fireRotation ?? frame.rotation);
                }
            });
            if (ticks.length === 0) {
                this.pendingEnemyTicks.delete(partyIndex);
            }
        });
    }
    queueEnemyDeaths(deaths) {
        deaths.forEach((death) => {
            if (!Number.isInteger(death.seq) ||
                death.seq <= this.lastAppliedEnemyDeathSeq ||
                this.pendingEnemyDeathSeqs.has(death.seq)) {
                return;
            }
            this.pendingEnemyDeathSeqs.add(death.seq);
            this.pendingEnemyDeaths.push(death);
        });
    }
    applyReplayEnemyFrames(enemies, frames) {
        frames.forEach((frame) => {
            const tank = enemies.find((candidate) => candidate.partyIndex === frame.partyIndex);
            if (tank === undefined) {
                return;
            }
            tank.setNetworkControlled(true);
            tank.applyNetworkMovement(frame.rotation, frame.moving, Number.isFinite(frame.x) ? frame.x - tank.position.x : 0, Number.isFinite(frame.y) ? frame.y - tank.position.y : 0);
            const lastFireSeq = this.lastEnemyFireSeqs.get(frame.partyIndex) ?? 0;
            if (tank.collider.isInitialized() && frame.fireSeq > lastFireSeq) {
                this.lastEnemyFireSeqs.set(frame.partyIndex, frame.fireSeq);
                tank.fireFromNetwork(Number.isFinite(frame.fireX) ? frame.fireX : tank.position.x, Number.isFinite(frame.fireY) ? frame.fireY : tank.position.y, frame.fireRotation ?? frame.rotation);
            }
        });
    }
    applyPlayerFrames(players) {
        this.pendingPlayerTicks.forEach((ticks, partyIndex) => {
            const tank = players.find((candidate) => {
                return (candidate !== null &&
                    candidate !== undefined &&
                    candidate.partyIndex === partyIndex);
            });
            if (tank === undefined || ticks.length === 0) {
                return;
            }
            tank.setNetworkControlled(true);
            const ticksToApply = ticks.length > PLAYER_TICK_CATCH_UP_BACKLOG
                ? MAX_PLAYER_TICKS_PER_UPDATE
                : 1;
            ticks.splice(0, ticksToApply).forEach((frame) => {
                tank.setNetworkTier(frame.tier ?? tank_1.TankTier.A);
                tank.applyNetworkMovement(frame.rotation, frame.moving, frame.initialSync && Number.isFinite(frame.x)
                    ? frame.x - tank.position.x
                    : Number.isFinite(frame.deltaX)
                        ? frame.deltaX
                        : 0, frame.initialSync && Number.isFinite(frame.y)
                    ? frame.y - tank.position.y
                    : Number.isFinite(frame.deltaY)
                        ? frame.deltaY
                        : 0);
                const lastFireSeq = this.lastPlayerFireSeqs.get(frame.partyIndex) ?? 0;
                if (tank.collider.isInitialized() &&
                    frame.fireSeq > lastFireSeq) {
                    this.lastPlayerFireSeqs.set(frame.partyIndex, frame.fireSeq);
                    tank.fireFromNetwork(frame.fireX, frame.fireY, frame.fireRotation);
                }
            });
            if (ticks.length === 0) {
                this.pendingPlayerTicks.delete(partyIndex);
            }
        });
    }
    applyReplayPlayerFrames(players, frames) {
        frames.forEach((frame) => {
            const tank = players.find((candidate) => {
                return (candidate !== null &&
                    candidate !== undefined &&
                    candidate.partyIndex === frame.partyIndex);
            });
            if (tank === undefined) {
                return;
            }
            tank.setNetworkControlled(true);
            tank.setNetworkTier(frame.tier ?? tank_1.TankTier.A);
            tank.applyNetworkMovement(frame.rotation, frame.moving, Number.isFinite(frame.deltaX) ? frame.deltaX : 0, Number.isFinite(frame.deltaY) ? frame.deltaY : 0);
            const lastFireSeq = this.lastPlayerFireSeqs.get(frame.partyIndex) ?? 0;
            if (tank.collider.isInitialized() && frame.fireSeq > lastFireSeq) {
                this.lastPlayerFireSeqs.set(frame.partyIndex, frame.fireSeq);
                tank.fireFromNetwork(frame.fireX, frame.fireY, frame.fireRotation);
            }
        });
    }
    observePlayers(players) {
        players.forEach((tank) => {
            if (tank === null || tank === undefined) {
                return;
            }
            if (this.observedPlayers.has(tank)) {
                return;
            }
            this.observedPlayers.add(tank);
            this.remoteInputBuffers.delete(tank.partyIndex);
            this.pendingRemoteFireSeqs.delete(tank.partyIndex);
            tank.fired.addListener(() => {
                this.playerFireSeqs.set(tank.partyIndex, (this.playerFireSeqs.get(tank.partyIndex) ?? 0) + 1);
                this.latestPlayerFire.set(tank.partyIndex, {
                    x: tank.position.x,
                    y: tank.position.y,
                    rotation: tank.rotation,
                });
            });
        });
    }
    observeEnemies(enemies) {
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
                this.enemyFireSeqs.set(tank.partyIndex, (this.enemyFireSeqs.get(tank.partyIndex) ?? 0) + 1);
            });
            tank.died.addListener((event) => {
                const center = tank.getCenter();
                this.queuedEnemyDeaths.push({
                    seq: ++this.enemyDeathSeq,
                    partyIndex: tank.partyIndex,
                    x: center.x,
                    y: center.y,
                    reason: event.reason,
                    hitterPartyIndex: event.hitterPartyIndex === 0 || event.hitterPartyIndex === 1
                        ? event.hitterPartyIndex
                        : null,
                });
            });
        });
    }
    updateNetworkProbe(deltaTime) {
        if (this.broadcaster) {
            return;
        }
        this.probeTimer += deltaTime;
        if (this.probeTimer < NETWORK_PROBE_INTERVAL_SECONDS) {
            return;
        }
        this.probeTimer = 0;
        this.probeSeq += 1;
        const linkId = this.observer
            ? observerLinkId(this.observerId)
            : this.localPlayerIndex;
        this.sendToLink(linkId, {
            type: 'webrtc-ping',
            id: this.probeSeq,
            sentAt: performance.now(),
            senderPlayerIndex: this.observer ? -1 : this.localPlayerIndex,
        });
    }
    applyNetworkProbe(sampleRttMs) {
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
        this.updateNetworkStatsElement();
    }
    updateNetworkStatsElement() {
        if (this.networkStatsElement === null) {
            return;
        }
        this.rttValueElement.textContent = this.formatMilliseconds(this.rttMs);
        this.jitterValueElement.textContent = this.formatMilliseconds(this.jitterMs);
    }
    formatMilliseconds(value) {
        return value === null || !Number.isFinite(value)
            ? '-- ms'
            : `${value.toFixed(1)} ms`;
    }
    ensureNetworkStatsElement() {
        if (this.networkStatsElement !== null) {
            return this.networkStatsElement;
        }
        const element = document.createElement('aside');
        element.className = 'webrtc-network-stats';
        element.setAttribute('aria-label', 'WebRTC network latency');
        const title = document.createElement('strong');
        title.className = 'webrtc-network-stats__title';
        title.textContent = 'WEBRTC';
        element.appendChild(title);
        const addRow = (label) => {
            const row = document.createElement('div');
            row.className = 'webrtc-network-stats__row';
            const labelElement = document.createElement('span');
            labelElement.textContent = label;
            const valueElement = document.createElement('output');
            valueElement.textContent = '-- ms';
            row.append(labelElement, valueElement);
            element.appendChild(row);
            return valueElement;
        };
        this.rttValueElement = addRow('PING');
        this.jitterValueElement = addRow('JITTER');
        document.body.appendChild(element);
        this.networkStatsElement = element;
        return element;
    }
    createPlayerUrl(playerIndex) {
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
    createObserverUrl() {
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
    showPlayerControls() {
        [0, 1].forEach((playerIndex) => {
            const url = this.createPlayerUrl(playerIndex);
            const button = this.ensureJoinButton(playerIndex);
            const label = `Copy WebRTC player-${playerIndex + 1} link`;
            button.type = 'button';
            button.textContent = label;
            button.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(url);
                    button.textContent = `WebRTC player-${playerIndex + 1} link copied`;
                    window.setTimeout(() => {
                        button.textContent = label;
                    }, 2000);
                }
                catch {
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
        observerButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(observerUrl);
                observerButton.textContent = 'WebRTC observer link copied';
                window.setTimeout(() => {
                    observerButton.textContent = observerLabel;
                }, 2000);
            }
            catch {
                observerButton.textContent = 'Copy failed - check DevTools';
            }
        };
        log(`observer link: ${observerUrl}`);
    }
    showStatus(message) {
        log(message.replace(/\n/g, ' '));
    }
    ensureJoinButton(linkId) {
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
exports.WebRtcHostMatchSync = WebRtcHostMatchSync;
