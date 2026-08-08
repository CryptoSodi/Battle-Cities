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
exports.Shield = void 0;
const core_1 = require("../core");
const GameState_1 = require("../game/GameState");
const config = __importStar(require("../config"));
class Shield extends core_1.GameObject {
    constructor() {
        super(64, 64);
        this.ignorePause = true;
        this.zIndex = config.SHIELD_Z_INDEX;
        this.painter = new core_1.SpritePainter();
    }
    setup({ spriteLoader }) {
        this.animation = new core_1.Animation(spriteLoader.loadList(['shield.1', 'shield.2']), { delay: 0.05, loop: true });
    }
    update({ deltaTime, gameState }) {
        // Shield is not displayed during a pause
        if (gameState.hasChangedTo(GameState_1.GameState.Paused)) {
            this.setVisible(false);
        }
        if (gameState.hasChangedTo(GameState_1.GameState.Playing)) {
            this.setVisible(true);
        }
        if (gameState.is(GameState_1.GameState.Paused)) {
            return;
        }
        this.animation.update(deltaTime);
        this.painter.sprite = this.animation.getCurrentFrame();
        this.setNeedsPaint();
    }
}
exports.Shield = Shield;
