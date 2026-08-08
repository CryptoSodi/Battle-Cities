"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapLoader = void 0;
const core_1 = require("../core");
// Container for map list readers used in the game. Readers can be switched
// in runtime, so maps can be loaded from different sources.
// If user picks default single player, we load maps from manifest over HTTP.
// If user wants custom maps from his file system, we use file reader.
class MapLoader {
    constructor(defaultReader) {
        this.loaded = new core_1.Subject();
        this.error = new core_1.Subject();
        this.activeReader = null;
        this.handleReaderLoaded = (mapConfig) => {
            this.loaded.notify(mapConfig);
        };
        this.handleReaderError = (err) => {
            this.error.notify(err);
        };
        this.defaultReader = defaultReader;
        this.setListReader(defaultReader);
    }
    setListReader(nextReader) {
        // Clean up previous reader
        if (this.activeReader !== null) {
            this.activeReader.loaded.removeListener(this.handleReaderLoaded);
            this.activeReader.error.removeListener(this.handleReaderError);
        }
        this.activeReader = nextReader;
        this.activeReader.loaded.addListener(this.handleReaderLoaded);
        this.activeReader.error.addListener(this.handleReaderError);
    }
    restoreDefaultReader() {
        this.setListReader(this.defaultReader);
    }
    loadAsync(levelNumber) {
        this.activeReader.readAsync(levelNumber);
    }
    getItemsCount() {
        return this.activeReader.getCount();
    }
}
exports.MapLoader = MapLoader;
