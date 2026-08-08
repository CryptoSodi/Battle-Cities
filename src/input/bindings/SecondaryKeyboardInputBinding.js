"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecondaryKeyboardInputBinding = void 0;
const core_1 = require("../../core");
const InputControl_1 = require("../InputControl");
// Suggested for multi-player mode, first player, left side of the keyboard,
// because primary tank spawns on the left side of base
class SecondaryKeyboardInputBinding extends core_1.InputBinding {
    constructor() {
        super();
        this.setDefault(InputControl_1.InputControl.Up, core_1.KeyboardButtonCode.W);
        this.setDefault(InputControl_1.InputControl.Down, core_1.KeyboardButtonCode.S);
        this.setDefault(InputControl_1.InputControl.Left, core_1.KeyboardButtonCode.A);
        this.setDefault(InputControl_1.InputControl.Right, core_1.KeyboardButtonCode.D);
        this.setDefault(InputControl_1.InputControl.Select, core_1.KeyboardButtonCode.Space);
        this.setDefault(InputControl_1.InputControl.PrimaryAction, core_1.KeyboardButtonCode.F);
        this.setDefault(InputControl_1.InputControl.SecondaryAction, core_1.KeyboardButtonCode.G);
        this.setDefault(InputControl_1.InputControl.Rewind, core_1.KeyboardButtonCode.R);
        this.setDefault(InputControl_1.InputControl.FastForward, core_1.KeyboardButtonCode.T);
    }
}
exports.SecondaryKeyboardInputBinding = SecondaryKeyboardInputBinding;
