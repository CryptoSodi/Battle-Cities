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
exports.GhostTank = void 0;
const core_1 = require("../core");
const game_1 = require("../game");
const tank_1 = require("../tank");
const config = __importStar(require("../config"));
const GhostBullet_1 = require("./GhostBullet");
const Tank_1 = require("./Tank");
const GHOST_OPACITY = 0.5;
const GHOST_TINT = 'rgb(120, 200, 255)';
const GHOST_SMOOTHING = 0.45;
class GhostTank extends core_1.GameObject {
    constructor(partyIndex) {
        super(64, 64);
        this.partyIndex = 0;
        this.state = Tank_1.TankState.Idle;
        this.type = tank_1.TankType.PlayerA();
        this.rotation = game_1.Rotation.Up;
        this.targetX = 0;
        this.targetY = 0;
        this.hasTarget = false;
        this.tierSkinAnimations = new Map();
        this.partyIndex = partyIndex;
        this.pivot.set(0.5, 0.5);
        this.setZIndex(config.PLAYER_TANK_Z_INDEX + 1);
    }
    applySnapshot(x, y, rotation, state, tier) {
        this.targetX = x;
        this.targetY = y;
        if (!this.hasTarget) {
            this.position.set(x, y);
            this.hasTarget = true;
        }
        this.rotation = rotation;
        this.state = state;
        this.type = this.getType(tier);
        this.updateMatrix(true);
        this.setVisible(true);
    }
    spawnGhostFire(x = this.position.x, y = this.position.y, rotation = this.rotation) {
        const previousX = this.position.x;
        const previousY = this.position.y;
        const previousRotation = this.rotation;
        try {
            this.position.set(x, y);
            this.rotation = rotation;
            this.updateMatrix(true);
            const bullet = new GhostBullet_1.GhostBullet();
            bullet.updateMatrix();
            bullet.setCenter(this.getSelfCenter());
            bullet.translateY(this.size.height / 2 - bullet.size.height / 2);
            bullet.updateMatrix();
            this.add(bullet);
            this.parent.attach(bullet);
        }
        finally {
            this.position.set(previousX, previousY);
            this.rotation = previousRotation;
            this.updateMatrix(true);
        }
    }
    setup({ spriteLoader }) {
        const colors = [tank_1.TankColorFactory.createPlayerColor(this.partyIndex)];
        this.tierSkinAnimations.set(tank_1.TankTier.A, new tank_1.TankSkinAnimation(spriteLoader, tank_1.TankType.PlayerA(), colors));
        this.tierSkinAnimations.set(tank_1.TankTier.B, new tank_1.TankSkinAnimation(spriteLoader, tank_1.TankType.PlayerB(), colors));
        this.tierSkinAnimations.set(tank_1.TankTier.C, new tank_1.TankSkinAnimation(spriteLoader, tank_1.TankType.PlayerC(), colors));
        this.tierSkinAnimations.set(tank_1.TankTier.D, new tank_1.TankSkinAnimation(spriteLoader, tank_1.TankType.PlayerD(), colors));
        const layer = new core_1.GameObject();
        layer.size.copyFrom(this.size);
        const painter = new core_1.SpritePainter(null, core_1.SpriteAlignment.MiddleCenter);
        painter.opacity = GHOST_OPACITY;
        painter.tintColor = GHOST_TINT;
        painter.tintAlpha = 0.35;
        layer.painter = painter;
        this.add(layer);
    }
    update({ deltaTime }) {
        if (this.hasTarget) {
            const nextX = this.position.x + (this.targetX - this.position.x) * GHOST_SMOOTHING;
            const nextY = this.position.y + (this.targetY - this.position.y) * GHOST_SMOOTHING;
            if (this.position.x !== nextX || this.position.y !== nextY) {
                this.dirtyPaintBox();
                this.position.set(nextX, nextY);
                this.updateMatrix(true);
                this.setNeedsPaint();
            }
        }
        const animation = this.tierSkinAnimations.get(this.type.tier);
        if (animation === undefined) {
            return;
        }
        animation.update(this, deltaTime);
        const sprite = animation.getCurrentFrame().getSprite(0);
        this.children.forEach((layer) => {
            const painter = layer.painter;
            painter.sprite = sprite;
        });
    }
    getType(tier) {
        switch (tier) {
            case tank_1.TankTier.B:
                return tank_1.TankType.PlayerB();
            case tank_1.TankTier.C:
                return tank_1.TankType.PlayerC();
            case tank_1.TankTier.D:
                return tank_1.TankType.PlayerD();
            case tank_1.TankTier.A:
            default:
                return tank_1.TankType.PlayerA();
        }
    }
}
exports.GhostTank = GhostTank;
