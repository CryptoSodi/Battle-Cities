"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerrainTile = void 0;
const core_1 = require("../core");
class TerrainTile extends core_1.GameObject {
    constructor() {
        super(...arguments);
        this.destroyed = new core_1.Subject();
    }
    destroy(notify = true) {
        this.removeSelf();
        if (notify) {
            this.destroyed.notify({
                centerPosition: this.getCenter(),
            });
        }
    }
}
exports.TerrainTile = TerrainTile;
