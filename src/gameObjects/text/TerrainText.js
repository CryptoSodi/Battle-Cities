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
exports.TerrainText = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const BrickTextShadow_1 = require("./BrickTextShadow");
class TerrainText extends core_1.GameObject {
    constructor(text = '', terrainType, options = {}, castShadow = false) {
        super();
        this.text = new core_1.Text(text, options);
        this.terrainType = terrainType;
        this.castShadow = castShadow;
    }
    setup({ rectFontLoader }) {
        const font = rectFontLoader.load(config.PRIMARY_RECT_FONT_ID);
        this.text.setFont(font);
        this.size.copyFrom(this.text.getSize());
        const rects = this.text.build();
        const tiles = terrain_1.TerrainFactory.createFromRegions(this.terrainType, core_1.ArrayUtils.flatten(rects));
        // Add the shadow layer first so it renders beneath the opaque letter tiles
        // (equal z-index, drawn in insertion order). Only the offset skirt shows.
        if (this.castShadow) {
            const shadow = new BrickTextShadow_1.BrickTextShadow(tiles, this.size.width, this.size.height);
            this.add(shadow);
        }
        this.add(...tiles);
    }
}
exports.TerrainText = TerrainText;
