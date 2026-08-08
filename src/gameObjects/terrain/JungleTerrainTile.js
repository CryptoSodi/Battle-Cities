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
exports.JungleTerrainTile = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const TerrainTile_1 = require("../TerrainTile");
// Number of leading sprites in terrain.jungle.* that are bottom-edge variants.
// The first BOTTOM_VARIANT_COUNT tiles form the bottom of a jungle cluster
// (where it meets the ground); the rest build the top/interior canopy.
const BOTTOM_VARIANT_COUNT = 2;
class JungleTerrainTile extends TerrainTile_1.TerrainTile {
    constructor() {
        super(config.JUNGLE_TILE_SIZE, config.JUNGLE_TILE_SIZE);
        this.type = terrain_1.TerrainType.Jungle;
        this.painter = new core_1.SpritePainter();
        this.zIndex = config.JUNGLE_TILE_Z_INDEX;
        // Set by TerrainFactory: true when there is no jungle in the cell directly
        // below, so this tile sits at the bottom edge of a jungle cluster.
        this.isBottom = false;
    }
    setup({ spriteLoader }) {
        // Data-driven: loads terrain.jungle.1..N (6 today — 2 bottom + 4 top).
        this.sprites = spriteLoader.loadSequence('terrain.jungle');
        this.painter.sprite = this.getSpriteByPosition();
    }
    // Picks a variant per cell so the foliage doesn't visibly repeat (same hash
    // approach as the grass ground), choosing from the bottom set on the bottom
    // edge and the top set everywhere else.
    getSpriteByPosition() {
        const size = config.JUNGLE_TILE_SIZE;
        const col = Math.floor(this.position.x / size);
        const row = Math.floor(this.position.y / size);
        const hash = Math.abs((col * 73856093) ^ (row * 19349663));
        if (this.isBottom) {
            const count = Math.min(BOTTOM_VARIANT_COUNT, this.sprites.length);
            return this.sprites[hash % count];
        }
        const topCount = this.sprites.length - BOTTOM_VARIANT_COUNT;
        if (topCount <= 0) {
            return this.sprites[hash % this.sprites.length];
        }
        return this.sprites[BOTTOM_VARIANT_COUNT + (hash % topCount)];
    }
}
exports.JungleTerrainTile = JungleTerrainTile;
