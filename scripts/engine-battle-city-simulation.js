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
exports.EngineBattleCitySimulation = void 0;
const CollisionSystem_1 = require("../src/core/collision/CollisionSystem");
const GameObject_1 = require("../src/core/GameObject");
const Rect_1 = require("../src/core/Rect");
const State_1 = require("../src/core/State");
const Prng_1 = require("../src/core/utils/Prng");
const GameState_1 = require("../src/game/GameState");
const Rotation_1 = require("../src/game/Rotation");
const Session_1 = require("../src/game/Session");
const gameObjects_1 = require("../src/gameObjects");
const LevelEventBus_1 = require("../src/level/LevelEventBus");
const LevelMatchLifecycle_1 = require("../src/level/LevelMatchLifecycle");
const LevelWorld_1 = require("../src/level/LevelWorld");
const LevelBaseScript_1 = require("../src/level/scripts/LevelBaseScript");
const LevelEnemyScript_1 = require("../src/level/scripts/LevelEnemyScript");
const LevelExplosionScript_1 = require("../src/level/scripts/LevelExplosionScript");
const LevelGameOverScript_1 = require("../src/level/scripts/LevelGameOverScript");
const LevelIntroScript_1 = require("../src/level/scripts/LevelIntroScript");
const LevelPlayerOverScript_1 = require("../src/level/scripts/LevelPlayerOverScript");
const LevelPlayerScript_1 = require("../src/level/scripts/LevelPlayerScript");
const LevelPointsScript_1 = require("../src/level/scripts/LevelPointsScript");
const LevelPowerupScript_1 = require("../src/level/scripts/LevelPowerupScript");
const LevelSpawnScript_1 = require("../src/level/scripts/LevelSpawnScript");
const LevelWinScript_1 = require("../src/level/scripts/LevelWinScript");
const MapConfig_1 = require("../src/map/MapConfig");
const applyRemotePlayerInput_1 = require("../src/network/webrtc/applyRemotePlayerInput");
const OrderedInputBuffer_1 = require("../src/network/webrtc/OrderedInputBuffer");
const TankTier_1 = require("../src/tank/TankTier");
const TerrainFactory_1 = require("../src/terrain/TerrainFactory");
const TerrainType_1 = require("../src/terrain/TerrainType");
const config = __importStar(require("../src/config"));
const REMOTE_INPUT_TIMEOUT_MS = 500;
const BASE_WALL_REGIONS = [
    { x: 0, y: 0, width: 128, height: 32 },
    { x: 0, y: 32, width: 32, height: 64 },
    { x: 96, y: 32, width: 32, height: 64 },
];
class HeadlessWebRtcMatch {
    constructor(inputBuffers, pendingFireSeqs, pendingPowerSlots, disableEnemyShooting) {
        this.inputBuffers = inputBuffers;
        this.pendingFireSeqs = pendingFireSeqs;
        this.pendingPowerSlots = pendingPowerSlots;
        this.disableEnemyShooting = disableEnemyShooting;
        this.lastFireSeqs = new Map();
        this.controlledTanks = new Map();
        this.lastProcessedInputSeq = [0, 0];
    }
    handlePlayerTank(tank, updateArgs) {
        const playerIndex = tank.partyIndex;
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
        const appliedFireSeq = (0, applyRemotePlayerInput_1.applyRemotePlayerInput)(tank, appliedInput, updateArgs.deltaTime, lastFireSeq);
        this.lastFireSeqs.set(tank.partyIndex, appliedFireSeq);
        this.lastProcessedInputSeq[playerIndex] = input.seq;
        return true;
    }
    getLastProcessedInputSeq() {
        return [...this.lastProcessedInputSeq];
    }
    observeAuthoritativePlayerTank(tank) {
        const playerIndex = tank.partyIndex;
        this.controlledTanks.set(playerIndex, tank);
        this.inputBuffers[playerIndex].clear();
        this.pendingFireSeqs[playerIndex].length = 0;
    }
    isEnabled() {
        return true;
    }
    isBroadcaster() {
        return true;
    }
    consumeRemotePowerSlot(playerIndex) {
        const slots = this.pendingPowerSlots.get(playerIndex);
        if (slots === undefined || slots.length === 0) {
            return null;
        }
        const slot = slots.shift() ?? null;
        if (slots.length === 0) {
            this.pendingPowerSlots.delete(playerIndex);
        }
        return slot;
    }
    isWaitingForPeer() {
        return false;
    }
    shouldDisableEnemyShooting() {
        return this.disableEnemyShooting;
    }
    setEnemyShootingDisabled(disabled) {
        this.disableEnemyShooting = disabled;
    }
}
/**
 * Browserless authoritative simulation that executes the same level scripts,
 * entities, collision system, timers, and session rules as LevelPlayScene.
 */
