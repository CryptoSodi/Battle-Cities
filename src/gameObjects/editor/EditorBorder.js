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
exports.EditorBorder = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const config = __importStar(require("../../config"));
const BorderWall_1 = require("../BorderWall");
class EditorBorder extends core_1.GameObject {
    constructor(fieldWidth, fieldHeight) {
        super();
        this.fieldWidth = fieldWidth;
        this.fieldHeight = fieldHeight;
    }
    setup() {
        config.getBorderRects(this.fieldWidth, this.fieldHeight).forEach((rect) => {
            const wall = new BorderWall_1.BorderWall(rect.width, rect.height);
            wall.tags = [game_1.Tag.EditorBlockMove];
            wall.position.set(rect.x, rect.y);
            this.add(wall);
        });
    }
}
exports.EditorBorder = EditorBorder;
