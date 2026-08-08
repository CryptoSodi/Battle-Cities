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
exports.DropShadowPainter = void 0;
const Painter_1 = require("../core/Painter");
const config = __importStar(require("../config"));
// Reusable soft drop shadow. Draws each caster's silhouette stepped outward in
// equal increments: overlapping steps near the caster accumulate to a darker
// shadow, while the far edge gets only the last step, so the shadow fades out.
// Interior overlap is hidden wherever opaque art is drawn on top. Used by both
// the level wall shadows and the menu brick text.
class DropShadowPainter extends Painter_1.Painter {
    constructor() {
        super(...arguments);
        this.casters = [];
        this.offsetX = config.WALL_SHADOW_OFFSET_X;
        this.offsetY = config.WALL_SHADOW_OFFSET_Y;
        this.steps = config.WALL_SHADOW_STEPS;
        this.color = config.WALL_SHADOW_COLOR;
        this.alpha = config.WALL_SHADOW_ALPHA;
    }
    paint(context) {
        if (this.casters.length === 0) {
            return;
        }
        const prevAlpha = context.getGlobalAlpha();
        context.setGlobalAlpha(this.alpha);
        for (let step = 1; step <= this.steps; step += 1) {
            const fraction = step / this.steps;
            const dx = this.offsetX * fraction;
            const dy = this.offsetY * fraction;
            for (const caster of this.casters) {
                if (caster.isRemoved) {
                    continue;
                }
                const box = caster.getWorldBoundingBox();
                const x = box.min.x + dx;
                const y = box.min.y + dy;
                const width = box.max.x - box.min.x;
                const height = box.max.y - box.min.y;
                if (!context.intersectsWorldCullBounds(x, y, width, height)) {
                    continue;
                }
                context.fillRect(x, y, width, height, this.color);
            }
        }
        context.setGlobalAlpha(prevAlpha);
    }
}
exports.DropShadowPainter = DropShadowPainter;
