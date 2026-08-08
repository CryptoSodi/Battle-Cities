"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatrolFireTankBehavior = void 0;
const PatrolTankBehavior_1 = require("./PatrolTankBehavior");
class PatrolFireTankBehavior extends PatrolTankBehavior_1.PatrolTankBehavior {
    update(tank, updateArgs) {
        super.update(tank, updateArgs);
        tank.fire();
    }
}
exports.PatrolFireTankBehavior = PatrolFireTankBehavior;
