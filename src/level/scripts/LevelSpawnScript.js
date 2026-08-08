"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelSpawnScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const LevelScript_1 = require("../LevelScript");
class LevelSpawnScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.handleEnemySpawnRequested = (event) => {
            const spawn = new gameObjects_1.Spawn();
            spawn.position.copyFrom(event.position);
            spawn.updateMatrix();
            spawn.completed.addListenerOnce(() => {
                this.eventBus.enemySpawnCompleted.notify({
                    type: event.type,
                    centerPosition: spawn.getCenter(),
                    partyIndex: event.partyIndex,
                });
                spawn.removeSelf();
            });
            this.world.field.add(spawn);
        };
        this.handlePlayerSpawnRequested = (event) => {
            const spawn = new gameObjects_1.Spawn();
            spawn.position.copyFrom(event.position);
            spawn.updateMatrix();
            spawn.completed.addListenerOnce(() => {
                this.eventBus.playerSpawnCompleted.notify({
                    type: event.type,
                    centerPosition: spawn.getCenter(),
                    partyIndex: event.partyIndex,
                });
                spawn.removeSelf();
            });
            this.world.field.add(spawn);
        };
    }
    init() {
        this.eventBus.enemySpawnRequested.addListener(this.handleEnemySpawnRequested);
        this.eventBus.playerSpawnRequested.addListener(this.handlePlayerSpawnRequested);
    }
}
exports.LevelSpawnScript = LevelSpawnScript;
