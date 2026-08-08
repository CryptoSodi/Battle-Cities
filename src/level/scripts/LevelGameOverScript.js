"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelGameOverScript = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const LevelScript_1 = require("../LevelScript");
const SLIDE_SPEED = 200;
const TARGET_POSITION_Y = 360;
const TOTAL_DURATION = 5;
const MOVE_BLOCK_DELAY = 1;
class LevelGameOverScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        // Disable by default
        this.enabled = false;
        this.moveBlockTimer = new core_1.Timer();
        this.totalTimer = new core_1.Timer();
        this.handleMoveBlockTimer = () => {
            this.eventBus.levelGameOverMoveBlocked.notify(null);
        };
        this.handleTotalTimer = () => {
            this.eventBus.levelGameOverCompleted.notify(null);
        };
    }
    setup() {
        this.notice = new gameObjects_1.GameOverNotice();
        this.notice.updateMatrix();
        this.notice.setCenterX(this.world.field.getSelfCenter().x);
        this.notice.position.y = this.world.field.size.height + 100;
        this.world.field.add(this.notice);
        this.moveBlockTimer.reset(MOVE_BLOCK_DELAY);
        this.moveBlockTimer.done.addListener(this.handleMoveBlockTimer);
        this.totalTimer.reset(TOTAL_DURATION);
        this.totalTimer.done.addListener(this.handleTotalTimer);
    }
    update(updateArgs) {
        const { deltaTime } = updateArgs;
        this.notice.dirtyPaintBox();
        this.notice.position.y -= SLIDE_SPEED * deltaTime;
        if (this.notice.position.y <= TARGET_POSITION_Y) {
            this.notice.position.y = TARGET_POSITION_Y;
        }
        this.notice.updateMatrix();
        this.moveBlockTimer.update(deltaTime);
        this.totalTimer.update(deltaTime);
    }
}
exports.LevelGameOverScript = LevelGameOverScript;
