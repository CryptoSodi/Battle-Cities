import { GameObject, RectPainter, Subject, Vector } from '../../core';
import { SpriteText } from '../../gameObjects';
import * as config from '../../config';

import { EditorPaletteItem } from './EditorPaletteItem';

export interface EditorPaletteEntry {
  label: string;
  createPreview: () => GameObject;
}

const ITEM_GAP = 10;
const ITEM_COLUMNS = 2;
const LABEL_HEIGHT = 28;
const LABEL_MARGIN_BOTTOM = 12;
const ITEM_HEIGHT = 88;
const ITEM_WIDTH = 124;
const PANEL_PADDING = 16;

export class EditorPalette extends GameObject {
  public readonly selected = new Subject<number>();
  private readonly entries: EditorPaletteEntry[];
  private readonly items: EditorPaletteItem[] = [];
  private readonly selectedLabelText: SpriteText;
  private selectedIndex = 0;
  private selectedLabel = '';

  constructor(entries: EditorPaletteEntry[]) {
    super(312, EditorPalette.getHeight(entries.length));

    this.entries = entries;
    this.zIndex = config.EDITOR_BRUSH_Z_INDEX + 4;
    this.selectedLabelText = new SpriteText('', {
      color: config.COLOR_WHITE,
      letterSpacing: 3,
    });
  }

  protected setup(): void {
    this.painter = new RectPainter(config.COLOR_GRAY, config.COLOR_WHITE);
    this.selectedLabelText.position.set(PANEL_PADDING, PANEL_PADDING);
    this.add(this.selectedLabelText);

    this.entries.forEach((entry, index) => {
      const item = new EditorPaletteItem(entry.createPreview(), ITEM_WIDTH, ITEM_HEIGHT);
      const columnIndex = index % ITEM_COLUMNS;
      const rowIndex = Math.floor(index / ITEM_COLUMNS);

      item.position.set(
        PANEL_PADDING + columnIndex * (ITEM_WIDTH + ITEM_GAP),
        PANEL_PADDING +
          LABEL_HEIGHT +
          LABEL_MARGIN_BOTTOM +
          rowIndex * (ITEM_HEIGHT + ITEM_GAP),
      );
      this.add(item);
      this.items.push(item);
    });

    this.selectedLabelText.setText(this.selectedLabel);
    this.setSelectedIndex(this.selectedIndex);
  }

  public setSelectedIndex(index: number): void {
    this.selectedIndex = index;

    this.items.forEach((item, itemIndex) => {
      item.setSelected(itemIndex === index);
    });
  }

  public setSelectedLabel(label: string): void {
    this.selectedLabel = label;

    if (this.selectedLabelText !== undefined) {
      this.selectedLabelText.setText(label);
    }
  }

  public getItemIndexAtPoint(point: Vector): number {
    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      if (item.getWorldBoundingBox().containsPoint(point)) {
        return i;
      }
    }

    return -1;
  }

  private static getHeight(itemsCount: number): number {
    const rows = Math.ceil(itemsCount / ITEM_COLUMNS);

    return (
      PANEL_PADDING * 2 +
      LABEL_HEIGHT +
      LABEL_MARGIN_BOTTOM +
      rows * ITEM_HEIGHT +
      Math.max(rows - 1, 0) * ITEM_GAP
    );
  }
}
