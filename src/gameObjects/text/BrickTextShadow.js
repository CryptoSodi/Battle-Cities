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
exports.BrickTextShadow = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
const DropShadowPainter_1 = require("../DropShadowPainter");
// Soft drop shadow for brick text (the menu title). Mirrors WallShadowField:
// a sized GameObject carrying a DropShadowPainter, drawn beneath the opaque
// letter tiles so only the offset skirt shows. Casters are the static letter
// tiles, passed in at construction.
class BrickTextShadow extends core_1.GameObject {
    constructor(casters, width, height) {
        super(width, height);
        this.painter = new DropShadowPainter_1.DropShadowPainter();
        this.painter.casters = casters;
        this.painter.offsetX = config.TEXT_SHADOW_OFFSET_X;
        this.painter.offsetY = config.TEXT_SHADOW_OFFSET_Y;
        this.painter.steps = config.TEXT_SHADOW_STEPS;
        this.painter.alpha = config.TEXT_SHADOW_ALPHA;
    }
    update() {
        this.setNeedsPaint();
    }
}
exports.BrickTextShadow = BrickTextShadow;
