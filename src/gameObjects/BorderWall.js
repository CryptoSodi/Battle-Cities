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
exports.BorderWall = void 0;
const core_1 = require("../core");
const Tag_1 = require("../game/Tag");
const config = __importStar(require("../config"));
class BorderWall extends core_1.GameObject {
    constructor() {
        super(...arguments);
        this.collider = new core_1.BoxCollider(this);
        this.tags = [Tag_1.Tag.Wall, Tag_1.Tag.Border, Tag_1.Tag.BlockMove];
        this.zIndex = config.BORDER_WALL_Z_INDEX;
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        const sprite = spriteLoader.load('terrain.border-steel');
        const tileSize = config.STEEL_TILE_SIZE;
        const columns = Math.ceil(this.size.width / tileSize);
        const rows = Math.ceil(this.size.height / tileSize);
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const tile = new core_1.GameObject(tileSize, tileSize);
                tile.position.set(column * tileSize, row * tileSize);
                tile.painter = new core_1.SpritePainter(sprite);
                this.add(tile);
            }
        }
    }
    update() {
        this.collider.update();
    }
}
exports.BorderWall = BorderWall;
