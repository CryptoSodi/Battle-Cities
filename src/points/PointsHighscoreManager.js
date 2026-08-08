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
exports.PointsHighscoreManager = void 0;
const api_1 = require("../network/api");
const config = __importStar(require("../config"));
class PointsHighscoreManager {
    constructor(storage) {
        this.storage = storage;
    }
    getPrimaryPoints() {
        const points = this.storage.getNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY, 0);
        return points;
    }
    savePrimaryPoints(points) {
        this.storage.setNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY, points);
        this.storage.save();
    }
    getSecondaryPoints() {
        const points = this.storage.getNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY, 0);
        return points;
    }
    saveSecondaryPoints(points) {
        this.storage.setNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY, points);
        this.storage.save();
    }
    getOverallMaxPoints() {
        const primaryPoints = this.getPrimaryPoints();
        const secondaryPoints = this.getSecondaryPoints();
        const points = [primaryPoints, secondaryPoints, config.DEFAULT_HIGHSCORE];
        const maxPoints = Math.max(...points);
        return maxPoints;
    }
    async syncWithServer() {
        try {
            const response = await (0, api_1.apiFetch)('/api/player', {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    highscorePrimary: this.getPrimaryPoints(),
                    highscoreSecondary: this.getSecondaryPoints(),
                }),
            });
            if (!response.ok) {
                return;
            }
            const body = await response.json();
            const player = body?.player;
            if (typeof player?.highscorePrimary !== 'number' ||
                typeof player?.highscoreSecondary !== 'number') {
                return;
            }
            this.storage.setNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY, Math.max(this.getPrimaryPoints(), player.highscorePrimary));
            this.storage.setNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY, Math.max(this.getSecondaryPoints(), player.highscoreSecondary));
            this.storage.save();
        }
        catch {
            // Highscore sync is best-effort; local play must remain available.
        }
    }
}
exports.PointsHighscoreManager = PointsHighscoreManager;
