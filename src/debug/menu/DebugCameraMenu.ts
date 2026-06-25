import * as config from '../../config';

import { DebugMenu, DebugMenuOptions } from '../DebugMenu';

// Live gameplay-zoom control. Adjusts the render-only camera zoom so different
// zoom levels can be tried in-game before committing a value to
// config.GAMEPLAY_ZOOM. Only attached in dev.
export class DebugCameraMenu extends DebugMenu {
  private getZoom: () => number;
  private setZoom: (zoom: number) => void;
  private valueLabel: HTMLElement;
  private slider: HTMLInputElement;

  constructor(
    getZoom: () => number,
    setZoom: (zoom: number) => void,
    options: DebugMenuOptions = {},
  ) {
    super('Camera zoom', options);

    this.getZoom = getZoom;
    this.setZoom = setZoom;

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

    this.appendButton('Reset', this.handleReset);

    this.updateLabel();
  }

  private handleSliderInput = (): void => {
    this.setZoom(parseFloat(this.slider.value));
    this.updateLabel();
  };

  private handleReset = (): void => {
    this.setZoom(config.GAMEPLAY_ZOOM);
    this.slider.value = String(config.GAMEPLAY_ZOOM);
    this.updateLabel();
  };

  private updateLabel = (): void => {
    const zoom = this.getZoom();
    // Approximate tiles visible across the play area (32px medium tiles).
    const viewportWidth =
      config.CANVAS_WIDTH -
      config.BORDER_LEFT_WIDTH -
      config.BORDER_RIGHT_WIDTH;
    const tilesAcross = Math.round(
      viewportWidth / zoom / config.TILE_SIZE_MEDIUM,
    );
    this.valueLabel.textContent = `Zoom: ${zoom.toFixed(
      2,
    )}× (~${tilesAcross} tiles wide)`;
  };
}
