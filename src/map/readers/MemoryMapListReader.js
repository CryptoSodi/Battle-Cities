"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMapListReader = void 0;
const MapListReader_1 = require("../MapListReader");
// Use to load maps from in-memory map configs.
// Used in editor to playtest the map.
class MemoryMapListReader extends MapListReader_1.MapListReader {
    constructor(mapConfigs) {
        super();
        this.mapConfigs = mapConfigs;
    }
    readAsync(levelNumber) {
        const index = levelNumber - 1;
        const mapConfig = this.mapConfigs[index];
        if (mapConfig === undefined) {
            this.error.notify(new Error(`Level "${levelNumber} not found`));
            return;
        }
        this.loaded.notify(mapConfig);
    }
    getCount() {
        return this.mapConfigs.length;
    }
}
exports.MemoryMapListReader = MemoryMapListReader;
