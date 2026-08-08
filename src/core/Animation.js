"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Animation = void 0;
const DEFAULT_OPTIONS = {
    delay: 0,
    // requestAnimationFrame is usually 60 fps
    fps: 60,
    loop: false,
};
class Animation {
    constructor(frames = [], options = {}) {
        this.time = 0;
        this.frames = frames;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.frameIndex = 0;
        this.loopIndex = 0;
    }
    getCurrentFrame() {
        return this.frames[this.frameIndex];
    }
    getCurrentFrameIndex() {
        return this.frameIndex;
    }
    isComplete() {
        // Looped animation can not end
        if (this.isLoopInfinite()) {
            return false;
        }
        // If loop is limited by number of times and it hasn't looped all times yet
        // animation is not complete.
        if (this.isLoopFinite() && !this.isLastLoop()) {
            return false;
        }
        if (!this.isLastFrame()) {
            return false;
        }
        // Make sure last frame is displayed on the screen for required amount
        // of tics including delay. Only after that set animation as complete.
        const isComplete = this.isCurrentFrameComplete();
        return isComplete;
    }
    /**
     * @param {number} deltaTime time passed since last frame in seconds
     */
    update(deltaTime) {
        // Record when entire animation has started. First frame will be shown for
        // at least one tick
        if (this.time === 0) {
            this.time = deltaTime;
            return;
        }
        // If looping is disabled and last frame animation is complete - nothing else
        // to animate
        if (this.isLoopDisabled() &&
            this.isLastFrame() &&
            this.isCurrentFrameComplete()) {
            return;
        }
        // If loop is limited to number and we are on the last loop and last frame
        // animation is complete - nothing else to animate
        if (this.isLoopFinite() &&
            this.isLastLoop() &&
            this.isLastFrame() &&
            this.isCurrentFrameComplete()) {
            return;
        }
        // Debounces animation to create a delay between frames.
        // If enough time has not passed yet from the last animation - wait.
        if (!this.isCurrentFrameComplete()) {
            this.time += deltaTime;
            return;
        }
        // Go to the next frame
        this.frameIndex += 1;
        if (this.frameIndex > this.frames.length - 1) {
            this.frameIndex = 0;
            // When frame is reset to the first one,
            // consider one animation loop complete
            this.loopIndex += 1;
        }
        this.time += deltaTime;
    }
    reset() {
        this.frameIndex = 0;
        this.loopIndex = 0;
        this.time = 0;
        return this;
    }
    resetWithFrames(frames) {
        this.reset();
        this.frames = frames;
        return this;
    }
    isCurrentFrameComplete() {
        // By default each frame will have 1 tick guaranteed
        const minFrameTime = 1 / this.options.fps;
        // Delay adds up to default min time
        const singleFrameTime = minFrameTime + this.options.delay;
        // Sum time for all frames including current in one cycle
        const passedFramesTime = (this.loopIndex * this.frames.length + this.frameIndex + 1) *
            singleFrameTime -
            minFrameTime;
        const isComplete = this.time > passedFramesTime;
        return isComplete;
    }
    isLastFrame() {
        return this.frameIndex === this.frames.length - 1;
    }
    isLoopInfinite() {
        return this.options.loop === true;
    }
    isLoopFinite() {
        return typeof this.options.loop === 'number';
    }
    isLoopDisabled() {
        return this.options.loop === false;
    }
    isLastLoop() {
        return this.loopIndex + 1 === this.options.loop;
    }
}
exports.Animation = Animation;
