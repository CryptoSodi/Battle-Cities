"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatrolTankBehavior = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const TankBehavior_1 = require("../TankBehavior");
class PatrolTankBehavior extends TankBehavior_1.TankBehavior {
    constructor() {
        super(...arguments);
        this.lastPosition = null;
    }
    update(tank, updateArgs) {
        tank.move(updateArgs.deltaTime);
        const tankPosition = this.roundPosition(tank.position);
        if (this.lastPosition !== null && this.lastPosition.equals(tankPosition)) {
            if (tank.rotation === game_1.Rotation.Up) {
                tank.rotate(game_1.Rotation.Down);
            }
            else if (tank.rotation === game_1.Rotation.Down) {
                tank.rotate(game_1.Rotation.Up);
            }
            else if (tank.rotation === game_1.Rotation.Left) {
                tank.rotate(game_1.Rotation.Right);
            }
            else if (tank.rotation === game_1.Rotation.Right) {
                tank.rotate(game_1.Rotation.Left);
            }
            tank.move(updateArgs.deltaTime);
            return;
        }
        this.lastPosition = tankPosition;
    }
    roundPosition(position) {
        const roundedPosition = new core_1.Vector(Math.round(position.x), Math.round(position.y));
        return roundedPosition;
    }
}
exports.PatrolTankBehavior = PatrolTankBehavior;
