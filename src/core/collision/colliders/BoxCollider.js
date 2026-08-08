"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoxCollider = void 0;
const Vector_1 = require("../../Vector");
const Collider_1 = require("../Collider");
class BoxCollider extends Collider_1.Collider {
    init() {
        const box = this.object.getWorldBoundingBox();
        this.prevBox = box.clone();
        this.currentBox = box.clone();
    }
    update() {
        const box = this.object.getWorldBoundingBox();
        this.prevBox = this.currentBox;
        this.currentBox = box.clone();
    }
    getBox() {
        return this.currentBox;
    }
    getPrevBox() {
        return this.prevBox;
    }
    getCurrentBox() {
        return this.currentBox;
    }
    getDirection() {
        const prevCenter = this.prevBox.getCenter();
        const currentCenter = this.currentBox.getCenter();
        const dx = currentCenter.x - prevCenter.x;
        const dy = currentCenter.y - prevCenter.y;
        const direction = new Vector_1.Vector(dx, dy);
        return direction;
    }
}
exports.BoxCollider = BoxCollider;
