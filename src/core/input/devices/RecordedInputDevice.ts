import { DeviceInputFrame } from '../DeviceInputFrame';
import { InputDevice } from '../InputDevice';

// Plays back a log captured by InputRecorderDevice in place of a live device.
// Advances one recorded frame per update() call, so it must be ticked in
// lockstep with the original recording (same fixed-timestep loop, same call
// order) for a replay to reproduce the original run.
//
// Once the log is exhausted, further ticks report "nothing pressed" rather
// than throwing -- a replay that outlives its recording just goes idle
// instead of crashing.
export class RecordedInputDevice implements InputDevice {
  private static readonly EMPTY_FRAME: DeviceInputFrame = {
    down: [],
    hold: [],
    up: [],
  };

  private readonly frames: DeviceInputFrame[];
  private frameIndex = 0;

  constructor(frames: DeviceInputFrame[]) {
    this.frames = frames;
  }

  public getFrameIndex(): number {
    return this.frameIndex;
  }

  public isConnected(): boolean {
    return true;
  }

  public listen(): void {
    // Nothing to listen to -- input comes from the recorded log.
  }

  public unlisten(): void {
    // Nothing to unlisten from.
  }

  public update(): void {
    this.frameIndex += 1;
  }

  // Mirrors live devices resetting held state when entering gameplay. Also
  // rewinds playback to the start, so a replay lines up with the original
  // recording as long as both call reset() at the same point in the pipeline
  // (level start, before the first tick).
  public reset(): void {
    this.frameIndex = 0;
  }

  public getDownCodes(): number[] {
    return this.getCurrentFrame().down;
  }

  public getHoldCodes(): number[] {
    return this.getCurrentFrame().hold;
  }

  public getUpCodes(): number[] {
    return this.getCurrentFrame().up;
  }

  private getCurrentFrame(): DeviceInputFrame {
    // update() advances the cursor before the frame is read, so the frame for
    // "this" tick is the one just consumed -- i.e. index (frameIndex - 1).
    const frame = this.frames[this.frameIndex - 1];
    return frame ?? RecordedInputDevice.EMPTY_FRAME;
  }
}
