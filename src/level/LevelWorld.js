"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelWorld = void 0;
const gameObjects_1 = require("../gameObjects");
class LevelWorld {
    constructor(sceneRoot, fieldWidth, fieldHeight) {
        this.playerTanks = [];
        this.sceneRoot = sceneRoot;
        this.field = new gameObjects_1.Field(fieldWidth, fieldHeight);
    }
    addPlayerTank(playerIndex, playerTank) {
        this.playerTanks[playerIndex] = playerTank;
        this.field.add(playerTank);
    }
    removePlayerTank(playerIndex) {
        const playerTank = this.playerTanks[playerIndex];
        if (playerTank === null || playerTank === undefined) {
            return;
        }
        playerTank.removeSelf();
        this.playerTanks[playerIndex] = null;
    }
    getPlayerTanks() {
        return this.playerTanks;
    }
}
exports.LevelWorld = LevelWorld;
