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
exports.WallShadowField = void 0;
const core_1 = require("../core");
const game_1 = require("../game");
const config = __importStar(require("../config"));
const DropShadowPainter_1 = require("./DropShadowPainter");
// Casts a soft drop shadow beneath solid walls (brick/steel) onto the ground.
// Sits just above the grass and below the terrain tiles, so the opaque tiles
// paint over the interior of each shadow and only the offset "skirt" along the
// bottom/right edge of a wall cluster stays visible — giving walls a raised look.
class WallShadowField extends core_1.GameObject {
    constructor() {
        super(...arguments);
        this.zIndex = config.WALL_SHADOW_Z_INDEX;
        this.painter = new DropShadowPainter_1.DropShadowPainter();
    }
    update() {
        // Refresh the caster list each tick so destroyed bricks stop casting.
        // Geometry is read live at paint time, so this only tracks membership.
        const casters = [];
        const field = this.parent;
        if (field !== null) {
            field.traverse((node) => {
                const { tags } = node;
                if (tags.includes(game_1.Tag.Wall) && !tags.includes(game_1.Tag.Border)) {
                    casters.push(node);
                }
            });
        }
        this.painter.casters = casters;
        this.setNeedsPaint();
    }
}
exports.WallShadowField = WallShadowField;
