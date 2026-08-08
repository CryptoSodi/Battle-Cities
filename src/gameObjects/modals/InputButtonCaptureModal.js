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
exports.InputButtonCaptureModal = void 0;
const core_1 = require("../../core");
const gameObjects_1 = require("../../gameObjects");
const config = __importStar(require("../../config"));
class InputButtonCaptureModal extends core_1.GameObject {
    constructor(width, height) {
        super(width, height);
        this.painter = new core_1.RectPainter(config.COLOR_BACKDROP);
        this.zIndex = config.MODAL_Z_INDEX;
        this.container = new core_1.GameObject(512, 256);
        this.text = new gameObjects_1.SpriteText('PRESS ANY KEY', { color: config.COLOR_WHITE });
    }
    setup() {
        this.container.painter = new core_1.RectPainter(config.COLOR_GRAY, config.COLOR_WHITE);
        this.container.updateMatrix();
        this.container.setCenter(this.getSelfCenter());
        this.add(this.container);
        this.text.setCenter(this.getSelfCenter());
        this.text.origin.set(0.5, 0.5);
        this.add(this.text);
    }
}
exports.InputButtonCaptureModal = InputButtonCaptureModal;
