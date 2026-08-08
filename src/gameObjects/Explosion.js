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
exports.Explosion = void 0;
const core_1 = require("./../core");
const config = __importStar(require("../config"));
const explosionEffect_1 = require("./explosionEffect");
class Explosion extends core_1.GameObject {
    constructor() {
        super(136, 136);
        this.zIndex = config.LARGE_EXPLOSION_Z_INDEX;
        this.painter = new core_1.SpritePainter();
        this.completed = new core_1.Subject();
        this.painter.alignment = core_1.SpriteAlignment.MiddleCenter;
    }
    setup({ spriteLoader, particles }) {
        this.animation = new core_1.Animation(spriteLoader.loadList(['explosion.large.1', 'explosion.large.2']), { delay: 0.066, loop: false });
        // Layer procedural flash/fireball/spark/smoke particles over the sprite.
        // Refresh the matrix first: the creator sets our center via setCenter()
        // *after* updateMatrix(), leaving boundingBox stale at the origin — reading
        // getCenter() without this would emit the blast at the top-left corner.
        this.updateMatrix();
        const center = this.getCenter();
        (0, explosionEffect_1.emitExplosion)(particles, center.x, center.y, { scale: 1.3, smoke: true });
    }
    update(updateArgs) {
        if (this.animation.isComplete()) {
            this.dirtyPaintBox();
            this.removeSelf();
            this.completed.notify(null);
            return;
        }
        this.animation.update(updateArgs.deltaTime);
        this.painter.sprite = config.SHOW_EXPLOSION_SPRITE
            ? this.animation.getCurrentFrame()
            : null;
        this.setNeedsPaint();
    }
}
exports.Explosion = Explosion;
