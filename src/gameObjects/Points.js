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
exports.Points = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
const SPRITE_POINTS_PREFIX = 'points';
const SPRITE_ID_SEPARATOR = '.';
class Points extends core_1.GameObject {
    constructor(value, duration) {
        super(56, 28);
        this.zIndex = config.POINTS_Z_INDEX;
        this.painter = new core_1.SpritePainter();
        this.timer = new core_1.Timer();
        this.handleTimer = () => {
            this.dirtyPaintBox();
            this.removeSelf();
        };
        this.value = value;
        this.timer.reset(duration);
        this.timer.done.addListener(this.handleTimer);
    }
    setup({ spriteLoader }) {
        const spriteId = this.getSpriteId(this.value);
        this.painter.sprite = spriteLoader.load(spriteId);
    }
    update(updateArgs) {
        this.timer.update(updateArgs.deltaTime);
    }
    getSpriteId(value) {
        const parts = [SPRITE_POINTS_PREFIX, value.toString()];
        const spriteId = parts.join(SPRITE_ID_SEPARATOR);
        return spriteId;
    }
}
exports.Points = Points;
