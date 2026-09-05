import { InputControl } from '../InputControl';
import { InputContext } from '../InputContext';

export const MenuInputContext: InputContext = {
  VerticalPrev: [InputControl.Up],
  VerticalNext: [InputControl.Down],
  HorizontalNext: [InputControl.Right],
  HorizontalPrev: [InputControl.Left],
  Skip: [InputControl.PrimaryAction, InputControl.Select],
  Select: [InputControl.PrimaryAction, InputControl.Select],
  // PSG1 normalizes its face buttons so physical B is PrimaryAction (confirm)
  // and physical A is SecondaryAction (back).
  Back: [InputControl.SecondaryAction],
};
