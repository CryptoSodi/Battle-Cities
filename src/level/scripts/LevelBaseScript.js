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
exports.LevelBaseScript = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const powerup_1 = require("../../powerup");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
const WALL_REGIONS = [
    { x: 0, y: 0, width: 128, height: 32 },
    { x: 0, y: 32, width: 32, height: 64 },
    { x: 96, y: 32, width: 32, height: 64 },
];
class LevelBaseScript extends LevelScript_1.LevelScript {
    constructor(isWebRtcMatch = detectWebRtcMatch()) {
        super();
        this.defenceTimer = new core_1.Timer();
        this.handlePowerupPicked = (event) => {
            const { type: powerupType } = event;
            if (powerupType === powerup_1.PowerupType.BaseDefence) {
                if (this.isWebRtcMatch) {
                    this.replaceBaseWalls(terrain_1.TerrainType.Steel);
                    this.defenceTimer.reset(config.BASE_DEFENCE_POWERUP_DURATION);
                    return;
                }
                this.base.activateDefence(config.BASE_DEFENCE_POWERUP_DURATION);
            }
        };
        this.restoreBrickWalls = () => {
            this.replaceBaseWalls(terrain_1.TerrainType.Brick);
        };
        this.isWebRtcMatch = isWebRtcMatch;
    }
    setup() {
        this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
        this.defenceTimer.done.addListener(this.restoreBrickWalls);
        this.base = new gameObjects_1.Base();
        this.base.position.copyFrom(this.mapConfig.getBasePosition());
        this.base.died.addListener(() => {
            this.eventBus.baseDied.notify(null);
        });
        this.world.field.add(this.base);
    }
    update(updateArgs) {
        if (this.isWebRtcMatch) {
            this.defenceTimer.update(updateArgs.deltaTime);
        }
    }
    replaceBaseWalls(type) {
        const basePosition = this.mapConfig.getBasePosition();
        const regions = WALL_REGIONS.map((region) => {
            return new core_1.Rect(basePosition.x + region.x, basePosition.y + region.y, region.width, region.height);
        });
        [...this.world.field.children].forEach((node) => {
            if (!(node instanceof gameObjects_1.TerrainTile)) {
                return;
            }
            const isBaseWall = regions.some((region) => {
                return (node.position.x >= region.x &&
                    node.position.x < region.x + region.width &&
                    node.position.y >= region.y &&
                    node.position.y < region.y + region.height);
            });
            if (isBaseWall) {
                node.destroy(false);
            }
        });
        const baseRect = new core_1.Rect(basePosition.x, basePosition.y, config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
        const tiles = terrain_1.TerrainFactory.createMapFromRegionConfigs(regions.map((region) => ({
            type,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
        })), this.world.field.size.width, this.world.field.size.height, [baseRect]);
        tiles.forEach((tile) => {
            tile.destroyed.addListener(() => {
                this.eventBus.mapTileDestroyed.notify({
                    type: tile.type,
                    position: tile.position.clone(),
                    size: tile.size.clone(),
                });
            });
        });
        this.world.field.add(...tiles);
        this.world.field.setNeedsPaint();
    }
}
exports.LevelBaseScript = LevelBaseScript;
function detectWebRtcMatch() {
    return (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('mode') === 'webrtc');
}
