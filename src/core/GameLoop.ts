import { Subject } from './Subject';

// References:
// https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
// https://gafferongames.com/post/fix_your_timestep/

export interface GameLoopOptions {
  // Delta limit value in seconds. Limit might be reached if game loop is paused
  // or breakpoint is activated during debugging.
  deltaTimeLimit?: number;
  // Simulation frequency. The sim always steps at exactly 1/fps seconds,
  // regardless of the display refresh rate, so gameplay is frame-rate
  // independent and reproducible.
  fps?: number;
  // Maximum number of fixed sim steps allowed per animation frame. Caps
  // catch-up work after a long stall so the loop can't spiral.
  maxSubSteps?: number;
}

export interface GameLoopUpdateEvent {
  // Always the fixed simulation step in seconds (1/fps).
  deltaTime: number;
}

export interface GameLoopRenderEvent {
  // Interpolation factor in [0, 1) describing how far the renderer is between
  // the last completed sim step and the next one. Renderers may use it to
  // smooth motion on displays faster than the sim rate.
  alpha: number;
}

const DEFAULT_OPTIONS = {
  deltaTimeLimit: 0.25,
  // requestAnimationFrame is usually 60 fps; in seconds
  fps: 60,
  maxSubSteps: 5,
};

enum State {
  Idle,
  Working,
  StopRequested,
}

export class GameLoop {
  // Fired once per fixed simulation step. May fire 0..maxSubSteps times per
  // animation frame depending on how much real time has elapsed.
  public readonly update = new Subject<GameLoopUpdateEvent>();
  // Fired exactly once per animation frame, after the step(s) for that frame.
  public readonly render = new Subject<GameLoopRenderEvent>();

  private options: GameLoopOptions;
  private lastTimestamp = null;
  private state = State.Idle;
  // Unconsumed real (scaled) time waiting to be turned into fixed sim steps.
  private accumulator = 0;
  // Global multiplier on simulation time. 1 = normal, <1 = slow-mo, 0 = frozen
  // (render still runs). Used for hit-stop and slow-motion effects.
  private timeScale = 1;

  constructor(options: GameLoopOptions = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
  }

  public start(): void {
    if (this.state !== State.Idle) {
      return;
    }

    this.state = State.Working;

    this.loop();
  }

  // WARNING: a couple of already queued callbacks might still fire after stop
  public stop(): void {
    if (this.state !== State.Working) {
      return;
    }

    this.state = State.StopRequested;
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public setTimeScale(value: number): void {
    this.timeScale = Math.max(0, value);
  }

  // For manual stepping over frames when loop is paused. Advances exactly
  // `ticks` fixed sim steps and then renders once.
  public next(ticks = 1): void {
    const fixedDeltaTime = this.getFixedDeltaTime();
    for (let i = 0; i < ticks; i += 1) {
      this.update.notify({ deltaTime: fixedDeltaTime });
    }
    this.render.notify({ alpha: 0 });
  }

  private loop = (timestamp = null): void => {
    if (this.state === State.Idle) {
      return;
    }

    if (this.state === State.StopRequested) {
      this.state = State.Idle;
      return;
    }

    const fixedDeltaTime = this.getFixedDeltaTime();

    // Real seconds elapsed since the previous animation frame. The initial
    // call from start() (timestamp === null) and the first real animation
    // frame (no previous timestamp yet) both advance a single ideal step, so
    // the scene is updated at least once before its first render.
    let frameTime = fixedDeltaTime;
    if (timestamp !== null && this.lastTimestamp !== null) {
      // Timestamp is originally in milliseconds, convert to seconds.
      frameTime = (timestamp - this.lastTimestamp) / 1000;

      // If delta is too large, we must have resumed from stop() or a
      // breakpoint. Clamp so the accumulator can't balloon.
      if (frameTime > this.options.deltaTimeLimit) {
        frameTime = this.options.deltaTimeLimit;
      }
    }

    this.lastTimestamp = timestamp;

    this.accumulator += frameTime * this.timeScale;

    let steps = 0;
    while (
      this.accumulator >= fixedDeltaTime &&
      steps < this.options.maxSubSteps
    ) {
      this.update.notify({ deltaTime: fixedDeltaTime });
      this.accumulator -= fixedDeltaTime;
      steps += 1;
    }

    // Hit the step cap (long stall / very slow device): drop the backlog so we
    // don't keep trying to catch up frame after frame.
    if (steps >= this.options.maxSubSteps && this.accumulator > fixedDeltaTime) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / fixedDeltaTime;
    this.render.notify({ alpha });

    window.requestAnimationFrame(this.loop);
  };

  private getFixedDeltaTime(): number {
    return 1 / this.options.fps;
  }
}
