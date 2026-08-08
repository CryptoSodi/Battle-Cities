"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = exports.createEmptyRunBoosts = void 0;
const SessionPlayer_1 = require("./SessionPlayer");
const tank_1 = require("../tank");
function createEmptyRunBoosts() {
    return { hull: 0, armor: 0, engine: 0, salvage: 0 };
}
exports.createEmptyRunBoosts = createEmptyRunBoosts;
var State;
(function (State) {
    State[State["Idle"] = 0] = "Idle";
    State[State["Playing"] = 1] = "Playing";
    State[State["GameOver"] = 2] = "GameOver";
})(State || (State = {}));
class Session {
    constructor() {
        this.primaryPlayer = new SessionPlayer_1.SessionPlayer();
        this.secondaryPlayer = new SessionPlayer_1.SessionPlayer();
        this.players = [];
        this.reset();
        this.players.push(this.primaryPlayer, this.secondaryPlayer);
    }
    start(startLevelNumber, endLevelNumber) {
        if (this.state !== State.Idle) {
            return;
        }
        this.startLevelNumber = startLevelNumber;
        this.endLevelNumber = endLevelNumber;
        this.currentLevelNumber = startLevelNumber;
        this.state = State.Playing;
    }
    reset() {
        this.seenIntro = false;
        this.startLevelNumber = 1;
        this.currentLevelNumber = 1;
        this.endLevelNumber = 1;
        this.state = State.Idle;
        this.playtest = false;
        this.multiplayer = false;
        this.runConsumables = {
            powerups: [],
            powerupItems: [],
            powerupCounts: [],
            extraLives: 0,
        };
        this.runExtraLivesApplied = false;
        this.runBoosts = createEmptyRunBoosts();
        this.playerTankTiers = [tank_1.TankTier.A, tank_1.TankTier.A];
        this.levelEnemyTotal = 0;
        this.levelEnemiesDefeated = 0;
        this.levelDurationTicks = 0;
        this.primaryPlayer.reset();
        this.secondaryPlayer.reset();
    }
    getPlayer(playerIndex) {
        return this.players[playerIndex];
    }
    getPlayers() {
        return this.players;
    }
    isAnyPlayerAlive() {
        if (!this.multiplayer) {
            return this.primaryPlayer.isAlive();
        }
        return this.players.some((player) => {
            return player.isAlive();
        });
    }
    resetExceptIntro() {
        this.startLevelNumber = 1;
        this.currentLevelNumber = 1;
        this.endLevelNumber = 1;
        this.state = State.Idle;
        this.playtest = false;
        this.playerTankTiers = [tank_1.TankTier.A, tank_1.TankTier.A];
        this.runExtraLivesApplied = false;
        this.primaryPlayer.reset();
        this.secondaryPlayer.reset();
    }
    activateNextLevel() {
        this.currentLevelNumber += 1;
        this.primaryPlayer.completeLevel();
        this.secondaryPlayer.completeLevel();
    }
    getMaxLevelPoints() {
        let maxPoints = 0;
        for (const player of this.players) {
            const points = player.getLevelPoints();
            if (points > maxPoints) {
                maxPoints = points;
            }
        }
        return maxPoints;
    }
    getMaxGamePoints() {
        let maxPoints = 0;
        for (const player of this.players) {
            const points = player.getGamePoints();
            if (points > maxPoints) {
                maxPoints = points;
            }
        }
        return maxPoints;
    }
    anybodyHasBonusPoints() {
        return this.players.some((player) => {
            return player.hasBonusPoints();
        });
    }
    getLevelNumber() {
        return this.currentLevelNumber;
    }
    isLastLevel() {
        return this.currentLevelNumber === this.endLevelNumber;
    }
    setGameOver() {
        this.state = State.GameOver;
    }
    isGameOver() {
        return this.state === State.GameOver;
    }
    setSeenIntro(seenIntro) {
        this.seenIntro = seenIntro;
    }
    haveSeenIntro() {
        return this.seenIntro;
    }
    setPlaytest() {
        this.playtest = true;
    }
    resetPlaytest() {
        this.playtest = false;
    }
    isPlaytest() {
        return this.playtest;
    }
    setMultiplayer() {
        this.multiplayer = true;
    }
    isMultiplayer() {
        return this.multiplayer;
    }
    setRunConsumables(runConsumables) {
        this.runConsumables = runConsumables;
        this.runExtraLivesApplied = false;
    }
    getRunConsumables() {
        return this.runConsumables;
    }
    consumeInitialExtraLives() {
        if (this.runExtraLivesApplied) {
            return 0;
        }
        this.runExtraLivesApplied = true;
        return Math.max(0, Math.floor(this.runConsumables.extraLives || 0));
    }
    clearRunConsumables() {
        this.runConsumables = {
            powerups: [],
            powerupItems: [],
            powerupCounts: [],
            extraLives: 0,
        };
        this.runExtraLivesApplied = false;
    }
    setRunBoosts(runBoosts) {
        this.runBoosts = {
            hull: clampBoostPercent(runBoosts?.hull),
            armor: clampBoostPercent(runBoosts?.armor),
            engine: clampBoostPercent(runBoosts?.engine),
            salvage: clampBoostPercent(runBoosts?.salvage),
        };
    }
    getRunBoosts() {
        return this.runBoosts;
    }
    setPlayerTankTier(playerIndex, tier) {
        if (playerIndex < 0 || playerIndex >= this.playerTankTiers.length) {
            return;
        }
        this.playerTankTiers[playerIndex] = isTankTier(tier) ? tier : tank_1.TankTier.A;
    }
    getPlayerTankTier(playerIndex) {
        return this.playerTankTiers[playerIndex] || tank_1.TankTier.A;
    }
    getPlayerTankTiers() {
        return this.playerTankTiers.slice();
    }
    startLevelStats(enemyTotal) {
        this.levelEnemyTotal = Math.max(0, Math.floor(enemyTotal));
        this.levelEnemiesDefeated = 0;
        this.levelDurationTicks = 0;
    }
    recordLevelTick() {
        this.levelDurationTicks += 1;
    }
    recordEnemyDefeated() {
        this.levelEnemiesDefeated += 1;
    }
    getLevelEnemyTotal() {
        return this.levelEnemyTotal;
    }
    getLevelEnemiesDefeated() {
        return this.levelEnemiesDefeated;
    }
    getLevelDurationTicks() {
        return this.levelDurationTicks;
    }
}
exports.Session = Session;
// Boost effects feed the simulation, so keep inputs sane regardless of what
// the server (or an old replay file) hands over.
function clampBoostPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.min(60, Math.floor(parsed)));
}
function isTankTier(value) {
    return (value === tank_1.TankTier.A ||
        value === tank_1.TankTier.B ||
        value === tank_1.TankTier.C ||
        value === tank_1.TankTier.D);
}
