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
exports.DebugLevelPowerupMenu = void 0;
const core_1 = require("../../core");
const powerup_1 = require("../../powerup");
const config = __importStar(require("../../config"));
const DebugGrid_1 = require("../DebugGrid");
const DebugMenu_1 = require("../DebugMenu");
class DebugLevelPowerupMenu extends DebugMenu_1.DebugMenu {
    constructor(levelWorld, powerupGrid, options = {}) {
        super('Level Powerup', options);
        this.spawnRequest = new core_1.Subject();
        this.handleGridShow = () => {
            this.showGrid();
        };
        this.handleGridUpdate = () => {
            this.updateDebugGrid();
        };
        this.handleGridHide = () => {
            this.debugGrid.removeSelf();
        };
        this.handleSpawn = () => {
            this.spawnRequest.notify(null);
        };
        this.handleSpawnBaseDefence = () => {
            this.spawnRequest.notify(powerup_1.PowerupType.BaseDefence);
        };
        this.handleSpawnFreeze = () => {
            this.spawnRequest.notify(powerup_1.PowerupType.Freeze);
        };
        this.handleSpawnSpeed = () => {
            this.spawnRequest.notify(powerup_1.PowerupType.Speed);
        };
        this.handleSpawnZoomOut = () => {
            this.spawnRequest.notify(powerup_1.PowerupType.ZoomOut);
        };
        this.handleSpawnWipeout = () => {
            this.spawnRequest.notify(powerup_1.PowerupType.Wipeout);
        };
        this.levelWorld = levelWorld;
        this.powerupGrid = powerupGrid;
        this.debugGrid = new DebugGrid_1.DebugGrid(this.levelWorld.field.size.width, this.levelWorld.field.size.height, config.TILE_SIZE_MEDIUM);
        this.appendButton('Show grid', this.handleGridShow);
        this.appendButton('Hide grid', this.handleGridHide);
        this.appendButton('Update grid', this.handleGridUpdate);
        this.appendButton('Spawn', this.handleSpawn);
        this.appendButton('Spawn: base defence', this.handleSpawnBaseDefence);
        this.appendButton('Spawn: freeze', this.handleSpawnFreeze);
        this.appendButton('Spawn: speed', this.handleSpawnSpeed);
        this.appendButton('Spawn: zoom out', this.handleSpawnZoomOut);
        this.appendButton('Spawn: wipeout', this.handleSpawnWipeout);
    }
    showGrid() {
        this.levelWorld.field.add(this.debugGrid);
        this.updateDebugGrid();
    }
    updateDebugGrid() {
        this.debugGrid.removeAllCellHighlights();
        const blockedCellIndexes = this.powerupGrid.getBlockedCellIndexes();
        blockedCellIndexes.forEach((cellIndex) => {
            this.debugGrid.highlightCell(cellIndex);
        });
    }
}
exports.DebugLevelPowerupMenu = DebugLevelPowerupMenu;
