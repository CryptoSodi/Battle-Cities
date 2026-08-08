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
exports.LevelEnemyScript = void 0;
const core_1 = require("../../core");
const debug_1 = require("../../debug");
const game_1 = require("../../game");
const powerup_1 = require("../../powerup");
const tank_1 = require("../../tank");
const behaviors_1 = require("../../tank/behaviors");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
const NETWORK_DEATH_COLLISION_GRACE = 0.2;
const TANK_SPAWN_SIZE = 64;
class LevelEnemyScript extends LevelScript_1.LevelScript {
    constructor(isNetworkEnemyMirror = detectNetworkEnemyMirror(), headless = false) {
        super();
        this.list = [];
        this.listIndex = 0;
        this.aliveTanks = [];
        this.positions = [];
        this.positionIndex = 0;
        this.spawnTimer = new core_1.Timer();
        this.freezeTimer = new core_1.Timer();
        this.debugMovementStopped = false;
        this.debugPlayerMirrorBulletsHidden = false;
        this.spawningCount = 0;
        this.activeEnemyIds = new Set();
        this.pendingNetworkRemovals = [];
        // Dev-only match replay (see src/replay): when set, newly spawned enemies
        // re-enact this recorded movement instead of deciding for themselves (see
        // RecordedTankBehavior) -- keyed by partyIndex, same as the saved replay's
        // own enemyTraces.
        this.replayEnemyTraces = null;
        // Fires synchronously the moment a tank is constructed and pushed to
        // aliveTanks -- deliberately NOT the eventBus.enemySpawnCompleted Subject,
        // whose listener order between scripts depends on when each script's own
        // (lazy, first-update-triggered) setup() runs, which isn't guaranteed to
        // be before a listener registered eagerly elsewhere (see LevelPlayScene's
        // enemy-fire recording, which needs the tank to already exist).
        this.tankCreated = new core_1.Subject();
        this.handleSpawnTimer = () => {
            // Happens after max enemies spawn
            if (this.aliveTanks.length >= this.getMaxAliveCount()) {
                this.spawnTimer.stop();
                return;
            }
            // No more tanks to spawn
            if (this.listIndex >= this.list.length) {
                this.spawnTimer.stop();
                return;
            }
            if (!this.requestSpawn()) {
                // Retry on the next simulation tick without consuming this enemy or
                // advancing to another spawn point.
                this.spawnTimer.reset(0);
                return;
            }
            // Start timer to spawn next enemy
            this.spawnTimer.reset(config.ENEMY_SPAWN_DELAY);
        };
        this.handleSpawnCompleted = (event) => {
            this.spawningCount -= 1;
            const { type } = event;
            if (type.party !== tank_1.TankParty.Enemy) {
                return;
            }
            const behavior = this.replayEnemyTraces !== null
                ? new behaviors_1.RecordedTankBehavior(this.replayEnemyTraces[event.partyIndex] ?? [])
                : this.isNetworkEnemyMirror
                    ? new behaviors_1.StandStillTankBehavior()
                    : new behaviors_1.AiTankBehavior();
            const tank = tank_1.TankFactory.createEnemy(event.partyIndex, type, behavior);
            tank.setNetworkControlled(this.isNetworkEnemyMirror);
            if (tank.behavior instanceof behaviors_1.AiTankBehavior) {
                tank.behavior.setBasePosition(this.mapConfig.getBasePosition());
            }
            tank.updateMatrix(); // Origin should be in before setting center
            tank.rotate(game_1.Rotation.Down);
            tank.setCenter(event.centerPosition);
            tank.updateMatrix();
            if (this.freezeTimer.isActive() || this.debugMovementStopped) {
                tank.freezeState.set(true);
            }
            tank.hit.addListener(() => {
                this.eventBus.enemyHit.notify({
                    type: tank.type,
                });
            });
            tank.died.addListener((deathEvent) => {
                this.eventBus.enemyDied.notify({
                    type: tank.type,
                    centerPosition: tank.getCenter(),
                    reason: deathEvent.reason,
                    hitterPartyIndex: deathEvent.hitterPartyIndex,
                });
                tank.removeSelf();
                this.activeEnemyIds.delete(tank.partyIndex);
                // Remove from alive
                this.aliveTanks = this.aliveTanks.filter((aliveTank) => {
                    return aliveTank !== tank;
                });
                // If timer was stopped because max count of alive enemies has been
                // reached, restart it, because one of alive tanks has just been killed
                if (!this.isNetworkEnemyMirror && !this.spawnTimer.isActive()) {
                    this.spawnTimer.reset(config.ENEMY_SPAWN_DELAY);
                }
                if (this.areAllDead()) {
                    this.eventBus.enemyAllDied.notify(null);
                }
            });
            this.aliveTanks.push(tank);
            this.tankCreated.notify(tank);
            this.world.field.add(tank);
        };
        this.handleFreezeTimer = () => {
            this.aliveTanks.forEach((tank) => {
                tank.freezeState.set(this.debugMovementStopped);
            });
        };
        this.handleDebugMovementToggle = (stopped) => {
            this.debugMovementStopped = stopped;
            this.aliveTanks.forEach((tank) => {
                tank.freezeState.set(stopped || this.freezeTimer.isActive());
            });
        };
        this.handleDebugPlayerMirrorBulletsToggle = (hidden) => {
            this.debugPlayerMirrorBulletsHidden = hidden;
        };
        this.handlePowerupPicked = (event) => {
            const { type: powerupType } = event;
            if (powerupType === powerup_1.PowerupType.Freeze) {
                this.freezeTimer.reset(config.FREEZE_POWERUP_DURATION);
                this.aliveTanks.forEach((tank) => {
                    tank.freezeState.set(true);
                });
            }
            if (powerupType === powerup_1.PowerupType.Wipeout) {
                this.aliveTanks.forEach((tank) => {
                    // Enemy with drop cant drop it when killed by powerup
                    tank.discardDrop();
                    // Pass death reason because picking up this powerup does not award
                    // per-enemy points. Only powerup pickup points are awarded.
                    tank.die(tank_1.TankDeathReason.WipeoutPowerup);
                });
            }
        };
        this.isNetworkEnemyMirror = isNetworkEnemyMirror;
        this.headless = headless;
    }
    setReplayEnemyTraces(traces) {
        this.replayEnemyTraces = traces;
    }
    // Exposes the currently-alive enemies so the scene can record their
    // per-tick movement during a real (non-replay) playthrough.
    getAliveTanks() {
        return this.aliveTanks;
    }
    getActiveEnemyIds() {
        return Array.from(this.activeEnemyIds);
    }
    syncNetworkEnemyCount(activeIds) {
        if (!this.isNetworkEnemyMirror) {
            return;
        }
        const activeIdSet = new Set(activeIds.filter((id) => {
            return Number.isInteger(id) && id >= 0 && id < this.list.length;
        }));
        this.aliveTanks
            .filter((tank) => !activeIdSet.has(tank.partyIndex))
            .forEach((tank) => this.removeNetworkEnemy(tank));
        if (activeIdSet.size === 0) {
            return;
        }
        const desiredCount = Math.max(...Array.from(activeIdSet)) + 1;
        while (this.listIndex < desiredCount && this.listIndex < this.list.length) {
            this.requestSpawn();
        }
    }
    syncNetworkReplayEnemies(frames) {
        if (!this.isNetworkEnemyMirror) {
            return;
        }
        frames.forEach((frame) => {
            if (this.aliveTanks.some((tank) => tank.partyIndex === frame.partyIndex) ||
                !Number.isInteger(frame.partyIndex) ||
                frame.partyIndex < 0 ||
                frame.partyIndex >= this.list.length) {
                return;
            }
            this.activeEnemyIds.add(frame.partyIndex);
            this.listIndex = Math.max(this.listIndex, frame.partyIndex + 1);
            this.spawningCount += 1;
            this.handleSpawnCompleted({
                type: this.list[frame.partyIndex],
                centerPosition: new core_1.Vector(frame.x + TANK_SPAWN_SIZE / 2, frame.y + TANK_SPAWN_SIZE / 2),
                partyIndex: frame.partyIndex,
            });
        });
    }
    syncNetworkEnemyDeaths(deaths, showEffects = true) {
        if (!this.isNetworkEnemyMirror) {
            return;
        }
        deaths.forEach((death) => {
            const tank = this.aliveTanks.find((candidate) => {
                return candidate.partyIndex === death.partyIndex;
            });
            if (tank !== undefined) {
                this.removeNetworkEnemy(tank, death, showEffects);
            }
        });
    }
    removeNetworkEnemy(tank, death = null, showEffects = true) {
        this.activeEnemyIds.delete(tank.partyIndex);
        const centerPosition = death !== null && Number.isFinite(death.x) && Number.isFinite(death.y)
            ? new core_1.Vector(death.x, death.y)
            : tank.getCenter();
        if (showEffects) {
            this.eventBus.enemyDied.notify({
                type: tank.type,
                centerPosition,
                reason: death?.reason ?? tank_1.TankDeathReason.Bullet,
                hitterPartyIndex: death?.hitterPartyIndex ?? null,
                networkMirror: true,
            });
        }
        if (showEffects) {
            tank.beginNetworkDeathGrace();
            this.pendingNetworkRemovals.push({
                tank,
                remaining: NETWORK_DEATH_COLLISION_GRACE,
            });
        }
        else {
            tank.finishNetworkRemoval();
        }
        this.aliveTanks = this.aliveTanks.filter((aliveTank) => {
            return aliveTank !== tank;
        });
    }
    init() {
        this.eventBus.enemySpawnCompleted.addListener(this.handleSpawnCompleted);
        this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
        this.list = this.mapConfig.getEnemySpawnList();
        this.positions = this.mapConfig.getEnemySpawnPositions();
    }
    setup() {
        if (!this.isNetworkEnemyMirror) {
            this.spawnTimer.reset(config.ENEMY_FIRST_SPAWN_DELAY);
        }
        this.spawnTimer.done.addListener(this.handleSpawnTimer);
        this.freezeTimer.done.addListener(this.handleFreezeTimer);
        if (config.IS_DEV && !this.headless) {
            const debugMenu = new debug_1.DebugLevelEnemyMenu({
                top: 365,
                left: 0,
                right: null,
            });
            debugMenu.attach();
            debugMenu.movementToggleRequest.addListener(this.handleDebugMovementToggle);
            debugMenu.playerMirrorBulletsToggleRequest.addListener(this.handleDebugPlayerMirrorBulletsToggle);
        }
    }
    update(updateArgs) {
        const { deltaTime } = updateArgs;
        updateArgs.magicBlockMovement.setPlayerMirrorBulletsSuppressed(this.debugPlayerMirrorBulletsHidden);
        if (!this.isNetworkEnemyMirror) {
            this.spawnTimer.update(deltaTime);
        }
        this.freezeTimer.update(deltaTime);
        this.updatePendingNetworkRemovals(deltaTime);
    }
    updatePendingNetworkRemovals(deltaTime) {
        this.pendingNetworkRemovals.forEach((pending) => {
            pending.remaining -= deltaTime;
        });
        this.pendingNetworkRemovals
            .filter((pending) => pending.remaining <= 0)
            .forEach((pending) => pending.tank.finishNetworkRemoval());
        this.pendingNetworkRemovals = this.pendingNetworkRemovals.filter((pending) => pending.remaining > 0);
    }
    requestSpawn() {
        const type = this.list[this.listIndex];
        const position = this.positions[this.positionIndex];
        if (type === undefined || position === undefined) {
            this.spawnTimer.stop();
            return false;
        }
        if (!this.isNetworkEnemyMirror && this.isSpawnPositionOccupied(position)) {
            return false;
        }
        this.spawningCount += 1;
        const partyIndex = this.listIndex;
        this.activeEnemyIds.add(partyIndex);
        // Go to next tank
        this.listIndex += 1;
        // Take turns for positions where to spawn tanks
        this.positionIndex += 1;
        if (this.positionIndex >= this.positions.length) {
            this.positionIndex = 0;
        }
        const unspawnedCount = this.getUnspawnedCount();
        this.eventBus.enemySpawnRequested.notify({
            type,
            position,
            partyIndex,
            unspawnedCount,
        });
        return true;
    }
    isSpawnPositionOccupied(position) {
        const spawnBox = new core_1.BoundingBox(position.clone(), new core_1.Vector(position.x + TANK_SPAWN_SIZE, position.y + TANK_SPAWN_SIZE));
        const tanks = [...this.aliveTanks, ...this.world.getPlayerTanks()].filter((tank) => tank !== null && tank !== undefined);
        return tanks.some((tank) => {
            tank.updateMatrix();
            return spawnBox.intersectsBox(tank.getBoundingBox());
        });
    }
    getUnspawnedCount() {
        return this.list.length - this.listIndex;
    }
    areAllDead() {
        const spawningCount = this.spawningCount;
        const unspawnedCount = this.getUnspawnedCount();
        const aliveCount = this.aliveTanks.length;
        const areAllDead = spawningCount === 0 && unspawnedCount === 0 && aliveCount === 0;
        return areAllDead;
    }
    getMaxAliveCount() {
        if (this.session.isMultiplayer()) {
            return config.ENEMY_MAX_ALIVE_COUNT_MULTIPLAYER;
        }
        return config.ENEMY_MAX_ALIVE_COUNT;
    }
}
exports.LevelEnemyScript = LevelEnemyScript;
function detectNetworkEnemyMirror() {
    if (typeof window === 'undefined') {
        return false;
    }
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    return (mode === 'match' ||
        mode === 'local' ||
        (mode === 'webrtc' && params.get('broadcaster') !== '1'));
}
