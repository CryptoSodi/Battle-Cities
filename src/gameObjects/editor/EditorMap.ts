import { GameObject, Rect, Subject, Vector } from '../../core';
import { MapConfig } from '../../map';
import {
  TerrainFactory,
  TerrainRegionConfig,
  TerrainType,
} from '../../terrain';
import * as config from '../../config';

import { Base } from '../Base';
import { EditorBaseBrush } from './EditorBaseBrush';
import { EditorBrush } from './EditorBrush';
import { EditorEraserBrush } from './EditorEraserBrush';
import { EditorField } from './EditorField';
import { EditorPaletteEntry } from './EditorPalette';
import { EditorSpawnBrush, EditorSpawnType } from './EditorSpawnBrush';
import { EditorTool } from './EditorTool';

interface EditorBrushDefinition {
  createBrush: () => GameObject;
  label: string;
}

export class EditorMap extends GameObject {
  public readonly selectedBrushIndexChanged = new Subject<number>();
  private container: GameObject;
  private tool: EditorTool;
  private mapConfig: MapConfig;
  private field: EditorField;
  private brushDefinitions: EditorBrushDefinition[];

  constructor(mapConfig: MapConfig) {
    super(mapConfig.getFieldWidth(), mapConfig.getFieldHeight());

    this.mapConfig = mapConfig;
    this.brushDefinitions = this.createBrushDefinitions();
  }

  public setField(field: EditorField): void {
    this.field = field;
  }

  public getSelectedBrushIndex(): number {
    if (this.tool === undefined) {
      return 0;
    }

    return this.tool.getSelectedBrushIndex();
  }

  public getPaletteEntries(): EditorPaletteEntry[] {
    return this.brushDefinitions.map((definition) => {
      return {
        label: definition.label.replace('BRUSH ', ''),
        createPreview: definition.createBrush,
      };
    });
  }

  public selectBrushIndex(index: number): void {
    this.tool.selectBrushIndex(index);
  }

  public setCursorWorldPosition(position: Vector): void {
    const localPosition = position.clone().sub(this.getWorldBoundingBox().min);
    const maxX = this.size.width - this.tool.size.width;
    const maxY = this.size.height - this.tool.size.height;
    const snapStepX = this.tool.getSnapStepX();
    const snapStepY = this.tool.getSnapStepY();

    localPosition.x = Math.max(0, Math.min(localPosition.x, maxX));
    localPosition.y = Math.max(0, Math.min(localPosition.y, maxY));
    localPosition.snapX(snapStepX);
    localPosition.snapY(snapStepY);

    this.tool.position.copyFrom(localPosition);
    this.tool.updateMatrix(true);
  }

  public drawAtCursor(): void {
    this.handleDraw();
  }

  public eraseAtCursor(): void {
    this.handleErase();
  }

  public getToolCenter(): Vector {
    if (this.tool === undefined) {
      return new Vector(0, 0);
    }

    return this.tool.getCenter();
  }

  protected setup(): void {
    // Holds all map tiles
    this.container = new GameObject();
    this.container.size.copyFrom(this.size);
    this.add(this.container);

    const terrainRegions = this.mapConfig.getTerrainRegions();
    terrainRegions.forEach((region) => {
      const tiles = TerrainFactory.createFromRegionConfigs([region]);

      this.container.add(...tiles);
    });

    const brushes = this.brushDefinitions.map((definition) => definition.createBrush());
    this.tool = new EditorTool();
    this.tool.position.set(64, 64);
    this.tool.brushChanged.addListener(this.handleBrushChanged);
    this.tool.draw.addListener(this.handleDraw);
    this.tool.erase.addListener(this.handleErase);
    this.add(this.tool);
    this.tool.setBrushes(brushes);
    this.handleBrushChanged(this.tool.getSelectedBrush());
  }

  private handleDraw = (): void => {
    const brush = this.tool.getSelectedBrush();

    if (brush instanceof EditorEraserBrush) {
      this.handleErase();
      return;
    }

    if (brush instanceof EditorBaseBrush || brush instanceof Base) {
      const position = this.tool.position.clone();
      this.mapConfig.setBasePosition(position);
      this.field.setBasePosition(position.x, position.y);
      return;
    }

    if (brush instanceof EditorSpawnBrush) {
      this.placeSpawn(brush.spawnType);
      return;
    }

    // Remove existing tiles first
    this.clearRect(this.tool.getBoundingBox().toRect());

    const region: TerrainRegionConfig = {
      type: (brush as EditorBrush).type,
      x: this.tool.position.x,
      y: this.tool.position.y,
      width: this.tool.size.width,
      height: this.tool.size.height,
    };

    this.mapConfig.addTerrainRegion(region);

    const tiles = TerrainFactory.createFromRegionConfigs([region]);

    this.container.add(...tiles);
  };

  private handleErase = (): void => {
    this.clearRect(this.tool.getBoundingBox().toRect());
  };

  private clearRect(rect: Rect): void {
    const tiles = this.container.children;

    // Iterate in reverse because we are removing items
    for (let i = tiles.length - 1; i >= 0; i -= 1) {
      const tile = tiles[i];
      const tileRect = tile.getBoundingBox().toRect();

      if (tileRect.intersectsRect(rect)) {
        tile.removeSelf();
      }
    }

    this.mapConfig.clearTerrainRect(rect);
  }

