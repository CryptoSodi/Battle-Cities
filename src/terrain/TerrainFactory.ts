import { Rect, Size, Vector } from '../core';
import {
  TerrainTile,
  BlueBrickTerrainTile,
  BrickSuperTerrainTile,
  BrickTerrainTile,
  IceTerrainTile,
  InverseBrickTerrainTile,
  JungleTerrainTile,
  MenuBrickTerrainTile,
  SteelTerrainTile,
  WaterTerrainTile,
} from '../gameObjects';
import * as config from '../config';

import { TerrainRegionConfig } from './TerrainRegionConfig';
import { TerrainType } from './TerrainType';

export class TerrainFactory {
  // Pass in regions for entire map at once so collision blocks can be
  // calculated correctly.
  public static createMapFromRegionConfigs(
    regionConfigs: TerrainRegionConfig[],
    fieldWidth?: number,
    fieldHeight?: number,
  ): TerrainTile[] {
    const rectsByType = this.mapRegionConfigsByType(regionConfigs);

    // Water cells (in brick sub-tile coordinates) let bricks adjacent to water
    // pick a mossy base course instead of the grassy one.
    const waterCells = this.computeOccupiedCells(
      rectsByType.get(TerrainType.Water) || [],
      config.BRICK_TILE_SIZE,
    );

    const tiles = [];

    rectsByType.forEach((regionRects, type) => {
      const regionTiles = this.createMapFromRegions(
        type,
        regionRects,
        fieldWidth,
        fieldHeight,
        waterCells,
      );
      tiles.push(...regionTiles);
    });

    return tiles;
  }

  // Pass in regions for entire map at once so collision blocks can be
  // calculated correctly.
  public static createMapFromRegions(
    type: TerrainType,
    regionRects: Rect[],
    fieldWidth?: number,
    fieldHeight?: number,
    waterCells?: Set<string>,
  ): TerrainTile[] {
    if (type === TerrainType.Brick) {
      return this.createMapFromBrickRegions(
        regionRects,
        fieldWidth,
        fieldHeight,
        waterCells,
      );
    }

    const tiles = [];

    regionRects.forEach((regionRect) => {
      const regionTiles = this.createFromRegion(type, regionRect);
      tiles.push(...regionTiles);
    });

    return tiles;
  }

  // NOTE: skips super brick creation, which means that movement collision
  // will be disabled. To create collisions use createMapXXX.
  public static createFromRegionConfigs(
    regionConfigs: TerrainRegionConfig[],
  ): TerrainTile[] {
    const rectsByType = this.mapRegionConfigsByType(regionConfigs);

    const tiles = [];

    rectsByType.forEach((regionRects, type) => {
      const regionTiles = this.createFromRegions(type, regionRects);
      tiles.push(...regionTiles);
    });

    return tiles;
  }

  // NOTE: skips super brick creation, which means that movement collision
  // will be disabled. To create collisions use createMapXXX.
  public static createFromRegions(
    type: TerrainType,
    regionRects: Rect[],
  ): TerrainTile[] {
    const tiles = [];

    regionRects.forEach((regionRect) => {
      const regionTiles = this.createFromRegion(type, regionRect);
      tiles.push(...regionTiles);
    });

    return tiles;
  }

  public static validateRegion(type: TerrainType, regionRect: Rect): Error {
    const { x, y, width, height } = regionRect;

    const tileSize = this.getTileSize(type);

    if (x % tileSize.width !== 0) {
      return this.createTileSizeError(type, regionRect, 'x', tileSize.width);
    }
    if (y % tileSize.height !== 0) {
      return this.createTileSizeError(type, regionRect, 'y', tileSize.height);
    }
    if (width % tileSize.width !== 0) {
      return this.createTileSizeError(
        type,
        regionRect,
        'width',
        tileSize.width,
      );
    }
    if (height % tileSize.height !== 0) {
      return this.createTileSizeError(
        type,
        regionRect,
        'height',
        tileSize.height,
      );
    }
  }

  public static validateRegionConfigs(regions: TerrainRegionConfig[]): Error {
    for (const region of regions) {
      const regionRect = new Rect(
        region.x,
        region.y,
        region.width,
        region.height,
      );

      const error = this.validateRegion(region.type, regionRect);

      if (error !== undefined) {
        return error;
      }
    }
  }

  private static createFromRegion(
    type: TerrainType,
    regionRect: Rect,
  ): TerrainTile[] {
    const { x, y, width, height } = regionRect;

    const tileSize = this.getTileSize(type);

    const tiles = [];

    for (let i = x; i < x + width; i += tileSize.width) {
      for (let j = y; j < y + height; j += tileSize.height) {
        const tile = this.createTile(type);
        tile.position.set(i, j);
        tiles.push(tile);
      }
    }

    return tiles;
  }

