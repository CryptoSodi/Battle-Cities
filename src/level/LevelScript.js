"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelScript = void 0;
class LevelScript {
    constructor() {
        this.enabled = true;
        this.needsSetup = true;
    }
    isEnabled() {
        return this.enabled;
    }
    enable() {
        this.enabled = true;
    }
    disable() {
        this.enabled = false;
    }
    invokeInit(world, eventBus, session, mapConfig) {
        this.world = world;
        this.eventBus = eventBus;
        this.session = session;
        this.mapConfig = mapConfig;
        this.init();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invokeUpdate(updateArgs) {
        if (this.enabled === false) {
            return;
        }
        if (this.needsSetup === true) {
            this.needsSetup = false;
            this.setup(updateArgs);
        }
        this.update(updateArgs);
    }
    init() {
        // Virtual
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setup(updateArgs) {
        // Virtual
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(updateArgs) {
        // Virtual
    }
}
exports.LevelScript = LevelScript;
