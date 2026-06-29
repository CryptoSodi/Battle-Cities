import { Rect, Vector } from '../core';
import { TankParty, TankType } from '../tank';
import { TerrainFactory, TerrainRegionConfig } from '../terrain';
import * as config from '../config';

import { MapDto } from './MapDto';
import { MapDtoSchema } from './MapDtoSchema';

export interface MapConfigToJsonOptions {
  pretty?: boolean;
}

const DEFAULT_TO_JSON_OPTIONS = {
  pretty: true,
};

export class MapConfig {
  private dto: MapDto;

  constructor() {
    this.dto = this.fillAndValidate({});
  }

  public getDto(): MapDto {
    return this.dto;
  }

  public fromDto(dto: MapDto): void {
    this.dto = this.fillAndValidate(dto);
  }

  public fillAndValidate(dto: MapDto): MapDto {
    const dtoWithFieldDefaults = this.addMissingFieldDefaults(dto);
    const { value: validatedDto, error: schemaError } = MapDtoSchema.validate(
      dtoWithFieldDefaults,
    );

    if (schemaError !== undefined) {
      throw schemaError;
    }

    const terrainError = TerrainFactory.validateRegionConfigs(
      validatedDto.terrain.regions,
    );
    if (terrainError !== undefined) {
      throw terrainError;
    }

    return validatedDto;
  }

  private addMissingFieldDefaults(dto: MapDto): MapDto {
    if (dto.field !== undefined) {
      return dto;
    }

    const hasMapContent =
      dto.base !== undefined ||
      (dto.terrain?.regions?.length ?? 0) > 0 ||
      (dto.spawn?.enemy?.locations?.length ?? 0) > 0 ||
      (dto.spawn?.enemy?.list?.length ?? 0) > 0 ||
      (dto.spawn?.player?.locations?.length ?? 0) > 0;

    const isLegacyMap = dto.version === undefined || dto.version < 2;
    if (!hasMapContent || !isLegacyMap) {
      return dto;
    }

    return {
      ...dto,
      field: {
        widthTiles: config.LEGACY_FIELD_TILE_COUNT,
        heightTiles: config.LEGACY_FIELD_TILE_COUNT,
      },
    };
  }

  public addTerrainRegion(region: TerrainRegionConfig): void {
    this.dto.terrain.regions.push(this.createStorageRegion(region));
  }

  public clearTerrainRect(rectToClear: Rect): void {
    const storageRectToClear = this.createStorageRect(rectToClear);
    const { regions } = this.dto.terrain;

    // Iterate in reverse because we are removing items from array
    for (let i = regions.length - 1; i >= 0; i -= 1) {
      const region = regions[i];

      const regionRect = new Rect(
        region.x,
        region.y,
        region.width,
        region.height,
      );

      if (regionRect.intersectsRect(storageRectToClear)) {
        regions.splice(i, 1);
      }
    }
  }

  public getTerrainRegions(): TerrainRegionConfig[] {
    if (!this.shouldOffsetLegacyContent()) {
      return this.dto.terrain.regions;
    }

    const legacyOffset = this.getLegacyOffset();

    return this.dto.terrain.regions.map((region) => {
      return {
        ...region,
        x: region.x + legacyOffset.x,
        y: region.y + legacyOffset.y,
      };
    });
  }

  public getFieldTileWidth(): number {
    return this.dto.field.widthTiles;
  }

  public getFieldTileHeight(): number {
    return this.dto.field.heightTiles;
  }

  public getFieldWidth(): number {
    return config.getFieldPixelSize(this.getFieldTileWidth());
  }

  public getFieldHeight(): number {
    return config.getFieldPixelSize(this.getFieldTileHeight());
  }

  public setFieldTileCount(widthTiles: number, heightTiles: number): void {
    this.upgradeLegacyContentToCurrentCoordinates();

    this.dto.field.widthTiles = widthTiles;
    this.dto.field.heightTiles = heightTiles;

    this.clampContentToFieldBounds();
  }

  public getPlayerSpawnPositions(): Vector[] {
    const dtoLocations = this.dto.spawn.player.locations;
    const defaultLocations = this.getDefaultPlayerSpawnPositions();
    if (dtoLocations.length > 0) {
      return defaultLocations.map((defaultLocation, index) => {
        const location = dtoLocations[index];
        if (location === undefined) {
          return new Vector(defaultLocation.x, defaultLocation.y);
        }

        return this.createWorldPosition(location.x, location.y);
      });
    }

    return defaultLocations.map((location) => {
      return new Vector(location.x, location.y);
    });
  }