  private static createMapFromBrickRegions(
    regionRects: Rect[],
    fieldWidth?: number,
    fieldHeight?: number,
    waterCells: Set<string> = new Set<string>(),
  ): TerrainTile[] {
    const superTileSize = config.BRICK_SUPER_TILE_SIZE;
    const fieldBounds = this.getFieldBounds(
      regionRects,
      fieldWidth,
      fieldHeight,
    );
    const superTileCols = Math.ceil(fieldBounds.width / superTileSize);
    const superTileRows = Math.ceil(fieldBounds.height / superTileSize);

    const superGrid = [];

    for (let rowIndex = 0; rowIndex < superTileRows; rowIndex += 1) {
      superGrid[rowIndex] = [];
      for (let colIndex = 0; colIndex < superTileCols; colIndex += 1) {
        superGrid[rowIndex][colIndex] = [];
      }
    }

    const subTileSize = config.BRICK_TILE_SIZE;
    const subTileCols = Math.ceil(fieldBounds.width / subTileSize);
    const subTileRows = Math.ceil(fieldBounds.height / subTileSize);

    const ratio = superTileSize / subTileSize;

    // Pre-pass: occupancy of every brick sub-cell across all regions, so a tile
    // can tell whether it sits at the bottom edge of a wall (nothing below it).
    const occupied = new Set<string>();
    const cellKey = (col: number, row: number): string => `${col},${row}`;
    for (const regionRect of regionRects) {
      const minCol = Math.max(0, Math.floor(regionRect.x / subTileSize));
      const minRow = Math.max(0, Math.floor(regionRect.y / subTileSize));
      const maxCol = Math.min(
        subTileCols,
        Math.ceil((regionRect.x + regionRect.width) / subTileSize),
      );
      const maxRow = Math.min(
        subTileRows,
        Math.ceil((regionRect.y + regionRect.height) / subTileSize),
      );
      for (let row = minRow; row < maxRow; row += 1) {
        for (let col = minCol; col < maxCol; col += 1) {
          occupied.add(cellKey(col, row));
        }
      }
    }

    for (const regionRect of regionRects) {
      // Find indexes of small cells coverd by current region
      // Those indexes will be global to entire field.
      const minIndex = new Vector(
        Math.max(0, Math.floor(regionRect.x / subTileSize)),
        Math.max(0, Math.floor(regionRect.y / subTileSize)),
      );
      const maxIndex = new Vector(
        Math.min(
          subTileCols,
          Math.ceil((regionRect.x + regionRect.width) / subTileSize),
        ),
        Math.min(
          subTileRows,
          Math.ceil((regionRect.y + regionRect.height) / subTileSize),
        ),
      );

      // Fill super-tile grid with possible sub-tiles
      for (let rowIndex = minIndex.y; rowIndex < maxIndex.y; rowIndex += 1) {
        for (let colIndex = minIndex.x; colIndex < maxIndex.x; colIndex += 1) {
          // Calculate indexes inside super grid which correspond to these
          // sub-tiles
          const superRowIndex = Math.floor(rowIndex / ratio);
          const superColIndex = Math.floor(colIndex / ratio);

          // Find sub-tiel position inside a super sel, because there are
          // multiple sub-tiles inside a super-tile. Position should be
          // calculated for local space because sub-tile is a child transform
          // of super-tile.
          const localRowIndex = rowIndex % ratio;
          const localColIndex = colIndex % ratio;

          const x = localColIndex * subTileSize;
          const y = localRowIndex * subTileSize;

          const subTile = this.createTile(
            TerrainType.Brick,
          ) as BrickTerrainTile;
          subTile.position.set(x, y);
          // Bottom-edge brick (no brick in the cell directly below) renders a
          // base course. Mossy where it touches water, grass-tufted otherwise.
          subTile.isBase = !occupied.has(cellKey(colIndex, rowIndex + 1));
          if (subTile.isBase) {
            const touchesWater =
              waterCells.has(cellKey(colIndex, rowIndex + 1)) ||
              waterCells.has(cellKey(colIndex - 1, rowIndex)) ||
              waterCells.has(cellKey(colIndex + 1, rowIndex)) ||
              waterCells.has(cellKey(colIndex, rowIndex - 1));
            subTile.baseVariant = touchesWater ? 'moss' : 'grass';
          }

          superGrid[superRowIndex][superColIndex].push(subTile);
        }
      }
    }

    const superTiles = [];

    // Go over super-grid to create super-tiles
    for (let rowIndex = 0; rowIndex < superTileRows; rowIndex += 1) {
      for (let colIndex = 0; colIndex < superTileCols; colIndex += 1) {
        const subTiles = superGrid[rowIndex][colIndex];
        if (subTiles.length === 0) {
          continue;
        }

        const x = colIndex * superTileSize;
        const y = rowIndex * superTileSize;

        const superTile = new BrickSuperTerrainTile(subTiles);
        superTile.position.set(x, y);
        superTiles.push(superTile);
      }
    }

    return superTiles;
  }

