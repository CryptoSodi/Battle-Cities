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
exports.LevelMinimapScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
// Fixed top-right HUD minimap. Lives on the scene root (not the scrolling
// field), reading live positions each paint. Purely presentational.
const MINIMAP_WIDTH = 132;
const MARGIN = 6;
class LevelMinimapScript extends LevelScript_1.LevelScript {
    setup() {
        const { field } = this.world;
        const fieldWidth = field.size.width;
        const fieldHeight = field.size.height;
        const width = MINIMAP_WIDTH;
        const height = Math.round(width * (fieldHeight / fieldWidth));
        this.minimap = new gameObjects_1.Minimap(field, fieldWidth, fieldHeight, width, height);
        // Hug the top-right corner of the canvas, just below the info bar.
        const x = config.CANVAS_WIDTH - width - MARGIN;
        const y = config.LEVEL_PLAY_TOP_OFFSET + MARGIN;
        this.minimap.position.set(x, y);
        this.world.sceneRoot.add(this.minimap);
    }
}
exports.LevelMinimapScript = LevelMinimapScript;