  public getEnemySpawnPositions(): Vector[] {
    const dtoLocations = this.dto.spawn.enemy.locations;
    const defaultLocations = this.getDefaultEnemySpawnPositions();
    if (dtoLocations.length > 0) {
      return defaultLocations.map((defaultLocation, index) => {
        const location = dtoLocations[index];
        if (location === undefined) {
          return new Vector(defaultLocation.x, defaultLocation.y);
        }

        return this.createWorldPosition(location.x, location.y);
      });
    }

    return defaultLocations.map((location) => {
      return new Vector(location.x, location.y);
    });
  }

  public getEnemySpawnList(): TankType[] {
    const types = this.dto.spawn.enemy.list.map((item) => {
      return new TankType(TankParty.Enemy, item.tier, item.drop);
    });
    return types;
  }

  public isEnemySpawnListEmpty(): boolean {
    return this.dto.spawn.enemy.list.length === 0;
  }

  public fillEnemySpawnList(type: TankType): void {
    for (let i = 0; i < config.ENEMY_MAX_TOTAL_COUNT; i += 1) {
      this.dto.spawn.enemy.list[i] = {
        tier: type.tier,
        drop: type.hasDrop,
      };
    }
  }

  public setEnemySpawnListItem(index: number, type: TankType): void {
    this.dto.spawn.enemy.list[index] = {
      tier: type.tier,
      drop: type.hasDrop,
    };
  }

  public getBasePosition(): Vector {
    const location = this.dto.base;
    if (location === undefined) {
      return this.getDefaultBasePosition();
    }

    return this.createWorldPosition(location.x, location.y);
  }

  public setBasePosition(position: Vector): void {
    this.dto.base = this.createStorageLocation(position.x, position.y);
  }

  public setPlayerSpawnLocation(index: number, position: Vector): void {
    this.dto.spawn.player.locations[index] = this.createStorageLocation(
      position.x,
      position.y,
    );
  }

  public setEnemySpawnLocation(index: number, position: Vector): void {
    if (this.isEnemySpawnListEmpty()) {
      this.fillEnemySpawnList(TankType.EnemyA());
    }

    this.dto.spawn.enemy.locations[index] = this.createStorageLocation(
      position.x,
      position.y,
    );
  }

  public toJSON(argOptions: MapConfigToJsonOptions = {}): string {
    const options = Object.assign({}, DEFAULT_TO_JSON_OPTIONS, argOptions);

    let json;
    if (options.pretty) {
      json = JSON.stringify(this.dto, null, 2);
    } else {
      json = JSON.stringify(this.dto);
    }

    return json;
  }

  public fromJSON(json: string): void {
    const dto = JSON.parse(json);

    this.dto = this.fillAndValidate(dto);
  }

  private createWorldPosition(x: number, y: number): Vector {
    if (!this.shouldOffsetLegacyContent()) {
      return new Vector(x, y);
    }

    const legacyOffset = this.getLegacyOffset();

    return new Vector(
      x + legacyOffset.x,
      y + legacyOffset.y,
    );
  }

  private shouldOffsetLegacyContent(): boolean {
    return this.dto.version < 2 && this.getFieldHeight() > config.LEGACY_FIELD_SIZE;
  }

  private createStorageLocation(
    x: number,
    y: number,
  ): { x: number; y: number } {
    if (!this.shouldOffsetLegacyContent()) {
      return { x, y };
    }

    const legacyOffset = this.getLegacyOffset();

    return {
      x: x - legacyOffset.x,
      y: y - legacyOffset.y,
    };
  }

  private createStorageRect(rect: Rect): Rect {
    const location = this.createStorageLocation(rect.x, rect.y);

    return new Rect(location.x, location.y, rect.width, rect.height);
  }

  private createStorageRegion(region: TerrainRegionConfig): TerrainRegionConfig {
    const location = this.createStorageLocation(region.x, region.y);

    return {
      ...region,
      x: location.x,
      y: location.y,
    };
  }

