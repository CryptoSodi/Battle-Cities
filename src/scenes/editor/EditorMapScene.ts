import { DebugCollisionMenu } from '../../debug';
import { GameUpdateArgs } from '../../game';
import {
  EditorBorder,
  EditorField,
  EditorMap,
  EditorPalette,
} from '../../gameObjects';
import { EditorMapInputContext } from '../../input';
import { MapConfig } from '../../map';
import { GameObject, Vector } from '../../core';
import * as config from '../../config';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

import { EditorLocationParams } from './params';

export class EditorMapScene extends GameScene<EditorLocationParams> {
  private editorWorld: GameObject;
  private field: EditorField;
  private map: EditorMap;
  private mapConfig: MapConfig;
  private palette: EditorPalette;
  private canvasElement: HTMLCanvasElement;
  private isPointerDrawing = false;
  private isPointerErasing = false;
  private isPaletteDragging = false;

  protected setup(updateArgs: GameUpdateArgs): void {
    this.mapConfig = this.params.mapConfig;
    const fieldWidth = this.mapConfig.getFieldWidth();
    const fieldHeight = this.mapConfig.getFieldHeight();

    this.editorWorld = new GameObject();
    this.root.add(this.editorWorld);
    this.editorWorld.add(new EditorBorder(fieldWidth, fieldHeight));

    this.field = new EditorField(this.mapConfig);
    this.field.position.set(
      config.BORDER_LEFT_WIDTH,
      config.BORDER_TOP_BOTTOM_HEIGHT,
    );
    this.editorWorld.add(this.field);

    this.map = new EditorMap(this.mapConfig);
    this.map.setField(this.field);
    this.map.position.set(
      config.BORDER_LEFT_WIDTH,
      config.BORDER_TOP_BOTTOM_HEIGHT,
    );
    this.editorWorld.add(this.map);

    this.palette = new EditorPalette(this.map.getPaletteEntries());
    this.palette.position.set(
      this.root.size.width - this.palette.size.width - 16,
      16,
    );
    this.palette.selected.addListener(this.handlePaletteSelected);
    this.root.add(this.palette);

    this.map.selectedBrushIndexChanged.addListener(this.handleBrushChanged);
    this.handleBrushChanged(0);

    this.canvasElement = document.querySelector('canvas');
    this.canvasElement.addEventListener('pointerdown', this.handlePointerDown);
    this.canvasElement.addEventListener('pointermove', this.handlePointerMove);
    this.canvasElement.addEventListener('pointerup', this.handlePointerUp);
    this.canvasElement.addEventListener('pointerleave', this.handlePointerUp);
    this.canvasElement.addEventListener('contextmenu', this.handleContextMenu);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { collisionSystem, inputManager } = updateArgs;

    const inputMethod = inputManager.getActiveMethod();

    if (inputMethod.isDownAny(EditorMapInputContext.Menu)) {
      this.unlistenPointerEvents();
      this.navigator.replace(GameSceneType.EditorMenu, this.params);
      return;
    }

    super.update(updateArgs);
    this.updateCamera();

    // Update all transforms before checking collisions
    this.root.updateWorldMatrix(false, true);

    collisionSystem.update();

    collisionSystem.collide();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    const position = this.getCanvasPosition(event);

    if (this.handlePalettePointer(position, event.button)) {
      return;
    }

    if (!this.map.getWorldBoundingBox().containsPoint(position)) {
      return;
    }

    this.map.setCursorWorldPosition(position);

    if (event.button === 2) {
      this.isPointerErasing = true;
      this.map.eraseAtCursor();
      return;
    }

    this.isPointerDrawing = true;
    this.map.drawAtCursor();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const position = this.getCanvasPosition(event);

    if (this.isPaletteDragging) {
      if ((event.buttons & 1) === 0) {
        this.isPaletteDragging = false;
        return;
      }

      if (this.map.getWorldBoundingBox().containsPoint(position)) {
        this.map.setCursorWorldPosition(position);
      }
      return;
    }

    if (this.map.getWorldBoundingBox().containsPoint(position)) {
      this.map.setCursorWorldPosition(position);

      if (this.isPointerErasing || (event.buttons & 2) !== 0) {
        this.map.eraseAtCursor();
        return;
      }

      if (this.isPointerDrawing || (event.buttons & 1) !== 0) {
        this.map.drawAtCursor();
      }
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.isPaletteDragging) {
      const position = this.getCanvasPosition(event);

      if (this.map.getWorldBoundingBox().containsPoint(position)) {
        this.map.setCursorWorldPosition(position);
        this.map.drawAtCursor();
      }

      this.isPaletteDragging = false;
    }

    this.isPointerDrawing = false;
    this.isPointerErasing = false;
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private handlePalettePointer(position: Vector, button: number): boolean {
    const itemIndex = this.palette.getItemIndexAtPoint(position);

    if (itemIndex === -1) {
      return false;
    }

    this.palette.selected.notify(itemIndex);

    if (button === 0) {
      this.isPaletteDragging = true;
      this.isPointerDrawing = false;
      this.isPointerErasing = false;
    }

    return true;
  }

  private getCanvasPosition(event: PointerEvent): Vector {
    const bounds = this.canvasElement.getBoundingClientRect();
    const scaleX = this.canvasElement.width / bounds.width;
    const scaleY = this.canvasElement.height / bounds.height;
    const x = (event.clientX - bounds.left) * scaleX;
    const y = (event.clientY - bounds.top) * scaleY;

    return new Vector(x, y);
  }

  private unlistenPointerEvents(): void {
    if (this.canvasElement === undefined || this.canvasElement === null) {
      return;
    }

    this.canvasElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvasElement.removeEventListener('pointermove', this.handlePointerMove);
    this.canvasElement.removeEventListener('pointerup', this.handlePointerUp);
    this.canvasElement.removeEventListener('pointerleave', this.handlePointerUp);
    this.canvasElement.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handlePaletteSelected = (index: number): void => {
    this.map.selectBrushIndex(index);
  };

  private handleBrushChanged = (index: number): void => {
    this.palette.setSelectedIndex(index);
    this.palette.setSelectedLabel(this.map.getBrushLabels()[index].replace('BRUSH ', ''));
  };

  private updateCamera(): void {
    const viewportRight = this.palette.position.x - 16;
    const viewportWidth = viewportRight;
    const viewportHeight = this.root.size.height;
    const worldWidth =
      config.BORDER_LEFT_WIDTH +
      this.mapConfig.getFieldWidth() +
      config.BORDER_RIGHT_WIDTH;
    const worldHeight =
      config.BORDER_TOP_BOTTOM_HEIGHT * 2 +
      this.mapConfig.getFieldHeight();

    const toolCenter = this.map
      .getToolCenter()
      .clone()
      .add(new Vector(config.BORDER_LEFT_WIDTH, config.BORDER_TOP_BOTTOM_HEIGHT));

    let nextX = viewportWidth / 2 - toolCenter.x;
    let nextY = viewportHeight / 2 - toolCenter.y;

    if (worldWidth <= viewportWidth) {
      nextX = (viewportWidth - worldWidth) / 2;
    } else {
      const minX = viewportWidth - worldWidth;
      nextX = Math.max(minX, Math.min(0, nextX));
    }

    if (worldHeight <= viewportHeight) {
      nextY = (viewportHeight - worldHeight) / 2;
    } else {
      const minY = viewportHeight - worldHeight;
      nextY = Math.max(minY, Math.min(0, nextY));
    }

    if (
      this.editorWorld.position.x !== nextX ||
      this.editorWorld.position.y !== nextY
    ) {
      this.root.setNeedsPaint();
      this.editorWorld.position.set(nextX, nextY);
      this.editorWorld.updateMatrix(true);
    }
  }
}
