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
exports.LevelIntroScript = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
class LevelIntroScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.completed = new core_1.Subject();
        this.handleTimer = () => {
            this.curtain.open();
            this.title.setVisible(false);
            this.completed.notify(null);
        };
    }
    setup() {
        this.timer = new core_1.Timer(config.LEVEL_START_DELAY);
        this.timer.done.addListener(this.handleTimer);
        // TODO: add them last order is important
        // TODO: curtain is displayed on top of scenes? (transition between levels)
        this.curtain = new gameObjects_1.Curtain(this.world.sceneRoot.size.width, this.world.sceneRoot.size.height, false);
        this.world.sceneRoot.add(this.curtain);
        this.title = new gameObjects_1.LevelTitle(this.session.getLevelNumber(), this.session.isPlaytest());
        this.title.setCenter(this.world.sceneRoot.getSelfCenter());
        this.title.origin.set(0.5, 0.5);
        this.world.sceneRoot.add(this.title);
    }
    update(updateArgs) {
        if (updateArgs.webRtcMatch.isWaitingForPeer()) {
            return;
        }
        this.timer.update(updateArgs.deltaTime);
    }
}
exports.LevelIntroScript = LevelIntroScript;
