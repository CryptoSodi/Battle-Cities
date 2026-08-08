"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelPlayInputContext = void 0;
const InputControl_1 = require("../InputControl");
exports.LevelPlayInputContext = {
    MoveUp: [InputControl_1.InputControl.Up],
    MoveDown: [InputControl_1.InputControl.Down],
    MoveLeft: [InputControl_1.InputControl.Left],
    MoveRight: [InputControl_1.InputControl.Right],
    Fire: [InputControl_1.InputControl.PrimaryAction],
    RapidFire: [InputControl_1.InputControl.SecondaryAction],
    PowerOne: [InputControl_1.InputControl.PowerOne],
    PowerTwo: [InputControl_1.InputControl.PowerTwo],
    PowerThree: [InputControl_1.InputControl.PowerThree],
    PowerFour: [InputControl_1.InputControl.PowerFour],
    Pause: [InputControl_1.InputControl.Select],
};
