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
exports.EditorMap = void 0;
const core_1 = require("../../core");
const terrain_1 = require("../../terrain");
const config = __importStar(require("../../config"));
const Base_1 = require("../Base");
const EditorBaseBrush_1 = require("./EditorBaseBrush");
const EditorBrush_1 = require("./EditorBrush");
const EditorEraserBrush_1 = require("./EditorEraserBrush");
const EditorSpawnBrush_1 = require("./EditorSpawnBrush");
const EditorTool_1 = require("./EditorTool");
class EditorMap extends core_1.GameObject {
    constructor(mapConfig) {
        super(mapConfig.getFieldWidth(), mapConfig.getFieldHeight());
        this.selectedBrushIndexChanged = new core_1.Subject();
        this.handleDraw = () => {
            const brush = this.tool.getSelectedBrush();
            if (brush instanceof EditorEraserBrush_1.EditorEraserBrush) {
                this.handleErase();
                return;
            }
            if (brush instanceof EditorBaseBrush_1.EditorBaseBrush || brush instanceof Base_1.Base) {
                const position = this.tool.position.clone();
                this.mapConfig.setBasePosition(position);
                this.field.setBasePosition(position.x, position.y);
                return;
            }
            if (brush instanceof EditorSpawnBrush_1.EditorSpawnBrush) {
                this.placeSpawn(brush.spawnType);
                return;
            }
            // Remove existing tiles first
            this.clearRect(this.tool.getBoundingBox().toRect());
            const region = {
                type: brush.type,
                x: this.tool.position.x,
                y: this.tool.position.y,
                width: this.tool.size.width,
                height: this.tool.size.height,
            };
            this.mapConfig.addTerrainRegion(region);
            const tiles = terrain_1.TerrainFactory.createFromRegionConfigs([region]);
            this.container.add(...tiles);
        };
        this.handleErase = () => {
            this.clearRect(this.tool.getBoundingBox().toRect());
        };
        this.handleBrushChanged = (brush) => {
            const selectedBrushIndex = this.tool.getSelectedBrushIndex();
            this.selectedBrushIndexChanged.notify(selectedBrushIndex);
        };
        this.mapConfig = mapConfig;
        this.brushDefinitions = this.createBrushDefinitions();
    }
    setField(field) {
        this.field = field;
    }
    getSelectedBrushIndex() {
        if (this.tool === undefined) {
            return 0;
        }
        return this.tool.getSelectedBrushIndex();
    }
    getPaletteEntries() {
        return this.brushDefinitions.map((definition) => {
            return {
                label: definition.label.replace('BRUSH ', ''),
                createPreview: definition.createBrush,
            };
        });
    }
    selectBrushIndex(index) {
        this.tool.selectBrushIndex(index);
    }
    setCursorWorldPosition(position) {
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
    drawAtCursor() {
        this.handleDraw();
    }
    eraseAtCursor() {
        this.handleErase();
    }
    getToolCenter() {
        if (this.tool === undefined) {
            return new core_1.Vector(0, 0);
        }
        return this.tool.getCenter();
    }
    setup() {
        // Holds all map tiles
        this.container = new core_1.GameObject();
        this.container.size.copyFrom(this.size);
        this.add(this.container);
        const terrainRegions = this.mapConfig.getTerrainRegions();
        terrainRegions.forEach((region) => {
            const tiles = terrain_1.TerrainFactory.createFromRegionConfigs([region]);
            this.container.add(...tiles);
        });
        const brushes = this.brushDefinitions.map((definition) => definition.createBrush());
        this.tool = new EditorTool_1.EditorTool();
        this.tool.position.set(64, 64);
        this.tool.brushChanged.addListener(this.handleBrushChanged);
        this.tool.draw.addListener(this.handleDraw);
        this.tool.erase.addListener(this.handleErase);
        this.add(this.tool);
        this.tool.setBrushes(brushes);
        this.handleBrushChanged(this.tool.getSelectedBrush());
    }
    clearRect(rect) {
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
    placeSpawn(spawnType) {
        const position = this.tool.position.clone();
        if (spawnType === EditorSpawnBrush_1.EditorSpawnType.Player0) {
            this.mapConfig.setPlayerSpawnLocation(0, position);
            this.field.setPlayerSpawnPosition(0, position.x, position.y);
            return;
        }
        if (spawnType === EditorSpawnBrush_1.EditorSpawnType.Player1) {
            this.mapConfig.setPlayerSpawnLocation(1, position);
            this.field.setPlayerSpawnPosition(1, position.x, position.y);
            return;
        }
        const enemyIndex = spawnType - EditorSpawnBrush_1.EditorSpawnType.Enemy0;
        this.mapConfig.setEnemySpawnLocation(enemyIndex, position);
        this.field.setEnemySpawnPosition(enemyIndex, position.x, position.y);
    }
    getBrushLabels() {
        return this.brushDefinitions.map((definition) => definition.label);
    }
    createBrushDefinitions() {
        const { TILE_SIZE_SMALL, TILE_SIZE_MEDIUM, TILE_SIZE_LARGE } = config;
        return [
            this.createTerrainBrushDefinition('BRICK 16X16', TILE_SIZE_SMALL, TILE_SIZE_SMALL, terrain_1.TerrainType.Brick),
            this.createTerrainBrushDefinition('BRICK 32X32', TILE_SIZE_MEDIUM, TILE_SIZE_MEDIUM, terrain_1.TerrainType.Brick),
            this.createTerrainBrushDefinition('BRICK 64X64', TILE_SIZE_LARGE, TILE_SIZE_LARGE, terrain_1.TerrainType.Brick),
            this.createTerrainBrushDefinition('STEEL 32X32', TILE_SIZE_MEDIUM, TILE_SIZE_MEDIUM, terrain_1.TerrainType.Steel),
            this.createTerrainBrushDefinition('STEEL 64X64', TILE_SIZE_LARGE, TILE_SIZE_LARGE, terrain_1.TerrainType.Steel),
            this.createTerrainBrushDefinition('JUNGLE 32X32', TILE_SIZE_MEDIUM, TILE_SIZE_MEDIUM, terrain_1.TerrainType.Jungle),
            this.createTerrainBrushDefinition('JUNGLE 64X64', TILE_SIZE_LARGE, TILE_SIZE_LARGE, terrain_1.TerrainType.Jungle),
            this.createTerrainBrushDefinition('WATER 32X32', TILE_SIZE_MEDIUM, TILE_SIZE_MEDIUM, terrain_1.TerrainType.Water),
            this.createTerrainBrushDefinition('WATER 64X64', TILE_SIZE_LARGE, TILE_SIZE_LARGE, terrain_1.TerrainType.Water),
            this.createTerrainBrushDefinition('ICE 32X32', TILE_SIZE_MEDIUM, TILE_SIZE_MEDIUM, terrain_1.TerrainType.Ice),
            this.createTerrainBrushDefinition('ICE 64X64', TILE_SIZE_LARGE, TILE_SIZE_LARGE, terrain_1.TerrainType.Ice),
            this.createBaseBrushDefinition(),
            this.createEraserBrushDefinition(),
            this.createSpawnBrushDefinition('PLAYER 1 SPAWN', EditorSpawnBrush_1.EditorSpawnType.Player0),
            this.createSpawnBrushDefinition('PLAYER 2 SPAWN', EditorSpawnBrush_1.EditorSpawnType.Player1),
            this.createSpawnBrushDefinition('ENEMY 1 SPAWN', EditorSpawnBrush_1.EditorSpawnType.Enemy0),
            this.createSpawnBrushDefinition('ENEMY 2 SPAWN', EditorSpawnBrush_1.EditorSpawnType.Enemy1),
            this.createSpawnBrushDefinition('ENEMY 3 SPAWN', EditorSpawnBrush_1.EditorSpawnType.Enemy2),
        ];
    }
    createTerrainBrushDefinition(label, width, height, type) {
        return {
            createBrush: () => new EditorBrush_1.EditorBrush(width, height, type),
            label: `BRUSH ${label}`,
        };
    }
    createSpawnBrushDefinition(label, spawnType) {
        return {
            createBrush: () => new EditorSpawnBrush_1.EditorSpawnBrush(spawnType),
            label: `BRUSH ${label}`,
        };
    }
    createBaseBrushDefinition() {
        return {
            createBrush: () => new EditorBaseBrush_1.EditorBaseBrush(),
            label: 'BRUSH BASE',
        };
    }
    createEraserBrushDefinition() {
        return {
            createBrush: () => new EditorEraserBrush_1.EditorEraserBrush(),
            label: 'BRUSH ERASER',
        };
    }
}
exports.EditorMap = EditorMap;
