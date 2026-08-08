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
exports.EditorSpawnBrush = exports.EditorSpawnType = void 0;
const game_1 = require("../../game");
const tank_1 = require("../../tank");
const config = __importStar(require("../../config"));
const EditorTankDummy_1 = require("./EditorTankDummy");
var EditorSpawnType;
(function (EditorSpawnType) {
    EditorSpawnType[EditorSpawnType["Player0"] = 0] = "Player0";
    EditorSpawnType[EditorSpawnType["Player1"] = 1] = "Player1";
    EditorSpawnType[EditorSpawnType["Enemy0"] = 2] = "Enemy0";
    EditorSpawnType[EditorSpawnType["Enemy1"] = 3] = "Enemy1";
    EditorSpawnType[EditorSpawnType["Enemy2"] = 4] = "Enemy2";
})(EditorSpawnType = exports.EditorSpawnType || (exports.EditorSpawnType = {}));
class EditorSpawnBrush extends EditorTankDummy_1.EditorTankDummy {
    constructor(spawnType) {
        super(EditorSpawnBrush.getTankType(spawnType), EditorSpawnBrush.getTankColor(spawnType), EditorSpawnBrush.getRotation(spawnType));
        this.zIndex = config.EDITOR_BRUSH_Z_INDEX;
        this.spawnType = spawnType;
    }
    static getTankType(spawnType) {
        if (spawnType === EditorSpawnType.Player0 ||
            spawnType === EditorSpawnType.Player1) {
            return tank_1.TankType.PlayerA();
        }
        return tank_1.TankType.EnemyA();
    }
    static getTankColor(spawnType) {
        if (spawnType === EditorSpawnType.Player0) {
            return tank_1.TankColorFactory.createPlayerColor(0);
        }
        if (spawnType === EditorSpawnType.Player1) {
            return tank_1.TankColorFactory.createPlayerColor(1);
        }
        return tank_1.TankColor.Default;
    }
    static getRotation(spawnType) {
        if (spawnType === EditorSpawnType.Player0 ||
            spawnType === EditorSpawnType.Player1) {
            return game_1.Rotation.Up;
        }
        return game_1.Rotation.Down;
    }
}
exports.EditorSpawnBrush = EditorSpawnBrush;
