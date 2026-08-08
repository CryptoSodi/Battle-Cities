"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorMapInputContext = void 0;
const InputControl_1 = require("../InputControl");
exports.EditorMapInputContext = {
    MoveUp: [InputControl_1.InputControl.Up],
    MoveDown: [InputControl_1.InputControl.Down],
    MoveLeft: [InputControl_1.InputControl.Left],
    MoveRight: [InputControl_1.InputControl.Right],
    Draw: [InputControl_1.InputControl.PrimaryAction],
    Erase: [InputControl_1.InputControl.SecondaryAction],
    NextBrush: [InputControl_1.InputControl.FastForward],
    PrevBrush: [InputControl_1.InputControl.Rewind],
    Menu: [InputControl_1.InputControl.Select],
};
