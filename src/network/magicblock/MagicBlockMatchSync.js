"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagicBlockMatchSync = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const ephemeral_rollups_sdk_1 = require("@magicblock-labs/ephemeral-rollups-sdk");
const web3_js_1 = require("@solana/web3.js");
const buffer_1 = require("buffer");
const core_1 = require("../../core");
const game_1 = require("../../game");
const terrain_1 = require("../../terrain");
const wallet_1 = require("../../wallet");
const config = __importStar(require("../../config"));
const webrtc_1 = require("../webrtc");
const TankMovementIdl_1 = require("./TankMovementIdl");
const PROGRAM_ID = new web3_js_1.PublicKey('Aaxx2EcXQA5My5isrPw35FWPGUve4jaiW8u3ER9c9tRu');
const BASE_RPC = 'https://rpc.magicblock.app/devnet';
const ROUTER_RPC = 'https://devnet-router.magicblock.app';
const MAGIC_CONTEXT_ID = new web3_js_1.PublicKey('MagicContext1111111111111111111111111111111');
const MAINNET_ER_ENDPOINTS = [
    'https://as.magicblock.app',
    'https://eu.magicblock.app',
    'https://us.magicblock.app',
    'https://mainnet-tee.magicblock.app',
];
const MATCH_SEED = buffer_1.Buffer.from('match');
const TERRAIN_SEED = buffer_1.Buffer.from('terrain');
const SESSION_TARGET_BALANCE = 0.05 * web3_js_1.LAMPORTS_PER_SOL;
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
const MATCH_ACCOUNT_PROJECTILES_OFFSET = MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE * 2;
const MATCH_ACCOUNT_SIZE = MATCH_ACCOUNT_PROJECTILES_OFFSET +
    PROJECTILE_SNAPSHOT_SIZE * MAX_PROJECTILES_PER_PLAYER * 2 +
    2;
const MAX_BOARD_MUTATIONS = 256;
const BOARD_MUTATION_SIZE = 2;
const MATCH_ACCOUNT_WITH_BOARD_SIZE = MATCH_ACCOUNT_SIZE + MAX_BOARD_MUTATIONS * BOARD_MUTATION_SIZE + 2;
const MAX_ENEMY_FIRE_EVENTS = 16;
const ENEMY_FIRE_EVENT_SIZE = 27;
const MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET = MATCH_ACCOUNT_WITH_BOARD_SIZE;
const MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE = MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET +
    MAX_ENEMY_FIRE_EVENTS * ENEMY_FIRE_EVENT_SIZE +
    2 +
    8;
const ENEMY_SPAWN_COUNT = 3;
const MAX_ENEMY_TOTAL = 20;
const MAX_ACTIVE_ENEMIES = 6;
const ENEMY_STATE_SIZE = 21;
const MATCH_ACCOUNT_ENEMIES_OFFSET = MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE +
    ENEMY_SPAWN_COUNT * 8 +
    1 +
    MAX_ENEMY_TOTAL;
