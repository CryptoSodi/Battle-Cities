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
exports.EnemyTank = void 0;
const GameState_1 = require("../game/GameState");
const Tag_1 = require("../game/Tag");
const TankColor_1 = require("../tank/TankColor");
const TankSkinAnimation_1 = require("../tank/TankSkinAnimation");
const TankTier_1 = require("../tank/TankTier");
const config = __importStar(require("../config"));
const Tank_1 = require("./Tank");
class EnemyTank extends Tank_1.Tank {
    constructor() {
        super(...arguments);
        this.tags = [Tag_1.Tag.Tank, Tag_1.Tag.Enemy];
        this.zIndex = config.ENEMY_TANK_Z_INDEX;
        this.healthSkinAnimations = new Map();
        this.dropBlinkElapsed = 0;
        this.networkControlled = false;
    }
    setNetworkControlled(controlled) {
        this.networkControlled = controlled;
        return this;
    }
    beginNetworkDeathGrace() {
        this.tags = [Tag_1.Tag.Enemy];
        this.setVisible(false);
    }
    finishNetworkRemoval() {
        this.collider.unregister();
        this.removeSelf();
    }
    applyNetworkHealth(health) {
        const wasHit = health < this.attributes.health;
        this.attributes.health = Math.max(0, health);
        const animation = this.healthSkinAnimations.get(this.attributes.health);
        if (animation !== undefined) {
            this.skinAnimation = animation;
        }
        if (wasHit) {
            this.hit.notify(null);
            if (this.type.hasDrop) {
                this.discardDrop();
            }
        }
    }
    setup(updateArgs) {
        const { audioLoader, spriteLoader } = updateArgs;
        this.hitSound = audioLoader.load('hit.enemy');
        // Tanks with drop should be blinking when paused
        if (this.type.hasDrop) {
            this.ignorePause = true;
        }
        // Currently only tier D tank has more than 1 health
        if (this.type.tier === TankTier_1.TankTier.D) {
            this.healthSkinAnimations.set(4, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, this.type, [
                TankColor_1.TankColor.Default,
                TankColor_1.TankColor.Secondary,
            ]));
            this.healthSkinAnimations.set(3, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, this.type, [
                TankColor_1.TankColor.Default,
                TankColor_1.TankColor.Primary,
            ]));
            this.healthSkinAnimations.set(2, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, this.type, [
                TankColor_1.TankColor.Secondary,
                TankColor_1.TankColor.Primary,
            ]));
        }
        this.healthSkinAnimations.set(1, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, this.type, [TankColor_1.TankColor.Default]));
        this.skinAnimation = this.healthSkinAnimations.get(this.attributes.health);
        super.setup(updateArgs);
    }
    update(updateArgs) {
        const { gameState } = updateArgs;
        if (this.networkControlled) {
            this.updateCollisionStates();
            this.collider.update();
            this.updateAnimation(updateArgs.deltaTime);
            this.setNeedsPaint();
            return;
        }
        const shouldIdle = this.freezeState.hasChangedTo(true) ||
            gameState.hasChangedTo(GameState_1.GameState.Paused);
        if (shouldIdle) {
            this.idle();
        }
        const isIdle = this.freezeState.is(true) || gameState.is(GameState_1.GameState.Paused);
        // Only update animation when idle, other components should not receive
        // updates
        if (isIdle) {
            this.updateCollisionStates();
            // When tank spawns during freeze his collision box should be updated
            this.collider.update();
            this.tankCollisionResolution = Tank_1.TankCollisionResolution.Unknown;
            // Tanks with drop should be blinking when paused or freezed
            this.updateAnimation(updateArgs.deltaTime);
            this.setNeedsPaint();
            return;
        }
        super.update(updateArgs);
    }
    receiveHit(damage, hitterPartyIndex) {
        if (this.networkControlled) {
            return;
        }
        super.receiveHit(damage, hitterPartyIndex);
        if (!this.isAlive()) {
            return;
        }
        this.hitSound.play();
        // Enemy drop powerup on first hit
        // - for tiers A,B,C - on death, because they have 1 health
        // - for tier D - on first hit, because they have 4 health
        // Make sure tier D won't drop powerup after first hit.
        this.discardDrop();
        // Change skin based on number of health left
        this.skinAnimation = this.healthSkinAnimations.get(this.attributes.health);
    }
    collide(collision) {
        if (this.networkControlled) {
            this.collideBullets(collision);
            return;
        }
        super.collide(collision);
    }
    discardDrop() {
        this.type.hasDrop = false;
        this.ignorePause = false;
        this.dropBlinkElapsed = 0;
        // Refresh animation state after the drop marker is removed.
        this.healthSkinAnimations.forEach((animation) => {
            animation.updateFrames();
        });
        return this;
    }
    updateAnimation(deltaTime, advanceFrames = true) {
        super.updateAnimation(deltaTime, advanceFrames);
        const shouldTint = this.type.hasDrop && this.isDropBlinkVisible(deltaTime);
        this.skinLayers.forEach((layer) => {
            const painter = layer.painter;
            painter.tintColor = shouldTint ? config.ENEMY_DROP_BLINK_COLOR : null;
            painter.tintAlpha = shouldTint ? config.ENEMY_DROP_BLINK_ALPHA : 0;
        });
    }
    isDropBlinkVisible(deltaTime) {
        if (!this.type.hasDrop) {
            this.dropBlinkElapsed = 0;
            return false;
        }
        this.dropBlinkElapsed += deltaTime;
        return (Math.floor(this.dropBlinkElapsed / config.ENEMY_DROP_BLINK_INTERVAL) %
            2 ===
            1);
    }
}
exports.EnemyTank = EnemyTank;
