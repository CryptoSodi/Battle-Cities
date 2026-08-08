"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorMenuItem = void 0;
const core_1 = require("../../../core");
const input_1 = require("../../../input");
const config = __importStar(require("../../../config"));
const text_1 = require("../../text");
const MenuItem_1 = require("../MenuItem");
// TODO: calculate dynamically
const ARROW_WIDTH = 28;
const ARROW_OFFSET = 16;
const ITEM_HEIGHT = 28;
const DEFAULT_OPTIONS = {
    color: config.COLOR_WHITE,
    containerWidth: 256,
    itemOriginX: 0.5,
};
class SelectorMenuItem extends MenuItem_1.MenuItem {
    constructor(choices = [], options = {}) {
        super();
        this.changed = new core_1.Subject();
        this.zIndex = 0;
        this.choices = [];
        this.selectedIndex = 0;
        this.items = [];
        this.choices = choices;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    setValue(value) {
        const choiceIndex = this.choices.findIndex((choice) => choice.value === value);
        if (choiceIndex === -1) {
            return;
        }
        this.selectChoice(choiceIndex);
    }
    getValue() {
        const focusedChoice = this.choices[this.selectedIndex];
        if (focusedChoice === undefined) {
            return null;
        }
        const { value } = focusedChoice;
        return value;
    }
    updateFocused(updateArgs) {
        const { inputManager } = updateArgs;
        const inputMethod = inputManager.getActiveMethod();
        if (inputMethod.isDownAny(input_1.MenuInputContext.HorizontalNext)) {
            this.selectNext();
            this.emitChange();
        }
        if (inputMethod.isDownAny(input_1.MenuInputContext.HorizontalPrev)) {
            this.selectPrev();
            this.emitChange();
        }
    }
    setup() {
        this.container = new core_1.GameObject(this.options.containerWidth, ITEM_HEIGHT);
        this.container.position.setX(ARROW_WIDTH + ARROW_OFFSET);
        this.add(this.container);
        this.choices.forEach((choice) => {
            const item = new text_1.SpriteText(choice.text, {
                color: this.options.color,
            });
            item.origin.setX(this.options.itemOriginX);
            item.position.setX(this.options.containerWidth * this.options.itemOriginX);
            item.setZIndex(this.zIndex + 1);
            this.container.add(item);
        });
        this.leftArrow = new text_1.SpriteText('←', { color: this.options.color });
        this.add(this.leftArrow);
        this.rightArrow = new text_1.SpriteText('→', { color: this.options.color });
        this.rightArrow.position.setX(ARROW_WIDTH + ARROW_OFFSET + this.options.containerWidth + ARROW_OFFSET);
        this.add(this.rightArrow);
        this.size.set(this.options.containerWidth + (ARROW_WIDTH + ARROW_OFFSET) * 2, 28);
        this.selectChoice();
    }
    emitChange() {
        const choice = this.choices[this.selectedIndex];
        this.changed.notify(choice);
    }
    selectPrev() {
        let prevIndex = this.selectedIndex - 1;
        if (prevIndex < 0) {
            prevIndex = this.choices.length - 1;
        }
        this.selectChoice(prevIndex);
    }
    selectNext() {
        let nextIndex = this.selectedIndex + 1;
        if (nextIndex > this.choices.length - 1) {
            nextIndex = 0;
        }
        this.selectChoice(nextIndex);
    }
    selectChoice(nextIndex) {
        if (nextIndex === undefined) {
            nextIndex = this.selectedIndex;
        }
        if (this.choices[nextIndex] === undefined) {
            this.selectedIndex = -1;
        }
        else {
            this.selectedIndex = nextIndex;
        }
        if (this.hasBeenSetup()) {
            this.container.dirtyPaintBox();
            this.container.children.forEach((item, index) => {
                if (this.selectedIndex === index) {
                    item.setVisible(true);
                }
                else {
                    item.setVisible(false);
                }
            });
        }
    }
}
exports.SelectorMenuItem = SelectorMenuItem;
