"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioLoader = void 0;
const Logger_1 = require("../Logger");
const Sound_1 = require("../Sound");
const Subject_1 = require("../Subject");
class AudioLoader {
    constructor(manifest) {
        this.loaded = new Subject_1.Subject();
        this.sounds = new Map();
        this.log = new Logger_1.Logger(AudioLoader.name, Logger_1.Logger.Level.None);
        this.manifest = manifest;
    }
    load(id) {
        const item = this.manifest[id];
        if (item === undefined) {
            throw new Error(`Invalid audio id = "${id}"`);
        }
        const { file: filePath } = item;
        if (this.sounds.has(filePath)) {
            return this.sounds.get(filePath);
        }
        const audioElement = new Audio();
        const sound = new Sound_1.Sound(audioElement);
        sound.loaded.addListener(() => {
            this.log.debug('Loaded "%s"', filePath);
            this.loaded.notify(sound);
        });
        audioElement.preload = 'auto';
        audioElement.src = filePath;
        this.sounds.set(filePath, sound);
        return sound;
    }
    async loadAsync(id) {
        return new Promise((resolve) => {
            const sound = this.load(id);
            if (sound.isLoaded()) {
                resolve(sound);
            }
            else {
                sound.loaded.addListener(() => {
                    resolve(sound);
                });
            }
        });
    }
    preloadAll() {
        Object.keys(this.manifest).forEach((id) => {
            this.load(id);
        });
    }
    async preloadAllAsync() {
        await Promise.all(Object.keys(this.manifest).map((id) => {
            return this.loadAsync(id);
        }));
    }
    getAllLoaded() {
        return Array.from(this.sounds.values());
    }
}
exports.AudioLoader = AudioLoader;
