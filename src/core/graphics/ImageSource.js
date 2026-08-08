"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSource = void 0;
const Subject_1 = require("../Subject");
class ImageSource {
    constructor() {
        this.loaded = new Subject_1.Subject();
    }
}
exports.ImageSource = ImageSource;