  private placeSpawn(spawnType: EditorSpawnType): void {
    const position = this.tool.position.clone();

    if (spawnType === EditorSpawnType.Player0) {
      this.mapConfig.setPlayerSpawnLocation(0, position);
      this.field.setPlayerSpawnPosition(0, position.x, position.y);
      return;
    }

    if (spawnType === EditorSpawnType.Player1) {
      this.mapConfig.setPlayerSpawnLocation(1, position);
      this.field.setPlayerSpawnPosition(1, position.x, position.y);
      return;
    }

    const enemyIndex = spawnType - EditorSpawnType.Enemy0;
    this.mapConfig.setEnemySpawnLocation(enemyIndex, position);
    this.field.setEnemySpawnPosition(enemyIndex, position.x, position.y);
  }

  private handleBrushChanged = (brush: GameObject): void => {
    const selectedBrushIndex = this.tool.getSelectedBrushIndex();

    this.selectedBrushIndexChanged.notify(selectedBrushIndex);
  };

  public getBrushLabels(): string[] {
    return this.brushDefinitions.map((definition) => definition.label);
  }

  private createBrushDefinitions(): EditorBrushDefinition[] {
    const { TILE_SIZE_SMALL, TILE_SIZE_MEDIUM, TILE_SIZE_LARGE } = config;

    return [
      this.createTerrainBrushDefinition(
        'BRICK 16X16',
        TILE_SIZE_SMALL,
        TILE_SIZE_SMALL,
        TerrainType.Brick,
      ),
      this.createTerrainBrushDefinition(
        'BRICK 32X32',
        TILE_SIZE_MEDIUM,
        TILE_SIZE_MEDIUM,
        TerrainType.Brick,
      ),
      this.createTerrainBrushDefinition(
        'BRICK 64X64',
        TILE_SIZE_LARGE,
        TILE_SIZE_LARGE,
        TerrainType.Brick,
      ),
      this.createTerrainBrushDefinition(
        'STEEL 32X32',
        TILE_SIZE_MEDIUM,
        TILE_SIZE_MEDIUM,
        TerrainType.Steel,
      ),
      this.createTerrainBrushDefinition(
        'STEEL 64X64',
        TILE_SIZE_LARGE,
        TILE_SIZE_LARGE,
        TerrainType.Steel,
      ),
      this.createTerrainBrushDefinition(
        'JUNGLE 32X32',
        TILE_SIZE_MEDIUM,
        TILE_SIZE_MEDIUM,
        TerrainType.Jungle,
      ),
      this.createTerrainBrushDefinition(
        'JUNGLE 64X64',
        TILE_SIZE_LARGE,
        TILE_SIZE_LARGE,
        TerrainType.Jungle,
      ),
      this.createTerrainBrushDefinition(
        'WATER 32X32',
        TILE_SIZE_MEDIUM,
        TILE_SIZE_MEDIUM,
        TerrainType.Water,
      ),
      this.createTerrainBrushDefinition(
        'WATER 64X64',
        TILE_SIZE_LARGE,
        TILE_SIZE_LARGE,
        TerrainType.Water,
      ),
      this.createTerrainBrushDefinition(
        'ICE 32X32',
        TILE_SIZE_MEDIUM,
        TILE_SIZE_MEDIUM,
        TerrainType.Ice,
      ),
      this.createTerrainBrushDefinition(
        'ICE 64X64',
        TILE_SIZE_LARGE,
        TILE_SIZE_LARGE,
        TerrainType.Ice,
      ),
      this.createBaseBrushDefinition(),
      this.createEraserBrushDefinition(),
      this.createSpawnBrushDefinition('PLAYER 1 SPAWN', EditorSpawnType.Player0),
      this.createSpawnBrushDefinition('PLAYER 2 SPAWN', EditorSpawnType.Player1),
      this.createSpawnBrushDefinition('ENEMY 1 SPAWN', EditorSpawnType.Enemy0),
      this.createSpawnBrushDefinition('ENEMY 2 SPAWN', EditorSpawnType.Enemy1),
      this.createSpawnBrushDefinition('ENEMY 3 SPAWN', EditorSpawnType.Enemy2),
    ];
  }

  private createTerrainBrushDefinition(
    label: string,
    width: number,
    height: number,
    type: TerrainType,
  ): EditorBrushDefinition {
    return {
      createBrush: () => new EditorBrush(width, height, type),
      label: `BRUSH ${label}`,
    };
  }

  private createSpawnBrushDefinition(
    label: string,
    spawnType: EditorSpawnType,
  ): EditorBrushDefinition {
    return {
      createBrush: () => new EditorSpawnBrush(spawnType),
      label: `BRUSH ${label}`,
    };
  }

  private createBaseBrushDefinition(): EditorBrushDefinition {
    return {
      createBrush: () => new EditorBaseBrush(),
      label: 'BRUSH BASE',
    };
  }

  private createEraserBrushDefinition(): EditorBrushDefinition {
    return {
      createBrush: () => new EditorEraserBrush(),
      label: 'BRUSH ERASER',
    };
  }
}
