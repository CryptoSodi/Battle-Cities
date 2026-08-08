"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighscoreHeading = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const TerrainText_1 = require("./TerrainText");
const VISIBILITY_DURATION = 0.012;
class HighscoreHeading extends core_1.GameObject {
    constructor(points) {
        super();
        this.texts = [];
        this.visibleIndex = 0;
        this.points = points;
        this.timer = new core_1.Timer();
        this.timer.reset(VISIBILITY_DURATION);
    }
    setup() {
        this.texts = [
            this.createText(terrain_1.TerrainType.Brick),
            this.createText(terrain_1.TerrainType.InverseBrick),
            this.createText(terrain_1.TerrainType.BlueBrick),
        ];
        this.texts.forEach((text) => {
            text.setVisible(false);
            this.add(text);
        });
        this.updateVisibility();
    }
    update({ deltaTime }) {
        if (this.timer.isDone()) {
            this.nextText();
            this.updateVisibility();
            this.timer.reset(VISIBILITY_DURATION);
            this.setNeedsPaint();
        }
        else {
            this.timer.update(deltaTime);
        }
    }
    nextText() {
        this.visibleIndex += 1;
        if (this.visibleIndex > this.texts.length - 1) {
            this.visibleIndex = 0;
        }
    }
    updateVisibility() {
        this.texts.forEach((text, index) => {
            if (index === this.visibleIndex) {
                text.setVisible(true);
            }
            else {
                text.setVisible(false);
            }
        });
    }
    createText(terrainType) {
        const message = `HISCORE\n${this.points}`;
        const text = new TerrainText_1.TerrainText(message, terrainType, {
            alignment: core_1.TextAlignment.Right,
            lineSpacing: 6,
        });
        text.origin.set(0.5, 0.5);
        return text;
    }
}
exports.HighscoreHeading = HighscoreHeading;
