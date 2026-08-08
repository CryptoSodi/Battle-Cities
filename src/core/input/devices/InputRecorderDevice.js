"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputRecorderDevice = void 0;
// Transparent recording proxy: wraps a real InputDevice and passes every call
// straight through unchanged (so gameplay behaves identically while
// recording), while appending a snapshot of that tick's down/hold/up codes to
// an internal log on every update(). The log, together with the simulation's
// PRNG seed, is everything needed to reproduce a run later via
// RecordedInputDevice -- see that class for the replay side.
class InputRecorderDevice {
    constructor(device) {
        this.frames = [];
        this.device = device;
    }
    getLog() {
        // Defensive copy -- callers must not be able to mutate the recording by
        // mutating the returned arrays.
        return this.frames.map((frame) => ({
            down: frame.down.slice(),
            hold: frame.hold.slice(),
            up: frame.up.slice(),
        }));
    }
    isConnected() {
        return this.device.isConnected();
    }
    listen() {
        this.device.listen();
    }
    unlisten() {
        this.device.unlisten();
    }
    update() {
        this.device.update();
        this.frames.push({
            down: this.device.getDownCodes().slice(),
            hold: this.device.getHoldCodes().slice(),
            up: this.device.getUpCodes().slice(),
        });
    }
    reset() {
        this.device.reset();
    }
    getDownCodes() {
        return this.device.getDownCodes();
    }
    getHoldCodes() {
        return this.device.getHoldCodes();
    }
    getUpCodes() {
        return this.device.getUpCodes();
    }
}
exports.InputRecorderDevice = InputRecorderDevice;