const MATCH_ACCOUNT_WITH_ENEMIES_SIZE = MATCH_ACCOUNT_ENEMIES_OFFSET +
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
];
var MatchSyncState;
(function (MatchSyncState) {
    MatchSyncState[MatchSyncState["Idle"] = 0] = "Idle";
    MatchSyncState[MatchSyncState["Starting"] = 1] = "Starting";
    MatchSyncState[MatchSyncState["Waiting"] = 2] = "Waiting";
    MatchSyncState[MatchSyncState["Ready"] = 3] = "Ready";
    MatchSyncState[MatchSyncState["Failed"] = 4] = "Failed";
})(MatchSyncState || (MatchSyncState = {}));
class MagicBlockMatchSync {
    constructor() {
        this.log = new core_1.Logger('MagicBlockMatch', core_1.Logger.Level.Info);
        this.baseConnection = new web3_js_1.Connection(BASE_RPC, 'confirmed');
        this.routerConnection = new ephemeral_rollups_sdk_1.ConnectionMagicRouter(ROUTER_RPC, 'confirmed');
        this.instructionCoder = new anchor_1.BorshInstructionCoder(TankMovementIdl_1.TANK_MOVEMENT_IDL);
        this.state = MatchSyncState.Idle;
        this.matchId = null;
        this.matchPda = null;
        this.terrainPda = null;
        this.session = null;
        this.erConnection = null;
        this.target = null;
        this.accountSubscription = null;
        this.lastPollAt = 0;
        this.polling = false;
        this.sending = false;
        this.sequence = 0;
        this.lastLocalX = 0;
        this.lastLocalY = 0;
        this.lastSendAt = 0;
        this.localBulletWallDamage = 1;
        this.remoteStateInitialized = false;
        this.remoteWaypoints = [];
        this.lastQueuedRemoteSequence = -1;
        this.observerRemoteStateInitialized = [
            false,
            false,
        ];
        this.observerRemoteWaypoints = [
            [],
            [],
        ];
        this.observerLastQueuedRemoteSequence = [-1, -1];
        this.localTankIdentity = null;
        this.localTankWasRemoved = false;
        this.pendingRespawnTank = null;
        this.pendingInputFrames = [];
        this.knownBoardMutations = new Set();
        this.remoteBoardMutations = [];
        this.knownBoardMutationEpoch = -1;
        this.pendingEnemyFireEvents = [];
        this.playerMirrorBulletsSuppressed = false;
        this.lastEnemyFireSequence = 0;
        this.capturedLocalX = 0;
        this.capturedLocalY = 0;
        this.lastCapturedDirection = null;
        this.currentLevelNumber = 1;
        this.statusContainer = null;
        this.statusMessageElement = null;
        this.joinButtonElement = null;
        this.latencyButtonElement = null;
        this.inputLatencyButtonElement = null;
        this.mainnetLatencyButtonElement = null;
        this.inputLatencyProbe = null;
        this.erEndpoint = null;
        this.initializedEnemies = new Set();
        this.enemyReplayStates = new Map();
        this.ghostSignalTransport = null;
        this.fail = (error) => {
            this.state = MatchSyncState.Failed;
            this.showStatus('MagicBlock match failed - check console');
            this.log.error('Match setup failed.', error);
        };
        this.handleMovementError = (error) => {
            this.sending = false;
            this.log.warn('Authoritative movement update failed; retrying.', error);
        };
        this.handleRefreshError = (error) => {
            this.polling = false;
            this.log.warn('Match refresh failed; retrying.', error);
        };
        const params = new URLSearchParams(window.location.search);
        this.enabled = params.get('mode') === 'match';
        this.observerMode = params.get('observer') === '1';
        this.localPlayerIndex =
            !this.observerMode && params.get('join') === '1' ? 1 : 0;
        this.debugDisableEnemyShooting = params.get('debugNoEnemyShooting') === '1';
        this.matchId = this.parseMatchId(params.get('match'));
        if (this.enabled) {
            this.showStatus(this.observerMode
                ? 'Opening MagicBlock observer...'
                : this.localPlayerIndex === 0
                    ? 'Preparing MagicBlock match...'
                    : 'Joining MagicBlock match...');
            this.configureGhostSignalTransport();
        }
    }
    isEnabled() {
        return this.enabled;
    }
    getLocalPlayerIndex() {
        return this.localPlayerIndex;
    }
    isObserver() {
        return this.enabled && this.observerMode;
    }
    isRemoteTank(partyIndex) {
        return this.enabled && (this.observerMode || partyIndex !== this.localPlayerIndex);
    }
    update(tanks, deltaTime, levelNumber, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions) {
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
            void this.start(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions).catch(this.fail);
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
                void this.respawnLocalPlayer(this.pendingRespawnTank).catch(this.handleMovementError);
            }
            return;
        }
        this.reconcileLocalState(localTank, deltaTime);
        this.refreshIfStale();
        if (!this.sending && Date.now() - this.lastSendAt >= SEND_INTERVAL_MS) {
            void this.sendPendingInputBatch().catch(this.handleMovementError);
        }
    }
    recordLocalFire(tank) {
        if (this.observerMode ||
            this.state !== MatchSyncState.Ready ||
            tank !== this.localTankIdentity ||
            this.pendingRespawnTank !== null) {
            return;
        }
        const direction = this.fromGameRotation(tank.rotation);
        this.enqueueInputFrame(direction, 0, true);
        this.lastCapturedDirection = direction;
    }
    recordBoardCellDestroyed(centerX, centerY) {
        // Local bullet terrain damage is cosmetic only. Authoritative board
        // mutations must come from the ER/server state, otherwise a replayed mirror
        // bullet can submit the same wall destruction as a second canonical hit.
    }
    drainRemoteBoardMutations() {
        return this.remoteBoardMutations.splice(0);
    }
    applyEnemyState(tanks, playerTanks, basePosition, deltaTime) {
        if (this.state !== MatchSyncState.Ready || this.target === null) {
            return;
        }
        const activeEnemyIds = new Set(this.target.enemies.map((snapshot) => snapshot.id));
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
    getActiveEnemyIds() {
        return this.target?.enemies.map((enemy) => enemy.id) ?? [];
    }
    setPlayerMirrorBulletsSuppressed(suppressed) {
        this.playerMirrorBulletsSuppressed = suppressed;
    }
    getEnemyReplayState(snapshot, x, y) {
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
    queueEnemyMovementSegment(snapshot, replayState, x, y) {
        const deltaX = x - replayState.authorityX;
        const deltaY = y - replayState.authorityY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance <= LOCAL_PREDICTION_EPSILON &&
            snapshot.direction === replayState.authorityDirection) {
            return;
        }
        replayState.segments.push({
            x,
            y,
            direction: this.directionFromDelta(replayState.authorityX, replayState.authorityY, x, y, snapshot.direction),
        });
        replayState.authorityX = x;
        replayState.authorityY = y;
        replayState.authorityDirection = snapshot.direction;
        if (replayState.segments.length > REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD) {
            replayState.segments.splice(0, replayState.segments.length - REMOTE_INPUT_BACKLOG_CATCH_UP_THRESHOLD);
        }
    }
    applyEnemyReplay(tank, replayState, enemyTanks, playerTanks, basePosition, deltaTime) {
        if (!replayState.initialized) {
            tank.position.set(replayState.authorityX, replayState.authorityY);
            tank.rotation = this.toGameRotation(replayState.authorityDirection);
            replayState.segments.length = 0;
            replayState.initialized = true;
            this.initializedEnemies.add(tank.partyIndex);
            return;
        }
        const authorityDistance = Math.hypot(replayState.authorityX - tank.position.x, replayState.authorityY - tank.position.y);
        if (authorityDistance > ENEMY_REPLAY_SNAP_DISTANCE) {
            tank.position.set(replayState.authorityX, replayState.authorityY);
            tank.rotation = this.toGameRotation(replayState.authorityDirection);
            replayState.segments.length = 0;
            return;
        }
        let movementBudget = tank.attributes.moveSpeed * ENEMY_REPLAY_SPEED_MULTIPLIER * deltaTime;
        while (movementBudget > LOCAL_PREDICTION_EPSILON &&
            replayState.segments.length > 0) {
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
            const direction = this.directionFromDelta(tank.position.x, tank.position.y, segment.x, segment.y, segment.direction);
            tank.rotate(this.toGameRotation(direction));
            const step = Math.min(distance, movementBudget);
            const nextPosition = this.positionAfterMove(tank.position.x, tank.position.y, direction, step);
            if (this.clientTankPositionBlocked(tank, nextPosition.x, nextPosition.y, enemyTanks, playerTanks, basePosition)) {
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
    applyPendingEnemyFireEvents(tanks) {
        if (this.pendingEnemyFireEvents.length === 0) {
            return;
        }
        if (this.debugDisableEnemyShooting) {
            this.pendingEnemyFireEvents.length = 0;
            return;
        }
        const remaining = [];
        this.pendingEnemyFireEvents.forEach((event) => {
            const tank = tanks.find((candidate) => candidate !== null &&
                candidate !== undefined &&
                candidate.partyIndex === event.enemyId);
            if (tank === undefined) {
                remaining.push(event);
                return;
            }
            const bullet = tank.fireFromNetwork(this.fromChainUnits(event.x), this.fromChainUnits(event.y), this.toGameRotation(event.direction));
            bullet?.setLocalDamageDisabled(true);
        });
        this.pendingEnemyFireEvents.length = 0;
        this.pendingEnemyFireEvents.push(...remaining);
    }
    positionAfterMove(x, y, direction, distance) {
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
    clientTankPositionBlocked(movingTank, x, y, enemyTanks, playerTanks, basePosition) {
        if (this.rectsOverlap(x, y, movingTank.size.width, movingTank.size.height, basePosition.x, basePosition.y, config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height)) {
            return true;
        }
        if (playerTanks.some((playerTank) => playerTank !== null &&
            playerTank !== undefined &&
            this.rectsOverlap(x, y, movingTank.size.width, movingTank.size.height, playerTank.position.x, playerTank.position.y, playerTank.size.width, playerTank.size.height))) {
            return true;
        }
        return enemyTanks.some((enemyTank) => {
            return (enemyTank !== null &&
                enemyTank !== undefined &&
                enemyTank !== movingTank &&
                this.rectsOverlap(x, y, movingTank.size.width, movingTank.size.height, enemyTank.position.x, enemyTank.position.y, enemyTank.size.width, enemyTank.size.height));
        });
    }
    rectsOverlap(firstX, firstY, firstWidth, firstHeight, secondX, secondY, secondWidth, secondHeight) {
        return (firstX < secondX + secondWidth &&
            firstX + firstWidth > secondX &&
            firstY < secondY + secondHeight &&
            firstY + firstHeight > secondY);
    }
    directionFromDelta(fromX, fromY, toX, toY, fallbackDirection) {
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
    async start(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions) {
        const provider = (0, wallet_1.getPhantomProvider)();
        if (provider === null) {
            throw new Error('Phantom is required for a MagicBlock match.');
        }
        const wallet = await provider.connect();
        const walletPublicKey = new web3_js_1.PublicKey(wallet.publicKey.toString());
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
        this.configureGhostSignalTransport();
        this.matchPda = this.deriveMatchPda(this.matchId);
        this.terrainPda = this.deriveTerrainPda(this.matchId);
        if (this.observerMode) {
            await this.startObserver();
            return;
        }
        this.session = this.loadOrCreateSession();
        await this.fundSession(walletPublicKey);
        if (this.localPlayerIndex === 0) {
            await this.startHost(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions);
        }
        else {
            await this.startJoiner();
        }
    }
    async startHost(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions) {
        let account = await this.baseConnection.getAccountInfo(this.matchPda);
        if (account === null) {
            await this.createMatch(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions);
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
        }
        else if (!account.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
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
    async startJoiner() {
        let account = await this.baseConnection.getAccountInfo(this.matchPda);
        if (account === null) {
            throw new Error('Match not found. Ask player one for a new link.');
        }
        if (account.owner.equals(PROGRAM_ID)) {
            const state = this.decodeMatchState(account.data);
            if (!state.players[1].joined) {
                await this.joinMatch();
            }
            else if (!state.players[1].authority.equals(this.session.publicKey)) {
                throw new Error('This match already has a second player.');
            }
        }
        else if (!account.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
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
    async startObserver() {
        const account = await this.baseConnection.getAccountInfo(this.matchPda);
        if (account === null) {
            throw new Error('Match not found. Ask player one for an observer link.');
        }
        if (!account.owner.equals(PROGRAM_ID) &&
            !account.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
            throw new Error('The match PDA has an unexpected owner.');
        }
        this.state = MatchSyncState.Waiting;
        this.showStatus('Observer waiting for MagicBlock ER...');
        const delegation = await this.waitForDelegation();
        await this.connectToEr(delegation);
        this.finishObserverReady();
    }
    async createMatch(firstTank, secondTank, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions) {
        const paddedEnemySpawns = Array.from({ length: ENEMY_SPAWN_COUNT }, (_, index) => enemySpawns[index] ?? { x: 0, y: 0 });
        const paddedSpeedClasses = Array.from({ length: MAX_ENEMY_TOTAL }, (_, index) => enemySpeedClasses[index] ?? 0);
        const terrain = this.encodeTerrain(fieldWidth, fieldHeight, this.withBaseWallTerrainRegions(terrainRegions, basePosition));
        const data = this.instructionCoder.encode('createMatch', {
            matchId: new anchor_1.BN(this.matchId),
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
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
                { pubkey: this.terrainPda, isSigner: false, isWritable: true },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data,
        }), false, 'createMatch');
        await this.uploadTerrain(terrain.bytes, terrain.steelBytes);
    }
    encodeTerrain(fieldWidth, fieldHeight, regions) {
        const width = Math.ceil(fieldWidth / BOARD_CELL_SIZE_PX);
        const height = Math.ceil(fieldHeight / BOARD_CELL_SIZE_PX);
        if (width > 108 || height > 108) {
            throw new Error(`Map terrain grid ${width}x${height} exceeds 108x108.`);
        }
        const bytes = new Uint8Array(Math.ceil((width * height) / 8));
        const steelBytes = new Uint8Array(bytes.length);
        const solidTypes = new Set([
            terrain_1.TerrainType.Brick,
            terrain_1.TerrainType.BrickSuper,
            terrain_1.TerrainType.Steel,
            terrain_1.TerrainType.Water,
        ]);
        regions.filter((region) => solidTypes.has(region.type)).forEach((region) => {
            const minX = Math.max(0, Math.floor(region.x / BOARD_CELL_SIZE_PX));
            const minY = Math.max(0, Math.floor(region.y / BOARD_CELL_SIZE_PX));
            const maxX = Math.min(width, Math.ceil((region.x + region.width) / BOARD_CELL_SIZE_PX));
            const maxY = Math.min(height, Math.ceil((region.y + region.height) / BOARD_CELL_SIZE_PX));
            for (let y = minY; y < maxY; y += 1) {
                for (let x = minX; x < maxX; x += 1) {
                    const bitIndex = y * width + x;
                    bytes[bitIndex >> 3] |= 1 << (bitIndex & 7);
                    if (region.type === terrain_1.TerrainType.Steel) {
                        steelBytes[bitIndex >> 3] |= 1 << (bitIndex & 7);
                    }
                }
            }
        });
        return { width, height, bytes, steelBytes };
    }
    withBaseWallTerrainRegions(regions, basePosition) {
        return [
            ...regions,
            ...BASE_WALL_TERRAIN_REGIONS.map((region) => ({
                type: terrain_1.TerrainType.Brick,
                x: basePosition.x + region.x,
                y: basePosition.y + region.y,
                width: region.width,
                height: region.height,
            })),
        ];
    }
    async uploadTerrain(bytes, steelBytes) {
        for (let offset = 0; offset < bytes.length; offset += TERRAIN_CHUNK_BYTES) {
            const chunk = Array.from(bytes.subarray(offset, offset + TERRAIN_CHUNK_BYTES));
            const steelChunk = Array.from(steelBytes.subarray(offset, offset + TERRAIN_CHUNK_BYTES));
            await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
                programId: PROGRAM_ID,
                keys: [
                    { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
                    { pubkey: this.matchPda, isSigner: false, isWritable: true },
                    { pubkey: this.terrainPda, isSigner: false, isWritable: true },
                ],
                data: this.instructionCoder.encode('initializeTerrainChunk', {
                    matchId: new anchor_1.BN(this.matchId),
                    offset,
                    bytes: chunk,
                    steelBytes: steelChunk,
                }),
            }), false, `initializeTerrainChunk(${offset})`);
        }
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
                { pubkey: this.terrainPda, isSigner: false, isWritable: true },
            ],
            data: this.instructionCoder.encode('finalizeTerrain', {
                matchId: new anchor_1.BN(this.matchId),
            }),
        }), false, 'finalizeTerrain');
        this.log.info(`Uploaded ${bytes.length} bytes of authoritative terrain.`);
    }
    async joinMatch() {
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
            ],
            data: this.instructionCoder.encode('joinMatch', {
                matchId: new anchor_1.BN(this.matchId),
            }),
        }), false, 'joinMatch');
    }
    async waitForSecondPlayer() {
        while (true) {
            const state = await this.fetchMatchState(this.baseConnection);
            if (state.players[1].joined) {
                return;
            }
            await this.delay(1000);
        }
    }
    async delegateMatch() {
        const account = await this.baseConnection.getAccountInfo(this.matchPda);
        if (account === null) {
            throw new Error('The match account does not exist.');
        }
        if (account.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
            this.log.info('Match account already delegated; skipping delegateMatch.');
            return;
        }
        if (!account.owner.equals(PROGRAM_ID)) {
            throw new Error('The match PDA has an unexpected owner.');
        }
        const buffer = (0, ephemeral_rollups_sdk_1.delegateBufferPdaFromDelegatedAccountAndOwnerProgram)(this.matchPda, PROGRAM_ID);
        const delegationRecord = (0, ephemeral_rollups_sdk_1.delegationRecordPdaFromDelegatedAccount)(this.matchPda);
        const delegationMetadata = (0, ephemeral_rollups_sdk_1.delegationMetadataPdaFromDelegatedAccount)(this.matchPda);
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: buffer, isSigner: false, isWritable: true },
                { pubkey: delegationRecord, isSigner: false, isWritable: true },
                { pubkey: delegationMetadata, isSigner: false, isWritable: true },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
                { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: this.instructionCoder.encode('delegateMatch', {
                matchId: new anchor_1.BN(this.matchId),
            }),
        }), false, 'delegateMatch');
    }
    async delegateTerrain() {
        const account = await this.baseConnection.getAccountInfo(this.terrainPda);
        if (account === null) {
            throw new Error('The terrain account does not exist.');
        }
        if (account.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
            this.log.info('Terrain account already delegated; skipping delegateTerrain.');
            return;
        }
        if (!account.owner.equals(PROGRAM_ID)) {
            throw new Error('The terrain PDA has an unexpected owner.');
        }
        const buffer = (0, ephemeral_rollups_sdk_1.delegateBufferPdaFromDelegatedAccountAndOwnerProgram)(this.terrainPda, PROGRAM_ID);
        const delegationRecord = (0, ephemeral_rollups_sdk_1.delegationRecordPdaFromDelegatedAccount)(this.terrainPda);
        const delegationMetadata = (0, ephemeral_rollups_sdk_1.delegationMetadataPdaFromDelegatedAccount)(this.terrainPda);
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: buffer, isSigner: false, isWritable: true },
                { pubkey: delegationRecord, isSigner: false, isWritable: true },
                { pubkey: delegationMetadata, isSigner: false, isWritable: true },
                { pubkey: this.terrainPda, isSigner: false, isWritable: true },
                { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: this.instructionCoder.encode('delegateTerrain', {
                matchId: new anchor_1.BN(this.matchId),
            }),
        }), false, 'delegateTerrain');
    }
    async startMatch() {
        await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
                { pubkey: this.terrainPda, isSigner: false, isWritable: true },
            ],
            data: this.instructionCoder.encode('startMatch', {
                matchId: new anchor_1.BN(this.matchId),
            }),
        }), true, 'startMatch');
    }
    async scheduleMatchCrank() {
        await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
                { pubkey: this.terrainPda, isSigner: false, isWritable: false },
                { pubkey: MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
                { pubkey: ephemeral_rollups_sdk_1.MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: this.instructionCoder.encode('scheduleMatchCrank', {
                matchId: new anchor_1.BN(this.matchId),
                epoch: new anchor_1.BN(this.target.epoch),
            }),
        }), true, 'scheduleMatchCrank');
        this.log.info('Scheduled authoritative enemy crank at 20 Hz.');
    }
    async connectToEr(delegation) {
        if (!delegation.fqdn) {
            throw new Error('MagicBlock router did not return an ER endpoint.');
        }
        this.erEndpoint = delegation.fqdn;
        this.erConnection = new web3_js_1.Connection(delegation.fqdn, 'confirmed');
        this.updateTarget(await this.waitForErMatchState());
        this.accountSubscription = this.erConnection.onAccountChange(this.matchPda, (account) => {
            try {
                this.updateTarget(this.decodeMatchState(account.data));
                this.lastPollAt = Date.now();
            }
            catch (error) {
                this.handleRefreshError(error);
            }
        }, 'processed');
        this.log.info(`Match ${this.matchId} connected to ${delegation.fqdn}`);
    }
    async waitForErMatchState() {
        let lastError = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            try {
                return await this.fetchMatchState(this.erConnection);
            }
            catch (error) {
                lastError = error;
                await this.delay(250);
            }
        }
        throw new Error(`Match was delegated but did not become readable on the ER: ${lastError?.message ?? 'unknown error'}`);
    }
    finishReady() {
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
        this.showStatus(`MagicBlock match live - player ${this.localPlayerIndex + 1}\nER: ${this.formatErEndpoint()}`);
        this.showLatencyControl();
        this.showInputLatencyControl();
        this.showMainnetLatencyControl();
        this.configureGhostSignalTransport();
    }
    finishObserverReady() {
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
        this.showStatus(`MagicBlock observer live\nER: ${this.formatErEndpoint()}`);
        this.showLatencyControl();
        this.showMainnetLatencyControl();
    }
    configureGhostSignalTransport() {
        if (!this.enabled ||
            this.observerMode ||
            this.matchId === null ||
            this.ghostSignalTransport !== null) {
            return;
        }
        const ghostSync = webrtc_1.WebRtcGhostSync.getInstance();
        ghostSync.configureFromLocation(this.localPlayerIndex);
        if (!ghostSync.isEnabled()) {
            return;
        }
        this.ghostSignalTransport = new webrtc_1.HttpGhostSignalTransport(this.matchId.toString(), this.localPlayerIndex);
        ghostSync.setSignalTransport(this.ghostSignalTransport);
        ghostSync.start();
        this.log.info('HTTP WebRTC ghost signaling enabled.');
    }
    captureLocalInput(tank) {
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
        if ((horizontalDistance > 0 || verticalDistance > 0) &&
            lastMovementDirection !== visualDirection) {
            this.enqueueInputFrame(visualDirection, 0);
        }
    }
    capturePendingBoardMutations(tank) {
        // Board mutations are no longer client-authoritative. Keep this hook as a
        // no-op so callers do not force empty movement sends for cosmetic damage.
    }
    enqueueInputFrame(direction, distance, fire = false) {
        let remaining = distance;
        do {
            const frameDistance = Math.min(1000, remaining);
            const last = this.pendingInputFrames[this.pendingInputFrames.length - 1];
            if (!fire &&
                !last?.fire &&
                last !== undefined &&
                last.direction === direction &&
                last.distance + frameDistance <= 1000) {
                last.distance += frameDistance;
            }
            else if (fire ||
                frameDistance > 0 ||
                last === undefined ||
                last.direction !== direction) {
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
    takeInputBatch() {
        const batch = [];
        let totalDistance = 0;
        let fireEvents = 0;
        while (this.pendingInputFrames.length > 0 &&
            batch.length < MAX_INPUT_BATCH_FRAMES) {
            const next = this.pendingInputFrames[0];
            if (batch.length > 0 &&
                (totalDistance + next.distance > MAX_BATCH_DISTANCE ||
                    (next.fire && fireEvents >= MAX_FIRE_EVENTS_PER_BATCH))) {
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
    async sendPendingInputBatch() {
        if (this.pendingInputFrames.length === 0) {
            return;
        }
        const frames = this.takeInputBatch();
        const encodedAtMs = performance.now();
        const wireFrames = frames.map((frame) => ({
            ...frame,
            fireAgeMs: frame.fire
                ? Math.min(MAX_FIRE_AGE_MS, Math.max(0, Math.round(encodedAtMs - (frame.queuedAtMs ?? encodedAtMs))))
                : 0,
        }));
        const boardMutations = [];
        const nextSequence = this.sequence + 1;
        this.sending = true;
        this.lastSendAt = Date.now();
        try {
            await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
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
                    matchId: new anchor_1.BN(this.matchId),
                    epoch: new anchor_1.BN(this.target.epoch),
                    frames: wireFrames.map((frame) => ({
                        direction: this.toAnchorDirection(frame.direction),
                        distance: frame.distance,
                        fire: frame.fire,
                        fireAgeMs: frame.fireAgeMs,
                    })),
                    projectiles: [],
                    boardMutations,
                    bulletWallDamage: this.localBulletWallDamage,
                    sequence: new anchor_1.BN(nextSequence),
                }),
            }), true);
            this.applyFramesToAuthoritativeCursor(frames);
            this.sequence = nextSequence;
        }
        catch (error) {
            const accepted = await this.recoverInputBatch(nextSequence);
            if (accepted) {
                return;
            }
            const rejected = error.message.startsWith('Transaction failed');
            if (!accepted && !rejected) {
                this.pendingInputFrames.unshift(...frames);
            }
            throw error;
        }
        finally {
            this.sending = false;
        }
    }
    async testInputUpdateLatency() {
        if (this.state !== MatchSyncState.Ready ||
            this.target === null ||
            this.erConnection === null) {
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
            await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
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
                    matchId: new anchor_1.BN(this.matchId),
                    epoch: new anchor_1.BN(this.target.epoch),
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
                    sequence: new anchor_1.BN(nextSequence),
                }),
            }), true, 'input update latency probe');
            const submitMs = Math.round(performance.now() - startedAtMs);
            this.sequence = nextSequence;
            return {
                elapsedMs: await observed,
                submitMs,
                sequence: nextSequence,
            };
        }
        catch (error) {
            this.cancelInputLatencyProbe(error.message);
            throw error;
        }
        finally {
            this.sending = false;
        }
    }
    async recoverInputBatch(attemptedSequence) {
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
        }
        catch (error) {
            this.handleRefreshError(error);
            return false;
        }
    }
    applyFramesToAuthoritativeCursor(frames) {
        frames.forEach((frame) => {
            const pixels = frame.distance / UNITS_PER_PIXEL;
            if (frame.direction === 0) {
                this.lastLocalY -= pixels;
            }
            else if (frame.direction === 1) {
                this.lastLocalX += pixels;
            }
            else if (frame.direction === 2) {
                this.lastLocalY += pixels;
            }
            else {
                this.lastLocalX -= pixels;
            }
        });
    }
    async respawnLocalPlayer(tank) {
        this.sending = true;
        this.lastSendAt = Date.now();
        await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
                { pubkey: this.matchPda, isSigner: false, isWritable: true },
            ],
            data: this.instructionCoder.encode('respawnPlayer', {
                matchId: new anchor_1.BN(this.matchId),
                epoch: new anchor_1.BN(this.target.epoch),
            }),
        }), true);
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
    applyRemoteState(tank, deltaTime) {
        if (tank === null || tank === undefined) {
            return;
        }
        if (this.playerMirrorBulletsSuppressed) {
            tank.bullets.slice().forEach((bullet) => bullet.nullify());
        }
        this.remoteStateInitialized = this.applyWaypointState(tank, deltaTime, this.remoteWaypoints, this.remoteStateInitialized);
    }
    applyWaypointState(tank, deltaTime, waypoints, initialized) {
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
        let movementBudget = tank.attributes.moveSpeed *
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
            if (waypoint.remainingDistance !== undefined &&
                waypoint.remainingTime !== undefined) {
                tank.rotation = this.toGameRotation(waypoint.direction);
                if (waypoint.remainingDistance <= LOCAL_PREDICTION_EPSILON) {
                    this.consumeRemoteWaypoint(tank, waypoint);
                    waypoints.shift();
                    continue;
                }
                const inputStep = Math.min(waypoint.remainingDistance, waypoint.remainingTime > 0
                    ? (waypoint.remainingDistance / waypoint.remainingTime) * deltaTime
                    : movementBudget, movementBudget);
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
            tank.position.set(tank.position.x + deltaX * scale, tank.position.y + deltaY * scale);
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
    applyObserverState(tanks, deltaTime) {
        this.target.players.forEach((state, index) => {
            if (!state.joined) {
                return;
            }
            const tank = tanks[index];
            if (tank === null || tank === undefined) {
                return;
            }
            this.observerRemoteStateInitialized[index] = this.applyWaypointState(tank, deltaTime, this.observerRemoteWaypoints[index], this.observerRemoteStateInitialized[index]);
        });
    }
    applyServerPlayerState(tank, state) {
        if (tank === null || tank === undefined) {
            return;
        }
        tank.position.set(this.fromChainUnits(state.x), this.fromChainUnits(state.y));
        tank.rotation = this.toGameRotation(state.direction);
        tank.updateMatrix(true);
        if (tank.collider.isInitialized()) {
            tank.collider.update();
        }
        tank.setNeedsPaint();
    }
    refreshIfStale() {
        if (!this.polling && Date.now() - this.lastPollAt >= POLL_INTERVAL_MS) {
            void this.refreshTarget().catch(this.handleRefreshError);
        }
    }
    updateTarget(next) {
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
            this.queueRemoteReceipt(next.players[remoteIndex], next.inputReceipts[remoteIndex]);
        }
    }
    resolveInputLatencyProbe(next) {
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
    waitForInputLatencyProbe(sequence, startedAtMs) {
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
    cancelInputLatencyProbe(message) {
        if (this.inputLatencyProbe === null) {
            return;
        }
        window.clearTimeout(this.inputLatencyProbe.timeoutId);
        const { reject } = this.inputLatencyProbe;
        this.inputLatencyProbe = null;
        reject(new Error(message));
    }
    queueBoardMutations(mutations) {
        mutations.forEach((mutation) => {
            const key = this.boardMutationKey(mutation);
            if (this.knownBoardMutations.has(key)) {
                return;
            }
            this.knownBoardMutations.add(key);
            this.remoteBoardMutations.push(mutation);
        });
    }
    queueEnemyFireEvents(events) {
        events.forEach((event) => {
            if (event.sequence <= this.lastEnemyFireSequence) {
                return;
            }
            this.pendingEnemyFireEvents.push(event);
            this.lastEnemyFireSequence = event.sequence;
        });
    }
    boardMutationKey(mutation) {
        return `${mutation.x}:${mutation.y}`;
    }
    queueRemoteSnapshot(state) {
        if (!state.joined) {
            return;
        }
        this.queueSnapshotToWaypoints(state, this.remoteWaypoints);
        this.lastQueuedRemoteSequence = state.sequence;
    }
    queueObserverSnapshot(index, state) {
        if (!state.joined) {
            return;
        }
        this.queueSnapshotToWaypoints(state, this.observerRemoteWaypoints[index]);
        this.observerLastQueuedRemoteSequence[index] = state.sequence;
    }
    queueSnapshotToWaypoints(state, waypoints) {
        waypoints.push({
            x: this.fromChainUnits(state.x),
            y: this.fromChainUnits(state.y),
            direction: state.direction,
            sequence: state.sequence,
            teleport: true,
        });
    }
    queueRemoteReceipt(state, receipt) {
        if (!state.joined || state.sequence <= this.lastQueuedRemoteSequence) {
            return;
        }
        this.lastQueuedRemoteSequence = this.queueReceiptToWaypoints(state, receipt, this.remoteWaypoints, this.lastQueuedRemoteSequence);
    }
    queueObserverReceipt(index, state, receipt) {
        const lastQueuedSequence = this.observerLastQueuedRemoteSequence[index];
        if (!state.joined || state.sequence <= lastQueuedSequence) {
            return;
        }
        this.observerLastQueuedRemoteSequence[index] = this.queueReceiptToWaypoints(state, receipt, this.observerRemoteWaypoints[index], lastQueuedSequence);
    }
    queueReceiptToWaypoints(state, receipt, waypoints, lastQueuedSequence) {
        const missedBatch = lastQueuedSequence >= 0 &&
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
            }
            else if (frame.direction === 1) {
                x += frame.distance;
            }
            else if (frame.direction === 2) {
                y += frame.distance;
            }
            else {
                x -= frame.distance;
            }
            waypoints.push({
                x: this.fromChainUnits(x),
                y: this.fromChainUnits(y),
                direction: frame.direction,
                sequence: receipt.batchSequence,
                teleport: false,
                remainingDistance: frameDistances[index],
                remainingTime: totalDistance > 0
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
    consumeRemoteWaypoint(tank, waypoint) {
        tank.position.set(waypoint.x, waypoint.y);
        tank.rotation = this.toGameRotation(waypoint.direction);
        if (waypoint.fire) {
            if (this.playerMirrorBulletsSuppressed) {
                return;
            }
            const bullet = tank.fireFromNetwork(waypoint.x, waypoint.y, this.toGameRotation(waypoint.direction));
            bullet?.setLocalDamageDisabled(true);
        }
    }
    reconcileLocalState(tank, deltaTime) {
        const state = this.target.players[this.localPlayerIndex];
        if (this.sending ||
            this.pendingInputFrames.length > 0 ||
            state.sequence < this.sequence) {
            return;
        }
        // The tank keeps moving locally between 50 ms submissions. Pulling it
        // toward the latest confirmed position during that window erases the
        // prediction before it can be sent and makes the sprite shake in place.
        // Reconcile only once all locally predicted movement has been submitted.
        const unsentDistance = Math.hypot(tank.position.x - this.lastLocalX, tank.position.y - this.lastLocalY);
        if (unsentDistance > LOCAL_PREDICTION_EPSILON) {
            return;
        }
        const x = this.fromChainUnits(state.x);
        const y = this.fromChainUnits(state.y);
        const distance = Math.hypot(x - tank.position.x, y - tank.position.y);
        if (distance < 2) {
            return;
        }
        this.moveTankTowards(tank, x, y, tank.attributes.moveSpeed *
            LOCAL_RECONCILE_SPEED_MULTIPLIER *
            deltaTime);
        this.capturedLocalX = tank.position.x;
        this.capturedLocalY = tank.position.y;
        tank.updateMatrix(true);
        tank.collider.update();
    }
    moveTankTowards(tank, targetX, targetY, maxDistance) {
        const deltaX = targetX - tank.position.x;
        const deltaY = targetY - tank.position.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance === 0) {
            return;
        }
        const scale = Math.min(1, maxDistance / distance);
        tank.position.set(tank.position.x + deltaX * scale, tank.position.y + deltaY * scale);
    }
    moveTankInDirection(tank, direction, distance) {
        if (direction === 0) {
            tank.position.subY(distance);
        }
        else if (direction === 1) {
            tank.position.addX(distance);
        }
        else if (direction === 2) {
            tank.position.addY(distance);
        }
        else {
            tank.position.subX(distance);
        }
    }
    async refreshTarget() {
        this.polling = true;
        this.lastPollAt = Date.now();
        try {
            this.updateTarget(await this.fetchMatchState(this.erConnection));
        }
        finally {
            this.polling = false;
        }
    }
    async fetchMatchState(connection) {
        const account = await connection.getAccountInfo(this.matchPda, 'confirmed');
        if (account === null) {
            throw new Error('Match state is unavailable.');
        }
        return this.decodeMatchState(account.data);
    }
    decodeMatchState(data) {
        if (data.length < MATCH_ACCOUNT_BASE_SIZE) {
            throw new Error('Match state returned invalid account data.');
        }
        const players = [
            this.decodePlayer(data, 79),
            this.decodePlayer(data, 129),
        ];
        const hasBatchReceipts = data.length >= MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE * 2;
        return {
            matchId: this.readU64(data, 8),
            epoch: this.readU64(data, 16),
            phase: data.readUInt8(56),
            players,
            inputReceipts: hasBatchReceipts
                ? [
                    this.decodeInputReceipt(data, MATCH_ACCOUNT_BASE_SIZE),
                    this.decodeInputReceipt(data, MATCH_ACCOUNT_BASE_SIZE + INPUT_RECEIPT_SIZE),
                ]
                : [
                    this.createSnapshotReceipt(players[0]),
                    this.createSnapshotReceipt(players[1]),
                ],
            boardMutations: data.length >= MATCH_ACCOUNT_WITH_BOARD_SIZE
                ? this.decodeBoardMutations(data)
                : [],
            enemies: data.length >= MATCH_ACCOUNT_WITH_ENEMIES_SIZE
                ? this.decodeEnemies(data)
                : [],
            enemyFireEvents: data.length >= MATCH_ACCOUNT_WITH_ENEMY_FIRE_EVENTS_SIZE
                ? this.decodeEnemyFireEvents(data)
                : [],
            simulationTick: data.length >= MATCH_ACCOUNT_WITH_ENEMIES_SIZE
                ? this.readU64(data, MATCH_ACCOUNT_ENEMIES_OFFSET +
                    MAX_ACTIVE_ENEMIES * ENEMY_STATE_SIZE +
                    1)
                : 0,
            tick: this.readU64(data, 179),
        };
    }
    decodeEnemies(data) {
        const enemies = [];
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
    decodeEnemyFireEvents(data) {
        const countOffset = MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET +
            MAX_ENEMY_FIRE_EVENTS * ENEMY_FIRE_EVENT_SIZE;
        const count = Math.min(MAX_ENEMY_FIRE_EVENTS, data.readUInt16LE(countOffset));
        const events = [];
        for (let index = 0; index < count; index += 1) {
            const offset = MATCH_ACCOUNT_ENEMY_FIRE_EVENTS_OFFSET + index * ENEMY_FIRE_EVENT_SIZE;
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
    decodeBoardMutations(data) {
        const count = Math.min(MAX_BOARD_MUTATIONS, data.readUInt16LE(MATCH_ACCOUNT_SIZE + MAX_BOARD_MUTATIONS * BOARD_MUTATION_SIZE));
        const mutations = [];
        for (let index = 0; index < count; index += 1) {
            const offset = MATCH_ACCOUNT_SIZE + index * BOARD_MUTATION_SIZE;
            mutations.push({
                x: data.readUInt8(offset),
                y: data.readUInt8(offset + 1),
            });
        }
        return mutations;
    }
    decodeInputReceipt(data, offset) {
        const len = Math.min(MAX_INPUT_BATCH_FRAMES, data.readUInt8(offset + INPUT_RECEIPT_SIZE - 1));
        const frames = [];
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
    createSnapshotReceipt(state) {
        return {
            batchSequence: state.sequence,
            startX: state.x,
            startY: state.y,
            frames: [],
        };
    }
    decodePlayer(data, offset) {
        return {
            authority: new web3_js_1.PublicKey(data.subarray(offset, offset + 32)),
            x: data.readInt32LE(offset + 32),
            y: data.readInt32LE(offset + 36),
            direction: data.readUInt8(offset + 40),
            sequence: this.readU64(data, offset + 41),
            joined: data.readUInt8(offset + 49) !== 0,
        };
    }
    async waitForDelegation() {
        for (let attempt = 0; attempt < 30; attempt += 1) {
            const status = (await this.routerConnection.getDelegationStatus(this.matchPda));
            if (status.isDelegated) {
                return status;
            }
            await this.delay(1000);
        }
        throw new Error('Timed out waiting for MagicBlock delegation.');
    }
    async fundSession(walletPublicKey) {
        const balance = await this.baseConnection.getBalance(this.session.publicKey, 'confirmed');
        if (balance >= SESSION_TARGET_BALANCE) {
            return;
        }
        const provider = (0, wallet_1.getPhantomProvider)();
        if (provider === null) {
            throw new Error('Phantom disconnected before session funding.');
        }
        const latest = await this.baseConnection.getLatestBlockhash('confirmed');
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: this.session.publicKey,
            lamports: SESSION_TARGET_BALANCE - balance,
        }));
        transaction.feePayer = walletPublicKey;
        transaction.recentBlockhash = latest.blockhash;
        transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
        const signed = await provider.signTransaction(transaction);
        const signature = await this.baseConnection.sendRawTransaction(signed.serialize());
        await this.baseConnection.confirmTransaction({ signature, ...latest }, 'confirmed');
    }
    async sendWithSession(connection, instruction, skipPreflight, label = 'transaction') {
        const commitment = skipPreflight ? 'processed' : 'confirmed';
        const latest = await connection.getLatestBlockhash(commitment);
        const transaction = new web3_js_1.Transaction().add(instruction);
        transaction.feePayer = this.session.publicKey;
        transaction.recentBlockhash = latest.blockhash;
        transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
        transaction.sign(this.session);
        const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight });
        const confirmation = await connection.confirmTransaction({ signature, ...latest }, commitment);
        if (confirmation.value.err !== null) {
            throw new Error(`${label} failed (${signature}): ${JSON.stringify(confirmation.value.err)}`);
        }
        return signature;
    }
    deriveMatchPda(matchId) {
        return web3_js_1.PublicKey.findProgramAddressSync([MATCH_SEED, new anchor_1.BN(matchId).toArrayLike(buffer_1.Buffer, 'le', 8)], PROGRAM_ID)[0];
    }
    deriveTerrainPda(matchId) {
        return web3_js_1.PublicKey.findProgramAddressSync([TERRAIN_SEED, new anchor_1.BN(matchId).toArrayLike(buffer_1.Buffer, 'le', 8)], PROGRAM_ID)[0];
    }
    loadOrCreateSession() {
        const key = `battlecity.magicblock.devnet.match.${this.matchId}.${this.localPlayerIndex}`;
        const stored = window.localStorage.getItem(key);
        if (stored !== null) {
            try {
                return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
            }
            catch {
                window.localStorage.removeItem(key);
            }
        }
        const session = web3_js_1.Keypair.generate();
        window.localStorage.setItem(key, JSON.stringify(Array.from(session.secretKey)));
        return session;
    }
    showJoinControl() {
        const url = this.createMatchLink('join');
        const button = this.ensureStatusButton('join');
        button.type = 'button';
        button.textContent = 'Copy player-two link';
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(url.toString());
                button.textContent = 'Player-two link copied';
                window.setTimeout(() => {
                    button.textContent = 'Copy player-two link';
                }, 2000);
            }
            catch {
                button.textContent = 'Copy failed - check DevTools';
            }
        };
        this.log.info(`Player-two link: ${url.toString()}`);
        this.showObserverControl();
    }
    showObserverControl() {
        const url = this.createMatchLink('observer');
        const button = this.ensureStatusButton('observer');
        button.type = 'button';
        button.textContent = 'Copy observer link';
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(url.toString());
                button.textContent = 'Observer link copied';
                window.setTimeout(() => {
                    button.textContent = 'Copy observer link';
                }, 2000);
            }
            catch {
                button.textContent = 'Copy failed - check DevTools';
            }
        };
        this.log.info(`Observer link: ${url.toString()}`);
    }
    createMatchLink(kind) {
        const url = new URL(window.location.href);
        url.searchParams.set('magicblock', '1');
        url.searchParams.set('mode', 'match');
        url.searchParams.set('match', this.matchId.toString());
        url.searchParams.set('level', this.currentLevelNumber.toString());
        if (kind === 'join') {
            url.searchParams.set('join', '1');
            url.searchParams.delete('observer');
        }
        else {
            url.searchParams.set('observer', '1');
            url.searchParams.delete('join');
            url.searchParams.delete('ghostMirror');
            url.searchParams.delete('ghostmirror');
            url.searchParams.delete('ghosmirror');
            return url;
        }
        if (url.searchParams.has('ghostMirror') ||
            url.searchParams.has('ghostmirror') ||
            url.searchParams.has('ghosmirror')) {
            url.searchParams.delete('ghostmirror');
            url.searchParams.delete('ghosmirror');
            url.searchParams.set('ghostMirror', '1');
        }
        return url;
    }
    showStatus(message) {
        this.ensureStatusMessage().textContent = message;
    }
    showLatencyControl() {
        const button = this.ensureStatusButton('latency');
        button.type = 'button';
        button.textContent = 'Ping MagicBlock';
        button.onclick = async () => {
            button.disabled = true;
            button.textContent = 'Pinging MagicBlock...';
            const startedAt = performance.now();
            try {
                if (this.erConnection === null || this.matchPda === null) {
                    throw new Error('MagicBlock ER is not connected.');
                }
                const account = await this.erConnection.getAccountInfo(this.matchPda, 'processed');
                if (account === null) {
                    throw new Error('Match account was not readable on the ER.');
                }
                const elapsedMs = Math.round(performance.now() - startedAt);
                button.textContent = `Ping MagicBlock (${elapsedMs} ms)`;
                this.showStatus(`MagicBlock ER read latency: ${elapsedMs} ms\nER: ${this.formatErEndpoint()}`);
                this.log.info(`MagicBlock ER read latency: ${elapsedMs} ms`);
            }
            catch (error) {
                button.textContent = 'Ping MagicBlock failed';
                this.showStatus('MagicBlock latency ping failed - check console');
                this.log.warn('MagicBlock latency ping failed.', error);
            }
            finally {
                button.disabled = false;
            }
        };
    }
    showInputLatencyControl() {
        const button = this.ensureStatusButton('input-latency');
        button.type = 'button';
        button.textContent = 'Test input update';
        button.onclick = async () => {
            button.disabled = true;
            button.textContent = 'Testing input update...';
            try {
                const result = await this.testInputUpdateLatency();
                button.textContent = `Input update (${result.elapsedMs} ms)`;
                this.showStatus(`MagicBlock input update latency: ${result.elapsedMs} ms\n` +
                    `ER submit/processed: ${result.submitMs} ms\n` +
                    `Observed sequence: ${result.sequence}\n` +
                    `ER: ${this.formatErEndpoint()}`);
                this.log.info(`MagicBlock input update latency: ${result.elapsedMs} ms ` +
                    `(submit ${result.submitMs} ms, sequence ${result.sequence})`);
            }
            catch (error) {
                const message = error.message;
                button.textContent = 'Input update test failed';
                this.showStatus(`MagicBlock input update test failed\n${message}`);
                this.log.warn('MagicBlock input update test failed.', error);
            }
            finally {
                button.disabled = false;
            }
        };
    }
    showMainnetLatencyControl() {
        const button = this.ensureStatusButton('mainnet-latency');
        button.type = 'button';
        button.textContent = 'Ping mainnet ERs';
        button.onclick = async () => {
            button.disabled = true;
            button.textContent = 'Pinging mainnet ERs...';
            const results = [];
            try {
                for (const endpoint of MAINNET_ER_ENDPOINTS) {
                    const startedAt = performance.now();
                    try {
                        const connection = new web3_js_1.Connection(endpoint, 'confirmed');
                        await connection.getLatestBlockhash('processed');
                        const elapsedMs = Math.round(performance.now() - startedAt);
                        results.push(`${new URL(endpoint).host}: ${elapsedMs} ms`);
                    }
                    catch (error) {
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
                    .filter((result) => result !== null)
                    .sort((a, b) => a.elapsedMs - b.elapsedMs);
                const fastest = successfulResults[0];
                button.textContent =
                    fastest === undefined
                        ? 'Mainnet ER ping failed'
                        : `Fastest mainnet: ${fastest.elapsedMs} ms`;
                this.showStatus(`Mainnet ER latency\n${results.join('\n')}\nCurrent devnet ER: ${this.formatErEndpoint()}`);
            }
            finally {
                button.disabled = false;
            }
        };
    }
    ensureStatusContainer() {
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
    formatErEndpoint() {
        if (this.erEndpoint === null) {
            return 'not connected';
        }
        try {
            return new URL(this.erEndpoint).host;
        }
        catch {
            return this.erEndpoint;
        }
    }
    ensureStatusMessage() {
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
    ensureStatusButton(kind) {
        const existing = kind === 'join'
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
        }
        else if (kind === 'observer') {
            // Observer link is shown only while hosting before delegation; it does not
            // need to be kept after the host panel is rebuilt.
        }
        else if (kind === 'latency') {
            this.latencyButtonElement = button;
        }
        else if (kind === 'input-latency') {
            this.inputLatencyButtonElement = button;
        }
        else {
            this.mainnetLatencyButtonElement = button;
        }
        return button;
    }
    applyStatusChildStyle(element, isButton) {
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
    createMatchId() {
        const value = new Uint32Array(1);
        window.crypto.getRandomValues(value);
        return value[0] || 1;
    }
    parseMatchId(value) {
        if (value === null) {
            return null;
        }
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }
    readU64(data, offset) {
        return data.readUInt32LE(offset) + data.readUInt32LE(offset + 4) * 0x100000000;
    }
    toChainUnits(value) {
        return Math.max(0, Math.min(65535, Math.round(value * UNITS_PER_PIXEL)));
    }
    fromChainUnits(value) {
        return value / UNITS_PER_PIXEL;
    }
    toAnchorDirection(direction) {
        return [{ up: {} }, { right: {} }, { down: {} }, { left: {} }][direction];
    }
    toGameRotation(direction) {
        return ([game_1.Rotation.Up, game_1.Rotation.Right, game_1.Rotation.Down, game_1.Rotation.Left][direction] ??
            game_1.Rotation.Down);
    }
    fromGameRotation(rotation) {
        return [game_1.Rotation.Up, game_1.Rotation.Right, game_1.Rotation.Down, game_1.Rotation.Left].indexOf(rotation);
    }
    delay(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }
}
exports.MagicBlockMatchSync = MagicBlockMatchSync;
