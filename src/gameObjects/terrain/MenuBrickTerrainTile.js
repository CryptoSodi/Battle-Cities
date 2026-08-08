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
exports.MenuBrickTerrainTile = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const TerrainTile_1 = require("../TerrainTile");
class MenuBrickTerrainTile extends TerrainTile_1.TerrainTile {
    constructor() {
        super(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
        this.type = terrain_1.TerrainType.MenuBrick;
        this.painter = new core_1.SpritePainter();
    }
    setup({ spriteLoader }) {
        this.sprites = spriteLoader.loadList([
            'terrain.menu-brick.1',
            'terrain.menu-brick.2',
        ]);
        this.painter.sprite = this.getSpriteByPosition();
    }
    getSpriteIds() {
        return ['terrain.brick.1', 'terrain.brick.2'];
    }
    getSpriteByPosition() {
        const horizontalIndex = Math.floor(this.position.x / config.BRICK_TILE_SIZE) % 2;
        const verticalIndex = Math.floor(this.position.y / config.BRICK_TILE_SIZE) % 2;
        const index = (horizontalIndex + verticalIndex) % 2;
        const sprite = this.sprites[index];
        return sprite;
    }
}
exports.MenuBrickTerrainTile = MenuBrickTerrainTile;
