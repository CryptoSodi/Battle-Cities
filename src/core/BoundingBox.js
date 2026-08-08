"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundingBox = void 0;
const Rect_1 = require("./Rect");
const Size_1 = require("./Size");
const Vector_1 = require("./Vector");
/**
 * Axis-aligned boudning box (AABB)
 */
class BoundingBox {
    constructor(min = new Vector_1.Vector(), max = new Vector_1.Vector()) {
        this.min = min;
        this.max = max;
    }
    getCenter() {
        return this.min
            .clone()
            .add(this.max)
            .divideScalar(2);
    }
    getSize() {
        const width = this.max.x - this.min.x;
        const height = this.max.y - this.min.y;
        const size = new Size_1.Size(width, height);
        return size;
    }
    round() {
        this.min.round();
        this.max.round();
        return this;
    }
    equals(other) {
        return this.min.equals(other.min) && this.max.equals(other.max);
    }
    distanceCenterToCenter(other) {
        return this.getCenter().distanceTo(other.getCenter());
    }
    minkowskiSum(other) {
        const otherWidth = other.max.x - other.min.x;
        const otherHeight = other.max.y - other.min.y;
        const minX = this.min.x - otherWidth / 2;
        const maxX = this.max.x + otherWidth / 2;
        const minY = this.min.y - otherHeight / 2;
        const maxY = this.max.y + otherHeight / 2;
        this.min.set(minX, minY);
        this.max.set(maxX, maxY);
        return this;
    }
    intersectWith(other) {
        const minX = Math.max(this.min.x, other.min.x);
        const maxX = Math.min(this.max.x, other.max.x);
        const minY = Math.max(this.min.y, other.min.y);
        const maxY = Math.min(this.max.y, other.max.y);
        this.min.set(minX, minY);
        this.max.set(maxX, maxY);
        return this;
    }
    unionWith(...others) {
        const boxes = [this, ...others];
        let minX = null;
        let maxX = null;
        let minY = null;
        let maxY = null;
        for (const box of boxes) {
            if (minX === null || box.min.x < minX) {
                minX = box.min.x;
            }
            if (maxX === null || box.max.x > maxX) {
                maxX = box.max.x;
            }
            if (minY === null || box.min.y < minY) {
                minY = box.min.y;
            }
            if (maxY === null || box.max.y > maxY) {
                maxY = box.max.y;
            }
        }
        this.min.set(minX, minY);
        this.max.set(maxX, maxY);
        return this;
    }
    intersectsBox(other) {
        return (this.min.x < other.max.x &&
            this.max.x > other.min.x &&
            this.min.y < other.max.y &&
            this.max.y > other.min.y);
    }
    containsPoint(p) {
        const isOutside = this.max.x <= p.x ||
            this.min.x >= p.x ||
            this.max.y <= p.y ||
            this.min.y >= p.y;
        return !isOutside;
    }
    clone() {
        return new BoundingBox(this.min.clone(), this.max.clone());
    }
    toRect() {
        return new Rect_1.Rect(this.min.x, this.min.y, this.max.x - this.min.x, this.max.y - this.min.y);
    }
    fromPoints(points) {
        if (points.length === 0) {
            return this;
        }
        this.min.copyFrom(points[0]);
        this.max.copyFrom(points[0]);
        for (const point of points) {
            if (point.x < this.min.x) {
                this.min.x = point.x;
            }
            if (point.x > this.max.x) {
                this.max.x = point.x;
            }
            if (point.y < this.min.y) {
                this.min.y = point.y;
            }
            if (point.y > this.max.y) {
                this.max.y = point.y;
            }
        }
        return this;
    }
}
exports.BoundingBox = BoundingBox;
