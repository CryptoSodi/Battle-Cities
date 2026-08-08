"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorField = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const gameObjects_1 = require("../../gameObjects");
const tank_1 = require("../../tank");
const EditorTankDummy_1 = require("./EditorTankDummy");
class EditorField extends core_1.GameObject {
    constructor(mapConfig) {
        super(mapConfig.getFieldWidth(), mapConfig.getFieldHeight());
        this.playerDummies = [];
        this.enemyDummies = [];
        this.mapConfig = mapConfig;
    }
    setup({ collisionSystem }) {
        this.base = new gameObjects_1.Base();
        this.base.collider = new core_1.BoxCollider(this.base, false);
        this.base.position.copyFrom(this.mapConfig.getBasePosition());
        collisionSystem.register(this.base.collider);
        this.add(this.base);
        this.mapConfig.getPlayerSpawnPositions().forEach((location, index) => {
            const dummy = new EditorTankDummy_1.EditorTankDummy(tank_1.TankType.PlayerA(), tank_1.TankColorFactory.createPlayerColor(index), game_1.Rotation.Up, false);
            dummy.position.set(location.x, location.y);
            this.add(dummy);
            this.playerDummies[index] = dummy;
        });
        this.mapConfig.getEnemySpawnPositions().forEach((location, index) => {
            const dummy = new EditorTankDummy_1.EditorTankDummy(tank_1.TankType.EnemyA(), tank_1.TankColor.Default, game_1.Rotation.Down, false);
            dummy.position.set(location.x, location.y);
            this.add(dummy);
            this.enemyDummies[index] = dummy;
        });
    }
    update() {
        this.base.collider.update();
    }
    setPlayerSpawnPosition(index, x, y) {
        const dummy = this.playerDummies[index];
        if (dummy === undefined) {
            return;
        }
        dummy.dirtyPaintBox();
        dummy.position.set(x, y);
        dummy.updateMatrix(true);
        dummy.setNeedsPaint();
    }
    setEnemySpawnPosition(index, x, y) {
        const dummy = this.enemyDummies[index];
        if (dummy === undefined) {
            return;
        }
        dummy.dirtyPaintBox();
        dummy.position.set(x, y);
        dummy.updateMatrix(true);
        dummy.setNeedsPaint();
    }
    setBasePosition(x, y) {
        this.base.dirtyPaintBox();
        this.base.position.set(x, y);
        this.base.updateMatrix(true);
        this.base.setNeedsPaint();
    }
}
exports.EditorField = EditorField;
