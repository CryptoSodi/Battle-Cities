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
exports.ScoreTableCounter = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
const text_1 = require("../text");
var State;
(function (State) {
    State[State["Idle"] = 0] = "Idle";
    State[State["Progress"] = 1] = "Progress";
    State[State["Done"] = 2] = "Done";
})(State || (State = {}));
const INCREMENT_DELAY = 0.135;
class ScoreTableCounter extends core_1.GameObject {
    constructor(targetKills, killCost, showAtRight = false) {
        super(344, 28);
        this.pointsLabel = new text_1.SpriteText('PTS', { color: config.COLOR_WHITE });
        this.pointsText = new text_1.SpriteText('', { color: config.COLOR_WHITE });
        this.killsText = new text_1.SpriteText('', { color: config.COLOR_WHITE });
        this.timer = new core_1.Timer();
        this.state = State.Idle;
        this.currentKills = 0;
        this.targetKills = 0;
        this.killCost = 0;
        this.targetKills = targetKills;
        this.killCost = killCost;
        this.showAtRight = showAtRight;
    }
    setup({ audioLoader }) {
        this.incrementSound = audioLoader.load('score');
        this.pointsLabel.position.setX(160);
        if (this.showAtRight) {
            this.pointsLabel.position.setX(252);
        }
        this.add(this.pointsLabel);
        this.pointsText.origin.setX(1);
        this.pointsText.position.setX(124);
        if (this.showAtRight) {
            this.pointsText.position.setX(216);
        }
        this.add(this.pointsText);
        this.killsText.position.setX(this.size.width);
        if (this.showAtRight) {
            this.killsText.position.setX(54);
        }
        this.killsText.origin.setX(1);
        this.add(this.killsText);
    }
    update(updateArgs) {
        if (this.state !== State.Progress) {
            return;
        }
        if (this.timer.isDone()) {
            this.updateText();
            this.incrementSound.play();
            this.currentKills += 1;
            this.setNeedsPaint();
            if (this.currentKills > this.targetKills) {
                this.state = State.Done;
                return;
            }
            this.timer.reset(INCREMENT_DELAY);
        }
        this.timer.update(updateArgs.deltaTime);
    }
    start() {
        if (this.state !== State.Idle) {
            return;
        }
        if (this.currentKills === this.targetKills) {
            this.updateText();
            this.state = State.Done;
            return;
        }
        this.state = State.Progress;
        this.timer.reset(INCREMENT_DELAY);
    }
    skip() {
        if (this.state === State.Done) {
            return;
        }
        this.currentKills = this.targetKills;
        this.updateText();
        this.state = State.Done;
    }
    updateText() {
        const points = this.currentKills * this.killCost;
        this.pointsText.setText(points.toString());
        this.killsText.setText(this.currentKills.toString());
    }
    isIdle() {
        return this.state === State.Idle;
    }
    isProgress() {
        return this.state === State.Progress;
    }
    isDone() {
        return this.state === State.Done;
    }
}
exports.ScoreTableCounter = ScoreTableCounter;
