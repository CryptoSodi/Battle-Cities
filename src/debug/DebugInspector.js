"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugInspector = void 0;
const core_1 = require("../core");
class DebugInspector {
    constructor(canvas) {
        this.click = new core_1.Subject();
        this.handleClick = (event) => {
            const pageScrollPosition = new core_1.Vector(window.pageXOffset, window.pageYOffset);
            const cursorPagePosition = new core_1.Vector(event.pageX, event.pageY);
            const cursorWindowPosition = cursorPagePosition
                .clone()
                .sub(pageScrollPosition);
            const bounds = this.canvas.getBoundingClientRect();
            const x = core_1.NumberUtils.clamp(cursorWindowPosition.x - bounds.left, 0, bounds.width);
            const y = core_1.NumberUtils.clamp(cursorWindowPosition.y - bounds.top, 0, bounds.height);
            const position = new core_1.Vector(x, y);
            this.click.notify(position);
        };
        this.canvas = canvas;
    }
    listen() {
        this.canvas.addEventListener('click', this.handleClick);
    }
}
exports.DebugInspector = DebugInspector;
