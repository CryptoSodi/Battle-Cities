"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TertiaryKeyboardInputBinding = void 0;
const core_1 = require("../../core");
const InputControl_1 = require("../InputControl");
// Suggested for multi-player mode, second player, right side of the keyboard,
// because secondary tank spawns on the right side of base
class TertiaryKeyboardInputBinding extends core_1.InputBinding {
    constructor() {
        super();
        this.setDefault(InputControl_1.InputControl.Up, core_1.KeyboardButtonCode.Up);
        this.setDefault(InputControl_1.InputControl.Down, core_1.KeyboardButtonCode.Down);
        this.setDefault(InputControl_1.InputControl.Left, core_1.KeyboardButtonCode.Left);
        this.setDefault(InputControl_1.InputControl.Right, core_1.KeyboardButtonCode.Right);
        this.setDefault(InputControl_1.InputControl.Select, core_1.KeyboardButtonCode.Enter);
        this.setDefault(InputControl_1.InputControl.PrimaryAction, core_1.KeyboardButtonCode.K);
        this.setDefault(InputControl_1.InputControl.SecondaryAction, core_1.KeyboardButtonCode.L);
        this.setDefault(InputControl_1.InputControl.Rewind, core_1.KeyboardButtonCode.I);
        this.setDefault(InputControl_1.InputControl.FastForward, core_1.KeyboardButtonCode.O);
    }
}
exports.TertiaryKeyboardInputBinding = TertiaryKeyboardInputBinding;
