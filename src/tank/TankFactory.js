"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankFactory = void 0;
const gameObjects_1 = require("../gameObjects");
const behaviors_1 = require("./behaviors");
const TankType_1 = require("./TankType");
class TankFactory {
    static createPlayer(partyIndex, type = TankType_1.TankType.PlayerA(), behavior = new behaviors_1.PlayerTankBehavior()) {
        return new gameObjects_1.PlayerTank(type, behavior, partyIndex);
    }
    static createPlayerType() {
        return TankType_1.TankType.PlayerA();
    }
    static createEnemy(partyIndex, type = TankType_1.TankType.EnemyA(), behavior = new behaviors_1.AiTankBehavior()) {
        return new gameObjects_1.EnemyTank(type, behavior, partyIndex);
    }
}
exports.TankFactory = TankFactory;
