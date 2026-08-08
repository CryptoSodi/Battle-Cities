"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputControlPresenter = void 0;
const InputControl_1 = require("./InputControl");
class InputControlPresenter {
    static asString(control, unknownValue = '???') {
        switch (control) {
            case InputControl_1.InputControl.Up:
                return 'MOVE UP';
            case InputControl_1.InputControl.Down:
                return 'MOVE DOWN';
            case InputControl_1.InputControl.Left:
                return 'MOVE LEFT';
            case InputControl_1.InputControl.Right:
                return 'MOVE RIGHT';
            case InputControl_1.InputControl.PrimaryAction:
                return 'FIRE';
            case InputControl_1.InputControl.SecondaryAction:
                return 'RAPID FIRE';
            case InputControl_1.InputControl.Select:
                return 'SELECT/PAUSE';
            default:
                return unknownValue;
        }
    }
}
exports.InputControlPresenter = InputControlPresenter;
