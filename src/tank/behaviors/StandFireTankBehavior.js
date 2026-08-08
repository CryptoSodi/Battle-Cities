"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandFireTankBehavior = void 0;
const TankBehavior_1 = require("../TankBehavior");
class StandFireTankBehavior extends TankBehavior_1.TankBehavior {
    update(tank) {
        tank.fire();
    }
}
exports.StandFireTankBehavior = StandFireTankBehavior;
