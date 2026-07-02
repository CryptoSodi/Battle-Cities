import { GameObject, Subject, Vector } from '../../core';
import { GameUpdateArgs } from '../../game';
import { MenuInputContext } from '../../input';

import { MenuCursor } from './MenuCursor';
import { MenuItem } from './MenuItem';

export interface MenuOptions {
  initialIndex?: number;
  itemHeight?: number;
}

const DEFAULT_OPTIONS = {
  initialIndex: 0,
  itemHeight: 60,
};

const CURSOR_OFFSET = 96;
const ITEM_OFFSET = 16;

export class Menu extends GameObject {
  public focused = new Subject<number>();
  public selected = new Subject<number>();
  private items: MenuItem[] = [];
  private options: MenuOptions;
  private cursor: MenuCursor = new MenuCursor();
  private focusedIndex = -1;

  constructor(options: MenuOptions = {}) {
    super();

    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.focusedIndex = this.options.initialIndex;
  }

  public setItems(items: MenuItem[]): void {
    this.items = items;
    // TODO: dynamic width and height
    this.size.set(480, items.length * this.options.itemHeight);
    this.updateMatrix();

    this.removeAllChildren();

    this.items.forEach((menuItem, index) => {
      menuItem.position.set(
        CURSOR_OFFSET,
        index * this.options.itemHeight + ITEM_OFFSET,
      );
      this.add(menuItem);
    });

    this.add(this.cursor);

    this.focusItem(0);
  }

  public hideCursor(): void {
    this.cursor.setVisible(false);
  }

  public showCursor(): void {
    // Reset to default so it could be overriden by parent visibility
    this.cursor.setVisible(null);
  }

  public reset(): void {
    this.focusItem(0);
  }

  public selectItemAtPoint(point: Vector): boolean {
    const box = this.getWorldBoundingBox();
    const itemIndex = Math.floor(
      (point.y - box.min.y) / this.options.itemHeight,
    );

    if (
      !box.containsPoint(point) ||
      itemIndex < 0 ||
      itemIndex >= this.items.length ||
      !this.items[itemIndex].isFocusable()
    ) {
      return false;
    }

    this.focusItem(itemIndex);
    this.notifyItemSelected();

    return true;
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager } = updateArgs;

    if (updateArgs.pointerClick !== null) {
      const wasItemSelected = this.selectItemAtPoint(updateArgs.pointerClick);
      if (wasItemSelected) {
        updateArgs.pointerClick = null;
        return;
      }
    }

    const inputMethod = inputManager.getActiveMethod();

    if (inputMethod.isDownAny(MenuInputContext.VerticalPrev)) {
      this.focusPrev();
    }

    if (inputMethod.isDownAny(MenuInputContext.VerticalNext)) {
      this.focusNext();
    }

    if (inputMethod.isDownAny(MenuInputContext.Select)) {
      this.notifyItemSelected();
    }

    this.items.forEach((menuItem, index) => {
      if (index === this.focusedIndex) {
        menuItem.updateFocused(updateArgs);
      }
    });
  }

  private focusItem(index: number): void {
    const prevFocusedItem = this.items[this.focusedIndex];
    if (prevFocusedItem !== undefined) {
      prevFocusedItem.unfocus();
    }

    if (index === -1) {
      this.focusedIndex = -1;
      this.hideCursor();
      return;
    }

    this.focusedIndex = index;
    this.showCursor();

    this.cursor.dirtyPaintBox();
    this.cursor.position.setY(this.cursor.size.height * this.focusedIndex);
    this.cursor.updateMatrix(true);
    // Re-sync render-interpolation history right after this teleport. The
    // cursor jumps whole rows in a single tick (unlike gameplay objects,
    // which move in small continuous steps), and extrapolation (see
    // Transform.interpApply) treats any jump as "last tick's velocity" and
    // projects further along it -- without this, the cursor visibly
    // overshoots past the new row for a couple of frames before settling.
    this.cursor.interpCapture();

    this.focused.notify(this.focusedIndex);

    const focusedItem = this.items[this.focusedIndex];
    focusedItem.focus();
  }

  private notifyItemSelected(): void {
    if (this.focusedIndex === -1) {
      return;
    }

    const focusedItem = this.items[this.focusedIndex];
    focusedItem.select();

    this.selected.notify(this.focusedIndex);
  }

  private focusPrev(): void {
    const prevIndex = this.getPrevFocusableIndex();
    this.focusItem(prevIndex);
  }

  private focusNext(): void {
    const nextIndex = this.getNextFocusableIndex();
    this.focusItem(nextIndex);
  }

  private getPrevFocusableIndex(): number {
    if (!this.hasFocusableItems()) {
      return -1;
    }

    let prevIndex = this.focusedIndex;
    let prevItem = null;

    do {
      prevIndex -= 1;
      if (prevIndex < 0) {
        prevIndex = this.items.length - 1;
      }
      prevItem = this.items[prevIndex];
    } while (prevItem.isFocusable() === false);

    return prevIndex;
  }

  private getNextFocusableIndex(): number {
    if (!this.hasFocusableItems()) {
      return -1;
    }

    let nextIndex = this.focusedIndex;
    let nextItem = null;

    do {
      nextIndex += 1;
      if (nextIndex > this.items.length - 1) {
        nextIndex = 0;
      }
      nextItem = this.items[nextIndex];
    } while (nextItem.isFocusable() === false);

    return nextIndex;
  }

  private hasFocusableItems(): boolean {
    return this.items.some((item) => item.isFocusable());
  }
}
