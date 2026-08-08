"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextFileReader = void 0;
const Logger_1 = require("../Logger");
const Subject_1 = require("../Subject");
class TextFileReader {
    constructor() {
        this.loaded = new Subject_1.Subject();
        this.error = new Subject_1.Subject();
        this.log = new Logger_1.Logger(TextFileReader.name);
        this.handleLoad = (ev) => {
            this.onLoad(ev);
        };
        this.handleError = () => {
            this.throwError(new Error('Failed to read'));
        };
    }
    read(file) {
        const fileReader = new globalThis.FileReader();
        fileReader.addEventListener('load', this.handleLoad);
        fileReader.addEventListener('error', this.handleError);
        fileReader.readAsText(file);
    }
    onLoad(ev) {
        const text = ev.target.result;
        this.loaded.notify(text);
    }
    throwError(err) {
        this.log.error('Error:', err);
        this.error.notify(err);
    }
}
exports.TextFileReader = TextFileReader;
