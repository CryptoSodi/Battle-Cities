"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManifestMapListReader = void 0;
const MapConfig_1 = require("../MapConfig");
const MapListReader_1 = require("../MapListReader");
// Used to load out-of-the-box maps.
// Reads map list from JSON manifest. Maps are loaded over HTTP.
class ManifestMapListReader extends MapListReader_1.MapListReader {
    constructor(manifest) {
        super();
        this.manifest = manifest;
    }
    async readAsync(levelNumber) {
        const index = levelNumber - 1;
        const item = this.manifest.list[index];
        if (item === undefined) {
            this.error.notify(new Error(`Level "${levelNumber} not found`));
            return;
        }
        try {
            const response = await fetch(item.file);
            const data = await response.json();
            const config = new MapConfig_1.MapConfig();
            config.fromDto(data);
            this.loaded.notify(config);
        }
        catch (err) {
            this.error.notify(err);
        }
    }
    getCount() {
        return this.manifest.list.length;
    }
}
exports.ManifestMapListReader = ManifestMapListReader;
