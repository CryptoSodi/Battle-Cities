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
exports.AlertModal = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const config = __importStar(require("../../config"));
const DEFAULT_OPTIONS = {
    containerWidth: 512,
    containerHeight: 200,
    message: '',
    acceptText: 'OK',
};
class AlertModal extends core_1.GameObject {
    constructor(options = {}) {
        super();
        this.painter = new core_1.RectPainter(config.COLOR_BACKDROP);
        this.accepted = new core_1.Subject();
        this.zIndex = config.MODAL_Z_INDEX;
        this.text = null;
        this.handleAcceptSelected = () => {
            this.accepted.notify(null);
        };
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    setup() {
        this.container = new core_1.GameObject(this.options.containerWidth, this.options.containerHeight);
        this.container.painter = new core_1.RectPainter(config.COLOR_GRAY, config.COLOR_WHITE);
        this.container.updateMatrix();
        this.container.setCenter(this.getSelfCenter());
        this.add(this.container);
        this.text = new gameObjects_1.SpriteText(this.options.message, {
            color: config.COLOR_WHITE,
        });
        this.text.setCenterX(this.container.getSelfCenter().x);
        this.text.origin.setX(0.5);
        this.text.position.setY(16);
        this.container.add(this.text);
        this.acceptItem = new gameObjects_1.TextMenuItem(this.options.acceptText);
        this.acceptItem.selected.addListener(this.handleAcceptSelected);
        const menuItems = [this.acceptItem];
        this.menu = new gameObjects_1.Menu();
        this.menu.setZIndex(this.zIndex + 1);
        this.menu.position.set(16, 128);
        this.menu.setItems(menuItems);
        this.container.add(this.menu);
    }
    setText(message) {
        // Setup has not been called yet
        if (this.text === null) {
            this.options.message = message;
            return;
        }
        this.text.setText(message);
    }
}
exports.AlertModal = AlertModal;
