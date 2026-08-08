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
exports.DebugMenu = void 0;
const config = __importStar(require("../config"));
const DEFAULT_OPTIONS = {
    top: 0,
    left: null,
    right: 0,
};
class DebugMenu {
    constructor(titleText = 'Untitled', options = {}) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.container = document.createElement('div');
        this.container.setAttribute('style', `background: white;
      color: black;
      position: absolute;
      left: ${this.getOffsetStyle(this.options.left)};
      right: ${this.getOffsetStyle(this.options.right)};
      top: ${this.getOffsetStyle(this.options.top)};
      padding: 10px;
      display: flex;
      flex-direction: column`);
        const title = document.createElement('div');
        title.textContent = titleText;
        this.container.appendChild(title);
    }
    attach() {
        if (config.IS_PROD) {
            return;
        }
        document.body.appendChild(this.container);
    }
    detach() {
        document.body.removeChild(this.container);
    }
    appendButton(text, handler) {
        const button = this.createButton(text, handler);
        this.container.appendChild(button);
        return button;
    }
    createButton(text, handler) {
        const button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', handler);
        return button;
    }
    getOffsetStyle(value) {
        if (value === null) {
            return 'initial';
        }
        return `${value}px`;
    }
}
exports.DebugMenu = DebugMenu;
