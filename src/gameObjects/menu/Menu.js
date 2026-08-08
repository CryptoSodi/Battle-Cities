"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Menu = void 0;
const core_1 = require("../../core");
const input_1 = require("../../input");
const MenuCursor_1 = require("./MenuCursor");
const DEFAULT_OPTIONS = {
    cursorOffsetX: 0,
    cursorSize: 60,
    initialIndex: 0,
    itemHeight: 60,
    itemOffsetX: 96,
    itemOffsetY: 16,
};
class Menu extends core_1.GameObject {
    constructor(options = {}) {
        super();
        this.focused = new core_1.Subject();
        this.selected = new core_1.Subject();
        this.items = [];
        this.cursor = new MenuCursor_1.MenuCursor();
        this.focusedIndex = -1;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.focusedIndex = this.options.initialIndex;
        this.cursor.size.set(this.options.cursorSize, this.options.cursorSize);
        this.cursor.position.setX(this.options.cursorOffsetX);
    }
    setItems(items) {
        this.items = items;
        // TODO: dynamic width and height
        this.size.set(480, items.length * this.options.itemHeight);
        this.updateMatrix();
        this.removeAllChildren();
        this.items.forEach((menuItem, index) => {
            menuItem.position.set(this.options.itemOffsetX, index * this.options.itemHeight + this.options.itemOffsetY);
            this.add(menuItem);
        });
        this.add(this.cursor);
        this.focusItem(0);
    }
    hideCursor() {
        this.cursor.setVisible(false);
    }
    showCursor() {
        // Reset to default so it could be overriden by parent visibility
        this.cursor.setVisible(null);
    }
    reset() {
        this.focusItem(0);
    }
    selectItemAtPoint(point) {
        const itemIndex = this.items.findIndex((item) => item.getWorldBoundingBox().containsPoint(point));
        if (itemIndex < 0 ||
            itemIndex >= this.items.length ||
            !this.items[itemIndex].isFocusable()) {
            return false;
        }
        this.focusItem(itemIndex);
        this.notifyItemSelected();
        return true;
    }
    update(updateArgs) {
        const { inputManager } = updateArgs;
        if (updateArgs.pointerClick !== null) {
            const wasItemSelected = this.selectItemAtPoint(updateArgs.pointerClick);
            if (wasItemSelected) {
                updateArgs.pointerClick = null;
                return;
            }
        }
        const inputMethod = inputManager.getActiveMethod();
        if (inputMethod.isDownAny(input_1.MenuInputContext.VerticalPrev)) {
            this.focusPrev();
        }
        if (inputMethod.isDownAny(input_1.MenuInputContext.VerticalNext)) {
            this.focusNext();
        }
        if (inputMethod.isDownAny(input_1.MenuInputContext.Select)) {
            this.notifyItemSelected();
        }
        this.items.forEach((menuItem, index) => {
            if (index === this.focusedIndex) {
                menuItem.updateFocused(updateArgs);
            }
        });
    }
    focusItem(index) {
        const prevFocusedItem = this.items[this.focusedIndex];
        if (prevFocusedItem !== undefined) {
            prevFocusedItem.unfocus();
        }
        if (index === -1) {
            this.focusedIndex = -1;
            this.hideCursor();
            return;
        }
        this.focusedIndex = index;
        this.showCursor();
        this.cursor.dirtyPaintBox();
        const focusedItem = this.items[this.focusedIndex];
        this.cursor.position.setY(focusedItem.position.y +
            focusedItem.size.height / 2 -
            this.cursor.size.height / 2);
        this.cursor.updateMatrix(true);
        // Re-sync render-interpolation history right after this teleport. The
        // cursor jumps whole rows in a single tick (unlike gameplay objects,
        // which move in small continuous steps), and extrapolation (see
        // Transform.interpApply) treats any jump as "last tick's velocity" and
        // projects further along it -- without this, the cursor visibly
        // overshoots past the new row for a couple of frames before settling.
        this.cursor.interpCapture();
        this.focused.notify(this.focusedIndex);
        focusedItem.focus();
    }
    notifyItemSelected() {
        if (this.focusedIndex === -1) {
            return;
        }
        const focusedItem = this.items[this.focusedIndex];
        focusedItem.select();
        this.selected.notify(this.focusedIndex);
    }
    focusPrev() {
        const prevIndex = this.getPrevFocusableIndex();
        this.focusItem(prevIndex);
    }
    focusNext() {
        const nextIndex = this.getNextFocusableIndex();
        this.focusItem(nextIndex);
    }
    getPrevFocusableIndex() {
        if (!this.hasFocusableItems()) {
            return -1;
        }
        let prevIndex = this.focusedIndex;
        let prevItem = null;
        do {
            prevIndex -= 1;
            if (prevIndex < 0) {
                prevIndex = this.items.length - 1;
            }
            prevItem = this.items[prevIndex];
        } while (prevItem.isFocusable() === false);
        return prevIndex;
    }
    getNextFocusableIndex() {
        if (!this.hasFocusableItems()) {
            return -1;
        }
        let nextIndex = this.focusedIndex;
        let nextItem = null;
        do {
            nextIndex += 1;
            if (nextIndex > this.items.length - 1) {
                nextIndex = 0;
            }
            nextItem = this.items[nextIndex];
        } while (nextItem.isFocusable() === false);
        return nextIndex;
    }
    hasFocusableItems() {
        return this.items.some((item) => item.isFocusable());
    }
}
exports.Menu = Menu;