class EngineBattleCitySimulation {
    constructor(map, options) {
        this.root = new GameObject_1.GameObject(config.CANVAS_WIDTH, config.CANVAS_HEIGHT);
        this.collisionSystem = new CollisionSystem_1.CollisionSystem();
        this.gameState = new State_1.State(GameState_1.GameState.Playing);
        this.mapConfig = new MapConfig_1.MapConfig();
        this.eventBus = new LevelEventBus_1.LevelEventBus();
        this.session = new Session_1.Session();
        this.inputBuffers = [new OrderedInputBuffer_1.OrderedInputBuffer(), new OrderedInputBuffer_1.OrderedInputBuffer()];
        this.pendingFireSeqs = [[], []];
        this.pendingPowerSlots = new Map();
        this.playerElapsed = [0, 0];
        this.playerFire = new Map();
        this.enemyFire = new Map();
        this.previousPlayers = new Map();
        this.previousEnemies = new Map();
        this.pendingEnemyDeaths = [];
        this.alwaysUpdateScripts = [];
        this.playingUpdateScripts = [];
        this.enemyExplosionCount = 0;
        this.enemyDeathSeq = 0;
        this.currentTick = 0;
        this.frameSeq = 0;
        this.pendingHitStopSeconds = 0;
        this.requestHitStop = (seconds) => {
            if (Number.isFinite(seconds) && seconds > this.pendingHitStopSeconds) {
                this.pendingHitStopSeconds = seconds;
            }
        };
        this.tickRate = Math.max(10, Math.floor(options.tickRate ?? 60));
        this.deltaTime = 1 / this.tickRate;
        this.rng = new Prng_1.Prng(options.seed);
        this.mapConfig.fromDto(map);
        const level = Math.max(1, Math.floor(options.level ?? 1));
        this.stageNumber = level;
        this.session.setMultiplayer();
        this.session.start(level, 35);
        const runState = options.runState;
        this.session.setRunBoosts(runState?.runBoosts ?? {
            hull: options.runBoosts?.hull ?? 0,
            armor: options.runBoosts?.armor ?? 0,
            engine: options.runBoosts?.engine ?? 0,
            salvage: options.runBoosts?.salvage ?? 0,
        });
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
        }
        else {
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
        (0, LevelMatchLifecycle_1.prepareLevelSession)(this.session, this.mapConfig.getEnemySpawnList().length);
        this.world = new LevelWorld_1.LevelWorld(this.root, this.mapConfig.getFieldWidth(), this.mapConfig.getFieldHeight());
        this.world.field.position.set(config.BORDER_LEFT_WIDTH, config.LEVEL_PLAY_TOP_OFFSET + config.BORDER_TOP_BOTTOM_HEIGHT);
        this.world.field.add(new gameObjects_1.GroundField(this.world.field.size.width, this.world.field.size.height));
        this.world.field.add(new gameObjects_1.WallShadowField(this.world.field.size.width, this.world.field.size.height));
        this.world.field.add(new gameObjects_1.Border(this.world.field.size.width, this.world.field.size.height));
        this.root.add(this.world.field);
        this.createTerrain();
        this.webRtcMatch = new HeadlessWebRtcMatch(this.inputBuffers, this.pendingFireSeqs, this.pendingPowerSlots, options.disableEnemyShooting === true);
        this.updateArgs = this.createUpdateArgs(this.webRtcMatch);
        this.baseScript = new LevelBaseScript_1.LevelBaseScript(true);
        this.enemyScript = new LevelEnemyScript_1.LevelEnemyScript(false, true);
        this.explosionScript = new LevelExplosionScript_1.LevelExplosionScript();
        this.gameOverScript = new LevelGameOverScript_1.LevelGameOverScript();
        this.introScript = new LevelIntroScript_1.LevelIntroScript();
        this.playerOverScript = new LevelPlayerOverScript_1.LevelPlayerOverScript();
        this.playerScript = new LevelPlayerScript_1.LevelPlayerScript({
            headless: true,
            playerRunConsumables: (runState?.playerRunConsumables ??
                options.playerRunConsumables)?.map((consumables) => ({
                powerups: consumables.powerups,
                powerupCounts: consumables.powerups.map((_, index) => {
                    return Math.max(0, Math.floor(consumables.powerupCounts?.[index] ?? 1));
                }),
            })),
        });
        this.pointsScript = new LevelPointsScript_1.LevelPointsScript();
        this.powerupScript = new LevelPowerupScript_1.LevelPowerupScript({
            isLocalServerMatch: false,
            isWebRtcClient: false,
            headless: true,
        });
        this.spawnScript = new LevelSpawnScript_1.LevelSpawnScript();
        this.winScript = new LevelWinScript_1.LevelWinScript();
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
            script.invokeInit(this.world, this.eventBus, this.session, this.mapConfig);
        });
        this.matchLifecycle = new LevelMatchLifecycle_1.LevelMatchLifecycle(this.eventBus, this.session, {
            gameOver: this.gameOverScript,
            playerOver: this.playerOverScript,
            player: this.playerScript,
            win: this.winScript,
        });
        this.alwaysUpdateScripts.push(this.introScript);
        this.introScript.completed.addListener(() => {
            this.alwaysUpdateScripts.push(this.gameOverScript, this.winScript);
            this.playingUpdateScripts.push(this.baseScript, this.explosionScript, this.enemyScript, this.spawnScript, this.playerOverScript, this.playerScript, this.pointsScript, this.powerupScript);
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
                    reason: event.reason,
                    hitterPartyIndex: event.hitterPartyIndex === 0 || event.hitterPartyIndex === 1
                        ? event.hitterPartyIndex
                        : null,
                });
            });
        });
        this.eventBus.enemyExploded.addListener(() => {
            this.enemyExplosionCount += 1;
            this.requestHitStop(config.HIT_STOP_KILL * config.CAMERA_SHAKE_INTENSITY);
        });
        this.eventBus.playerDied.addListener(() => {
            this.requestHitStop(config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY);
        });
        this.eventBus.baseDied.addListener(() => {
            this.requestHitStop(config.HIT_STOP_DEATH * config.CAMERA_SHAKE_INTENSITY);
        });
        this.root.updateMatrix(true);
        this.root.updateWorldMatrix(false, true);
    }
    get tick() {
        return this.currentTick;
    }
    get seq() {
        return this.frameSeq;
    }
    consumeHitStopSeconds() {
        const seconds = this.pendingHitStopSeconds;
        this.pendingHitStopSeconds = 0;
        return seconds;
    }
    setEnemyShootingDisabled(disabled) {
        this.webRtcMatch.setEnemyShootingDisabled(disabled);
    }
    acceptInput(packet) {
        if ((packet.player !== 0 && packet.player !== 1) ||
            !Number.isInteger(packet.seq) ||
            !isRotation(packet.direction) ||
            !isPowerSlot(packet.powerSlot)) {
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
    step() {
        this.currentTick += 1;
        this.session.recordLevelTick();
        this.alwaysUpdateScripts.forEach((script) => {
            script.invokeUpdate(this.updateArgs);
        });
        if (!this.gameState.is(GameState_1.GameState.Paused)) {
            this.playingUpdateScripts.forEach((script) => {
                if (!this.alwaysUpdateScripts.includes(script)) {
                    script.invokeUpdate(this.updateArgs);
                }
            });
        }
        this.prepareNetworkTick();
        this.root.traverseDescedants((node) => {
            const shouldUpdate = this.gameState.is(GameState_1.GameState.Playing) || node.ignorePause;
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
    getScores() {
        return [
            this.session.getPlayer(0).getGamePoints(),
            this.session.getPlayer(1).getGamePoints(),
        ];
    }
    getLives() {
        return [
            this.session.getPlayer(0).getLivesCount(),
            this.session.getPlayer(1).getLivesCount(),
        ];
    }
    getEnemyExplosionCount() {
        return this.enemyExplosionCount;
    }
    isComplete() {
        return this.matchLifecycle.isComplete();
    }
    isTerminal() {
        return this.matchLifecycle.isComplete() &&
            this.matchLifecycle.getResult() === 'loss';
    }
    createNextStageRunState() {
        if (!this.matchLifecycle.isComplete() ||
            this.matchLifecycle.getResult() !== 'win') {
            throw new Error('Cannot advance an unfinished or lost stage');
        }
        const maxLevelPoints = this.session.getMaxLevelPoints();
        this.session.getPlayers().forEach((player) => {
            if (player.getLevelPoints() > 0 &&
                player.getLevelPoints() === maxLevelPoints) {
                player.addBonusPoints();
            }
        });
        this.session.activateNextLevel();
        const playerRunConsumables = this.playerScript.getAuthoritativeRunConsumables() ?? [
            { powerups: [], powerupCounts: [] },
            { powerups: [], powerupCounts: [] },
        ];
        return {
            stageNumber: this.session.getLevelNumber(),
            tick: this.currentTick,
            frameSeq: this.frameSeq,
            scores: this.getScores(),
            lives: this.getLives(),
            tankTiers: this.session.getPlayerTankTiers(),
            runBoosts: this.session.getRunBoosts(),
            playerRunConsumables,
            playerElapsedSeconds: [...this.playerElapsed],
        };
    }
    applyInitialPlayerTiers(tiers) {
        if (tiers === undefined) {
            return;
        }
        tiers.forEach((tier, player) => {
            this.session.getPlayer(player).setTankTier(tier);
            this.session.setPlayerTankTier(player, tier);
        });
    }
    createUpdateArgs(webRtcMatch) {
        const silentSound = {
            play: () => undefined,
            playLoop: () => undefined,
            resume: () => undefined,
            pause: () => undefined,
            stop: () => undefined,
            canResume: () => false,
            setMuted: () => undefined,
            isMuted: () => true,
            setGlobalMuted: () => undefined,
            isGlobalMuted: () => true,
        };
        const spriteLoader = {
            load: () => null,
            loadList: (ids) => ids.map(() => null),
            loadSequence: () => [null],
            has: () => false,
        };
        const neutralInputMethod = {
            isDownAny: () => false,
            isHoldAny: () => false,
            isNotHoldAll: () => true,
            getHoldLastIndex: () => -1,
        };
        const inputManager = {
            isReplaying: () => false,
            getActiveMethod: () => neutralInputMethod,
            getMethodByVariant: () => neutralInputMethod,
        };
        const magicBlockMovement = {
            isWatching: () => false,
            isRemoteTank: () => false,
            isLocalServerMatchWaitingForStart: () => false,
            isOnlineMatch: () => false,
            isLocalServerMatch: () => false,
            recordLocalFire: () => undefined,
            setPlayerMirrorBulletsSuppressed: () => undefined,
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
                spawn: () => undefined,
                flash: () => undefined,
                clear: () => undefined,
            },
            rng: this.rng,
            session: this.session,
            spriteLoader,
            webRtcMatch,
        };
    }
    createTerrain() {
        const basePosition = this.mapConfig.getBasePosition();
        const baseRect = new Rect_1.Rect(basePosition.x, basePosition.y, config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
        const regions = [
            ...this.mapConfig.getTerrainRegions(),
            ...BASE_WALL_REGIONS.map((region) => ({
                type: TerrainType_1.TerrainType.Brick,
                x: basePosition.x + region.x,
                y: basePosition.y + region.y,
                width: region.width,
                height: region.height,
            })),
        ];
        const tiles = TerrainFactory_1.TerrainFactory.createMapFromRegionConfigs(regions, this.world.field.size.width, this.world.field.size.height, [baseRect]);
        tiles.forEach((tile) => {
            tile.destroyed.addListener(() => {
                this.eventBus.mapTileDestroyed.notify({
                    type: tile.type,
                    position: tile.position.clone(),
                    size: tile.size.clone(),
                });
            });
            if (tile instanceof gameObjects_1.BrickSuperTerrainTile) {
                tile.subTileDestroyed.addListener(() => undefined);
            }
        });
        this.world.field.add(...tiles);
    }
    prepareNetworkTick() {
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
    observeTankFire(tank, states) {
        const existing = states.get(tank.partyIndex);
        if (existing?.tank === tank) {
            return;
        }
        const state = existing ?? {
            tank,
            seq: 0,
            x: 0,
            y: 0,
            rotation: tank.rotation,
        };
        state.tank = tank;
        state.x = tank.position.x;
        state.y = tank.position.y;
        state.rotation = tank.rotation;
        states.set(tank.partyIndex, state);
        tank.fired.addListener(() => {
            state.seq += 1;
            state.x = tank.position.x;
            state.y = tank.position.y;
            state.rotation = tank.rotation;
        });
    }
    clampTanksToFieldBounds() {
        const maxX = this.world.field.size.width - config.TILE_SIZE_LARGE;
        const maxY = this.world.field.size.height - config.TILE_SIZE_LARGE;
        this.world.field.children.forEach((node) => {
            if (!(node instanceof gameObjects_1.Tank)) {
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
    createFrame() {
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
                    record.getTierKillCount(TankTier_1.TankTier.A),
                    record.getTierKillCount(TankTier_1.TankTier.B),
                    record.getTierKillCount(TankTier_1.TankTier.C),
                    record.getTierKillCount(TankTier_1.TankTier.D),
                ];
            }),
            sharedElapsedSeconds: this.currentTick * this.deltaTime,
            playerOneElapsedSeconds: this.playerElapsed[0],
            playerTwoElapsedSeconds: this.playerElapsed[1],
            players,
            powerup: powerup,
            powerupPickup: pickup,
            activeEnemyIds,
            enemyDeaths: this.pendingEnemyDeaths.splice(0, this.pendingEnemyDeaths.length),
            enemies,
        };
    }
    createPlayerFrame(tank) {
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
            partyIndex: tank.partyIndex,
            tier: tank.type.tier,
            x: tank.position.x,
            y: tank.position.y,
            rotation: tank.rotation,
            moving: tank.state === gameObjects_1.TankState.Moving,
            deltaX,
            deltaY,
            alive: tank.isAlive(),
            fireSeq: fire?.seq ?? 0,
            fireX: fire?.x ?? tank.position.x,
            fireY: fire?.y ?? tank.position.y,
            fireRotation: fire?.rotation ?? tank.rotation,
            initialSync: !sameTank,
        };
    }
    createEnemyFrame(tank) {
        const previous = this.previousEnemies.get(tank.partyIndex);
        const deltaX = previous === undefined ? 0 : tank.position.x - previous.x;
        const deltaY = previous === undefined ? 0 : tank.position.y - previous.y;
        this.previousEnemies.set(tank.partyIndex, {
            x: tank.position.x,
            y: tank.position.y,
        });
        const fire = this.enemyFire.get(tank.partyIndex);
        return {
            partyIndex: tank.partyIndex,
            x: tank.position.x,
            y: tank.position.y,
            rotation: tank.rotation,
            moving: tank.state === gameObjects_1.TankState.Moving,
            deltaX,
            deltaY,
            alive: tank.isAlive(),
            fireSeq: fire?.seq ?? 0,
            fireX: fire?.x ?? tank.position.x,
            fireY: fire?.y ?? tank.position.y,
            fireRotation: fire?.rotation ?? tank.rotation,
        };
    }
}
exports.EngineBattleCitySimulation = EngineBattleCitySimulation;
function isRotation(value) {
    return (value === null ||
        value === Rotation_1.Rotation.Up ||
        value === Rotation_1.Rotation.Right ||
        value === Rotation_1.Rotation.Down ||
        value === Rotation_1.Rotation.Left);
}
function isPowerSlot(value) {
    return (value === undefined ||
        value === null ||
        (Number.isInteger(value) && value >= 0 && value < 4));
}
