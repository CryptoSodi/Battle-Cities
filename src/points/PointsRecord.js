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
exports.PointsRecord = void 0;
const tank_1 = require("../tank");
const config = __importStar(require("../config"));
const TANK_POINTS_MAP = {
    [tank_1.TankTier.A]: 100,
    [tank_1.TankTier.B]: 200,
    [tank_1.TankTier.C]: 300,
    [tank_1.TankTier.D]: 400,
};
const POWERUP_POINTS = 500;
class PointsRecord {
    constructor() {
        this.kills = [];
        this.powerups = [];
        this.bonus = false;
    }
    addKill(tier) {
        this.kills.push(tier);
        return this;
    }
    addPowerup(type) {
        this.powerups.push(type);
        return this;
    }
    addBonus() {
        this.bonus = true;
        return this;
    }
    hasBonus() {
        return this.bonus === true;
    }
    getTierKillCost(tier) {
        return TANK_POINTS_MAP[tier];
    }
    getPowerupCost() {
        return POWERUP_POINTS;
    }
    getKillTotalCount() {
        return this.kills.length;
    }
    getTierKillCount(tierToFind) {
        const kills = this.kills.filter((tier) => tier === tierToFind);
        const count = kills.length;
        return count;
    }
    setTierKillCounts(counts) {
        this.kills = [];
        [tank_1.TankTier.A, tank_1.TankTier.B, tank_1.TankTier.C, tank_1.TankTier.D].forEach((tier, index) => {
            const count = Math.min(1000, Math.max(0, Math.floor(Number(counts[index]) || 0)));
            for (let kill = 0; kill < count; kill += 1) {
                this.kills.push(tier);
            }
        });
    }
    getTierPoints(tierToFind) {
        let total = 0;
        this.kills.forEach((tier) => {
            if (tier !== tierToFind) {
                return;
            }
            total += this.getTierKillCost(tier);
        });
        return total;
    }
    getKillTotalPoints() {
        let total = 0;
        this.kills.forEach((tier) => {
            total += this.getTierKillCost(tier);
        });
        return total;
    }
    getPowerupTotalPoints() {
        const total = this.powerups.length * this.getPowerupCost();
        return total;
    }
    getBonusTotalPoints() {
        if (this.bonus) {
            return config.BONUS_POINTS;
        }
        return 0;
    }
    getTotalPoints() {
        const killTotal = this.getKillTotalPoints();
        const powerupTotal = this.getPowerupTotalPoints();
        const bonusTotal = this.getBonusTotalPoints();
        const total = killTotal + powerupTotal + bonusTotal;
        return total;
    }
    reset() {
        this.kills = [];
        this.powerups = [];
        this.bonus = false;
    }
}
exports.PointsRecord = PointsRecord;
