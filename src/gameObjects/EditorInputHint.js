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
exports.EditorInputHint = void 0;
const core_1 = require("../core");
const input_1 = require("../input");
const terrain_1 = require("../terrain");
const config = __importStar(require("../config"));
const editor_1 = require("./editor");
const text_1 = require("./text");
class EditorInputHint extends core_1.GameObject {
    constructor(bindingType) {
        super(config.CANVAS_WIDTH, 570);
        this.zIndex = 0;
        this.bindingType = bindingType;
    }
    setVariantType(bindingType) {
        this.bindingType = bindingType;
        this.updateText();
    }
    setup(updateArgs) {
        const { inputManager } = updateArgs;
        this.inputManager = inputManager;
        this.painter = new core_1.RectPainter(config.COLOR_GRAY_LIGHT);
        this.brushIcon = new editor_1.EditorBrush(64, 64, terrain_1.TerrainType.Brick);
        this.brushIcon.origin.setX(0.5);
        this.brushIcon.setCenterX(this.getSelfCenter().x);
        this.brushIcon.position.setY(106);
        this.add(this.brushIcon);
        this.moveUpHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Center,
        });
        this.moveUpHint.origin.setX(0.5);
        this.moveUpHint.setCenterX(this.getSelfCenter().x);
        this.moveUpHint.position.setY(20);
        this.add(this.moveUpHint);
        this.moveDownHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Center,
        });
        this.moveDownHint.origin.setX(0.5);
        this.moveDownHint.setCenterX(this.getSelfCenter().x);
        this.moveDownHint.position.setY(190);
        this.add(this.moveDownHint);
        this.moveLeftHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Right,
        });
        this.moveLeftHint.origin.setX(1);
        this.moveLeftHint.position.set(460, 125);
        this.add(this.moveLeftHint);
        this.moveRightHint = new text_1.SpriteText('', {
            alignment: core_1.TextAlignment.Right,
        });
        this.moveRightHint.position.set(560, 125);
        this.add(this.moveRightHint);
        this.drawHint = new text_1.SpriteText();
        this.drawHint.position.set(270, 320);
        this.add(this.drawHint);
        this.eraseHint = new text_1.SpriteText();
        this.eraseHint.position.set(270, 370);
        this.add(this.eraseHint);
        this.nextBrushHint = new text_1.SpriteText();
        this.nextBrushHint.position.set(270, 420);
        this.add(this.nextBrushHint);
        this.prevBrushHint = new text_1.SpriteText();
        this.prevBrushHint.position.set(270, 470);
        this.add(this.prevBrushHint);
        this.backHint = new text_1.SpriteText();
        this.backHint.position.set(270, 520);
        this.add(this.backHint);
        this.updateText();
    }
    updateText() {
        const moveUpDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.MoveUp[0]);
        this.moveUpHint.setText(`${moveUpDisplayCode}\n↑`);
        const moveDownDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.MoveDown[0]);
        this.moveDownHint.setText(`↓\n${moveDownDisplayCode}`);
        const moveLeftDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.MoveLeft[0]);
        this.moveLeftHint.setText(`${moveLeftDisplayCode} ←`);
        const moveRightDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.MoveRight[0]);
        this.moveRightHint.setText(`→ ${moveRightDisplayCode}`);
        const drawDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.Draw[0]);
        this.drawHint.setText(`DRAW       - ${drawDisplayCode}`);
        const eraseDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.Erase[0]);
        this.eraseHint.setText(`ERASE      - ${eraseDisplayCode}`);
        const nextBrushDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.NextBrush[0]);
        this.nextBrushHint.setText(`NEXT BRUSH - ${nextBrushDisplayCode}`);
        const prevBrushDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.PrevBrush[0]);
        this.prevBrushHint.setText(`PREV BRUSH - ${prevBrushDisplayCode}`);
        const backDisplayCode = this.inputManager.getDisplayedControlCode(this.bindingType, input_1.EditorMapInputContext.Menu[0]);
        this.backHint.setText(`MENU       - ${backDisplayCode}`);
    }
}
exports.EditorInputHint = EditorInputHint;
