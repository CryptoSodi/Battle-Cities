"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankColorFactory = void 0;
const TankColor_1 = require("./TankColor");
const COLORS = [TankColor_1.TankColor.Primary, TankColor_1.TankColor.Secondary];
class TankColorFactory {
    static createPlayerColor(playerIndex) {
        return COLORS[playerIndex];
    }
}
exports.TankColorFactory = TankColorFactory;
