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
exports.GroundField = void 0;
const core_1 = require("../core");
const Painter_1 = require("../core/Painter");
const config = __importStar(require("../config"));
// Tiles grass variants across the whole field as the ground beneath everything.
// A per-cell hash picks a variant so the grass doesn't visibly repeat. Cosmetic;
// sits below all terrain (negative z-index) so walls/water/etc. draw on top.
class GroundFieldPainter extends Painter_1.Painter {
    constructor() {
        super(...arguments);
        this.sprites = [];
        this.tileSize = config.TILE_SIZE_MEDIUM;
        this.destinationRect = new core_1.Rect();
    }
    paint(context, renderObject) {
        if (this.sprites.length === 0 || !this.sprites[0].isImageLoaded()) {
            return;
        }
        const box = renderObject.getWorldBoundingBox();
        const fieldX = box.min.x;
        const fieldY = box.min.y;
        const fieldWidth = box.max.x - box.min.x;
        const fieldHeight = box.max.y - box.min.y;
        const cols = Math.ceil(fieldWidth / this.tileSize);
        const rows = Math.ceil(fieldHeight / this.tileSize);
        const cull = context.getWorldCullBounds();
        let startCol = 0;
        let endCol = cols;
        let startRow = 0;
        let endRow = rows;
        if (cull !== null) {
            startCol = Math.max(0, Math.floor((cull.minX - fieldX) / this.tileSize));
            endCol = Math.min(cols, Math.ceil((cull.maxX - fieldX) / this.tileSize));
            startRow = Math.max(0, Math.floor((cull.minY - fieldY) / this.tileSize));
            endRow = Math.min(rows, Math.ceil((cull.maxY - fieldY) / this.tileSize));
            if (startCol >= endCol || startRow >= endRow) {
                return;
            }
        }
        const dest = this.destinationRect;
        dest.width = this.tileSize;
        dest.height = this.tileSize;
        for (let row = startRow; row < endRow; row += 1) {
            dest.y = fieldY + row * this.tileSize;
            for (let col = startCol; col < endCol; col += 1) {
                const hash = Math.abs((col * 73856093) ^ (row * 19349663));
                const sprite = this.sprites[hash % this.sprites.length];
                dest.x = fieldX + col * this.tileSize;
                context.drawImage(sprite.image, sprite.sourceRect, dest);
            }
        }
    }
}
class GroundField extends core_1.GameObject {
    constructor() {
        super(...arguments);
        this.zIndex = config.GROUND_FIELD_Z_INDEX;
        this.painter = new GroundFieldPainter();
    }
    setup({ spriteLoader }) {
        this.painter.sprites = spriteLoader.loadSequence('terrain.grass');
    }
}
exports.GroundField = GroundField;
