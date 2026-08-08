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
exports.DebugCameraMenu = void 0;
const config = __importStar(require("../../config"));
const DebugMenu_1 = require("../DebugMenu");
// Live gameplay-zoom control. Adjusts the render-only camera zoom so different
// zoom levels can be tried in-game before committing a value to
// config.GAMEPLAY_ZOOM. Only attached in dev.
class DebugCameraMenu extends DebugMenu_1.DebugMenu {
    constructor(getZoom, setZoom, getVisualZoom, setVisualZoom, options = {}) {
        super('Camera zoom', options);
        this.handleSliderInput = () => {
            this.setZoom(parseFloat(this.slider.value));
            this.updateLabel();
        };
        this.handleVisualSliderInput = () => {
            this.setVisualZoom(parseFloat(this.visualSlider.value));
            this.updateLabel();
        };
        this.handleReset = () => {
            this.setZoom(config.GAMEPLAY_ZOOM);
            this.slider.value = String(config.GAMEPLAY_ZOOM);
            this.setVisualZoom(1);
            this.visualSlider.value = '1';
            this.updateLabel();
        };
        this.updateLabel = () => {
            const zoom = this.getZoom();
            const visualZoom = this.getVisualZoom();
            // Approximate tiles visible across the play area (32px medium tiles).
            const viewportWidth = config.CANVAS_WIDTH -
                config.BORDER_LEFT_WIDTH -
                config.BORDER_RIGHT_WIDTH;
            const tilesAcross = Math.round(viewportWidth / zoom / config.TILE_SIZE_MEDIUM);
            this.valueLabel.textContent = `Gameplay zoom: ${zoom.toFixed(2)}× (~${tilesAcross} tiles wide)`;
            this.visualValueLabel.textContent = `Visual zoom-out: ${visualZoom.toFixed(2)}×`;
        };
        this.getZoom = getZoom;
        this.setZoom = setZoom;
        this.getVisualZoom = getVisualZoom;
        this.setVisualZoom = setVisualZoom;
        this.valueLabel = document.createElement('div');
        this.container.appendChild(this.valueLabel);
        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = '1';
        this.slider.max = '8';
        this.slider.step = '0.25';
        this.slider.value = String(this.getZoom());
        this.slider.addEventListener('input', this.handleSliderInput);
        this.container.appendChild(this.slider);
        this.visualValueLabel = document.createElement('div');
        this.container.appendChild(this.visualValueLabel);
        this.visualSlider = document.createElement('input');
        this.visualSlider.type = 'range';
        this.visualSlider.min = '0.25';
        this.visualSlider.max = '1';
        this.visualSlider.step = '0.05';
        this.visualSlider.value = String(this.getVisualZoom());
        this.visualSlider.addEventListener('input', this.handleVisualSliderInput);
        this.container.appendChild(this.visualSlider);
        this.appendButton('Reset', this.handleReset);
        this.updateLabel();
    }
    update() {
        this.slider.value = String(this.getZoom());
        this.visualSlider.value = String(this.getVisualZoom());
        this.updateLabel();
    }
}
exports.DebugCameraMenu = DebugCameraMenu;
