"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecondaryGamepadInputBinding = void 0;
const core_1 = require("../../core");
const InputControl_1 = require("../InputControl");
class SecondaryGamepadInputBinding extends core_1.InputBinding {
    constructor() {
        super();
        this.setDefault(InputControl_1.InputControl.Up, core_1.GamepadButtonCode.Up);
        this.setDefault(InputControl_1.InputControl.Down, core_1.GamepadButtonCode.Down);
        this.setDefault(InputControl_1.InputControl.Left, core_1.GamepadButtonCode.Left);
        this.setDefault(InputControl_1.InputControl.Right, core_1.GamepadButtonCode.Right);
        this.setDefault(InputControl_1.InputControl.Select, core_1.GamepadButtonCode.Start);
        this.setDefault(InputControl_1.InputControl.PrimaryAction, core_1.GamepadButtonCode.X);
        this.setDefault(InputControl_1.InputControl.SecondaryAction, core_1.GamepadButtonCode.Y);
        this.setDefault(InputControl_1.InputControl.Rewind, core_1.GamepadButtonCode.A);
        this.setDefault(InputControl_1.InputControl.FastForward, core_1.GamepadButtonCode.B);
    }
}
exports.SecondaryGamepadInputBinding = SecondaryGamepadInputBinding;
