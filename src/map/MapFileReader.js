"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapFileReader = void 0;
const core_1 = require("../core");
const MapConfig_1 = require("./MapConfig");
class MapFileReader extends core_1.TextFileReader {
    onLoad(ev) {
        const json = ev.target.result;
        const mapConfig = new MapConfig_1.MapConfig();
        try {
            mapConfig.fromJSON(json);
            this.loaded.notify(mapConfig);
        }
        catch (err) {
            this.throwError(err);
        }
    }
}
exports.MapFileReader = MapFileReader;
