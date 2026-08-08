"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelWinScript = void 0;
const core_1 = require("../../core");
const LevelScript_1 = require("../LevelScript");
const POST_WIN_DELAY = 3;
class LevelWinScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        // Disable by default
        this.enabled = false;
        this.timer = new core_1.Timer();
        this.handleTimer = () => {
            this.eventBus.levelWinCompleted.notify(null);
        };
    }
    setup() {
        this.timer.reset(POST_WIN_DELAY);
        this.timer.done.addListener(this.handleTimer);
    }
    update(updateArgs) {
        this.timer.update(updateArgs.deltaTime);
    }
}
exports.LevelWinScript = LevelWinScript;
