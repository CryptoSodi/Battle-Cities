"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Size = void 0;
const Vector_1 = require("./Vector");
class Size {
    constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
    }
    set(width, height) {
        this.width = width;
        this.height = height;
        return this;
    }
    setWidth(width) {
        this.width = width;
        return this;
    }
    setHeight(height) {
        this.height = height;
        return this;
    }
    copyFrom(size) {
        this.width = size.width;
        this.height = size.height;
        return this;
    }
    flip() {
        const tmp = this.width;
        this.width = this.height;
        this.height = tmp;
        return this;
    }
    clone() {
        return new Size(this.width, this.height);
    }
    toVector() {
        return new Vector_1.Vector(this.width, this.height);
    }
}
exports.Size = Size;
