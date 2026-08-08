"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapListReader = void 0;
const core_1 = require("../core");
class MapListReader {
    constructor() {
        this.loaded = new core_1.Subject();
        this.error = new core_1.Subject();
    }
}
exports.MapListReader = MapListReader;
