"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VictoryTankBehavior = void 0;
const core_1 = require("../../core");
const TankBehavior_1 = require("../TankBehavior");
const MOVE_DURATION = 3;
const PREFIRE_DELAY = 1;
const FIRE_LIMIT = 1;
var State;
(function (State) {
    State[State["Moving"] = 0] = "Moving";
    State[State["Prefire"] = 1] = "Prefire";
    State[State["Firing"] = 2] = "Firing";
    State[State["Done"] = 3] = "Done";
})(State || (State = {}));
class VictoryTankBehavior extends TankBehavior_1.TankBehavior {
    constructor() {
        super(...arguments);
        this.stopped = new core_1.Subject();
        this.fired = new core_1.Subject();
        this.moveTimer = new core_1.Timer(MOVE_DURATION);
        this.prefireTimer = new core_1.Timer(PREFIRE_DELAY);
        this.fireCounter = 0;
        this.state = State.Moving;
    }
    update(tank, updateArgs) {
        if (this.state === State.Done) {
            return;
        }
        if (this.state === State.Moving) {
            if (this.moveTimer.isDone()) {
                this.state = State.Prefire;
                this.stopped.notify(null);
                tank.idle();
                return;
            }
            tank.move(updateArgs.deltaTime);
            this.moveTimer.update(updateArgs.deltaTime);
            return;
        }
        if (this.state === State.Prefire) {
            if (this.prefireTimer.isDone()) {
                this.state = State.Firing;
                return;
            }
            this.prefireTimer.update(updateArgs.deltaTime);
            return;
        }
        // Move for some time
        if (this.moveTimer.isActive()) {
            return;
        }
        // Once done moving start firing
        const hasFired = tank.fire();
        if (!hasFired) {
            return;
        }
        this.fired.notify(null);
        // Fire specific number of times
        this.fireCounter += 1;
        if (this.fireCounter < FIRE_LIMIT) {
            return;
        }
        this.state = State.Done;
    }
}
exports.VictoryTankBehavior = VictoryTankBehavior;
