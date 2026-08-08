"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelExplosionScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const LevelScript_1 = require("../LevelScript");
class LevelExplosionScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.handleEnemyDied = (event) => {
            const explosion = new gameObjects_1.Explosion();
            explosion.updateMatrix();
            explosion.setCenter(event.centerPosition);
            explosion.completed.addListener(() => {
                this.eventBus.enemyExploded.notify(event);
            });
            this.world.field.add(explosion);
        };
        this.handlePlayerDied = (event) => {
            const explosion = new gameObjects_1.Explosion();
            explosion.updateMatrix();
            explosion.setCenter(event.centerPosition);
            this.world.field.add(explosion);
        };
    }
    setup() {
        this.eventBus.enemyDied.addListener(this.handleEnemyDied);
        this.eventBus.playerDied.addListener(this.handlePlayerDied);
    }
}
exports.LevelExplosionScript = LevelExplosionScript;
