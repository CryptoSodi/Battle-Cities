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
exports.EditorEnemyPreview = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const tank_1 = require("../../tank");
const config = __importStar(require("../../config"));
class EditorEnemyPreview extends core_1.GameObject {
    constructor(types = []) {
        super(96, 96);
        this.painter = new core_1.RectPainter(null, config.COLOR_WHITE);
        this.animations = [];
        this.selectedIndex = -1;
        this.types = types;
    }
    show(typeToShow) {
        const index = this.types.findIndex((type) => type.equals(typeToShow));
        this.selectedIndex = index;
        if (this.selectedIndex === -1) {
            this.setVisible(false);
        }
        else {
            this.setVisible(true);
        }
        this.setNeedsPaint();
    }
    setup({ spriteLoader }) {
        this.container = new core_1.GameObject(64, 64);
        this.container.updateMatrix();
        this.container.setCenter(this.getSelfCenter());
        this.container.painter = new core_1.SpritePainter();
        this.add(this.container);
        this.animations = this.types.map((type) => {
            return new tank_1.TankIdleAnimation(spriteLoader, type, [tank_1.TankColor.Default], game_1.Rotation.Up);
        });
    }
    update({ deltaTime }) {
        const animation = this.animations[this.selectedIndex];
        if (animation === undefined) {
            return;
        }
        animation.update(deltaTime);
        const frame = animation.getCurrentFrame();
        const sprite = frame.getSprite(0);
        const painter = this.container.painter;
        painter.sprite = sprite;
        this.setNeedsPaint();
    }
}
exports.EditorEnemyPreview = EditorEnemyPreview;