  private getLegacyOffset(): Vector {
    return new Vector(
      0,
      Math.max(0, this.getFieldHeight() - config.LEGACY_FIELD_SIZE),
    );
  }

  private getDefaultBasePosition(): Vector {
    return new Vector(
      Math.floor((this.getFieldWidth() - config.BASE_DEFAULT_SIZE.width) / 2),
      this.getFieldHeight() - config.BASE_DEFAULT_SIZE.height,
    );
  }

  private getDefaultPlayerSpawnPositions(): Vector[] {
    const basePosition = this.getDefaultBasePosition();
    const y = this.getFieldHeight() - config.TILE_SIZE_LARGE;

    return [
      new Vector(
        Math.max(0, basePosition.x - config.TILE_SIZE_LARGE - config.TILE_SIZE_MEDIUM),
        y,
      ),
      new Vector(
        Math.min(
          this.getFieldWidth() - config.TILE_SIZE_LARGE,
          basePosition.x + config.BASE_DEFAULT_SIZE.width + config.TILE_SIZE_MEDIUM,
        ),
        y,
      ),
    ];
  }

  private getDefaultEnemySpawnPositions(): Vector[] {
    const rightX = Math.max(0, this.getFieldWidth() - config.TILE_SIZE_LARGE);
    const centerX = Math.max(
      0,
      Math.floor((rightX / 2) / config.TILE_SIZE_LARGE) * config.TILE_SIZE_LARGE,
    );

    return [new Vector(centerX, 0), new Vector(rightX, 0), new Vector(0, 0)];
  }

  private clampContentToFieldBounds(): void {
    const fieldRect = new Rect(0, 0, this.getFieldWidth(), this.getFieldHeight());

    this.dto.terrain.regions = this.getTerrainRegions()
      .map((region) => {
        const clampedX = Math.max(0, Math.min(region.x, fieldRect.width));
        const clampedY = Math.max(0, Math.min(region.y, fieldRect.height));
        const clampedWidth = Math.max(
          0,
          Math.min(region.width, fieldRect.width - clampedX),
        );
        const clampedHeight = Math.max(
          0,
          Math.min(region.height, fieldRect.height - clampedY),
        );

        if (clampedWidth === 0 || clampedHeight === 0) {
          return null;
        }

        return this.createStorageRegion({
          ...region,
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          height: clampedHeight,
        });
      })
      .filter((region) => region !== null);

    const playerPositions = this.getPlayerSpawnPositions()
      .map((position) => this.clampObjectPosition(position, config.TILE_SIZE_LARGE, config.TILE_SIZE_LARGE))
      .map((position) => this.createStorageLocation(position.x, position.y));
    this.dto.spawn.player.locations = playerPositions;

    const enemyPositions = this.getEnemySpawnPositions()
      .map((position) => this.clampObjectPosition(position, config.TILE_SIZE_LARGE, config.TILE_SIZE_LARGE))
      .map((position) => this.createStorageLocation(position.x, position.y));
    this.dto.spawn.enemy.locations = enemyPositions;

    const basePosition = this.clampObjectPosition(
      this.getBasePosition(),
      config.BASE_DEFAULT_SIZE.width,
      config.BASE_DEFAULT_SIZE.height,
    );
    this.dto.base = this.createStorageLocation(basePosition.x, basePosition.y);
  }

  private clampObjectPosition(
    position: Vector,
    width: number,
    height: number,
  ): Vector {
    return new Vector(
      Math.max(0, Math.min(position.x, this.getFieldWidth() - width)),
      Math.max(0, Math.min(position.y, this.getFieldHeight() - height)),
    );
  }

  private upgradeLegacyContentToCurrentCoordinates(): void {
    if (!this.shouldOffsetLegacyContent()) {
      return;
    }

    this.dto.terrain.regions = this.getTerrainRegions().map((region) => {
      return { ...region };
    });

    this.dto.spawn.player.locations = this.getPlayerSpawnPositions().map((position) => {
      return { x: position.x, y: position.y };
    });

    this.dto.spawn.enemy.locations = this.getEnemySpawnPositions().map((position) => {
      return { x: position.x, y: position.y };
    });

    const basePosition = this.getBasePosition();
    this.dto.base = { x: basePosition.x, y: basePosition.y };
    this.dto.version = 2;
  }
}
