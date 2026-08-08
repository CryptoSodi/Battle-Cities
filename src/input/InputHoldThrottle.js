"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputHoldThrottle = void 0;
const core_1 = require("../core");
const DEFAULT_OPTIONS = {
    activationDelay: 0,
    delay: 0,
};
class InputHoldThrottle {
    constructor(controls, callback, options) {
        this.controls = controls;
        this.callback = callback;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.timer = new core_1.Timer(options.activationDelay);
    }
    update(inputMethod, deltaTime) {
        if (inputMethod.isDownAny(this.controls) ||
            inputMethod.isUpAny(this.controls)) {
            this.timer.reset(this.options.activationDelay);
        }
        if (inputMethod.isHoldAny(this.controls)) {
            if (this.timer.isDone()) {
                this.callback();
                this.timer.reset(this.options.delay);
            }
            else {
                this.timer.update(deltaTime);
            }
        }
    }
}
exports.InputHoldThrottle = InputHoldThrottle;
