import { InputBinding, KeyboardButtonCode } from '../../core';

import { InputControl } from '../InputControl';

// Suggested for single-player mode
export class PrimaryKeyboardInputBinding extends InputBinding {
  constructor() {
    super();

    this.setDefault(InputControl.Up, KeyboardButtonCode.Up);
    this.setDefault(InputControl.Down, KeyboardButtonCode.Down);
    this.setDefault(InputControl.Left, KeyboardButtonCode.Left);
    this.setDefault(InputControl.Right, KeyboardButtonCode.Right);
    this.setDefault(InputControl.Select, KeyboardButtonCode.Enter);
    this.setDefault(InputControl.PrimaryAction, KeyboardButtonCode.Z);
    this.setDefault(InputControl.SecondaryAction, KeyboardButtonCode.X);
    this.setDefault(InputControl.PowerOne, KeyboardButtonCode.Num1);
    this.setDefault(InputControl.PowerTwo, KeyboardButtonCode.Num2);
    this.setDefault(InputControl.PowerThree, KeyboardButtonCode.Num3);
    this.setDefault(InputControl.PowerFour, KeyboardButtonCode.Num4);
    this.setDefault(InputControl.Rewind, KeyboardButtonCode.A);
    this.setDefault(InputControl.FastForward, KeyboardButtonCode.S);
  }
}
