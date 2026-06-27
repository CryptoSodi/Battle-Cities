import { GamepadButtonCode } from '../codes';
import { InputDevice } from '../InputDevice';
import {
  MobileGamepadHost,
  REMOTE_GAMEPAD_STALE_MS,
  RemoteGamepad,
} from '../../../input/mobile';

const AXIS_DEAD_ZONE = 0.22;

export class MobileGamepadInputDevice implements InputDevice {
  private host: MobileGamepadHost;
  private deviceIndex: number;
  private isListening = false;
  private downCodes: number[] = [];
  private holdCodes: number[] = [];
  private upCodes: number[] = [];

  constructor(host: MobileGamepadHost, deviceIndex: number) {
    this.host = host;
    this.deviceIndex = deviceIndex;
  }

  public isConnected(): boolean {
    const gamepad = this.getGamepad();

    return gamepad !== null && gamepad.connected === true;
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

    const gamepad = this.getGamepad();
    const codes = gamepad === null ? [] : this.getPressedCodes(gamepad);

    const downCodes = [];
    const holdCodes = [];

    for (const code of codes) {
      if (!this.downCodes.includes(code) && !this.holdCodes.includes(code)) {
        downCodes.push(code);
      }

      if (this.downCodes.includes(code) || this.holdCodes.includes(code)) {
        holdCodes.push(code);
      }
    }

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

  private getGamepad(): RemoteGamepad {
    const gamepad = this.host.getGamepad(this.deviceIndex);
    if (gamepad === null || gamepad.connected !== true) {
      return null;
    }

    if (
      gamepad.receivedAt !== undefined &&
      Date.now() - gamepad.receivedAt > REMOTE_GAMEPAD_STALE_MS
    ) {
      return null;
    }

    return gamepad;
  }

  private getPressedCodes(gamepad: RemoteGamepad): number[] {
    const codes = [];

    gamepad.buttons.forEach((button, index) => {
      if (button.pressed === true) {
        codes.push(index);
      }
    });

    const horizontalAxis = gamepad.axes[0] || 0;
    const verticalAxis = gamepad.axes[1] || 0;

    if (verticalAxis < -AXIS_DEAD_ZONE) {
      codes.push(GamepadButtonCode.Up);
    }

    if (verticalAxis > AXIS_DEAD_ZONE) {
      codes.push(GamepadButtonCode.Down);
    }

    if (horizontalAxis < -AXIS_DEAD_ZONE) {
      codes.push(GamepadButtonCode.Left);
    }

    if (horizontalAxis > AXIS_DEAD_ZONE) {
      codes.push(GamepadButtonCode.Right);
    }

    return codes;
  }
}
