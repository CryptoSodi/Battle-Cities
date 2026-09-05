import { GamepadButtonCode } from '../codes';
import { InputDevice } from '../InputDevice';

const AXIS_DEAD_ZONE = 0.22;

export class GamepadInputDevice implements InputDevice {
  private deviceIndex: number;
  private isListening = false;
  private injectedCodes: number[] = [];
  private downCodes: number[] = [];
  private holdCodes: number[] = [];
  private upCodes: number[] = [];

  constructor(deviceIndex: number) {
    this.deviceIndex = deviceIndex;
  }

  public isConnected(): boolean {
    const gamepad = this.getGamepad();

    if (gamepad === null) {
      return false;
    }

    return true;
  }

  public listen(): void {
    this.isListening = true;
  }

  public unlisten(): void {
    this.isListening = false;
  }

  public update(): void {
    if (!this.isListening) {
      return;
    }

    const codes = this.injectedCodes.slice();
    const gamepad = this.getGamepad();

    // The Android bridge can provide physical buttons even when WebView does
    // not expose that controller through navigator.getGamepads().
    if (gamepad !== null) {
      const { buttons } = gamepad;
      for (let i = 0; i < buttons.length; i += 1) {
        const button = buttons[i];
        if (button.pressed === true) this.addCode(codes, i);
      }
      this.addStickCodes(codes, gamepad.axes);
    }

    const downCodes = [];
    const holdCodes = [];

    for (const code of codes) {
      // Newly pressed key, which was not previously down or hold
      if (!this.downCodes.includes(code) && !this.holdCodes.includes(code)) {
        downCodes.push(code);
      }

      // Button that was down on previous frame is now considered hold, because
      // it is still down on current frame.
      // Hold continues to be hold.
      if (this.downCodes.includes(code) || this.holdCodes.includes(code)) {
        holdCodes.push(code);
      }
    }

    // Find buttons that were down or hold on previous frame, which means
    // that in current frame they are considered up

    const upCodes = [];

    for (const code of this.downCodes) {
      if (!codes.includes(code)) {
        upCodes.push(code);
      }
    }

    for (const code of this.holdCodes) {
      if (!codes.includes(code)) {
        upCodes.push(code);
      }
    }

    this.downCodes = downCodes;
    this.holdCodes = holdCodes;
    this.upCodes = upCodes;
  }

  public reset(): void {
    this.injectedCodes = [];
    this.downCodes = [];
    this.holdCodes = [];
    this.upCodes = [];
  }

  public getDownCodes(): number[] {
    return this.downCodes;
  }

  public getHoldCodes(): number[] {
    return this.holdCodes;
  }

  public getUpCodes(): number[] {
    return this.upCodes;
  }

  // Native Android controller events are merged with the browser Gamepad API
  // so physical buttons and sticks always drive the same gamepad binding.
  public setCodePressed(code: number, pressed: boolean): void {
    const index = this.injectedCodes.indexOf(code);
    if (pressed && index === -1) this.injectedCodes.push(code);
    if (!pressed && index !== -1) this.injectedCodes.splice(index, 1);
  }

  private getGamepad(): Gamepad {
    const gamepads = navigator.getGamepads();

    // Firefox will have empty array
    if (gamepads.length === 0) {
      return null;
    }

    const gamepad = gamepads[this.deviceIndex];

    // Chrome will have filled array of 4 elements with null values
    // Value will be null after device is connected or page is reloaded,
    // until user has pressed any button.
    if (gamepad === null) {
      return null;
    }

    return gamepad;
  }

  private addStickCodes(codes: number[], axes: ReadonlyArray<number>): void {
    const leftX = axes[0] || 0;
    const leftY = axes[1] || 0;
    const rightX = axes[2] || 0;
    const rightY = axes[3] || 0;

    if (leftY < -AXIS_DEAD_ZONE) this.addCode(codes, GamepadButtonCode.Up);
    if (leftY > AXIS_DEAD_ZONE) this.addCode(codes, GamepadButtonCode.Down);
    if (leftX < -AXIS_DEAD_ZONE) this.addCode(codes, GamepadButtonCode.Left);
    if (leftX > AXIS_DEAD_ZONE) this.addCode(codes, GamepadButtonCode.Right);

    const rightStickHorizontal = Math.abs(rightX) >= Math.abs(rightY);
    if (rightStickHorizontal && rightX > AXIS_DEAD_ZONE)
      this.addCode(codes, GamepadButtonCode.RightStickRight);
    if (!rightStickHorizontal && rightY < -AXIS_DEAD_ZONE)
      this.addCode(codes, GamepadButtonCode.RightStickUp);
    if (!rightStickHorizontal && rightY > AXIS_DEAD_ZONE)
      this.addCode(codes, GamepadButtonCode.RightStickDown);
    if (rightStickHorizontal && rightX < -AXIS_DEAD_ZONE)
      this.addCode(codes, GamepadButtonCode.RightStickLeft);
  }

  private addCode(codes: number[], code: number): void {
    if (!codes.includes(code)) codes.push(code);
  }
}
