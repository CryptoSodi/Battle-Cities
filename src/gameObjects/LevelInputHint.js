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
exports.LevelInputHint = void 0;
const core_1 = require("../core");
const game_1 = require("../game");
const input_1 = require("../input");
const tank_1 = require("../tank");
const config = __importStar(require("../config"));
const text_1 = require("./text");
class LevelInputHint extends core_1.GameObject {
    constructor(bindingType) {
        super(config.CANVAS_WIDTH, 510);
        this.zIndex = 0;
        this.bindingType = bindingType;
    }
    setBindingType(bindingType) {
        this.bindingType = bindingType;
        this.updateText();
    }
    setup(updateArgs) {
        const { inputManager, spriteLoader } = updateArgs;
        this.inputManager = inputManager;
        this.painter = new core_1.RectPainter(config.COLOR_GRAY_LIGHT);
        const tankSpriteId = tank_1.TankSpriteId.create(tank_1.TankType.PlayerA(), tank_1.TankColor.Primary, game_1.Rotation.Up);
        this.tankIcon = new core_1.GameObject(64, 64);
        this.tankIcon.setZIndex(this.zIndex + 1);
        this.tankIcon.origin.setX(0.5);
        this.tankIcon.setCenterX(this.getSelfCenter().x);
        this.tankIcon.position.setY(106);
        this.tankIcon.painter = new core_1.SpritePainter(spriteLoader.load(tankSpriteId));
        this.add(this.tankIcon);
        this.moveUpHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Center,
        });
        this.moveUpHint.setZIndex(this.zIndex + 1);
        this.moveUpHint.origin.setX(0.5);
        this.moveUpHint.setCenterX(this.getSelfCenter().x);
        this.moveUpHint.position.setY(20);
        this.add(this.moveUpHint);
        this.moveDownHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Center,
        });
        this.moveDownHint.setZIndex(this.zIndex + 1);
        this.moveDownHint.origin.setX(0.5);
        this.moveDownHint.setCenterX(this.getSelfCenter().x);
        this.moveDownHint.position.setY(190);
        this.add(this.moveDownHint);
        this.moveLeftHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Right,
        });
        this.moveLeftHint.setZIndex(this.zIndex + 1);
        this.moveLeftHint.origin.setX(1);
        this.moveLeftHint.position.set(460, 125);
        this.add(this.moveLeftHint);
        this.moveRightHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Right,
        });
        this.moveRightHint.setZIndex(this.zIndex + 1);
        this.moveRightHint.position.set(560, 125);
        this.add(this.moveRightHint);
        this.fireHint = new text_1.SpriteText('');
        this.fireHint.setZIndex(this.zIndex + 1);
        this.fireHint.position.set(250, 354);
        this.add(this.fireHint);
        this.rapidFireHint = new text_1.SpriteText('');
        this.rapidFireHint.setZIndex(this.zIndex + 1);
        this.rapidFireHint.position.set(250, 404);
        this.add(this.rapidFireHint);
        this.pauseHint = new text_1.SpriteText('');
        this.pauseHint.setZIndex(this.zIndex + 1);
        this.pauseHint.position.set(250, 454);
        this.add(this.pauseHint);
        this.updateText();
    }
    updateText() {
        const moveUpDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.MoveUp[0]);
        this.moveUpHint.setText(`${moveUpDisplayCode}\n↑`);
        const moveDownDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.MoveDown[0]);
        this.moveDownHint.setText(`↓\n${moveDownDisplayCode}`);
        const moveLeftDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.MoveLeft[0]);
        this.moveLeftHint.setText(`${moveLeftDisplayCode} ←`);
        const moveRightDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.MoveRight[0]);
        this.moveRightHint.setText(`→ ${moveRightDisplayCode}`);
        const fireDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.Fire[0]);
        this.fireHint.setText(`FIRE       - ${fireDisplayCode}`);
        const rapidFireDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.RapidFire[0]);
        this.rapidFireHint.setText(`RAPID FIRE - ${rapidFireDisplayCode}`);
        const pauseDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.LevelPlayInputContext.Pause[0]);
        this.pauseHint.setText(`PAUSE      - ${pauseDisplayCode}`);
    }
}
exports.LevelInputHint = LevelInputHint;
