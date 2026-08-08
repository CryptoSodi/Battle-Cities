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
exports.SceneInputHint = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
const SpriteText_1 = require("./SpriteText");
const BLINK_DELAY = 0.4;
class SceneInputHint extends SpriteText_1.SpriteText {
    constructor(text) {
        super(text, {
            color: config.COLOR_BLACK,
            opacity: 0.1,
        });
        this.zIndex = config.LEVEL_TITLE_Z_INDEX;
        this.blinkTimer = new core_1.Timer();
        this.origin.set(0.5, 0.5);
        this.updateMatrix();
        this.setCenterX(config.CANVAS_WIDTH / 2);
        this.position.setY(840);
    }
    update({ deltaTime }) {
        this.blinkTimer.update(deltaTime);
        if (this.blinkTimer.isDone()) {
            this.dirtyPaintBox();
            this.setVisible(!this.getVisible());
            this.blinkTimer.reset(BLINK_DELAY);
        }
    }
}
exports.SceneInputHint = SceneInputHint;
