"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelAudioScript = void 0;
const game_1 = require("../../game");
const input_1 = require("../../input");
const powerup_1 = require("../../powerup");
const LevelScript_1 = require("../LevelScript");
const MOVE_CONTROLS = [
    ...input_1.LevelPlayInputContext.MoveUp,
    ...input_1.LevelPlayInputContext.MoveDown,
    ...input_1.LevelPlayInputContext.MoveLeft,
    ...input_1.LevelPlayInputContext.MoveRight,
];
var MoveState;
(function (MoveState) {
    MoveState[MoveState["Idle"] = 0] = "Idle";
    MoveState[MoveState["Moving"] = 1] = "Moving";
})(MoveState || (MoveState = {}));
class LevelAudioScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.moveState = MoveState.Idle;
        this.handleBaseDied = () => {
            this.playerExplosionSound.play();
        };
        this.handleEnemyDied = () => {
            // TODO: wipeout powerup explodes multiple enemies, should trigger
            // single audio
            this.audioManager.play('explosion.enemy');
        };
        this.handlePlayerDied = () => {
            this.playerExplosionSound.play();
        };
        this.handlePlayerFired = () => {
            this.audioManager.play('fire');
        };
        this.handlePlayerSlided = () => {
            this.audioManager.play('ice');
        };
        this.handlePowerupSpawned = () => {
            this.audioManager.play('powerup.spawn');
        };
        this.handlePowerupPicked = (event) => {
            // Separate sound for life pickup
            if (event.type === powerup_1.PowerupType.Life) {
                return;
            }
            this.audioManager.play('powerup.pickup');
        };
        this.handlePlayerLifeup = () => {
            this.audioManager.play('life');
        };
        this.handleLevelPaused = () => {
            this.audioManager.pauseAll();
            this.pauseSound.play();
        };
        this.levelUnpaused = () => {
            this.audioManager.resumeAll();
        };
        this.handleLevelGameOverMoveBlocked = () => {
            this.moveSound.stop();
            this.idleSound.stop();
        };
        this.handleLevelWinCompleted = () => {
            this.audioManager.stopAll();
        };
    }
    setup({ audioManager, audioLoader }) {
        this.audioManager = audioManager;
        this.eventBus.baseDied.addListener(this.handleBaseDied);
        this.eventBus.enemyDied.addListener(this.handleEnemyDied);
        this.eventBus.playerDied.addListener(this.handlePlayerDied);
        this.eventBus.playerFired.addListener(this.handlePlayerFired);
        this.eventBus.playerSlided.addListener(this.handlePlayerSlided);
        this.eventBus.powerupSpawned.addListener(this.handlePowerupSpawned);
        this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
        this.eventBus.levelPaused.addListener(this.handleLevelPaused);
        this.eventBus.levelUnpaused.addListener(this.levelUnpaused);
        this.eventBus.levelGameOverMoveBlocked.addListener(this.handleLevelGameOverMoveBlocked);
        this.eventBus.levelWinCompleted.addListener(this.handleLevelWinCompleted);
        this.session.getPlayers().forEach((playerSession) => {
            playerSession.lifeup.addListener(this.handlePlayerLifeup);
        });
        this.moveSound = audioLoader.load('tank.move');
        this.idleSound = audioLoader.load('tank.idle');
        this.pauseSound = audioLoader.load('pause');
        this.playerExplosionSound = audioLoader.load('explosion.player');
        // Play level intro right away. Rest of the sound must be muted until
        // intro finishes.
        const introSound = audioLoader.load('level-intro');
        introSound.ended.addListener(() => {
            this.audioManager.unmuteAll();
        });
        introSound.play();
        this.audioManager.muteAllExcept(introSound, this.pauseSound, this.playerExplosionSound);
        this.idleSound.playLoop();
    }
    update(updateArgs) {
        const { gameState, inputManager, session } = updateArgs;
        const activeMethod = inputManager.getActiveMethod();
        // By default check single-player active input
        let inputMethods = [activeMethod];
        if (session.isMultiplayer()) {
            const playerSessions = session.getPlayers();
            // Get input variants for all players
            inputMethods = playerSessions.map((playerSession) => {
                const playerVariant = playerSession.getInputVariant();
                const playerMethod = inputManager.getMethodByVariant(playerVariant);
                return playerMethod;
            });
        }
        const anybodyMoving = inputMethods.some((inputMethod) => {
            return inputMethod.isHoldAny(MOVE_CONTROLS);
        });
        const everybodyIdle = inputMethods.every((inputMethod) => {
            return inputMethod.isNotHoldAll(MOVE_CONTROLS);
        });
        if (!gameState.is(game_1.GameState.Paused)) {
            // Check if started moving
            if (anybodyMoving && this.moveState !== MoveState.Moving) {
                this.moveState = MoveState.Moving;
                this.idleSound.stop();
                this.moveSound.playLoop();
            }
            // If stopped moving
            if (everybodyIdle && this.moveState !== MoveState.Idle) {
                this.moveState = MoveState.Idle;
                this.moveSound.stop();
                this.idleSound.playLoop();
            }
        }
    }
}
exports.LevelAudioScript = LevelAudioScript;
