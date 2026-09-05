import { GamepadButtonCode, InputBinding } from '../../core';

import { InputControl } from '../InputControl';

export class PrimaryGamepadInputBinding extends InputBinding {
  constructor() {
    super();

    this.setDefault(InputControl.Up, GamepadButtonCode.Up);
    this.setDefault(InputControl.Down, GamepadButtonCode.Down);
    this.setDefault(InputControl.Left, GamepadButtonCode.Left);
    this.setDefault(InputControl.Right, GamepadButtonCode.Right);
    this.setDefault(InputControl.Select, GamepadButtonCode.Start);
    this.setDefault(InputControl.PrimaryAction, GamepadButtonCode.A);
    this.setDefault(InputControl.SecondaryAction, GamepadButtonCode.B);
    this.setDefault(InputControl.PowerOne, GamepadButtonCode.RightStickRight);
    this.setDefault(InputControl.PowerTwo, GamepadButtonCode.RightStickUp);
    this.setDefault(InputControl.PowerThree, GamepadButtonCode.RightStickDown);
    this.setDefault(InputControl.PowerFour, GamepadButtonCode.RightStickLeft);
    this.setDefault(InputControl.Rewind, GamepadButtonCode.X);
    this.setDefault(InputControl.FastForward, GamepadButtonCode.Y);
  }
}
