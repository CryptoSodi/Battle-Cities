"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sound = void 0;
const Subject_1 = require("./Subject");
class Sound {
    constructor(audioElement) {
        this.ended = new Subject_1.Subject();
        this.loaded = new Subject_1.Subject();
        this.localMuted = false;
        this.globalMuted = false;
        this.handleLoaded = () => {
            this.loaded.notify(null);
            this.audioElement.removeEventListener('loadeddata', this.handleLoaded);
        };
        this.handleEnded = () => {
            this.ended.notify(null);
        };
        this.audioElement = audioElement;
        this.audioElement.addEventListener('loadeddata', this.handleLoaded);
        this.audioElement.addEventListener('ended', this.handleEnded);
    }
    isLoaded() {
        return this.audioElement.readyState === 4;
    }
    play() {
        this.stop();
        this.audioElement.loop = false;
        this.audioElement.play();
    }
    playLoop() {
        this.stop();
        this.audioElement.loop = true;
        this.audioElement.play();
    }
    resume() {
        this.audioElement.play();
    }
    pause() {
        this.audioElement.pause();
    }
    stop() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }
    canResume() {
        // TODO: what if 0?
        return (this.audioElement.paused &&
            !this.audioElement.ended &&
            this.audioElement.currentTime > 0);
    }
    setMuted(isMuted) {
        this.localMuted = isMuted;
        this.updateElementMuted();
    }
    isMuted() {
        return this.localMuted;
    }
    setGlobalMuted(isGlobalMuted) {
        this.globalMuted = isGlobalMuted;
        this.updateElementMuted();
    }
    isGlobalMuted() {
        return this.globalMuted;
    }
    updateElementMuted() {
        this.audioElement.muted = this.globalMuted || this.localMuted;
    }
}
exports.Sound = Sound;
