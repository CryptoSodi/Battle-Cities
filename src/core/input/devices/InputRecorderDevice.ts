import { DeviceInputFrame } from '../DeviceInputFrame';
import { InputDevice } from '../InputDevice';

// Transparent recording proxy: wraps a real InputDevice and passes every call
// straight through unchanged (so gameplay behaves identically while
// recording), while appending a snapshot of that tick's down/hold/up codes to
// an internal log on every update(). The log, together with the simulation's
// PRNG seed, is everything needed to reproduce a run later via
// RecordedInputDevice -- see that class for the replay side.
export class InputRecorderDevice implements InputDevice {
  private readonly device: InputDevice;
  private readonly frames: DeviceInputFrame[] = [];

  constructor(device: InputDevice) {
    this.device = device;
  }

  public getLog(): DeviceInputFrame[] {
    // Defensive copy -- callers must not be able to mutate the recording by
    // mutating the returned arrays.
    return this.frames.map((frame) => ({
      down: frame.down.slice(),
      hold: frame.hold.slice(),
      up: frame.up.slice(),
    }));
  }

  public isConnected(): boolean {
    return this.device.isConnected();
  }

  public listen(): void {
    this.device.listen();
  }

  public unlisten(): void {
    this.device.unlisten();
  }

  public update(): void {
    this.device.update();

    this.frames.push({
      down: this.device.getDownCodes().slice(),
      hold: this.device.getHoldCodes().slice(),
      up: this.device.getUpCodes().slice(),
    });
  }

  public reset(): void {
    this.device.reset();
  }

  public getDownCodes(): number[] {
    return this.device.getDownCodes();
  }

  public getHoldCodes(): number[] {
    return this.device.getHoldCodes();
  }

  public getUpCodes(): number[] {
    return this.device.getUpCodes();
  }
}
