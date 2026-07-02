import { InputControl } from '../InputControl';
import { InputContext } from '../InputContext';

export const LevelPlayInputContext: InputContext = {
  MoveUp: [InputControl.Up],
  MoveDown: [InputControl.Down],
  MoveLeft: [InputControl.Left],
  MoveRight: [InputControl.Right],
  Fire: [InputControl.PrimaryAction],
  RapidFire: [InputControl.SecondaryAction],
  PowerOne: [InputControl.PowerOne],
  PowerTwo: [InputControl.PowerTwo],
  PowerThree: [InputControl.PowerThree],
  PowerFour: [InputControl.PowerFour],
  Pause: [InputControl.Select],
};
