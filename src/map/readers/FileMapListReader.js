"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMapListReader = void 0;
const MapFileReader_1 = require("../MapFileReader");
const MapListReader_1 = require("../MapListReader");
// Used to load user maps from files system via browser file dialog.
// Use in combination with core/FileOpener.
class FileMapListReader extends MapListReader_1.MapListReader {
    constructor(files) {
        super();
        const fileList = Array.from(files);
        // Sort by filename alphabetically
        fileList.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        this.files = fileList;
    }
    async readAsync(levelNumber) {
        const index = levelNumber - 1;
        const file = this.files[index];
        if (file === undefined) {
            this.error.notify(new Error(`Level "${levelNumber} not found`));
            return;
        }
        const fileReader = new MapFileReader_1.MapFileReader();
        fileReader.loaded.addListenerOnce((mapConfig) => {
            this.loaded.notify(mapConfig);
        });
        fileReader.error.addListenerOnce((err) => {
            this.error.notify(err);
        });
        fileReader.read(file);
    }
    getCount() {
        return this.files.length;
    }
}
exports.FileMapListReader = FileMapListReader;
