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
exports.LevelPowerupScript = void 0;
const core_1 = require("../../core");
const debug_1 = require("../../debug");
const powerup_1 = require("../../powerup");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
class LevelPowerupScript extends LevelScript_1.LevelScript {
    constructor(options = {}) {
        super();
        this.networkPowerupId = null;
        this.activePowerupId = null;
        this.powerupSequence = 0;
        this.pickupSequence = 0;
        this.lastNetworkPickupSequence = 0;
        this.latestPickup = null;
        this.activePowerup = null;
        // Dev-only match replay (see src/replay/PowerupSpawnFrame): when set, each
        // spawn() call re-enacts the next recorded (type, position) pair instead of
        // drawing from rng.
        this.replayPowerupSpawns = null;
        this.replaySpawnIndex = 0;
        this.isRecordingPowerups = false;
        this.recordedPowerupSpawns = [];
        this.handleEnemyHit = (event) => {
            if (this.isLocalServerMatch || this.isWebRtcClient) {
                return;
            }
            const { type: tankType } = event;
            // Ignore if tank does not have droppable powerup
            if (!tankType.hasDrop) {
                return;
            }
            this.spawn();
        };
        // Remove active powerup whenever new enemy spawns with drop
        this.handleEnemySpawnCompleted = (event) => {
            if (this.isLocalServerMatch || this.isWebRtcClient) {
                return;
            }
            const { type: tankType } = event;
            // Tanks without drops don't affect powerups
            if (!tankType.hasDrop) {
                return;
            }
            this.revoke();
        };
        // Remove powerup after timer expires
        this.handleTimer = () => {
            this.revoke();
        };
        this.handleMapTileDestroyed = (event) => {
            const { type: terrainType, position, size } = event;
            // Only steel tiles when destroyed can free new space for powerup spawn
            if (terrainType !== terrain_1.TerrainType.Steel) {
                return;
            }
            const rect = new core_1.Rect(position.x, position.y, size.width, size.height);
            this.grid.freeRect(rect);
        };
        this.capturePowerupPickup = (event) => {
            this.pickupSequence += 1;
            this.latestPickup = {
                seq: this.pickupSequence,
                type: event.type,
                partyIndex: event.partyIndex,
                x: event.centerPosition.x,
                y: event.centerPosition.y,
                hotbarSlot: event.hotbarSlot,
            };
        };
        const detected = detectNetworkMode();
        this.isLocalServerMatch =
            options.isLocalServerMatch ?? detected.isLocalServerMatch;
        this.isWebRtcClient = options.isWebRtcClient ?? detected.isWebRtcClient;
        this.headless = options.headless === true;
    }
    setReplayPowerupSpawns(frames) {
        this.replayPowerupSpawns = frames;
    }
    startRecordingPowerups() {
        this.isRecordingPowerups = true;
    }
    getRecordedPowerupSpawns() {
        return this.recordedPowerupSpawns;
    }
    syncNetworkPowerup(snapshot) {
        if (!this.isLocalServerMatch) {
            return;
        }
        this.applyNetworkPowerup(snapshot);
    }
    syncWebRtcPowerup(snapshot) {
        if (!this.isWebRtcClient) {
            return;
        }
        this.applyNetworkPowerup(snapshot);
    }
    syncWebRtcPickup(snapshot) {
        if (!this.isWebRtcClient ||
            snapshot === null ||
            snapshot.seq <= this.lastNetworkPickupSequence) {
            return;
        }
        this.lastNetworkPickupSequence = snapshot.seq;
        this.eventBus.powerupPicked.notify({
            type: snapshot.type,
            partyIndex: snapshot.partyIndex,
            centerPosition: new core_1.Vector(snapshot.x, snapshot.y),
            hotbarSlot: snapshot.hotbarSlot,
        });
    }
    getWebRtcPowerup() {
        if (this.activePowerup === null || this.activePowerupId === null) {
            return null;
        }
        return {
            id: this.activePowerupId,
            kind: this.activePowerup.type,
            x: this.activePowerup.position.x,
            y: this.activePowerup.position.y,
        };
    }
    getWebRtcPickup() {
        return this.latestPickup;
    }
    applyNetworkPowerup(snapshot) {
        if (snapshot === null) {
            if (this.networkPowerupId !== null) {
                this.revoke();
                this.networkPowerupId = null;
            }
            return;
        }
        if (snapshot.id === this.networkPowerupId) {
            return;
        }
        this.revoke();
        const powerup = powerup_1.PowerupFactory.create(snapshot.kind);
        powerup.position.set(snapshot.x, snapshot.y);
        powerup.setNetworkControlled(true);
        this.activePowerup = powerup;
        this.networkPowerupId = snapshot.id;
        this.world.field.add(powerup);
        this.eventBus.powerupSpawned.notify({
            type: powerup.type,
            position: powerup.position.clone(),
        });
    }
    setup(updateArgs) {
        this.rng = updateArgs.rng;
        this.eventBus.enemyHit.addListener(this.handleEnemyHit);
        this.eventBus.enemySpawnCompleted.addListener(this.handleEnemySpawnCompleted);
        this.eventBus.mapTileDestroyed.addListener(this.handleMapTileDestroyed);
        this.eventBus.powerupPicked.addListener(this.capturePowerupPickup);
        this.timer = new core_1.Timer();
        this.timer.done.addListener(this.handleTimer);
        this.grid = new powerup_1.PowerupGrid(this.mapConfig.getFieldWidth(), this.mapConfig.getFieldHeight());
        this.blockGridDefaults();
        this.blockGridInitialMap();
        if (config.IS_DEV && !this.headless) {
            const debugMenu = new debug_1.DebugLevelPowerupMenu(this.world, this.grid, {
                top: 125,
            });
            debugMenu.attach();
            debugMenu.spawnRequest.addListener((type) => {
                this.spawn(type);
            });
        }
    }
    update({ deltaTime }) {
        if (this.isWebRtcClient) {
            return;
        }
        this.timer.update(deltaTime);
    }
    spawn(type = null) {
        // Override previous powerup with newly picked up one
        this.revoke();
        // Needed either way: to block spawn positions around live players below,
        // or as the fallback "give directly to player" target further down.
        const playerTankRects = this.createPlayerTankRects();
        let powerup;
        let position;
        if (this.replayPowerupSpawns !== null) {
            // Dev-only match replay: re-enact exactly which powerup spawned where,
            // instead of drawing from rng (see PowerupSpawnFrame -- once enemies
            // stopped consuming the same rng stream, its alignment with the
            // original recording broke, so this must be replayed verbatim too).
            const frame = this.replayPowerupSpawns[this.replaySpawnIndex] ?? null;
            this.replaySpawnIndex += 1;
            powerup =
                frame !== null
                    ? powerup_1.PowerupFactory.create(frame.type)
                    : powerup_1.PowerupFactory.createRandom(this.rng); // recording exhausted; fall back
            position =
                frame !== null && frame.position !== null
                    ? new core_1.Vector(frame.position.x, frame.position.y)
                    : null;
        }
        else {
            powerup =
                type !== null
                    ? powerup_1.PowerupFactory.create(type)
                    : powerup_1.PowerupFactory.createRandom(this.rng);
            // Block area around player tank at the moment of powerup spawn
            // so player won't accidently pick up a powerup. After spawning free it back
            // because player tank is in constant movement.
            if (playerTankRects.length > 0) {
                this.grid.backup();
                playerTankRects.forEach((playerTankRect) => {
                    if (playerTankRect === null) {
                        return;
                    }
                    this.grid.blockRect(playerTankRect);
                });
            }
            position = this.grid.getRandomPosition(this.rng);
            if (playerTankRects.length > 0) {
                this.grid.restore();
            }
        }
        if (this.isRecordingPowerups) {
            this.recordedPowerupSpawns.push({
                type: powerup.type,
                position: position !== null ? { x: position.x, y: position.y } : null,
            });
        }
        // In case no free position available, give powerup directly to player.
        // Spawn it on top of player tank, if available. Otherwise, on top of base.
        // Specify appropriate center position to display points for picking it up.
        if (position === null) {
            // Check which player rect is available
            // If primary player tank is missing, use second tank
            let partyIndex = 0;
            if (playerTankRects[0] === null) {
                partyIndex = 1;
            }
            // In case second is missing - use default spot
            const directRect = playerTankRects[partyIndex] ?? this.createBaseRect();
            this.eventBus.powerupPicked.notify({
                type: powerup.type,
                centerPosition: directRect.getCenter(),
                partyIndex,
            });
            return;
        }
        powerup.position.copyFrom(position);
        powerup.picked.addListener(({ partyIndex }) => {
            this.activePowerup = null;
            this.activePowerupId = null;
            this.timer.stop();
            this.eventBus.powerupPicked.notify({
                type: powerup.type,
                centerPosition: powerup.getCenter(),
                partyIndex,
            });
        });
        // Salvage boost: dropped powerups stay on the field longer. Deterministic
        // (a plain multiplier on the despawn timer) and replay-safe (the session
        // holds the recorded run's boosts during playback).
        const salvage = this.session.getRunBoosts().salvage;
        this.timer.reset(config.POWERUP_DURATION * (1 + salvage / 100));
        this.activePowerup = powerup;
        this.activePowerupId = ++this.powerupSequence;
        this.world.field.add(powerup);
        this.eventBus.powerupSpawned.notify({
            type: powerup.type,
            position,
        });
    }
    revoke() {
        if (this.activePowerup === null) {
            return;
        }
        this.activePowerup.destroy();
        this.activePowerup = null;
        this.activePowerupId = null;
        this.eventBus.powerupRevoked.notify(null);
    }
    createBaseRect() {
        const basePosition = this.mapConfig.getBasePosition();
        return new core_1.Rect(basePosition.x, basePosition.y, config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
    }
    createPlayerTankRects() {
        const rects = [];
        const playerTanks = this.world.getPlayerTanks();
        playerTanks.forEach((playerTank) => {
            if (playerTank === null) {
                rects.push(null);
                return;
            }
            // Create a margin around player tank, so player won't accidently pick
            // powerup up.
            const margin = config.TILE_SIZE_LARGE;
            const rect = new core_1.Rect(playerTank.position.x - margin, playerTank.position.y - margin, playerTank.size.width + margin * 2, playerTank.size.height + margin * 2);
            rects.push(rect);
        });
        return rects;
    }
    blockGridDefaults() {
        this.grid.blockRect(this.createBaseRect());
        const playerSpawnPositions = this.mapConfig.getPlayerSpawnPositions();
        playerSpawnPositions.forEach((position) => {
            this.grid.blockRect(new core_1.Rect(position.x, position.y, 64, 64));
        });
        const enemySpawnPositions = this.mapConfig.getEnemySpawnPositions();
        enemySpawnPositions.forEach((position) => {
            this.grid.blockRect(new core_1.Rect(position.x, position.y, 64, 64));
        });
    }
    blockGridInitialMap() {
        const denyTypes = [terrain_1.TerrainType.Steel, terrain_1.TerrainType.Water];
        const regions = this.mapConfig.getTerrainRegions();
        regions.forEach((region) => {
            if (!denyTypes.includes(region.type)) {
                return;
            }
            this.grid.blockRect(new core_1.Rect(region.x, region.y, region.width, region.height));
        });
    }
}
exports.LevelPowerupScript = LevelPowerupScript;
function detectNetworkMode() {
    if (typeof window === 'undefined') {
        return { isLocalServerMatch: false, isWebRtcClient: false };
    }
    const params = new URLSearchParams(window.location.search);
    return {
        isLocalServerMatch: params.get('mode') === 'local',
        isWebRtcClient: params.get('mode') === 'webrtc' &&
            params.get('broadcaster') !== '1',
    };
}
