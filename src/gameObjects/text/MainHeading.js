"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainHeading = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const TerrainText_1 = require("./TerrainText");
class MainHeading extends TerrainText_1.TerrainText {
    constructor() {
        super('BATTLE\nCITIES', terrain_1.TerrainType.MenuBrick, {
            alignment: core_1.TextAlignment.Center,
            lineSpacing: 3,
        }, true);
    }
}
exports.MainHeading = MainHeading;
