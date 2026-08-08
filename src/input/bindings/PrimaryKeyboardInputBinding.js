"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryKeyboardInputBinding = void 0;
const core_1 = require("../../core");
const InputControl_1 = require("../InputControl");
// Suggested for single-player mode
class PrimaryKeyboardInputBinding extends core_1.InputBinding {
    constructor() {
        super();
        this.setDefault(InputControl_1.InputControl.Up, core_1.KeyboardButtonCode.Up);
        this.setDefault(InputControl_1.InputControl.Down, core_1.KeyboardButtonCode.Down);
        this.setDefault(InputControl_1.InputControl.Left, core_1.KeyboardButtonCode.Left);
        this.setDefault(InputControl_1.InputControl.Right, core_1.KeyboardButtonCode.Right);
        this.setDefault(InputControl_1.InputControl.Select, core_1.KeyboardButtonCode.Enter);
        this.setDefault(InputControl_1.InputControl.PrimaryAction, core_1.KeyboardButtonCode.Z);
        this.setDefault(InputControl_1.InputControl.SecondaryAction, core_1.KeyboardButtonCode.X);
        this.setDefault(InputControl_1.InputControl.PowerOne, core_1.KeyboardButtonCode.Num1);
        this.setDefault(InputControl_1.InputControl.PowerTwo, core_1.KeyboardButtonCode.Num2);
        this.setDefault(InputControl_1.InputControl.PowerThree, core_1.KeyboardButtonCode.Num3);
        this.setDefault(InputControl_1.InputControl.PowerFour, core_1.KeyboardButtonCode.Num4);
        this.setDefault(InputControl_1.InputControl.Rewind, core_1.KeyboardButtonCode.A);
        this.setDefault(InputControl_1.InputControl.FastForward, core_1.KeyboardButtonCode.S);
    }
}
exports.PrimaryKeyboardInputBinding = PrimaryKeyboardInputBinding;
