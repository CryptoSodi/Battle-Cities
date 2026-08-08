"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TankSkinAnimation = void 0;
const Rotation_1 = require("../game/Rotation");
const RotationMap_1 = require("../game/RotationMap");
const Tank_1 = require("../gameObjects/Tank");
const animations_1 = require("./animations");
// TODO: Remake to factory?
class TankSkinAnimation {
    constructor(spriteLoader, type, colors) {
        this.rotation = Rotation_1.Rotation.Up;
        this.tankState = Tank_1.TankState.Uninitialized;
        this.moveAnimationMap = new RotationMap_1.RotationMap();
        this.idleAnimationMap = new RotationMap_1.RotationMap();
        this.idleAnimationMap.set(Rotation_1.Rotation.Up, new animations_1.TankIdleAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Up));
        this.idleAnimationMap.set(Rotation_1.Rotation.Down, new animations_1.TankIdleAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Down));
        this.idleAnimationMap.set(Rotation_1.Rotation.Left, new animations_1.TankIdleAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Left));
        this.idleAnimationMap.set(Rotation_1.Rotation.Right, new animations_1.TankIdleAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Right));
        this.moveAnimationMap.set(Rotation_1.Rotation.Up, new animations_1.TankMoveAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Up));
        this.moveAnimationMap.set(Rotation_1.Rotation.Down, new animations_1.TankMoveAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Down));
        this.moveAnimationMap.set(Rotation_1.Rotation.Left, new animations_1.TankMoveAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Left));
        this.moveAnimationMap.set(Rotation_1.Rotation.Right, new animations_1.TankMoveAnimation(spriteLoader, type, colors, Rotation_1.Rotation.Right));
        this.currentAnimationMap = this.idleAnimationMap;
    }
    update(tank, deltaTime, advanceFrames = true) {
        this.rotation = tank.rotation;
        if (tank.state === this.tankState) {
            const animation = this.currentAnimationMap.get(this.rotation);
            if (advanceFrames) {
                animation.update(deltaTime);
            }
            return;
        }
        this.tankState = tank.state;
        this.currentAnimationMap =
            tank.state === Tank_1.TankState.Idle
                ? this.idleAnimationMap
                : this.moveAnimationMap;
        const animation = this.currentAnimationMap.get(tank.rotation);
        animation.reset();
    }
    // Tank might lose his drop, use it remove drop animation frames
    updateFrames() {
        this.idleAnimationMap.forEach((animation) => {
            animation.updateFrames();
        });
        this.moveAnimationMap.forEach((animation) => {
            animation.updateFrames();
        });
    }
    getCurrentFrame() {
        const animation = this.currentAnimationMap.get(this.rotation);
        return animation.getCurrentFrame();
    }
}
exports.TankSkinAnimation = TankSkinAnimation;
