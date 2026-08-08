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
exports.PlayerTank = void 0;
const core_1 = require("../core");
const Tag_1 = require("../game/Tag");
const TankAttributesFactory_1 = require("../tank/TankAttributesFactory");
const TankColorFactory_1 = require("../tank/TankColorFactory");
const TankDeathReason_1 = require("../tank/TankDeathReason");
const TankSkinAnimation_1 = require("../tank/TankSkinAnimation");
const TankTier_1 = require("../tank/TankTier");
const TankType_1 = require("../tank/TankType");
const config = __importStar(require("../config"));
const Tank_1 = require("./Tank");
class PlayerTank extends Tank_1.Tank {
    constructor() {
        super(...arguments);
        this.upgraded = new core_1.Subject();
        this.tags = [Tag_1.Tag.Tank, Tag_1.Tag.Player];
        this.zIndex = config.PLAYER_TANK_Z_INDEX;
        this.tierSkinAnimations = new Map();
        this.colors = [];
        this.speedBoostTimer = new core_1.Timer();
        this.speedBoostMultiplier = 1;
        this.networkControlled = false;
        // Run-long trait boosts (trading/staking), applied deterministically:
        // hull/armor add flat bonus health, engine multiplies move speed for the
        // whole run (unlike the temporary powerup speedBoostMultiplier). Values
        // come from the session at spawn (or from the replay being re-enacted).
        this.runBoostBonusHealth = 0;
        this.runBoostSpeedMultiplier = 1;
        this.handleSpeedBoostTimer = () => {
            this.speedBoostMultiplier = 1;
            this.applySpeedBoost();
        };
    }
    setup(updateArgs) {
        const { spriteLoader } = updateArgs;
        // Player only has one color
        this.colors.push(TankColorFactory_1.TankColorFactory.createPlayerColor(this.partyIndex));
        this.tierSkinAnimations.set(TankTier_1.TankTier.A, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, TankType_1.TankType.PlayerA(), this.colors));
        this.tierSkinAnimations.set(TankTier_1.TankTier.B, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, TankType_1.TankType.PlayerB(), this.colors));
        this.tierSkinAnimations.set(TankTier_1.TankTier.C, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, TankType_1.TankType.PlayerC(), this.colors));
        this.tierSkinAnimations.set(TankTier_1.TankTier.D, new TankSkinAnimation_1.TankSkinAnimation(spriteLoader, TankType_1.TankType.PlayerD(), this.colors));
        this.skinAnimation = this.tierSkinAnimations.get(this.type.tier);
        super.setup(updateArgs);
        this.speedBoostTimer.done.addListener(this.handleSpeedBoostTimer);
    }
    update(updateArgs) {
        if (this.networkControlled) {
            this.updateCollisionStates();
            this.shieldTimer.update(updateArgs.deltaTime);
            this.updateStun(updateArgs.deltaTime);
            this.behavior.update(this, updateArgs);
            this.lastFireTimer.update(updateArgs.deltaTime);
            this.updateAnimation(updateArgs.deltaTime);
            this.collider.update();
            this.speedBoostTimer.update(updateArgs.deltaTime);
            this.setNeedsPaint();
            return;
        }
        super.update(updateArgs);
        this.speedBoostTimer.update(updateArgs.deltaTime);
    }
    setNetworkControlled(controlled) {
        this.networkControlled = controlled;
        return this;
    }
    setNetworkTier(tier) {
        if (this.type.tier === tier) {
            return;
        }
        this.type.increaseTier(tier);
        this.applyTier(true);
    }
    // If tier is provided - it means that specific tier needs to be activated
    // when transitioning to the next level.next
    // If not - then most likely powerup has been picked up and we simply need
    // to upgrade the tank one tier up.
    upgrade(targetTier = null, notify = true) {
        if (this.type.isMaxTier()) {
            return;
        }
        this.type.increaseTier(targetTier);
        this.applyTier(notify);
    }
    activateSpeedBoost(duration, multiplier) {
        this.speedBoostMultiplier = multiplier;
        this.applySpeedBoost();
        this.speedBoostTimer.reset(duration);
    }
    // Call right after creation (before the first update). Every +10% hull and
    // every +15% armor grant one bonus hit; engine % maps directly to speed.
    setRunBoosts(boosts) {
        this.runBoostBonusHealth =
            Math.floor((boosts?.hull || 0) / 10) + Math.floor((boosts?.armor || 0) / 15);
        this.runBoostSpeedMultiplier = 1 + (boosts?.engine || 0) / 100;
        this.attributes.health += this.runBoostBonusHealth;
        this.applySpeedBoost();
    }
    receiveHit(damage, hitterPartyIndex) {
        const wasMaxTier = this.type.isMaxTier();
        this.attributes.health = Math.max(0, this.attributes.health - damage);
        this.hit.notify(null);
        if (this.isAlive()) {
            return;
        }
        if (wasMaxTier) {
            this.type.increaseTier(TankTier_1.TankTier.C);
            this.applyTier(true);
            return;
        }
        this.die(TankDeathReason_1.TankDeathReason.Bullet, hitterPartyIndex);
    }
    collide(collision) {
        if (this.networkControlled) {
            this.collideBullets(collision);
            return;
        }
        super.collide(collision);
    }
    applyTier(notify) {
        this.attributes = TankAttributesFactory_1.TankAttributesFactory.create(this.type);
        this.attributes.health += this.runBoostBonusHealth;
        this.applySpeedBoost();
        this.skinAnimation = this.tierSkinAnimations.get(this.type.tier);
        if (notify === true) {
            this.upgraded.notify({ tier: this.type.tier });
        }
    }
    applySpeedBoost() {
        const baseAttributes = TankAttributesFactory_1.TankAttributesFactory.create(this.type);
        this.attributes.moveSpeed =
            baseAttributes.moveSpeed *
                this.speedBoostMultiplier *
                this.runBoostSpeedMultiplier;
    }
}
exports.PlayerTank = PlayerTank;
