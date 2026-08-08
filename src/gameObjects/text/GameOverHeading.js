"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameOverHeading = void 0;
const terrain_1 = require("../../terrain");
const TerrainText_1 = require("./TerrainText");
class GameOverHeading extends TerrainText_1.TerrainText {
    constructor() {
        super('GAME\nOVER', terrain_1.TerrainType.Brick, {
            lineSpacing: 6,
        });
    }
}
exports.GameOverHeading = GameOverHeading;
