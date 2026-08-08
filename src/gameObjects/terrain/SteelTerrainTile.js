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
exports.SteelTerrainTile = void 0;
const core_1 = require("../../core");
const Tag_1 = require("../../game/Tag");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const TerrainTile_1 = require("../TerrainTile");
class SteelTerrainTile extends TerrainTile_1.TerrainTile {
    constructor() {
        super(config.STEEL_TILE_SIZE, config.STEEL_TILE_SIZE);
        this.type = terrain_1.TerrainType.Steel;
        this.collider = new core_1.BoxCollider(this);
        this.zIndex = config.STEEL_TILE_Z_INDEX;
        this.tags = [Tag_1.Tag.Wall, Tag_1.Tag.Steel, Tag_1.Tag.BlockMove];
        this.painter = new core_1.SpritePainter();
    }
    destroy(notify = true) {
        super.destroy(notify);
        this.collider.unregister();
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        this.painter.sprite = spriteLoader.load('terrain.steel');
    }
    update() {
        this.collider.update();
    }
}
exports.SteelTerrainTile = SteelTerrainTile;
