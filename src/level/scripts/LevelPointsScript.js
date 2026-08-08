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
exports.LevelPointsScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const points_1 = require("../../points");
const tank_1 = require("../../tank");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
class LevelPointsScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.handleEnemyExploded = (event) => {
            // Only kills are awarded
            if (event.reason === tank_1.TankDeathReason.WipeoutPowerup) {
                return;
            }
            const value = this.getEnemyTankPointsValue(event.type);
            const points = new gameObjects_1.Points(value, config.POINTS_ENEMY_TANK_DURATION);
            points.updateMatrix();
            points.setCenter(event.centerPosition);
            this.world.field.add(points);
        };
        this.handlePowerupPicked = (event) => {
            const points = new gameObjects_1.Points(points_1.PointsValue.V500, config.POINTS_POWERUP_DURATION);
            points.updateMatrix();
            points.setCenter(event.centerPosition);
            this.world.field.add(points);
        };
    }
    setup() {
        this.eventBus.enemyExploded.addListener(this.handleEnemyExploded);
        this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
    }
    getEnemyTankPointsValue(type) {
        switch (type.tier) {
            case tank_1.TankTier.A:
                return points_1.PointsValue.V100;
            case tank_1.TankTier.B:
                return points_1.PointsValue.V200;
            case tank_1.TankTier.C:
                return points_1.PointsValue.V300;
            case tank_1.TankTier.D:
                return points_1.PointsValue.V400;
            default:
                return 0;
        }
    }
}
exports.LevelPointsScript = LevelPointsScript;
