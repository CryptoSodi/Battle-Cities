"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuItem = void 0;
const core_1 = require("../../core");
class MenuItem extends core_1.GameObject {
    constructor() {
        super(...arguments);
        this.focused = new core_1.Subject();
        this.unfocused = new core_1.Subject();
        this.selected = new core_1.Subject();
        this.focusable = true;
        this.isFocused = false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateFocused(updateArgs) {
        // Virtual
    }
    setFocusable(focusable) {
        this.focusable = focusable;
        this.setNeedsPaint();
    }
    isFocusable() {
        return this.focusable;
    }
    focus() {
        this.isFocused = true;
        this.focused.notify(null);
    }
    unfocus() {
        this.isFocused = false;
        this.unfocused.notify(null);
    }
    select() {
        this.selected.notify(null);
    }
}
exports.MenuItem = MenuItem;
