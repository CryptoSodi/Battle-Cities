"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelEventBus = void 0;
const core_1 = require("../core");
class LevelEventBus {
    constructor() {
        this.baseDied = new core_1.Subject();
        this.enemyAllDied = new core_1.Subject();
        this.enemyDied = new core_1.Subject();
        this.enemyExploded = new core_1.Subject();
        this.enemyHit = new core_1.Subject();
        this.enemySpawnCompleted = new core_1.Subject();
        this.enemySpawnRequested = new core_1.Subject();
        this.mapTileDestroyed = new core_1.Subject();
        this.levelPaused = new core_1.Subject();
        this.levelUnpaused = new core_1.Subject();
        this.levelGameOverMoveBlocked = new core_1.Subject();
        this.levelGameOverCompleted = new core_1.Subject();
        this.levelWinCompleted = new core_1.Subject();
        this.playerDied = new core_1.Subject();
        this.playerFired = new core_1.Subject();
        this.playerSlided = new core_1.Subject();
        this.playerSpawnCompleted = new core_1.Subject();
        this.playerSpawnRequested = new core_1.Subject();
        this.powerupSpawned = new core_1.Subject();
        this.powerupPicked = new core_1.Subject();
        this.powerupRevoked = new core_1.Subject();
    }
}
exports.LevelEventBus = LevelEventBus;
