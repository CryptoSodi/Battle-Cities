"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueBrickTerrainTile = void 0;
const BrickTerrainTile_1 = require("./BrickTerrainTile");
class BlueBrickTerrainTile extends BrickTerrainTile_1.BrickTerrainTile {
    getSpriteIds() {
        return ['terrain.blue-brick.1', 'terrain.blue-brick.2'];
    }
}
exports.BlueBrickTerrainTile = BlueBrickTerrainTile;
