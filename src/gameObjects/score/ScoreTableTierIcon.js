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
exports.ScoreTableTierIcon = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const tank_1 = require("../../tank");
const config = __importStar(require("../../config"));
const text_1 = require("../text");
class ScoreTableTierIcon extends core_1.GameObject {
    constructor(tier, showRight = false) {
        super(128, 64);
        this.leftIcon = new text_1.SpriteText('←', {
            color: config.COLOR_WHITE,
        });
        this.rightIcon = new text_1.SpriteText('→', {
            color: config.COLOR_WHITE,
        });
        this.tank = new core_1.GameObject(64, 64);
        this.tier = tier;
        this.showRight = showRight;
    }
    setup({ spriteLoader }) {
        const type = new tank_1.TankType(tank_1.TankParty.Enemy, this.tier);
        const spriteId = tank_1.TankSpriteId.create(type, tank_1.TankColor.Default, game_1.Rotation.Up);
        const sprite = spriteLoader.load(spriteId);
        const painter = new core_1.SpritePainter();
        painter.sprite = sprite;
        this.tank.painter = painter;
        this.tank.updateMatrix();
        this.tank.setCenter(this.getSelfCenter());
        this.add(this.tank);
        this.leftIcon.position.setY(16);
        this.add(this.leftIcon);
        if (this.showRight) {
            this.rightIcon.position.set(100, 16);
            this.add(this.rightIcon);
        }
    }
}
exports.ScoreTableTierIcon = ScoreTableTierIcon;
