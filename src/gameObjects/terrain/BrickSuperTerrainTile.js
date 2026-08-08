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
exports.BrickSuperTerrainTile = void 0;
const core_1 = require("../../core");
const Tag_1 = require("../../game/Tag");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const TerrainTile_1 = require("../TerrainTile");
// Acts as a container for brick tiles and is used for movement collision
// resolution. Tanks are snapped to medium size tile grid, but brick tiles
// are small size. To avoid unexpected collision jumps this class serves
// as a medium size tile container - tank won't be able to move on it's
// area until all brick small-size sub-tiles have been destroyed inside it.
// Small-size brick still react to bullets, this one does not.
class BrickSuperTerrainTile extends TerrainTile_1.TerrainTile {
    constructor(subTiles) {
        super(config.BRICK_SUPER_TILE_SIZE, config.BRICK_SUPER_TILE_SIZE);
        this.type = terrain_1.TerrainType.BrickSuper;
        this.collider = new core_1.BoxCollider(this);
        this.tags = [Tag_1.Tag.BlockMove];
        // Fires for each individual sub-brick destroyed (not just when the whole
        // super-tile clears), carrying the sub-brick's field-local center. Purely
        // cosmetic hook — the level scene uses it to spawn destruction debris so
        // every chipped brick shows particles, not only the final one in a cell.
        this.subTileDestroyed = new core_1.Subject();
        this.subTiles = subTiles;
    }
    destroy(notify = true) {
        super.destroy(notify);
        this.collider.unregister();
        for (const subTile of this.subTiles) {
            subTile.destroy(notify);
        }
    }
    setup({ collisionSystem }) {
        collisionSystem.register(this.collider);
        for (const tile of this.subTiles) {
            // Keep track when sub-tile is destroyed - when all of them are destroyed
            // super-tile must self-destruct to allow movement on freed area.
            // Note: no need to remove from children, sub-tile will self-remove.
            tile.destroyed.addListenerOnce(() => {
                const index = this.subTiles.indexOf(tile);
                if (index === -1) {
                    return;
                }
                this.subTiles.splice(index, 1);
                // Sub-tile position is local to this super-tile; lift it to field-local
                // (same space the particle overlay expects) for the debris burst.
                this.subTileDestroyed.notify(new core_1.Vector(this.position.x + tile.position.x + tile.size.width / 2, this.position.y + tile.position.y + tile.size.height / 2));
                if (this.subTiles.length === 0) {
                    this.destroy();
                }
            });
        }
        this.add(...this.subTiles);
    }
    update() {
        this.collider.update();
    }
}
exports.BrickSuperTerrainTile = BrickSuperTerrainTile;
