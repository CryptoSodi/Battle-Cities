"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordedInputDevice = void 0;
// Plays back a log captured by InputRecorderDevice in place of a live device.
// Advances one recorded frame per update() call, so it must be ticked in
// lockstep with the original recording (same fixed-timestep loop, same call
// order) for a replay to reproduce the original run.
//
// Once the log is exhausted, further ticks report "nothing pressed" rather
// than throwing -- a replay that outlives its recording just goes idle
// instead of crashing.
class RecordedInputDevice {
    constructor(frames) {
        this.frameIndex = 0;
        this.frames = frames;
    }
    getFrameIndex() {
        return this.frameIndex;
    }
    isConnected() {
        return true;
    }
    listen() {
        // Nothing to listen to -- input comes from the recorded log.
    }
    unlisten() {
        // Nothing to unlisten from.
    }
    update() {
        this.frameIndex += 1;
    }
    // Mirrors live devices resetting held state when entering gameplay. Also
    // rewinds playback to the start, so a replay lines up with the original
    // recording as long as both call reset() at the same point in the pipeline
    // (level start, before the first tick).
    reset() {
        this.frameIndex = 0;
    }
    getDownCodes() {
        return this.getCurrentFrame().down;
    }
    getHoldCodes() {
        return this.getCurrentFrame().hold;
    }
    getUpCodes() {
        return this.getCurrentFrame().up;
    }
    getCurrentFrame() {
        // update() advances the cursor before the frame is read, so the frame for
        // "this" tick is the one just consumed -- i.e. index (frameIndex - 1).
        const frame = this.frames[this.frameIndex - 1];
        return frame ?? RecordedInputDevice.EMPTY_FRAME;
    }
}
exports.RecordedInputDevice = RecordedInputDevice;
RecordedInputDevice.EMPTY_FRAME = {
    down: [],
    hold: [],
    up: [],
};
