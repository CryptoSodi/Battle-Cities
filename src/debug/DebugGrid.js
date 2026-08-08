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
exports.DebugGrid = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
class DebugGrid extends core_1.GameObject {
    constructor(width, height, step, color = '#fff') {
        super(width, height);
        this.zIndex = config.DEBUG_GRID_Z_INDEX;
        this.highlightedCells = [];
        this.step = step;
        for (let x = 0; x <= width; x += step) {
            const line = new core_1.GameObject();
            const painter = new core_1.LinePainter();
            painter.strokeColor = color;
            painter.positions.push(new core_1.Vector(x, 0), new core_1.Vector(x, height));
            line.painter = painter;
            this.add(line);
        }
        for (let y = 0; y <= height; y += step) {
            const line = new core_1.GameObject();
            const painter = new core_1.LinePainter();
            painter.strokeColor = color;
            painter.positions.push(new core_1.Vector(0, y), new core_1.Vector(width, y));
            line.painter = painter;
            this.add(line);
        }
    }
    highlightCell(index, color = 'rgba(255, 0, 0, 0.5)') {
        const cell = new core_1.GameObject(this.step, this.step);
        cell.painter = new core_1.RectPainter(color);
        cell.position.set(index.x * this.step, index.y * this.step);
        this.highlightedCells.push(cell);
        this.add(cell);
    }
    removeAllCellHighlights() {
        this.highlightedCells.forEach((cell) => {
            cell.removeSelf();
        });
        this.highlightedCells = [];
    }
}
exports.DebugGrid = DebugGrid;
