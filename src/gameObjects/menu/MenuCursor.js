"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuCursor = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const tank_1 = require("../../tank");
class MenuCursor extends core_1.GameObject {
    constructor() {
        super(60, 60);
        this.painter = new core_1.SpritePainter();
        this.painter.alignment = core_1.SpriteAlignment.AspectFit;
    }
    setup({ spriteLoader }) {
        this.animation = new tank_1.TankMoveAnimation(spriteLoader, tank_1.TankType.PlayerA(), [tank_1.TankColor.Primary], game_1.Rotation.Right);
        this.updateSprite();
    }
    update(updateArgs) {
        this.animation.update(updateArgs.deltaTime);
        this.updateSprite();
        this.setNeedsPaint();
    }
    updateSprite() {
        const frame = this.animation.getCurrentFrame();
        const sprite = frame.getSprite(0);
        this.painter.sprite = sprite;
    }
}
exports.MenuCursor = MenuCursor;
