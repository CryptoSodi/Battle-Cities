"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLoop = void 0;
const Subject_1 = require("./Subject");
const DEFAULT_OPTIONS = {
    deltaTimeLimit: 0.25,
    // requestAnimationFrame is usually 60 fps; in seconds
    fps: 60,
    maxSubSteps: 5,
    timerDriven: false,
};
var State;
(function (State) {
    State[State["Idle"] = 0] = "Idle";
    State[State["Working"] = 1] = "Working";
    State[State["StopRequested"] = 2] = "StopRequested";
})(State || (State = {}));
class GameLoop {
    constructor(options = {}) {
        // Fired once per fixed simulation step. May fire 0..maxSubSteps times per
        // animation frame depending on how much real time has elapsed.
        this.update = new Subject_1.Subject();
        // Fired exactly once per animation frame, after the step(s) for that frame.
        this.render = new Subject_1.Subject();
        this.lastTimestamp = null;
        this.state = State.Idle;
        // Unconsumed real (scaled) time waiting to be turned into fixed sim steps.
        this.accumulator = 0;
        // Global multiplier on simulation time. 1 = normal, <1 = slow-mo, 0 = frozen
        // (render still runs). Used for hit-stop and slow-motion effects.
        this.timeScale = 1;
        // Remaining REAL-time seconds to freeze the simulation for (hit-stop). Real
        // time — the sim is frozen, so a sim timer couldn't tick it back down.
        this.hitStopRemaining = 0;
        this.loop = (timestamp = null) => {
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
            // Hit-stop: while frozen, drain the freeze by REAL elapsed time and feed no
            // time into the sim (render still runs below), then resume normally.
            let effectiveTimeScale = this.timeScale;
            if (this.hitStopRemaining > 0) {
                this.hitStopRemaining = Math.max(0, this.hitStopRemaining - frameTime);
                effectiveTimeScale = 0;
            }
            this.accumulator += frameTime * effectiveTimeScale;
            let steps = 0;
            while (this.accumulator >= fixedDeltaTime &&
                steps < this.options.maxSubSteps) {
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
            if (this.options.timerDriven) {
                window.setTimeout(() => this.loop(performance.now()), 1000 / this.options.fps);
            }
            else {
                window.requestAnimationFrame(this.loop);
            }
        };
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    start() {
        if (this.state !== State.Idle) {
            return;
        }
        this.state = State.Working;
        this.loop();
    }
    // WARNING: a couple of already queued callbacks might still fire after stop
    stop() {
        if (this.state !== State.Working) {
            return;
        }
        this.state = State.StopRequested;
    }
    getTimeScale() {
        return this.timeScale;
    }
    setTimeScale(value) {
        this.timeScale = Math.max(0, value);
    }
    // Freeze the simulation for `seconds` of real time (hit-stop / impact punch).
    // Rendering keeps running; overlapping requests take the longest.
    hitStop(seconds) {
        if (seconds > this.hitStopRemaining) {
            this.hitStopRemaining = seconds;
        }
    }
    // For manual stepping over frames when loop is paused. Advances exactly
    // `ticks` fixed sim steps and then renders once.
    next(ticks = 1) {
        const fixedDeltaTime = this.getFixedDeltaTime();
        for (let i = 0; i < ticks; i += 1) {
            this.update.notify({ deltaTime: fixedDeltaTime });
        }
        this.render.notify({ alpha: 0 });
    }
    getFixedDeltaTime() {
        return 1 / this.options.fps;
    }
}
exports.GameLoop = GameLoop;
