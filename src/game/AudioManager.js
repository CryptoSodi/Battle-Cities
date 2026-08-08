"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioManager = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
// Sounds routed to the "music" (ambient) bus; everything else defaults to the
// "sfx" bus so impacts and ambience can be balanced independently.
const MUSIC_SOUND_IDS = ['level-intro', 'pause', 'tank.idle', 'tank.move'];
class AudioManager {
    constructor(audioLoader, storage) {
        this.globalMuted = false;
        this.masterVolume = config.AUDIO_MASTER_VOLUME;
        this.musicElements = new Set();
        this.audioLoader = audioLoader;
        this.storage = storage;
        this.mixer = new core_1.AudioMixer(this.masterVolume, config.AUDIO_MASTER_INTENSITY);
        this.mixer.setBusVolume('sfx', config.AUDIO_SFX_VOLUME);
        this.mixer.setBusVolume('music', config.AUDIO_MUSIC_VOLUME);
        // Resolve which elements belong on the music bus up front so the loaded
        // handler can route them without needing the sound id.
        MUSIC_SOUND_IDS.forEach((id) => {
            try {
                this.musicElements.add(this.audioLoader.load(id).audioElement);
            }
            catch {
                // Missing manifest entry — skip; it just stays on the default bus.
            }
        });
        this.audioLoader.loaded.addListener((sound) => {
            sound.setGlobalMuted(this.globalMuted);
            this.mixer.connect(sound.audioElement, this.busFor(sound));
        });
        // Route anything that finished loading before this listener was attached.
        this.audioLoader.getAllLoaded().forEach((sound) => {
            this.mixer.connect(sound.audioElement, this.busFor(sound));
        });
    }
    busFor(sound) {
        return this.musicElements.has(sound.audioElement) ? 'music' : 'sfx';
    }
    setGlobalMuted(isGlobalMuted) {
        this.globalMuted = isGlobalMuted;
        this.mixer.setMuted(isGlobalMuted);
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            sound.setGlobalMuted(isGlobalMuted);
        });
    }
    isGlobalMuted() {
        return this.globalMuted;
    }
    // Master output level in [0..1]. Persisted; layered under the fixed
    // reduced-audio intensity scalar inside the mixer.
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.mixer.setMasterVolume(this.masterVolume);
    }
    getMasterVolume() {
        return this.masterVolume;
    }
    play(soundId) {
        this.mixer.resume();
        const sound = this.audioLoader.load(soundId);
        sound.play();
    }
    playLoop(soundId) {
        this.mixer.resume();
        const sound = this.audioLoader.load(soundId);
        sound.playLoop();
    }
    stop(soundId) {
        const sound = this.audioLoader.load(soundId);
        sound.stop();
    }
    pauseAll() {
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            sound.pause();
        });
    }
    resumeAll() {
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            if (sound.canResume()) {
                sound.resume();
            }
        });
    }
    stopAll() {
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            sound.stop();
        });
    }
    muteAllExcept(...exceptSounds) {
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            if (!exceptSounds.includes(sound)) {
                sound.setMuted(true);
            }
        });
    }
    unmuteAll() {
        const sounds = this.getLoadedSounds();
        sounds.forEach((sound) => {
            sound.setMuted(false);
        });
    }
    loadSettings() {
        this.globalMuted = this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_AUDIO_MUTED, false);
        this.mixer.setMuted(this.globalMuted);
        this.masterVolume = this.storage.getNumber(config.STORAGE_KEY_SETTINGS_AUDIO_VOLUME, config.AUDIO_MASTER_VOLUME);
        this.mixer.setMasterVolume(this.masterVolume);
    }
    saveSettings() {
        this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_AUDIO_MUTED, this.globalMuted);
        this.storage.setNumber(config.STORAGE_KEY_SETTINGS_AUDIO_VOLUME, this.masterVolume);
        this.storage.save();
    }
    getLoadedSounds() {
        return this.audioLoader.getAllLoaded();
    }
}
exports.AudioManager = AudioManager;
