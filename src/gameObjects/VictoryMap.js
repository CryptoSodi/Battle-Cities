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
exports.VictoryMap = void 0;
const core_1 = require("../core");
const terrain_1 = require("../terrain");
const config = __importStar(require("../config"));
const SmallExplosion_1 = require("./SmallExplosion");
const Explosion_1 = require("./Explosion");
class VictoryMap extends core_1.GameObject {
    constructor() {
        super(config.CANVAS_WIDTH, 312);
        this.tileDestroyed = new core_1.Subject();
        this.destroyed = new core_1.Subject();
        this.tiles = [];
        this.destroyCount = 1;
        this.shouldDestroy = false;
        this.handleTileDestroyed = (event) => {
            // Whenever tank destroys first tile - the whole show begins
            this.shouldDestroy = true;
            let explosion;
            if (core_1.RandomUtils.number(0, 2) === 0) {
                explosion = new Explosion_1.Explosion();
            }
            else {
                explosion = new SmallExplosion_1.SmallExplosion();
            }
            explosion.updateMatrix();
            explosion.setCenter(event.centerPosition);
            this.add(explosion);
            this.tileDestroyed.notify(null);
        };
    }
    destroy() {
        if (this.tiles.length === 0) {
            this.destroyed.notify(null);
            this.shouldDestroy = false;
            return;
        }
        for (let i = 0; i < this.destroyCount; i += 1) {
            const tile = core_1.RandomUtils.arrayElement(this.tiles);
            if (tile === undefined) {
                return;
            }
            const index = this.tiles.indexOf(tile);
            tile.destroy();
            this.tiles.splice(index, 1);
        }
        this.destroyCount += 1;
    }
    setup() {
        this.tiles = terrain_1.TerrainFactory.createFromRegions(terrain_1.TerrainType.Brick, [
            new core_1.Rect(0, 0, this.size.width, this.size.height),
        ]);
        this.tiles.forEach((tile) => {
            tile.destroyed.addListener(this.handleTileDestroyed);
        });
        this.add(...this.tiles);
    }
    update() {
        if (this.shouldDestroy === false) {
            return;
        }
        this.destroy();
    }
}
exports.VictoryMap = VictoryMap;
