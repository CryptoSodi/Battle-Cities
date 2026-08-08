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
exports.BrickTerrainTile = void 0;
const core_1 = require("../../core");
const Tag_1 = require("../../game/Tag");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const TerrainTile_1 = require("../TerrainTile");
// Movement collision tags are defined in BrickSuperTerrainTile.
// Bullet collsion tags are defined here.
class BrickTerrainTile extends TerrainTile_1.TerrainTile {
    constructor() {
        super(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
        this.type = terrain_1.TerrainType.Brick;
        this.collider = new core_1.BoxCollider(this);
        this.zIndex = config.BRICK_TILE_Z_INDEX;
        this.tags = [Tag_1.Tag.Wall, Tag_1.Tag.Brick];
        this.painter = new core_1.SpritePainter();
        // Set by TerrainFactory for bricks at the bottom edge of a wall cluster so
        // they render the darker base course. baseVariant picks the skirt to match
        // the surrounding terrain: 'grass' on land, 'moss' where the wall meets water.
        this.isBase = false;
        this.baseVariant = 'grass';
    }
    destroy(notify = true) {
        super.destroy(notify);
        this.collider.unregister();
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        this.sprites = spriteLoader.loadList(this.getSpriteIds());
        this.baseSprites = spriteLoader.loadList(this.getBaseSpriteIds());
        this.mossSprites = spriteLoader.loadList(this.getMossSpriteIds());
        this.painter.sprite = this.getSpriteByPosition();
    }
    update() {
        this.collider.update();
    }
    getSpriteIds() {
        return ['terrain.brick.1', 'terrain.brick.2'];
    }
    getBaseSpriteIds() {
        return ['terrain.brick.base.1', 'terrain.brick.base.2'];
    }
    getMossSpriteIds() {
        return ['terrain.brick.moss.1', 'terrain.brick.moss.2'];
    }
    getSpriteByPosition() {
        const horizontalIndex = Math.floor(this.position.x / config.BRICK_TILE_SIZE) % 2;
        const verticalIndex = Math.floor(this.position.y / config.BRICK_TILE_SIZE) % 2;
        const index = (horizontalIndex + verticalIndex) % 2;
        let sprites = this.sprites;
        if (this.isBase) {
            sprites =
                this.baseVariant === 'moss' ? this.mossSprites : this.baseSprites;
        }
        return sprites[index];
    }
}
exports.BrickTerrainTile = BrickTerrainTile;
