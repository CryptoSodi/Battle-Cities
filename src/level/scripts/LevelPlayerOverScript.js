"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelPlayerOverScript = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const LevelScript_1 = require("../LevelScript");
const MOVE_DURATION = 1;
const STAY_DURATION = 1;
const SLIDE_POSITIONS = [
    { startX: 64, endX: 224 },
    { startX: 640, endX: 480 },
];
var State;
(function (State) {
    State[State["Idle"] = 0] = "Idle";
    State[State["Moving"] = 1] = "Moving";
    State[State["Staying"] = 2] = "Staying";
    State[State["Done"] = 3] = "Done";
})(State || (State = {}));
class LevelPlayerOverScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        // Disable by default
        this.enabled = false;
        this.timer = new core_1.Timer();
        this.playerIndex = -1;
        this.state = State.Idle;
        this.handleTimerDone = () => {
            if (this.state === State.Moving) {
                this.state = State.Staying;
                this.timer.reset(STAY_DURATION);
                return;
            }
            if (this.state === State.Staying) {
                this.state = State.Done;
                this.notice.dirtyPaintBox();
                this.notice.removeSelf();
                return;
            }
        };
    }
    setPlayerIndex(playerIndex) {
        this.playerIndex = playerIndex;
    }
    setup() {
        this.notice = new gameObjects_1.GameOverNotice();
        this.notice.updateMatrix();
        this.notice.position.setX(SLIDE_POSITIONS[this.playerIndex].startX);
        this.notice.position.setY(this.world.field.size.height - this.notice.size.height);
        this.world.field.add(this.notice);
        this.state = State.Moving;
        this.timer.reset(MOVE_DURATION);
        this.timer.done.addListener(this.handleTimerDone);
    }
    update(updateArgs) {
        const { deltaTime } = updateArgs;
        if (this.state === State.Moving) {
            this.notice.dirtyPaintBox();
            const { startX, endX } = SLIDE_POSITIONS[this.playerIndex];
            const totalDistance = endX - startX;
            const speed = totalDistance / MOVE_DURATION;
            this.notice.position.x += speed * deltaTime;
            if (this.playerIndex === 0 && this.notice.position.x > endX) {
                this.notice.position.x = endX;
            }
            else if (this.playerIndex === 1 && this.notice.position.x < endX) {
                this.notice.position.x = endX;
            }
            this.notice.updateMatrix();
            this.timer.update(deltaTime);
        }
        if (this.state === State.Staying) {
            this.timer.update(deltaTime);
        }
    }
}
exports.LevelPlayerOverScript = LevelPlayerOverScript;
