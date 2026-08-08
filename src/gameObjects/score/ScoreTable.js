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
exports.ScoreTable = void 0;
const core_1 = require("../../core");
const TankTier_1 = require("../../tank/TankTier"); // TODO: circular dep?
const config = __importStar(require("../../config"));
const text_1 = require("../text");
const ScoreTableCounter_1 = require("./ScoreTableCounter");
const ScoreTableTierIcon_1 = require("./ScoreTableTierIcon");
const ScoreTableUnderline_1 = require("./ScoreTableUnderline");
var State;
(function (State) {
    State[State["Idle"] = 0] = "Idle";
    State[State["Transitioning"] = 1] = "Transitioning";
    State[State["Counting"] = 2] = "Counting";
    State[State["Done"] = 3] = "Done";
})(State || (State = {}));
const TIERS = [TankTier_1.TankTier.A, TankTier_1.TankTier.B, TankTier_1.TankTier.C, TankTier_1.TankTier.D];
const TRANSITION_DELAY = 0.4;
const MULTIPLAYER_WIDTH = 836;
const SINGLE_PLAYER_LABEL_X = 256;
const SINGLE_PLAYER_COUNTER_X = 4;
const SINGLE_PLAYER_TOTAL_X = 256;
const SINGLE_PLAYER_TOTAL_KILLS_X = 348;
const MULTIPLAYER_PRIMARY_LABEL_X = 256;
const MULTIPLAYER_SECONDARY_LABEL_X = 836;
const MULTIPLAYER_PRIMARY_COUNTER_X = 4;
const MULTIPLAYER_SECONDARY_COUNTER_X = 492;
const MULTIPLAYER_TOTAL_X = 256;
const MULTIPLAYER_PRIMARY_TOTAL_KILLS_X = 348;
const MULTIPLAYER_SECONDARY_TOTAL_KILLS_X = 546;
class ScoreTable extends core_1.GameObject {
    constructor(isMultiplayer = false) {
        super(MULTIPLAYER_WIDTH, 544);
        this.done = new core_1.Subject();
        this.primaryPlayerLabel = new text_1.SpriteText('Ⅰ-PLAYER', {
            color: config.COLOR_RED,
        });
        this.secondaryPlayerLabel = new text_1.SpriteText('Ⅱ-PLAYER', {
            color: config.COLOR_RED,
        });
        this.underline = new ScoreTableUnderline_1.ScoreTableUnderline();
        this.primaryGamePoints = new text_1.SpriteText('', {
            color: config.COLOR_YELLOW,
        });
        this.secondaryGamePoints = new text_1.SpriteText('', {
            color: config.COLOR_YELLOW,
        });
        this.totalLabel = new text_1.SpriteText('TOTAL', { color: config.COLOR_WHITE });
        this.primaryTotalKills = new text_1.SpriteText('', { color: config.COLOR_WHITE });
        this.secondaryTotalKills = new text_1.SpriteText('', {
            color: config.COLOR_WHITE,
        });
        this.counters = [];
        this.currentCounterIndex = 0;
        this.state = State.Idle;
        this.transitionTimer = new core_1.Timer();
    }
    setup({ session }) {
        this.session = session;
        const isMultiplayer = this.session.isMultiplayer();
        const primaryLabelX = isMultiplayer
            ? MULTIPLAYER_PRIMARY_LABEL_X
            : SINGLE_PLAYER_LABEL_X;
        const primaryCounterX = isMultiplayer
            ? MULTIPLAYER_PRIMARY_COUNTER_X
            : SINGLE_PLAYER_COUNTER_X;
        const totalX = isMultiplayer
            ? MULTIPLAYER_TOTAL_X
            : SINGLE_PLAYER_TOTAL_X;
        const primaryTotalKillsX = isMultiplayer
            ? MULTIPLAYER_PRIMARY_TOTAL_KILLS_X
            : SINGLE_PLAYER_TOTAL_KILLS_X;
        this.primaryPlayerLabel.position.set(primaryLabelX, 0);
        this.primaryPlayerLabel.origin.setX(1);
        this.add(this.primaryPlayerLabel);
        if (isMultiplayer) {
            this.secondaryPlayerLabel.position.set(MULTIPLAYER_SECONDARY_LABEL_X, 0);
            this.secondaryPlayerLabel.origin.setX(1);
            this.add(this.secondaryPlayerLabel);
        }
        // For player total points display sum of all levels and current level
        this.primaryGamePoints.setText(this.session.primaryPlayer.getGamePoints().toString());
        this.primaryGamePoints.position.set(primaryLabelX, 64);
        this.primaryGamePoints.origin.set(1, 0);
        this.add(this.primaryGamePoints);
        if (isMultiplayer) {
            this.secondaryGamePoints.setText(this.session.secondaryPlayer.getGamePoints().toString());
            this.secondaryGamePoints.position.set(MULTIPLAYER_SECONDARY_LABEL_X, 64);
            this.secondaryGamePoints.origin.set(1, 0);
            this.add(this.secondaryGamePoints);
        }
        TIERS.forEach((tier, tierIndex) => {
            const icon = new ScoreTableTierIcon_1.ScoreTableTierIcon(tier, isMultiplayer);
            icon.updateMatrix();
            icon.setCenter(this.getSelfCenter());
            icon.position.setY(136 + 100 * tierIndex);
            this.add(icon);
            const primaryRecord = this.getPrimaryRecord();
            const primaryCost = primaryRecord.getTierKillCost(tier);
            const primaryKills = primaryRecord.getTierKillCount(tier);
            const primaryCounter = new ScoreTableCounter_1.ScoreTableCounter(primaryKills, primaryCost);
            primaryCounter.position.set(primaryCounterX, 152 + 100 * tierIndex);
            this.counters[tierIndex] = this.counters[tierIndex] || [];
            this.counters[tierIndex].push(primaryCounter);
            this.add(primaryCounter);
            if (isMultiplayer) {
                const secondaryRecord = this.getSecondaryRecord();
                const secondaryCost = secondaryRecord.getTierKillCost(tier);
                const secondaryKills = secondaryRecord.getTierKillCount(tier);
                const secondaryCounter = new ScoreTableCounter_1.ScoreTableCounter(secondaryKills, secondaryCost, true);
                secondaryCounter.position.set(MULTIPLAYER_SECONDARY_COUNTER_X, 152 + 100 * tierIndex);
                this.counters[tierIndex] = this.counters[tierIndex] || [];
                this.counters[tierIndex].push(secondaryCounter);
                this.add(secondaryCounter);
            }
        });
        this.underline.updateMatrix();
        this.underline.setCenter(this.getSelfCenter());
        this.underline.position.setY(504);
        this.add(this.underline);
        this.totalLabel.position.set(totalX, 516);
        this.totalLabel.origin.set(1, 0);
        this.add(this.totalLabel);
        this.primaryTotalKills.position.set(primaryTotalKillsX, 516);
        this.primaryTotalKills.origin.set(1, 0);
        this.add(this.primaryTotalKills);
        if (isMultiplayer) {
            this.secondaryTotalKills.position.set(MULTIPLAYER_SECONDARY_TOTAL_KILLS_X, 516);
            this.secondaryTotalKills.origin.set(1, 0);
            this.add(this.secondaryTotalKills);
        }
    }
    update(updateArgs) {
        if (this.state === State.Idle || this.state === State.Done) {
            return;
        }
        if (this.state === State.Transitioning) {
            if (this.transitionTimer.isDone()) {
                if (this.allCountersDone()) {
                    this.finish();
                    return;
                }
                const tierCounters = this.getCurrentCounters();
                for (const tierCounter of tierCounters) {
                    tierCounter.start();
                }
                this.state = State.Counting;
            }
            this.transitionTimer.update(updateArgs.deltaTime);
            return;
        }
        if (this.state === State.Counting) {
            const tierCounters = this.getCurrentCounters();
            const everyTierCounterDone = tierCounters.every((tierCounter) => {
                return tierCounter.isDone();
            });
            if (everyTierCounterDone) {
                if (this.hasNextCounter()) {
                    this.currentCounterIndex += 1;
                }
                this.state = State.Transitioning;
                this.transitionTimer.reset(TRANSITION_DELAY);
                return;
            }
        }
    }
    start() {
        if (this.state !== State.Idle) {
            return;
        }
        this.state = State.Transitioning;
        this.transitionTimer.reset(TRANSITION_DELAY);
    }
    skip() {
        if (this.state === State.Done) {
            return;
        }
        for (const tierCounters of this.counters) {
            for (const tierCounter of tierCounters) {
                tierCounter.skip();
            }
        }
        this.finish();
    }
    finish() {
        this.primaryTotalKills.setText(this.getPrimaryRecord()
            .getKillTotalCount()
            .toString());
        this.secondaryTotalKills.setText(this.getSecondaryRecord()
            .getKillTotalCount()
            .toString());
        this.state = State.Done;
        this.done.notify(null);
    }
    getCurrentCounters() {
        return this.counters[this.currentCounterIndex];
    }
    hasNextCounter() {
        return this.currentCounterIndex < this.counters.length - 1;
    }
    allCountersDone() {
        const lastCounters = this.counters[this.counters.length - 1];
        const allDone = lastCounters.every((counter) => {
            return counter.isDone();
        });
        return allDone;
    }
    getPrimaryRecord() {
        return this.session.primaryPlayer.getLevelPointsRecord();
    }
    getSecondaryRecord() {
        return this.session.secondaryPlayer.getLevelPointsRecord();
    }
}
exports.ScoreTable = ScoreTable;
