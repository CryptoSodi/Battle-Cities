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
exports.EditorEraserBrush = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
class EditorEraserBrush extends core_1.GameObject {
    constructor() {
        super(config.TILE_SIZE_LARGE, config.TILE_SIZE_LARGE);
        this.zIndex = config.EDITOR_BRUSH_Z_INDEX;
    }
    setup() {
        this.painter = new core_1.RectPainter('rgba(255,255,255,0.08)', config.COLOR_WHITE);
        this.painter.lineWidth = 2;
    }
}
exports.EditorEraserBrush = EditorEraserBrush;
