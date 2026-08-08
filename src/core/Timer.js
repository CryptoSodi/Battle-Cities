"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Timer = void 0;
const Subject_1 = require("./Subject");
class Timer {
    constructor(timeLeft = null) {
        this.done = new Subject_1.Subject();
        this.timeLeft = null;
        this.timeLeft = timeLeft;
    }
    reset(timeLeft) {
        this.timeLeft = timeLeft;
        return this;
    }
    stop() {
        this.timeLeft = null;
        return this;
    }
    update(deltaTime) {
        if (!this.isActive()) {
            return;
        }
        this.timeLeft -= deltaTime;
        if (this.timeLeft < 0) {
            this.timeLeft = null;
            this.done.notify(null);
        }
    }
    isActive() {
        return this.timeLeft !== null;
    }
    isDone() {
        return this.timeLeft === null;
    }
}
exports.Timer = Timer;
