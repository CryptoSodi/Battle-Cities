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
exports.LevelInfo = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
const text_1 = require("../text");
const BLOCK_TOP = 20;
const BLOCK_GAP = 16;
const EDGE_PADDING_LEFT = 56;
const EDGE_PADDING_RIGHT = 32;
const CENTER_GAP = 40;
const SCORE_GAP = 48;
const BATTLE_TIME_GAP = 48;
class LevelInfo extends core_1.GameObject {
    constructor(width, isMultiplayer, showBattleTime = false) {
        super(width, config.LEVEL_INFO_HEIGHT);
        this.zIndex = config.LEVEL_INFO_Z_INDEX;
        this.enemyTitle = new text_1.SpriteText('ENEMY', { color: config.COLOR_YELLOW });
        this.enemyValue = new text_1.SpriteText('00', { color: config.COLOR_WHITE });
        this.scoreTitle = new text_1.SpriteText('SCORE', { color: config.COLOR_YELLOW });
        this.scoreValue = new text_1.SpriteText('000000', { color: '#4dff00' });
        this.primaryLivesTitle = new text_1.SpriteText('1P', { color: config.COLOR_YELLOW });
        this.primaryLivesValue = new text_1.SpriteText('00', { color: config.COLOR_WHITE });
        this.secondaryLivesTitle = new text_1.SpriteText('2P', { color: config.COLOR_YELLOW });
        this.secondaryLivesValue = new text_1.SpriteText('00', { color: config.COLOR_WHITE });
        this.stageTitle = new text_1.SpriteText('STAGE', { color: config.COLOR_YELLOW });
        this.stageValue = new text_1.SpriteText('00', { color: config.COLOR_WHITE });
        this.battleTimeTitle = new text_1.SpriteText('BATTLE TIME', {
            color: config.COLOR_YELLOW,
        });
        this.battleTimeValue = new text_1.SpriteText('00:00', {
            color: '#4dff00',
        });
        this.displayedScore = -1;
        this.displayedBattleSecond = -1;
        this.isMultiplayer = isMultiplayer;
        this.showBattleTime = showBattleTime;
    }
    setup() {
        this.painter = new core_1.RectPainter('rgba(6, 6, 6, 0.94)', '#4f4f4f');
        this.add(this.enemyTitle);
        this.add(this.enemyValue);
        this.add(this.scoreTitle);
        this.add(this.scoreValue);
        this.add(this.primaryLivesTitle);
        this.add(this.primaryLivesValue);
        if (this.isMultiplayer) {
            this.add(this.secondaryLivesTitle);
            this.add(this.secondaryLivesValue);
        }
        this.add(this.stageTitle);
        this.add(this.stageValue);
        if (this.showBattleTime) {
            this.add(this.battleTimeTitle);
            this.add(this.battleTimeValue);
        }
        this.layout();
    }
    setLevelNumber(levelNumber) {
        this.stageValue.setText(levelNumber.toString().padStart(2, '0'));
        this.layout();
    }
    setLivesCount(playerIndex, livesCount) {
        const displayLivesCount = Math.max(0, livesCount - 1)
            .toString()
            .padStart(2, '0');
        if (playerIndex === 0) {
            this.primaryLivesValue.setText(displayLivesCount);
        }
        if (playerIndex === 1) {
            this.secondaryLivesValue.setText(displayLivesCount);
        }
        this.layout();
    }
    setEnemyCount(enemyCount) {
        this.enemyValue.setText(enemyCount.toString().padStart(2, '0'));
        this.layout();
    }
    setScore(score) {
        const displayScore = Math.max(0, Math.floor(score));
        if (displayScore === this.displayedScore) {
            return;
        }
        this.displayedScore = displayScore;
        this.scoreValue.setText(displayScore.toString().padStart(6, '0'));
        this.layout();
    }
    setBattleTime(elapsedSeconds) {
        const totalSeconds = Math.max(0, Math.floor(elapsedSeconds));
        if (!this.showBattleTime || totalSeconds === this.displayedBattleSecond) {
            return;
        }
        this.displayedBattleSecond = totalSeconds;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        this.battleTimeValue.setText(`${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`);
        this.layout();
    }
    layout() {
        const enemyWidth = this.getBlockWidth(this.enemyTitle, this.enemyValue);
        const stageWidth = this.getBlockWidth(this.stageTitle, this.stageValue);
        this.positionBlock(this.enemyTitle, this.enemyValue, EDGE_PADDING_LEFT);
        this.positionBlock(this.scoreTitle, this.scoreValue, EDGE_PADDING_LEFT + enemyWidth + SCORE_GAP);
        const stageStartX = this.size.width - EDGE_PADDING_RIGHT - stageWidth;
        this.positionBlock(this.stageTitle, this.stageValue, stageStartX);
        if (this.showBattleTime) {
            const battleTimeWidth = this.getBlockWidth(this.battleTimeTitle, this.battleTimeValue);
            const battleTimeX = stageStartX - BATTLE_TIME_GAP - battleTimeWidth;
            this.positionBlock(this.battleTimeTitle, this.battleTimeValue, battleTimeX);
        }
        const centerX = this.size.width / 2;
        const primaryWidth = this.getBlockWidth(this.primaryLivesTitle, this.primaryLivesValue);
        if (this.isMultiplayer) {
            const secondaryWidth = this.getBlockWidth(this.secondaryLivesTitle, this.secondaryLivesValue);
            const totalPlayersWidth = primaryWidth + CENTER_GAP + secondaryWidth;
            const playerStartX = centerX - totalPlayersWidth / 2;
            this.positionBlock(this.primaryLivesTitle, this.primaryLivesValue, playerStartX);
            this.positionBlock(this.secondaryLivesTitle, this.secondaryLivesValue, playerStartX + primaryWidth + CENTER_GAP);
            return;
        }
        this.positionBlock(this.primaryLivesTitle, this.primaryLivesValue, centerX - primaryWidth / 2);
    }
    positionBlock(title, value, startX) {
        title.position.set(startX, BLOCK_TOP);
        title.updateMatrix();
        value.position.set(startX + title.getTextSize().width + BLOCK_GAP, BLOCK_TOP);
        value.updateMatrix();
    }
    getBlockWidth(title, value) {
        return title.getTextSize().width + BLOCK_GAP + value.getTextSize().width;
    }
}
exports.LevelInfo = LevelInfo;
