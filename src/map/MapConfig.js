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
exports.MapConfig = void 0;
const core_1 = require("../core");
const TankParty_1 = require("../tank/TankParty");
const TankType_1 = require("../tank/TankType");
const TerrainFactory_1 = require("../terrain/TerrainFactory");
const config = __importStar(require("../config"));
const MapDtoSchema_1 = require("./MapDtoSchema");
const DEFAULT_TO_JSON_OPTIONS = {
    pretty: true,
};
class MapConfig {
    constructor() {
        this.dto = this.fillAndValidate({});
    }
    getDto() {
        return this.dto;
    }
    fromDto(dto) {
        this.dto = this.fillAndValidate(dto);
    }
    fillAndValidate(dto) {
        const dtoWithFieldDefaults = this.addMissingFieldDefaults(dto);
        const { value: validatedDto, error: schemaError } = MapDtoSchema_1.MapDtoSchema.validate(dtoWithFieldDefaults);
        if (schemaError !== undefined) {
            throw schemaError;
        }
        const terrainError = TerrainFactory_1.TerrainFactory.validateRegionConfigs(validatedDto.terrain.regions);
        if (terrainError !== undefined) {
            throw terrainError;
        }
        return validatedDto;
    }
    addMissingFieldDefaults(dto) {
        if (dto.field !== undefined) {
            return dto;
        }
        const hasMapContent = dto.base !== undefined ||
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
    addTerrainRegion(region) {
        this.dto.terrain.regions.push(this.createStorageRegion(region));
    }
    clearTerrainRect(rectToClear) {
        const storageRectToClear = this.createStorageRect(rectToClear);
        const { regions } = this.dto.terrain;
        // Iterate in reverse because we are removing items from array
        for (let i = regions.length - 1; i >= 0; i -= 1) {
            const region = regions[i];
            const regionRect = new core_1.Rect(region.x, region.y, region.width, region.height);
            if (regionRect.intersectsRect(storageRectToClear)) {
                regions.splice(i, 1);
            }
        }
    }
    getTerrainRegions() {
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
    getFieldTileWidth() {
        return this.dto.field.widthTiles;
    }
    getFieldTileHeight() {
        return this.dto.field.heightTiles;
    }
    getFieldWidth() {
        return config.getFieldPixelSize(this.getFieldTileWidth());
    }
    getFieldHeight() {
        return config.getFieldPixelSize(this.getFieldTileHeight());
    }
    setFieldTileCount(widthTiles, heightTiles) {
        this.upgradeLegacyContentToCurrentCoordinates();
        this.dto.field.widthTiles = widthTiles;
        this.dto.field.heightTiles = heightTiles;
        this.clampContentToFieldBounds();
    }
    getPlayerSpawnPositions() {
        const dtoLocations = this.dto.spawn.player.locations;
        const defaultLocations = this.getDefaultPlayerSpawnPositions();
        if (dtoLocations.length > 0) {
            return defaultLocations.map((defaultLocation, index) => {
                const location = dtoLocations[index];
                if (location === undefined) {
                    return new core_1.Vector(defaultLocation.x, defaultLocation.y);
                }
                return this.createWorldPosition(location.x, location.y);
            });
        }
        return defaultLocations.map((location) => {
            return new core_1.Vector(location.x, location.y);
        });
    }
    getEnemySpawnPositions() {
        const dtoLocations = this.dto.spawn.enemy.locations;
        const defaultLocations = this.getDefaultEnemySpawnPositions();
        if (dtoLocations.length > 0) {
            return defaultLocations.map((defaultLocation, index) => {
                const location = dtoLocations[index];
                if (location === undefined) {
                    return new core_1.Vector(defaultLocation.x, defaultLocation.y);
                }
                return this.createWorldPosition(location.x, location.y);
            });
        }
        return defaultLocations.map((location) => {
            return new core_1.Vector(location.x, location.y);
        });
    }
    getEnemySpawnList() {
        const types = this.dto.spawn.enemy.list.map((item) => {
            return new TankType_1.TankType(TankParty_1.TankParty.Enemy, item.tier, item.drop);
        });
        return types;
    }
    isEnemySpawnListEmpty() {
        return this.dto.spawn.enemy.list.length === 0;
    }
    fillEnemySpawnList(type) {
        for (let i = 0; i < config.ENEMY_MAX_TOTAL_COUNT; i += 1) {
            this.dto.spawn.enemy.list[i] = {
                tier: type.tier,
                drop: type.hasDrop,
            };
        }
    }
    setEnemySpawnListItem(index, type) {
        this.dto.spawn.enemy.list[index] = {
            tier: type.tier,
            drop: type.hasDrop,
        };
    }
    getBasePosition() {
        const location = this.dto.base;
        if (location === undefined) {
            return this.getDefaultBasePosition();
        }
        return this.createWorldPosition(location.x, location.y);
    }
    setBasePosition(position) {
        this.dto.base = this.createStorageLocation(position.x, position.y);
    }
    setPlayerSpawnLocation(index, position) {
        this.dto.spawn.player.locations[index] = this.createStorageLocation(position.x, position.y);
    }
    setEnemySpawnLocation(index, position) {
        if (this.isEnemySpawnListEmpty()) {
            this.fillEnemySpawnList(TankType_1.TankType.EnemyA());
        }
        this.dto.spawn.enemy.locations[index] = this.createStorageLocation(position.x, position.y);
    }
    toJSON(argOptions = {}) {
        const options = Object.assign({}, DEFAULT_TO_JSON_OPTIONS, argOptions);
        let json;
        if (options.pretty) {
            json = JSON.stringify(this.dto, null, 2);
        }
        else {
            json = JSON.stringify(this.dto);
        }
        return json;
    }
    fromJSON(json) {
        const dto = JSON.parse(json);
        this.dto = this.fillAndValidate(dto);
    }
    createWorldPosition(x, y) {
        if (!this.shouldOffsetLegacyContent()) {
            return new core_1.Vector(x, y);
        }
        const legacyOffset = this.getLegacyOffset();
        return new core_1.Vector(x + legacyOffset.x, y + legacyOffset.y);
    }
    shouldOffsetLegacyContent() {
        return this.dto.version < 2 && this.getFieldHeight() > config.LEGACY_FIELD_SIZE;
    }
    createStorageLocation(x, y) {
        if (!this.shouldOffsetLegacyContent()) {
            return { x, y };
        }
        const legacyOffset = this.getLegacyOffset();
        return {
            x: x - legacyOffset.x,
            y: y - legacyOffset.y,
        };
    }
    createStorageRect(rect) {
        const location = this.createStorageLocation(rect.x, rect.y);
        return new core_1.Rect(location.x, location.y, rect.width, rect.height);
    }
    createStorageRegion(region) {
        const location = this.createStorageLocation(region.x, region.y);
        return {
            ...region,
            x: location.x,
            y: location.y,
        };
    }
    getLegacyOffset() {
        return new core_1.Vector(0, Math.max(0, this.getFieldHeight() - config.LEGACY_FIELD_SIZE));
    }
    getDefaultBasePosition() {
        return new core_1.Vector(Math.floor((this.getFieldWidth() - config.BASE_DEFAULT_SIZE.width) / 2), this.getFieldHeight() - config.BASE_DEFAULT_SIZE.height);
    }
    getDefaultPlayerSpawnPositions() {
        const basePosition = this.getDefaultBasePosition();
        const y = this.getFieldHeight() - config.TILE_SIZE_LARGE;
        return [
            new core_1.Vector(Math.max(0, basePosition.x - config.TILE_SIZE_LARGE - config.TILE_SIZE_MEDIUM), y),
            new core_1.Vector(Math.min(this.getFieldWidth() - config.TILE_SIZE_LARGE, basePosition.x + config.BASE_DEFAULT_SIZE.width + config.TILE_SIZE_MEDIUM), y),
        ];
    }
    getDefaultEnemySpawnPositions() {
        const rightX = Math.max(0, this.getFieldWidth() - config.TILE_SIZE_LARGE);
        const centerX = Math.max(0, Math.floor((rightX / 2) / config.TILE_SIZE_LARGE) * config.TILE_SIZE_LARGE);
        return [new core_1.Vector(centerX, 0), new core_1.Vector(rightX, 0), new core_1.Vector(0, 0)];
    }
    clampContentToFieldBounds() {
        const fieldRect = new core_1.Rect(0, 0, this.getFieldWidth(), this.getFieldHeight());
        this.dto.terrain.regions = this.getTerrainRegions()
            .map((region) => {
            const clampedX = Math.max(0, Math.min(region.x, fieldRect.width));
            const clampedY = Math.max(0, Math.min(region.y, fieldRect.height));
            const clampedWidth = Math.max(0, Math.min(region.width, fieldRect.width - clampedX));
            const clampedHeight = Math.max(0, Math.min(region.height, fieldRect.height - clampedY));
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
        const basePosition = this.clampObjectPosition(this.getBasePosition(), config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
        this.dto.base = this.createStorageLocation(basePosition.x, basePosition.y);
    }
    clampObjectPosition(position, width, height) {
        return new core_1.Vector(Math.max(0, Math.min(position.x, this.getFieldWidth() - width)), Math.max(0, Math.min(position.y, this.getFieldHeight() - height)));
    }
    upgradeLegacyContentToCurrentCoordinates() {
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
exports.MapConfig = MapConfig;
