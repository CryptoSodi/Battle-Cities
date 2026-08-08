"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankSpriteId = void 0;
const Rotation_1 = require("../game/Rotation");
const SPRITE_TANK_PREFIX = 'tank';
const SPRITE_ID_SEPARATOR = '.';
class TankSpriteId {
    static create(type, color, rotation, frameNumber = 1) {
        const parts = [
            SPRITE_TANK_PREFIX,
            type.party.toString(),
            color.toString(),
            type.tier.toString(),
            this.getRotationString(rotation),
            frameNumber.toString(),
        ];
        const spriteId = parts.join(SPRITE_ID_SEPARATOR);
        return spriteId;
    }
    static getRotationString(rotation) {
        switch (rotation) {
            case Rotation_1.Rotation.Up:
                return 'up';
            case Rotation_1.Rotation.Down:
                return 'down';
            case Rotation_1.Rotation.Left:
                return 'left';
            case Rotation_1.Rotation.Right:
                return 'right';
            default:
                return 'unknown';
        }
    }
}
exports.TankSpriteId = TankSpriteId;
