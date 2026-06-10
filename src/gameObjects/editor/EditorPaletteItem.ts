import { GameObject, RectPainter } from '../../core';
import * as config from '../../config';

export class EditorPaletteItem extends GameObject {
  private readonly preview: GameObject;
  private isSelected = false;

  constructor(preview: GameObject, width = 280, height = 80) {
    super(width, height);

    this.preview = preview;
  }

  protected setup(): void {
    this.painter = new RectPainter(config.COLOR_GRAY_LIGHT, config.COLOR_BLACK);
    this.setZIndex(config.EDITOR_BRUSH_Z_INDEX + 5);

    this.preview.setZIndex(config.EDITOR_BRUSH_Z_INDEX + 6);

    this.preview.position.set(
      (this.size.width - this.preview.size.width) / 2,
      (this.size.height - this.preview.size.height) / 2,
    );
    this.add(this.preview);

    this.applySelectedState();
  }

  public setSelected(isSelected: boolean): void {
    this.isSelected = isSelected;
    this.applySelectedState();
  }

  private applySelectedState(): void {
    if (this.painter === null) {
      return;
    }

    const painter = this.painter as RectPainter;

    painter.fillColor = this.isSelected ? config.COLOR_YELLOW : config.COLOR_GRAY_LIGHT;
    painter.strokeColor = this.isSelected ? config.COLOR_WHITE : config.COLOR_BLACK;

    this.setNeedsPaint();
  }
}
