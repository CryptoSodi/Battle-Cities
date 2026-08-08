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
exports.AiTankBehavior = void 0;
const core_1 = require("../../core");
const Rotation_1 = require("../../game/Rotation");
const config = __importStar(require("../../config"));
const TankBehavior_1 = require("../TankBehavior");
var State;
(function (State) {
    State[State["Moving"] = 0] = "Moving";
    State[State["Thinking"] = 1] = "Thinking";
    State[State["UnstuckThinking"] = 2] = "UnstuckThinking";
    State[State["Firing"] = 3] = "Firing";
})(State || (State = {}));
const THINK_DURATION = 0.3;
const FIRE_MIN_DELAY = 0;
const FIRE_MAX_DELAY = 1.5;
const STUCK_FIRE_CHANCE = 30;
const UNSTUCK_THINK_CHANCE = 5;
const ROTATE_TOWARDS_BASE_CHANCE = 30;
const ROTATE_UP_CHANCE = 10;
const ROTATIONS = [Rotation_1.Rotation.Up, Rotation_1.Rotation.Down, Rotation_1.Rotation.Left, Rotation_1.Rotation.Right];
class AiTankBehavior extends TankBehavior_1.TankBehavior {
    constructor() {
        super(...arguments);
        this.state = State.Moving;
        this.lastPosition = new core_1.Vector(-1, -1);
        this.thinkTimer = new core_1.Timer();
        this.fireTimer = new core_1.Timer();
        this.log = new core_1.Logger(AiTankBehavior.name, core_1.Logger.Level.Info);
        this.basePosition = new core_1.Vector(config.BASE_DEFAULT_POSITION.x, config.BASE_DEFAULT_POSITION.y);
    }
    setBasePosition(basePosition) {
        this.basePosition = basePosition.clone();
        return this;
    }
    update(tank, updateArgs) {
        this.rng = updateArgs.rng;
        const shootingDisabled = updateArgs.webRtcMatch.shouldDisableEnemyShooting();
        if (shootingDisabled && this.state === State.Firing) {
            this.state = State.Moving;
        }
        if (this.fireTimer.isDone() && !shootingDisabled) {
            const hasFired = tank.fire();
            if (hasFired) {
                this.log.debug('Fire!');
                // If tank decided to fire during thinking phase, we wait for it
                // here and then reset him
                if (this.state === State.Firing) {
                    this.state = State.Moving;
                }
            }
            else {
                this.log.debug('Could not fire :(');
            }
            // Fire next bullet in some random interval
            this.attemptFire();
        }
        else if (this.fireTimer.isDone()) {
            this.attemptFire();
        }
        else {
            this.fireTimer.update(updateArgs.deltaTime);
        }
        // Simply waiting to fire after tank decided to fire
        if (this.state === State.Firing) {
            return;
        }
        if (this.state === State.Thinking || this.state === State.UnstuckThinking) {
            if (this.thinkTimer.isDone()) {
                // When tank is done thinking, he can either fire in his current
                // direction or rotate and move to another direction. First, find out
                // if he wants to fire.
                if (!shootingDisabled &&
                    this.state === State.Thinking &&
                    this.shouldFireWhenStuck()) {
                    this.log.debug('I am done thinking. I want to fire!');
                    this.state = State.Firing;
                    return;
                }
                // Otherwise, we pick some new random direction
                this.state = State.Moving;
                const nextRotation = this.getNextRotation(tank);
                this.log.debug('I am done thinking. Rotating %s', nextRotation);
                tank.rotate(nextRotation);
                return;
            }
            this.thinkTimer.update(updateArgs.deltaTime);
            return;
        }
        tank.move(updateArgs.deltaTime);
        // Position might come as floats, but we need precise ints in here to
        // check if positions is exactly the same
        const tankPosition = tank.position.clone().round();
        // If tank can no longer move it his direction, he has to decide what to do
        // next.
        const isStuck = this.lastPosition.equals(tankPosition) && this.state === State.Moving;
        if (isStuck) {
            this.log.debug('I am stuck. Thinking...');
            this.state = State.Thinking;
            this.thinkTimer.reset(THINK_DURATION);
            return;
        }
        // If tank is not stuck and can still move in his direction, there is a
        // chance that he will do something instead of just moving forward
        if (this.shouldThinkWhenUnstuck(tank)) {
            this.log.debug('I changed my mind all of a sudden. Thinking...');
            this.state = State.UnstuckThinking;
            this.thinkTimer.reset(THINK_DURATION);
            return;
        }
        this.lastPosition = tankPosition;
    }
    attemptFire() {
        // Convert seconds to milliseconds to use random integer func
        const min = FIRE_MIN_DELAY * 1000;
        const max = FIRE_MAX_DELAY * 1000;
        const delay = this.rng.number(min, max) / 1000;
        this.log.debug('I will try to fire in %f seconds', delay);
        this.fireTimer.reset(delay);
    }
    shouldThinkWhenUnstuck(tank) {
        const num = this.rng.number(1, 100);
        const hasChance = num <= UNSTUCK_THINK_CHANCE;
        const { rotation, position } = tank;
        const isTankVertical = rotation === Rotation_1.Rotation.Up || rotation === Rotation_1.Rotation.Down;
        const isTankHorizontal = rotation === Rotation_1.Rotation.Left || rotation === Rotation_1.Rotation.Right;
        const tileSize = config.TILE_SIZE_MEDIUM;
        const isTankOnTileX = isTankHorizontal && position.x % tileSize === 0;
        const isTankOnTileY = isTankVertical && position.y % tileSize === 0;
        const shouldThink = hasChance && (isTankOnTileX || isTankOnTileY);
        return shouldThink;
    }
    shouldFireWhenStuck() {
        const shouldFire = this.rng.probability(STUCK_FIRE_CHANCE);
        return shouldFire;
    }
    getNextRotation(tank) {
        const shouldRotateTowardsBase = this.rng.probability(ROTATE_TOWARDS_BASE_CHANCE);
        if (shouldRotateTowardsBase) {
            this.log.debug('I want to go towards base');
            return this.getRotationTowardsBase(tank);
        }
        // Enemy should rotate up less, because base it at the bottom
        const shouldRotateUp = this.rng.probability(ROTATE_UP_CHANCE);
        if (shouldRotateUp) {
            this.log.debug('I want to go up');
            return Rotation_1.Rotation.Up;
        }
        return this.getRandomRotationExcept(Rotation_1.Rotation.Up);
    }
    getRandomRotation() {
        return this.rng.arrayElement(ROTATIONS);
    }
    getRandomRotationExcept(prevRotation) {
        const rotations = ROTATIONS.slice();
        // Remove prev rotation from possible outcomes
        const prevIndex = rotations.indexOf(prevRotation);
        rotations.splice(prevIndex, 1);
        return this.rng.arrayElement(rotations);
    }
    getRotationTowardsBase(tank) {
        const tankPosition = tank.position;
        const direction = this.basePosition
            .clone()
            .sub(tankPosition)
            .normalize();
        const maxValue = Math.max(direction.x, direction.y);
        if (Math.abs(direction.x) === Math.abs(maxValue)) {
            if (direction.x > 0) {
                return Rotation_1.Rotation.Right;
            }
            if (direction.x < 0) {
                return Rotation_1.Rotation.Left;
            }
        }
        return Rotation_1.Rotation.Down;
    }
}
exports.AiTankBehavior = AiTankBehavior;
