"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelMatchLifecycle = exports.prepareLevelSession = void 0;
const powerup_1 = require("../powerup");
const tank_1 = require("../tank");
function prepareLevelSession(session, enemyTotal) {
    session.startLevelStats(enemyTotal);
    const extraLives = session.consumeInitialExtraLives();
    for (let index = 0; index < extraLives; index += 1) {
        session.primaryPlayer.addLife();
        if (session.isMultiplayer()) {
            session.secondaryPlayer.addLife();
        }
    }
}
exports.prepareLevelSession = prepareLevelSession;
class LevelMatchLifecycle {
    constructor(eventBus, session, scripts) {
        this.eventBus = eventBus;
        this.session = session;
        this.scripts = scripts;
        this.result = null;
        this.completed = false;
        this.handleBaseDied = () => {
            this.activateGameOver();
        };
        this.handleEnemyAllDied = () => {
            this.scripts.pause?.disable();
            this.scripts.win.enable();
        };
        this.handleEnemyDied = (event) => {
            if (event.networkMirror === true) {
                return;
            }
            this.session.recordEnemyDefeated();
            if (event.reason === tank_1.TankDeathReason.WipeoutPowerup ||
                event.hitterPartyIndex === null ||
                event.hitterPartyIndex === undefined) {
                return;
            }
            this.session
                .getPlayer(event.hitterPartyIndex)
                .addKillPoints(event.type.tier);
        };
        this.handlePlayerDied = (event) => {
            const playerSession = this.session.getPlayer(event.partyIndex);
            playerSession.removeLife();
            if (this.session.isAnyPlayerAlive()) {
                if (!playerSession.isAlive()) {
                    this.scripts.playerOver.setPlayerIndex(event.partyIndex);
                    this.scripts.playerOver.enable();
                }
                return;
            }
            this.activateGameOver();
        };
        this.handlePowerupPicked = (event) => {
            const playerSession = this.session.getPlayer(event.partyIndex);
            if (!playerSession.isAlive()) {
                return;
            }
            playerSession.addPowerupPoints(event.type);
            if (event.type === powerup_1.PowerupType.Life) {
                playerSession.addLife();
            }
        };
        eventBus.baseDied.addListener(this.handleBaseDied);
        eventBus.enemyAllDied.addListener(this.handleEnemyAllDied);
        eventBus.enemyDied.addListener(this.handleEnemyDied);
        eventBus.playerDied.addListener(this.handlePlayerDied);
        eventBus.powerupPicked.addListener(this.handlePowerupPicked);
        eventBus.levelGameOverCompleted.addListener(() => {
            this.result = 'loss';
            this.completed = true;
        });
        eventBus.levelWinCompleted.addListener(() => {
            if (!this.session.isGameOver()) {
                this.result = 'win';
                this.completed = true;
            }
        });
    }
    isComplete() {
        return this.completed;
    }
    getResult() {
        return this.result;
    }
    loseMatch() {
        this.activateGameOver();
    }
    activateGameOver() {
        this.result = 'loss';
        this.completed = false;
        this.session.setGameOver();
        this.scripts.pause?.disable();
        this.scripts.player.disable();
        this.scripts.gameOver.enable();
        this.scripts.win.disable();
    }
}
exports.LevelMatchLifecycle = LevelMatchLifecycle;
