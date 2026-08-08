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
exports.GhostBullet = void 0;
const core_1 = require("../core");
const game_1 = require("../game");
const config = __importStar(require("../config"));
const GHOST_BULLET_LIFE_SECONDS = 0.45;
const GHOST_BULLET_SPEED = 380;
class GhostBullet extends core_1.GameObject {
    constructor(rotation = game_1.Rotation.Up) {
        super(config.BULLET_WIDTH, 16);
        this.rotation = game_1.Rotation.Up;
        this.lifeLeft = GHOST_BULLET_LIFE_SECONDS;
        this.rotation = rotation;
        this.pivot.set(0.5, 0.5);
        this.setZIndex(config.PLAYER_TANK_Z_INDEX + 2);
    }
    setup({ spriteLoader }) {
        const painter = new core_1.SpritePainter(null, core_1.SpriteAlignment.MiddleCenter);
        painter.opacity = 0.5;
        painter.tintColor = 'rgb(120, 200, 255)';
        painter.tintAlpha = 0.35;
        painter.sprite = spriteLoader.load(`bullet.${this.getRotationString()}`);
        this.painter = painter;
    }
    update({ deltaTime }) {
        this.lifeLeft -= deltaTime;
        if (this.lifeLeft <= 0) {
            this.removeSelf();
            return;
        }
        this.dirtyPaintBox();
        this.translateY(GHOST_BULLET_SPEED * deltaTime);
        this.updateMatrix(true);
        this.setNeedsPaint();
    }
    getRotationString() {
        switch (this.rotation) {
            case game_1.Rotation.Up:
                return 'up';
            case game_1.Rotation.Down:
                return 'down';
            case game_1.Rotation.Left:
                return 'left';
            case game_1.Rotation.Right:
                return 'right';
            default:
                return 'up';
        }
    }
}
exports.GhostBullet = GhostBullet;
