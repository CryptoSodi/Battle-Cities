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
exports.PowerupGrid = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
// Grid for calculating zones where powerup can spawn. It should not spawn
// in player-unreachable and gameplay conflicting areas, which are:
// - tank spawns
// - player base
// - water and steel tiles
// These areas should be denied on level start. While playing, player can
// destroy steel tiles, grid should be update accordingly, so powerup could
// spawn in freed areas.
// Note, that this grid does not check if player pathing is available to reach
// spawned powerup. It is up to level designer to not create unreachable areas.
//
// Powerup size is large (64x64)
// For grid we are using medium size (32x32), because the least powerup-blocking
// tile size is medium (steel, water).
// Powerup can't spawn if all four medium tiles are blocked, but if any of them
// are free, user will be able to pick it up.
//
// Rows    - y axis
// Columns - x axis
//
// Use can use DebugGrid to visualize denied tiles.
class PowerupGrid {
    constructor(fieldWidth, fieldHeight) {
        this.grid = [];
        this.backupGrid = null;
        this.tileSize = config.TILE_SIZE_MEDIUM;
        this.rowCount = fieldHeight / this.tileSize;
        this.colCount = fieldWidth / this.tileSize;
        for (let rowIndex = 0; rowIndex < this.rowCount; rowIndex += 1) {
            this.grid[rowIndex] = [];
            for (let colIndex = 0; colIndex < this.colCount; colIndex += 1) {
                this.grid[rowIndex][colIndex] = true;
            }
        }
    }
    blockCell(rowIndex, colIndex) {
        this.toggleCell(rowIndex, colIndex, false);
    }
    freeCell(rowIndex, colIndex) {
        this.toggleCell(rowIndex, colIndex, true);
    }
    blockRect(rect) {
        this.toggleRect(rect, false);
    }
    freeRect(rect) {
        this.toggleRect(rect, true);
    }
    toggleCell(rowIndex, colIndex, isFree) {
        this.grid[rowIndex][colIndex] = isFree;
    }
    toggleRect(rect, isFree) {
        // Find indexes of cells which should be disabled
        const minIndex = new core_1.Vector(Math.max(0, Math.floor(rect.x / this.tileSize)), Math.max(0, Math.floor(rect.y / this.tileSize)));
        const maxIndex = new core_1.Vector(Math.min(this.rowCount, Math.ceil((rect.x + rect.width) / this.tileSize)), Math.min(this.colCount, Math.ceil((rect.y + rect.height) / this.tileSize)));
        for (let rowIndex = minIndex.y; rowIndex < maxIndex.y; rowIndex += 1) {
            for (let colIndex = minIndex.x; colIndex < maxIndex.x; colIndex += 1) {
                this.toggleCell(rowIndex, colIndex, isFree);
            }
        }
    }
    getBlockedCellIndexes() {
        const blockedCells = [];
        for (let rowIndex = 0; rowIndex < this.rowCount; rowIndex += 1) {
            for (let colIndex = 0; colIndex < this.colCount; colIndex += 1) {
                const isFree = this.grid[rowIndex][colIndex];
                if (!isFree) {
                    blockedCells.push(new core_1.Vector(colIndex, rowIndex));
                }
            }
        }
        return blockedCells;
    }
    // Find all possible spawn positions for powerups. Considering that
    // their size is "large" and cell size is "medium", we are iterating
    // with overlap.
    getFreeLargeCellIndexes() {
        const freeLargeCells = [];
        for (let rowIndex = 0; rowIndex < this.rowCount - 1; rowIndex += 1) {
            for (let colIndex = 0; colIndex < this.colCount - 1; colIndex += 1) {
                const isFree11 = this.grid[rowIndex][colIndex];
                const isFree12 = this.grid[rowIndex][colIndex + 1];
                const isFree21 = this.grid[rowIndex + 1][colIndex];
                const isFree22 = this.grid[rowIndex + 1][colIndex + 1];
                const isBlocked = !isFree11 && !isFree12 && !isFree21 && !isFree22;
                if (isBlocked) {
                    continue;
                }
                freeLargeCells.push(new core_1.Vector(colIndex, rowIndex));
            }
        }
        return freeLargeCells;
    }
    getRandomPosition(rng) {
        const freeLargeCells = this.getFreeLargeCellIndexes();
        // In case all cells are blocked you need to decide what to do with powerup
        if (freeLargeCells.length === 0) {
            return null;
        }
        const index = rng.arrayElement(freeLargeCells);
        const position = index.multScalar(this.tileSize);
        return position;
    }
    backup() {
        this.backupGrid = [];
        for (let rowIndex = 0; rowIndex < this.rowCount; rowIndex += 1) {
            this.backupGrid[rowIndex] = this.grid[rowIndex].slice();
        }
    }
    restore() {
        if (this.backupGrid === null) {
            return;
        }
        for (let rowIndex = 0; rowIndex < this.rowCount; rowIndex += 1) {
            this.grid[rowIndex] = this.backupGrid[rowIndex].slice();
        }
        this.backupGrid = null;
    }
}
exports.PowerupGrid = PowerupGrid;
