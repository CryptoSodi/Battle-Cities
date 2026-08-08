"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelSelectionInputContext = void 0;
const InputControl_1 = require("../InputControl");
exports.LevelSelectionInputContext = {
    Next: [InputControl_1.InputControl.Right],
    Prev: [InputControl_1.InputControl.Left],
    FastNext: [InputControl_1.InputControl.Up],
    FastPrev: [InputControl_1.InputControl.Down],
    Select: [InputControl_1.InputControl.PrimaryAction],
};
