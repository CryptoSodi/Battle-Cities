"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuInputContext = void 0;
const InputControl_1 = require("../InputControl");
exports.MenuInputContext = {
    VerticalPrev: [InputControl_1.InputControl.Up],
    VerticalNext: [InputControl_1.InputControl.Down],
    HorizontalNext: [InputControl_1.InputControl.Right],
    HorizontalPrev: [InputControl_1.InputControl.Left],
    Skip: [InputControl_1.InputControl.PrimaryAction, InputControl_1.InputControl.Select],
    Select: [InputControl_1.InputControl.PrimaryAction, InputControl_1.InputControl.Select],
};
