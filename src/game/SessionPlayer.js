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
exports.SessionPlayer = void 0;
const core_1 = require("../core");
const points_1 = require("../points");
const tank_1 = require("../tank");
const config = __importStar(require("../config"));
class SessionPlayer {
    constructor() {
        this.lifeup = new core_1.Subject();
        this.reset();
    }
    reset() {
        this.levelPointsRecord = new points_1.PointsRecord();
        this.gamePoints = 0;
        this.lastGamePoints = null;
        this.lives = config.PLAYER_INITIAL_LIVES;
        this.nextLifePointThreshold = config.PLAYER_EXTRA_LIVE_POINTS;
        this.tankTier = tank_1.TankTier.A;
        this.levelFirstSpawned = true;
        this.inputVariant = null;
    }
    addKillPoints(tier) {
        this.levelPointsRecord.addKill(tier);
        this.checkLifeup();
    }
    addPowerupPoints(type) {
        this.levelPointsRecord.addPowerup(type);
        this.checkLifeup();
    }
    addBonusPoints() {
        this.levelPointsRecord.addBonus();
        this.checkLifeup();
    }
    completeLevel() {
        this.gamePoints += this.getLevelPoints();
        this.levelPointsRecord.reset();
        this.resetLevelFirstSpawn();
    }
    // Sum of all previous levels and current level
    getGamePoints() {
        return this.gamePoints + this.getLevelPoints();
    }
    setAuthoritativeGamePoints(points) {
        const total = Math.max(0, Math.floor(points));
        this.gamePoints = total - this.getLevelPoints();
    }
    getLevelPoints() {
        return this.levelPointsRecord.getTotalPoints();
    }
    setLastGamePoints(lastGamePoints) {
        this.lastGamePoints = lastGamePoints;
    }
    getLastGamePoints() {
        return this.lastGamePoints;
    }
    wasInLastGame() {
        return this.lastGamePoints !== null;
    }
    hasBonusPoints() {
        return this.levelPointsRecord.hasBonus();
    }
    getLevelPointsRecord() {
        return this.levelPointsRecord;
    }
    getLivesCount() {
        return this.lives;
    }
    setLivesCount(lives) {
        this.lives = Math.max(0, Math.floor(lives));
    }
    isAlive() {
        return this.lives > 0;
    }
    getTankTier() {
        return this.tankTier;
    }
    setTankTier(tankTier) {
        this.tankTier = tankTier;
    }
    resetTankTier() {
        this.tankTier = tank_1.TankTier.A;
    }
    isLevelFirstSpawn() {
        return this.levelFirstSpawned;
    }
    setLevelSpawned() {
        this.levelFirstSpawned = false;
    }
    resetLevelFirstSpawn() {
        this.levelFirstSpawned = true;
    }
    addLife() {
        if (!this.isAlive()) {
            return;
        }
        this.lives += 1;
        this.lifeup.notify(null);
    }
    removeLife() {
        this.lives = Math.max(0, this.lives - 1);
    }
    setInputVariant(inputVariant) {
        this.inputVariant = inputVariant;
    }
    getInputVariant() {
        return this.inputVariant;
    }
    checkLifeup() {
        if (this.getGamePoints() >= this.nextLifePointThreshold) {
            this.nextLifePointThreshold += config.PLAYER_EXTRA_LIVE_POINTS;
            this.addLife();
        }
    }
}
exports.SessionPlayer = SessionPlayer;