  // Maps a set of region rects onto a cell grid of the given size, returning
  // the occupied cells keyed as "col,row" (used for water adjacency lookups).
  private static computeOccupiedCells(
    regionRects: Rect[],
    cellSize: number,
  ): Set<string> {
    const cells = new Set<string>();

    for (const regionRect of regionRects) {
      const minCol = Math.floor(regionRect.x / cellSize);
      const minRow = Math.floor(regionRect.y / cellSize);
      const maxCol = Math.ceil((regionRect.x + regionRect.width) / cellSize);
      const maxRow = Math.ceil((regionRect.y + regionRect.height) / cellSize);
      for (let row = minRow; row < maxRow; row += 1) {
        for (let col = minCol; col < maxCol; col += 1) {
          cells.add(`${col},${row}`);
        }
      }
    }

    return cells;
  }

  private static getFieldBounds(
    regionRects: Rect[],
    fieldWidth?: number,
    fieldHeight?: number,
  ): Rect {
    if (fieldWidth !== undefined && fieldHeight !== undefined) {
      return new Rect(0, 0, fieldWidth, fieldHeight);
    }

    if (regionRects.length === 0) {
      return new Rect(0, 0, 0, 0);
    }

    let maxWidth = 0;
    let maxHeight = 0;

    regionRects.forEach((regionRect) => {
      maxWidth = Math.max(maxWidth, regionRect.x + regionRect.width);
      maxHeight = Math.max(maxHeight, regionRect.y + regionRect.height);
    });

    return new Rect(0, 0, maxWidth, maxHeight);
  }

  private static mapRegionConfigsByType(
    regionConfigs: TerrainRegionConfig[],
  ): Map<TerrainType, Rect[]> {
    const rectsByType = new Map<TerrainType, Rect[]>();

    for (const regionConfig of regionConfigs) {
      const { type } = regionConfig;

      const regionRect = new Rect(
        regionConfig.x,
        regionConfig.y,
        regionConfig.width,
        regionConfig.height,
      );

      const regionRects = rectsByType.get(type) || [];

      regionRects.push(regionRect);

      rectsByType.set(type, regionRects);
    }

    return rectsByType;
  }

  private static createTile(type: TerrainType): TerrainTile {
    switch (type) {
      case TerrainType.Brick:
        return new BrickTerrainTile();
      case TerrainType.Steel:
        return new SteelTerrainTile();
      case TerrainType.Jungle:
        return new JungleTerrainTile();
      case TerrainType.Water:
        return new WaterTerrainTile();
      case TerrainType.Ice:
        return new IceTerrainTile();
      case TerrainType.MenuBrick:
        return new MenuBrickTerrainTile();
      case TerrainType.InverseBrick:
        return new InverseBrickTerrainTile();
      case TerrainType.BlueBrick:
        return new BlueBrickTerrainTile();
      default:
        throw new Error(`Tile object for "${type}" not defined`);
    }
  }

  private static getTileSize(type: TerrainType): Size {
    switch (type) {
      case TerrainType.Brick:
        return new Size(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
      case TerrainType.BrickSuper:
        return new Size(
          config.BRICK_SUPER_TILE_SIZE,
          config.BRICK_SUPER_TILE_SIZE,
        );
      case TerrainType.Steel:
        return new Size(config.STEEL_TILE_SIZE, config.STEEL_TILE_SIZE);
      case TerrainType.Jungle:
        return new Size(config.JUNGLE_TILE_SIZE, config.JUNGLE_TILE_SIZE);
      case TerrainType.Water:
        return new Size(config.WATER_TILE_SIZE, config.WATER_TILE_SIZE);
      case TerrainType.Ice:
        return new Size(config.ICE_TILE_SIZE, config.ICE_TILE_SIZE);
      case TerrainType.MenuBrick:
        return new Size(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
      case TerrainType.InverseBrick:
        return new Size(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
      case TerrainType.BlueBrick:
        return new Size(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
      default:
        throw new Error(`Tile size for "${type}" not defined`);
    }
  }

  private static createTileSizeError(
    type: TerrainType,
    regionRect: Rect,
    propertyName: string,
    propertySize: number,
  ): Error {
    const message = `Map tile "${type}" with properties ${regionRect.toString()} has invalid property "${propertyName}": it must be divisible by tile size "${propertySize}"`;

    return new Error(message);
  }
}
