"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteMenuItem = void 0;
const core_1 = require("../../../core");
const MenuItem_1 = require("../MenuItem");
class SpriteMenuItem extends MenuItem_1.MenuItem {
    constructor(sprite, width, height) {
        super();
        this.size.set(width, height);
        this.painter = new core_1.SpritePainter(sprite, core_1.SpriteAlignment.Stretch);
    }
}
exports.SpriteMenuItem = SpriteMenuItem;
