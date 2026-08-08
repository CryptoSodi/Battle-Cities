"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rect = void 0;
const Vector_1 = require("./Vector");
class Rect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    setWidth(width) {
        this.width = width;
        return this;
    }
    setHeight(height) {
        this.height = height;
        return this;
    }
    getCenter() {
        return new Vector_1.Vector(this.x + this.width / 2, this.y + this.height / 2);
    }
    intersectsRect(other) {
        return (this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y);
    }
    clone() {
        return new Rect(this.x, this.y, this.width, this.height);
    }
    toString() {
        return `[x: ${this.x}, y: ${this.y}, width: ${this.width}, height: ${this.height}]`;
    }
}
exports.Rect = Rect;
