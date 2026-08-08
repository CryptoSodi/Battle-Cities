"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InverseBrickTerrainTile = void 0;
const BrickTerrainTile_1 = require("./BrickTerrainTile");
class InverseBrickTerrainTile extends BrickTerrainTile_1.BrickTerrainTile {
    getSpriteIds() {
        return ['terrain.inverse-brick.1', 'terrain.inverse-brick.2'];
    }
}
exports.InverseBrickTerrainTile = InverseBrickTerrainTile;
