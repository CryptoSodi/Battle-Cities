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
exports.Tank = exports.TankCollisionResolution = exports.TankState = void 0;
const core_1 = require("../core");
const GameState_1 = require("../game/GameState");
const Rotation_1 = require("../game/Rotation");
const Tag_1 = require("../game/Tag");
const TankAttributesFactory_1 = require("../tank/TankAttributesFactory");
const TankDeathReason_1 = require("../tank/TankDeathReason");
const config = __importStar(require("../config"));
const Bullet_1 = require("./Bullet");
const Shield_1 = require("./Shield");
var TankState;
(function (TankState) {
    TankState[TankState["Uninitialized"] = 0] = "Uninitialized";
    TankState[TankState["Idle"] = 1] = "Idle";
    TankState[TankState["Moving"] = 2] = "Moving";
})(TankState = exports.TankState || (exports.TankState = {}));
var SpawnCollisionState;
(function (SpawnCollisionState) {
    SpawnCollisionState[SpawnCollisionState["WaitUpdate"] = 0] = "WaitUpdate";
    SpawnCollisionState[SpawnCollisionState["WaitCollide"] = 1] = "WaitCollide";
    SpawnCollisionState[SpawnCollisionState["NotColliding"] = 2] = "NotColliding";
    SpawnCollisionState[SpawnCollisionState["Resolved"] = 3] = "Resolved";
})(SpawnCollisionState || (SpawnCollisionState = {}));
var PlayerCollisionState;
(function (PlayerCollisionState) {
    PlayerCollisionState[PlayerCollisionState["NotColliding"] = 0] = "NotColliding";
    PlayerCollisionState[PlayerCollisionState["Colliding"] = 1] = "Colliding";
    PlayerCollisionState[PlayerCollisionState["WaitCollide"] = 2] = "WaitCollide";
})(PlayerCollisionState || (PlayerCollisionState = {}));
var TankCollisionResolution;
(function (TankCollisionResolution) {
    TankCollisionResolution[TankCollisionResolution["Unknown"] = 0] = "Unknown";
    TankCollisionResolution[TankCollisionResolution["Self"] = 1] = "Self";
    TankCollisionResolution[TankCollisionResolution["Both"] = 2] = "Both";
})(TankCollisionResolution = exports.TankCollisionResolution || (exports.TankCollisionResolution = {}));
const SKIN_LAYER_DESCRIPTIONS = [{ opacity: 1 }, { opacity: 0.5 }];
const SNAP_SIZE = config.TILE_SIZE_MEDIUM;
const STUN_BLINK_DELAY = 0.1;
const MOVE_ANIMATION_MIN_DISTANCE = 0.25;
class Tank extends core_1.GameObject {
    constructor(type, behavior, partyIndex) {
        super(64, 64);
        this.collider = new core_1.SweptBoxCollider(this, true);
        this.tags = [Tag_1.Tag.Tank];
        // Tank index within it's party: players (0-1), enemies (0-19).
        this.partyIndex = -1;
        this.bullets = [];
        this.shield = null;
        this.fired = new core_1.Subject();
        this.died = new core_1.Subject();
        this.hit = new core_1.Subject();
        this.slided = new core_1.Subject();
        this.state = TankState.Uninitialized;
        this.freezeState = new core_1.State(false);
        this.isOnIce = false;
        // Per-sprite hit flash [0..1], set to full on receiveHit and decayed in
        // updateAnimation. Render-only cosmetic (see SpritePainter.flash) — never read
        // by the sim, so it can't affect replay determinism.
        this.hitFlash = 0;
        this.shieldTimer = new core_1.Timer();
        this.skinLayers = [];
        this.lastFireTimer = new core_1.Timer();
        this.slideTimer = new core_1.Timer();
        this.stunTimer = new core_1.Timer();
        this.stunBlinkTimer = new core_1.Timer();
        this.spawnCollisionState = new core_1.State(SpawnCollisionState.WaitUpdate);
        this.playerCollisionState = new core_1.State(PlayerCollisionState.NotColliding);
        this.tankCollisionResolution = TankCollisionResolution.Unknown;
        this.isCollisionAbusedByPlayer = false;
        this.lastSettledAnimationPosition = null;
        this.handleStunTimer = () => {
            this.stunBlinkTimer.stop();
            this.setVisible(true);
        };
        this.handleShieldTimer = () => {
            this.shield.removeSelf();
            this.shield = null;
        };
        this.pivot.set(0.5, 0.5);
        this.type = type;
        this.behavior = behavior;
        this.partyIndex = partyIndex;
        this.attributes = TankAttributesFactory_1.TankAttributesFactory.create(this.type);
        this.shieldTimer.done.addListener(this.handleShieldTimer);
        this.stunTimer.done.addListener(this.handleStunTimer);
    }
    setup(updateArgs) {
        const { collisionSystem } = updateArgs;
        this.collisionSystem = collisionSystem;
        collisionSystem.register(this.collider);
        this.behavior.setup(this, updateArgs);
        this.lastSettledAnimationPosition = this.position.clone();
        SKIN_LAYER_DESCRIPTIONS.forEach(() => {
            const layer = new core_1.GameObject();
            layer.size.copyFrom(this.size);
            const painter = new core_1.SpritePainter();
            painter.alignment = core_1.SpriteAlignment.MiddleCenter;
            layer.painter = painter;
            this.skinLayers.push(layer);
            this.add(layer);
        });
    }
    update(updateArgs) {
        const { deltaTime, gameState } = updateArgs;
        const didMoveLastTick = this.consumeSettledMovementForAnimation();
        this.updateCollisionStates();
        this.shieldTimer.update(deltaTime);
        const shouldIdle = this.freezeState.hasChangedTo(true) ||
            gameState.hasChangedTo(GameState_1.GameState.Paused);
        if (shouldIdle) {
            this.idle();
        }
        const isIdle = this.freezeState.is(true) || gameState.is(GameState_1.GameState.Paused);
        // Only update animation when idle
        if (isIdle) {
            this.updateAnimation(deltaTime);
            return;
        }
        this.dirtyPaintBox();
        if (this.isSliding()) {
            if (this.isOnIce) {
                this.slideTimer.update(deltaTime);
                if (this.slideTimer.isDone()) {
                    // If slide timer is done, then tank becomes idle wherever it stopped
                    // and player has control of it again.
                    this.idle(false);
                }
                else {
                    // If on ice and still sliding - move tank in whatever direction it
                    // is facing
                    this.move(deltaTime);
                }
            }
            else {
                // If tank is sliding, but appears not to be on ice any more, then
                // stop sliding.
                this.slideTimer.stop();
                this.idle(false);
            }
        }
        this.updateStun(deltaTime);
        // Behavior code is responsible for blocking movement for a tank when it
        // is sliding
        this.behavior.update(this, updateArgs);
        this.lastFireTimer.update(deltaTime);
        this.updateAnimation(deltaTime, didMoveLastTick);
        this.collider.update();
        // Reset so in case tank leaves ice, flag will be correct. #collide() is
        // called right after and it will set the flag if tank is on ice.
        this.isOnIce = false;
        this.tankCollisionResolution = TankCollisionResolution.Unknown;
    }
    updateCollisionStates() {
        if (this.spawnCollisionState.is(SpawnCollisionState.WaitCollide)) {
            // Collide has not been called on prev frame means tank is not colliding
            // with anything
            this.enablePostSpawnCollision();
        }
        else if (this.spawnCollisionState.is(SpawnCollisionState.WaitUpdate)) {
            // If collision actually exists, #collide() will be called right after
            // this first update and we will know the state of collision.
            // If it won't be called, this state will stay hanging and we will receive
            // it here on the next #update() call. That means that tank is not
            // colliding with anything and we should make it collidable.
            this.spawnCollisionState.set(SpawnCollisionState.WaitCollide);
        }
        if (this.playerCollisionState.is(PlayerCollisionState.WaitCollide)) {
            // Collide has not been called on prev frame means tank is not colliding
            // with player
            this.playerCollisionState.set(PlayerCollisionState.NotColliding);
        }
        else if (this.playerCollisionState.is(PlayerCollisionState.Colliding)) {
            // If tanks were previously colliding. From here we wait for next
            // #collide() call, where it either goes back to colliding or not
            //  colliding.
            this.playerCollisionState.set(PlayerCollisionState.WaitCollide);
        }
    }
    updateAnimation(deltaTime, advanceFrames = true) {
        this.skinAnimation.update(this, deltaTime, advanceFrames);
        const frame = this.skinAnimation.getCurrentFrame();
        if (this.hitFlash > 0) {
            this.hitFlash = Math.max(0, this.hitFlash - deltaTime / config.SPRITE_FLASH_DECAY_SECONDS);
        }
        this.skinLayers.forEach((layer, index) => {
            const description = SKIN_LAYER_DESCRIPTIONS[index];
            const painter = layer.painter;
            const sprite = frame.getSprite(index);
            painter.opacity = description.opacity;
            painter.sprite = sprite;
            painter.flash = this.hitFlash;
        });
    }
    consumeSettledMovementForAnimation() {
        if (this.lastSettledAnimationPosition === null) {
            this.lastSettledAnimationPosition = this.position.clone();
            return false;
        }
        const distance = this.position.distanceTo(this.lastSettledAnimationPosition);
        this.lastSettledAnimationPosition.copyFrom(this.position);
        return distance >= MOVE_ANIMATION_MIN_DISTANCE;
    }
    collide(collision) {
        this.collideIce(collision);
        this.collideSpawnedTanks(collision);
        this.collideWalls(collision);
        this.collideTanks(collision);
        this.collideBullets(collision);
    }
    fire(ignoreLocalLimits = false) {
        if (!ignoreLocalLimits &&
            this.bullets.length >= this.attributes.bulletMaxCount) {
            return;
        }
        // Throttle how fast next bullet comes out during rapid fire
        if (!ignoreLocalLimits && this.lastFireTimer.isActive()) {
            return;
        }
        const bullet = new Bullet_1.Bullet(this.partyIndex, this.attributes.bulletSpeed, this.attributes.bulletTankDamage, this.attributes.bulletWallDamage);
        // First, add bullet inside a tank and position it at the north center
        // of the tank (where the gun is). Bullet will inherit tank's rotation.
        // Update tank position
        this.updateWorldMatrix(true);
        // Add bullet - it will inherit rotation
        this.add(bullet);
        // Make sure rotation is in matrix
        bullet.updateMatrix();
        // Position bullet
        bullet.setCenter(this.getSelfCenter());
        bullet.translateY(this.size.height / 2 - bullet.size.height / 2);
        bullet.updateMatrix();
        // Then, detach bullet from a tank and move it to a field
        this.parent.attach(bullet);
        if (this.tags.includes(Tag_1.Tag.Player)) {
            bullet.tags.push(Tag_1.Tag.Player);
        }
        else if (this.tags.includes(Tag_1.Tag.Enemy)) {
            bullet.tags.push(Tag_1.Tag.Enemy);
        }
        this.bullets.push(bullet);
        bullet.died.addListener(() => {
            this.bullets = this.bullets.filter((tankBullet) => {
                return tankBullet !== bullet;
            });
        });
        this.fired.notify(null);
        if (!ignoreLocalLimits) {
            this.lastFireTimer.reset(this.attributes.bulletRapidFireDelay);
        }
        return true;
    }
    fireFromNetwork(x, y, rotation) {
        const localPosition = this.position.clone();
        const localRotation = this.rotation;
        try {
            this.position.set(x, y);
            this.rotation = rotation;
            this.updateMatrix(true);
            const bulletCount = this.bullets.length;
            if (!this.fire(true) || this.bullets.length === bulletCount) {
                return null;
            }
            return this.bullets[this.bullets.length - 1];
        }
        finally {
            this.position.copyFrom(localPosition);
            this.rotation = localRotation;
            this.updateMatrix(true);
        }
    }
    move(deltaTime) {
        if (this.state !== TankState.Moving) {
            this.state = TankState.Moving;
        }
        this.translateY(this.attributes.moveSpeed * deltaTime);
        this.updateMatrix(true);
    }
    updateStun(deltaTime) {
        if (!this.isStunned()) {
            return;
        }
        if (this.stunBlinkTimer.isDone()) {
            this.stunBlinkTimer.reset(STUN_BLINK_DELAY);
            this.setVisible(!this.getVisible());
        }
        this.stunBlinkTimer.update(deltaTime);
        this.stunTimer.update(deltaTime);
    }
    applyNetworkMovement(rotation, moving, deltaX, deltaY) {
        this.rotation = rotation;
        this.state = moving ? TankState.Moving : TankState.Idle;
        this.position.set(this.position.x + deltaX, this.position.y + deltaY);
        this.updateMatrix(true);
    }
    idle(checkIce = true) {
        if (this.state !== TankState.Idle) {
            this.state = TankState.Idle;
        }
        // Whenever player lets go of his input controls, we check if tank is on ice
        // and if it should slide.
        if (checkIce &&
            this.tags.includes(Tag_1.Tag.Player) &&
            this.isOnIce &&
            !this.isSliding()) {
            this.slided.notify(null);
            this.slideTimer.reset(config.ICE_SLIDE_DURATION);
        }
    }
    rotate(rotation) {
        // When tank is rotating align it to grid. It is needed to:
        // - simplify user navigation when moving into narrow passages; without it
        //   user will be stuck on corners
        if (rotation !== this.rotation) {
            if (rotation === Rotation_1.Rotation.Up || rotation === Rotation_1.Rotation.Down) {
                this.position.snapX(SNAP_SIZE);
            }
            else if (rotation === Rotation_1.Rotation.Left || rotation === Rotation_1.Rotation.Right) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        super.rotate(rotation);
        return this;
    }
    die(reason = TankDeathReason_1.TankDeathReason.Bullet, hitterPartyIndex = null) {
        const event = {
            hitterPartyIndex,
            reason,
        };
        this.died.notify(event);
        this.collider.unregister();
    }
    activateShield(duration) {
        if (this.shield !== null) {
            this.shield.removeSelf();
            this.shieldTimer.stop();
            this.shield = null;
        }
        this.shield = new Shield_1.Shield();
        this.shield.updateMatrix();
        this.shield.setCenter(this.getSelfCenter());
        this.add(this.shield);
        this.shieldTimer.reset(duration);
    }
    isAlive() {
        return this.attributes.health > 0;
    }
    receiveHit(damage, hitterPartyIndex) {
        this.attributes.health = Math.max(0, this.attributes.health - damage);
        // Kick off the white hit flash (render-only). Scaled by the motion master
        // so reduced-motion disables it.
        this.hitFlash = config.SPRITE_FLASH_HIT * config.CAMERA_SHAKE_INTENSITY;
        this.hit.notify(null);
        if (!this.isAlive()) {
            this.die(TankDeathReason_1.TankDeathReason.Bullet, hitterPartyIndex);
        }
    }
    isSliding() {
        return this.slideTimer.isActive();
    }
    isStunned() {
        return this.stunTimer.isActive();
    }
    collideIce(collision) {
        // Only player can slip on ice
        if (this.tags.includes(Tag_1.Tag.Enemy)) {
            return;
        }
        const iceTileContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(Tag_1.Tag.Ice);
        });
        if (iceTileContacts.length === 0) {
            return;
        }
        // Check if center of tank is on ice - if so then apply the effect.
        const selfBox = this.getWorldBoundingBox();
        const selfCenter = selfBox.getCenter();
        const sumBox = new core_1.BoundingBox();
        for (const contact of iceTileContacts) {
            sumBox.unionWith(contact.box);
        }
        const isOnIce = sumBox.containsPoint(selfCenter);
        this.isOnIce = isOnIce;
    }
    // Try to solve the issue when some alive tank is
    // moving on top of a spawn and at the same time new tank has been spawned.
    // Not to toss the tanks around we simply don't enable collisions for
    // a newly spawned tank until these both tanks move away from each other.
    collideSpawnedTanks(collision) {
        if (this.spawnCollisionState.is(SpawnCollisionState.WaitCollide)) {
            const tankContacts = collision.contacts.filter((contact) => {
                return contact.collider.object.tags.includes(Tag_1.Tag.Tank);
            });
            if (tankContacts.length > 0) {
                // Live one more cycle and check collisions on next frame
                this.spawnCollisionState.set(SpawnCollisionState.WaitUpdate);
            }
            else {
                // Collide has been called but there is no collision with other tanks.
                this.enablePostSpawnCollision();
            }
        }
    }
    collideWalls(collision) {
        const wallContacts = [];
        for (const contact of collision.contacts) {
            const { tags } = contact.collider.object;
            if (tags.includes(Tag_1.Tag.BlockMove) && !tags.includes(Tag_1.Tag.Tank)) {
                wallContacts.push(contact);
            }
        }
        if (wallContacts.length === 0) {
            return;
        }
        // Find closest wall we are colliding with. It solves "tunneling" problem
        // if tank is going too fast it can jump over some small tiles of walls.
        // By using swept box collider and then finding closest points of contact,
        // we make tank interact with the first object on the way.
        // Tank can also hit multiple block at the same time.
        const closestWallContacts = this.getClosestContacts(wallContacts, this.collider.getPrevBox());
        if (closestWallContacts.length === 0) {
            return;
        }
        // Most likely it collides with multiple brick when going front and they
        // are positioned in one line near each other. So it will be enough to
        // resolve just one collision of them all.
        const firstWallContact = closestWallContacts[0];
        const otherCurrentBox = firstWallContact.collider.getCurrentBox();
        this.resolveMinkowski(otherCurrentBox, true);
    }
    resolveMinkowski(otherBox, shouldSnap = false) {
        const selfCurrentBox = this.collider.getCurrentBox();
        const selfPrevBox = this.collider.getPrevBox();
        const selfPrevCenter = selfPrevBox.getCenter();
        // Calculate Minksowski sum of collidable boxes.
        const minkowskiBox = otherBox.clone().minkowskiSum(selfCurrentBox);
        // Resulting box has diagonals. Next we are going to reposition those
        // diagonals to the start of coordinate system. By computing cross product
        // between those diagonals and a center of previous bounding box of
        // collided object we will be able to identify which side of bounding box
        // is collided. Thanks to this we will know what side to resolve collision
        // with without relying on direction or rotation, which might not provide
        // the correct result in different situations
        const minkowskiRect = minkowskiBox.toRect();
        const minkowskiCenter = minkowskiBox.getCenter();
        // Move previous center position according to how diagonals are moved.
        // It is important to use previous position, because current position
        // might intersect from the other side and give the opposite info.
        // We want to know from which direction collision came from.
        const localPrev = new core_1.Vector(selfPrevCenter.x - minkowskiCenter.x, selfPrevCenter.y - minkowskiCenter.y);
        // We will check on which side of diagonals the center is
        // Bottom-left to bottom-right diagonal
        //    |  /
        //    | /
        // ___|/_____
        //    |(0,0)
        //    |
        const blTrLocalDiag = new core_1.Vector(minkowskiRect.width / 2, minkowskiRect.height / 2);
        // Top-left to bottom-right diagonal
        //    |
        // ___|(0,0)___
        //    |\
        //    | \
        //    |  \
        const tlBrLocalDiag = new core_1.Vector(minkowskiRect.width / 2, -minkowskiRect.height / 2);
        const blTrCrossProduct = localPrev.cross(blTrLocalDiag);
        const tlBrCrossProduct = localPrev.cross(tlBrLocalDiag);
        const isTop = blTrCrossProduct < 0 && tlBrCrossProduct < 0;
        const isBottom = blTrCrossProduct > 0 && tlBrCrossProduct > 0;
        const isLeft = blTrCrossProduct > 0 && tlBrCrossProduct < 0;
        const isRight = blTrCrossProduct < 0 && tlBrCrossProduct > 0;
        if (isTop) {
            this.position.subY(selfCurrentBox.min.y - otherBox.max.y);
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (isBottom) {
            this.position.subY(selfCurrentBox.max.y - otherBox.min.y);
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (isLeft) {
            this.position.subX(selfCurrentBox.min.x - otherBox.max.x);
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        else if (isRight) {
            this.position.subX(selfCurrentBox.max.x - otherBox.min.x);
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        this.updateMatrix(true);
        this.collider.update();
    }
    collideTanks(collision) {
        if (!this.tags.includes(Tag_1.Tag.BlockMove)) {
            return;
        }
        const tankContacts = [];
        const playerTankContacts = [];
        const wallContacts = [];
        for (const contact of collision.contacts) {
            const { tags } = contact.collider.object;
            if (tags.includes(Tag_1.Tag.BlockMove) && tags.includes(Tag_1.Tag.Tank)) {
                tankContacts.push(contact);
            }
            if (tags.includes(Tag_1.Tag.BlockMove) && !tags.includes(Tag_1.Tag.Tank)) {
                wallContacts.push(contact);
            }
            if (tags.includes(Tag_1.Tag.Tank) && tags.includes(Tag_1.Tag.Player)) {
                playerTankContacts.push(contact);
            }
        }
        if (this.playerCollisionState.is(PlayerCollisionState.WaitCollide)) {
            if (playerTankContacts.length > 0) {
                this.playerCollisionState.set(PlayerCollisionState.Colliding);
            }
            else {
                this.playerCollisionState.set(PlayerCollisionState.NotColliding);
            }
        }
        if (tankContacts.length === 0) {
            return;
        }
        const closestTankContacts = this.getClosestContacts(tankContacts, this.collider.getPrevBox());
        const firstTankContact = closestTankContacts[0];
        const otherCollider = firstTankContact.collider;
        const other = otherCollider.object;
        if (other.tankCollisionResolution === TankCollisionResolution.Self) {
            // Other tank has already resolved the collision, skip for current tank
            return;
        }
        // First we check which tanks are moving. It is easier if only one of them
        // is moving, because we only need to resolve his collision.
        const selfCurrentBox = this.collider.getCurrentBox();
        const selfPrevBox = this.collider.getPrevBox();
        const isSelfMoving = !selfCurrentBox.equals(selfPrevBox);
        const otherPrevBox = otherCollider.getPrevBox();
        const otherCurrentBox = otherCollider.getCurrentBox();
        const isOtherMoving = !otherCurrentBox.equals(otherPrevBox);
        if (!isOtherMoving && !isSelfMoving) {
            // Both still. It might happen when one tank goes on spawn of another
            // tank and stand there. Both should do nothing until they get of each
            // others way.
            return;
        }
        if (isOtherMoving && !isSelfMoving) {
            // Let other resolve because it is moving
            return;
        }
        const selfDirection = this.collider.getDirection().normalize();
        const otherDirection = otherCollider.getDirection().normalize();
        if (!isOtherMoving && isSelfMoving) {
            // We are going to resolve because we are moving
            // There is a special case when enemy tank is moving and player tank
            // is standing in the way but it can not be hit with a bullet. Player
            // could abuse this to block enemy tanks from moving. To workaround it
            // we check if enemy tank is moving directly on grid and it collides
            // with player. If at the moment of collision the intersecrion area is
            // not enough for bullet to hit, then we disable collision at all and
            // enemy tank will move "through" player tank.
            if (this.tags.includes(Tag_1.Tag.Enemy) &&
                other.tags.includes(Tag_1.Tag.Player) &&
                !this.isFrozenCollision(other)) {
                // If enemy is already colliding with player - skip it right away
                if (this.playerCollisionState.is(PlayerCollisionState.Colliding)) {
                    return;
                }
                const roundedPosition = this.position.clone().round();
                const isMovingOnGridHorizontally = (selfDirection.x === 1 || selfDirection.x === -1) &&
                    roundedPosition.y % config.TILE_SIZE_MEDIUM === 0;
                const isMovingOnGridVertically = (selfDirection.y === 1 || selfDirection.y === -1) &&
                    roundedPosition.x % config.TILE_SIZE_MEDIUM === 0;
                const intersectionBox = selfCurrentBox
                    .clone()
                    .intersectWith(otherCurrentBox);
                const intersectionRect = intersectionBox.toRect();
                const thresholdWidth = (this.size.width - config.BULLET_WIDTH) / 2;
                const thresholdHeight = (this.size.height - config.BULLET_WIDTH) / 2;
                // Don't resolve and remember that player tank was in contact with
                // current tank so we can resolve collision later when they continue
                // moving
                if (isMovingOnGridVertically &&
                    intersectionRect.width <= thresholdWidth) {
                    this.playerCollisionState.set(PlayerCollisionState.Colliding);
                    return;
                }
                // Don't resolve
                if (isMovingOnGridHorizontally &&
                    intersectionRect.height <= thresholdHeight) {
                    this.playerCollisionState.set(PlayerCollisionState.Colliding);
                    return;
                }
            }
            this.resolveMinkowski(otherPrevBox);
            this.tankCollisionResolution = TankCollisionResolution.Self;
            return;
        }
        // Below we handle if both tanks are moving
        // If player tank is colliding with enemy who decided to temporarily
        // ignore collsion with player. We also check if enemy is waiting because
        // we don't know which tank's #collide() is called first
        if (this.tags.includes(Tag_1.Tag.Player) &&
            other.tags.includes(Tag_1.Tag.Enemy) &&
            !this.isFrozenCollision(other)) {
            if (other.playerCollisionState.is(PlayerCollisionState.Colliding) ||
                other.playerCollisionState.is(PlayerCollisionState.WaitCollide)) {
                return;
            }
        }
        // If enemy tank who decided to temporarily ignore collsion with player
        // is colliding with player. We also check if enemy is waiting because
        // we don't know which tank's #collide() is called first.
        if (this.tags.includes(Tag_1.Tag.Enemy) &&
            other.tags.includes(Tag_1.Tag.Player) &&
            !this.isFrozenCollision(other)) {
            if (this.playerCollisionState.is(PlayerCollisionState.Colliding) ||
                other.playerCollisionState.is(PlayerCollisionState.WaitCollide)) {
                return;
            }
        }
        // First tank rolled-back his movement, current tank should align to it.
        if (other.tankCollisionResolution === TankCollisionResolution.Both) {
            this.resolveMinkowski(otherCurrentBox);
            return;
        }
        const hasWallCollision = wallContacts.length > 0;
        // Find which direction tank is moving, then find direction of collision
        // from the tank's perspective.
        const selfCurrentCenter = selfCurrentBox.getCenter();
        const otherCurrentCenter = otherCurrentBox.getCenter();
        const selfCollisionDirection = otherCurrentCenter
            .clone()
            .sub(selfCurrentCenter)
            .normalize();
        const otherCollisionDirection = selfCurrentCenter
            .clone()
            .sub(otherCurrentCenter)
            .normalize();
        // Dot product of tank's direction and collision direction from his
        // perspective lets us know if tank is moving towards collision. If that
        // is the case, we consider him as an initiator of the collision and it
        // will be responsible for resolving the collision.
        // If both of them are moving towards collision, then we compare dot
        // product value to check who participates in collision more.
        // If they move towards each other, dot products will be equal and tanks
        // should both resolve the collision. It is important that they resolve
        // it in respect to each other - one should rollback is movement, the other
        // one will account for that rollback and position himself according to
        // first tank bounding box. This will hold tanks in place if they continue
        // moving towards each other.
        const selfDot = selfDirection.dot(selfCollisionDirection);
        const otherDot = otherDirection.dot(otherCollisionDirection);
        let isSelfInitiator = selfDot > 0;
        let isOtherInitiator = otherDot > 0;
        if (selfDot > 0 && otherDot > 0) {
            if (selfDot === otherDot) {
                isSelfInitiator = true;
                isOtherInitiator = true;
            }
            else {
                isSelfInitiator = selfDot > otherDot;
                isOtherInitiator = otherDot > selfDot;
            }
        }
        // Players must not push enemy tanks. If the player is moving into an enemy
        // (regardless of who is the "stronger" initiator), the player stops at the
        // enemy's previous position and the enemy is never displaced by it.
        // Mirrored on the enemy's side so the outcome is the same no matter which
        // tank's collide() runs first this pass. Scoped to player<->enemy only, so
        // enemy<->enemy and the anti-block logic above are unaffected.
        if (this.tags.includes(Tag_1.Tag.Player) &&
            other.tags.includes(Tag_1.Tag.Enemy) &&
            selfDot > 0) {
            this.resolveMinkowski(otherPrevBox);
            this.tankCollisionResolution = TankCollisionResolution.Self;
            return;
        }
        if (this.tags.includes(Tag_1.Tag.Enemy) &&
            other.tags.includes(Tag_1.Tag.Player) &&
            otherDot > 0) {
            // The player is driving into us — don't move because of the player.
            return;
        }
        // In case current tank has other collision with walls, let him be, and
        // resolve collsion ourselves
        if (hasWallCollision) {
            isSelfInitiator = false;
            isOtherInitiator = true;
        }
        if (isSelfInitiator && !isOtherInitiator) {
            this.resolveMinkowski(otherPrevBox);
            this.tankCollisionResolution = TankCollisionResolution.Self;
            return;
        }
        if (!isSelfInitiator && isOtherInitiator) {
            // We go where we were going, other one will resolve the collision
            return;
        }
        if (isSelfInitiator && isOtherInitiator) {
            // Both should resolve because they are moving towards each other.
            // One should rollback his movement completely, and the other one
            // should use former tank box to align itself. As a result if they
            // both move at each other at full speed, they will be kept in place.
            this.resolveByRollback(this.collider.getDirection());
            this.tankCollisionResolution = TankCollisionResolution.Both;
            return;
        }
        // In case neither is an initiator, we check who has more collsiions with
        // other objects.
        const otherCollision = this.collisionSystem.getCollisionByCollider(other.collider);
        const selfContactsExceptOther = collision.contacts.filter((contact) => {
            return contact.collider !== other.collider;
        });
        const otherContactsExceptSelf = otherCollision.contacts.filter((contact) => {
            return contact.collider !== this.collider;
        });
        if (otherContactsExceptSelf.length > 0 &&
            selfContactsExceptOther.length === 0) {
            this.resolveMinkowski(otherPrevBox);
            this.tankCollisionResolution = TankCollisionResolution.Self;
            return;
        }
        if (this.tags.includes(Tag_1.Tag.Enemy) &&
            other.tags.includes(Tag_1.Tag.Enemy) &&
            isSelfMoving) {
            this.resolveMinkowski(otherPrevBox);
            this.tankCollisionResolution = TankCollisionResolution.Self;
            return;
        }
        // For the rest of the situations, we just let them be. During testing
        // this seemed to work fine.
    }
    collideBullets(collision) {
        const bulletContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(Tag_1.Tag.Bullet);
        });
        if (bulletContacts.length === 0) {
            return;
        }
        bulletContacts.forEach((contact) => {
            const bullet = contact.collider.object;
            // Prevent self-destruction
            if (this.bullets.includes(bullet)) {
                return;
            }
            // A bullet only hits once: if another tank already consumed it this
            // collision pass (e.g. two enemies overlapping), don't take damage too.
            if (bullet.isSpent()) {
                return;
            }
            if (bullet.isLocalDamageDisabled()) {
                return;
            }
            // If tank has shield - swallow the bullet
            if (this.shield !== null) {
                bullet.nullify();
                return;
            }
            // Enemy bullets don't affect enemy tanks
            if (bullet.tags.includes(Tag_1.Tag.Enemy) && this.tags.includes(Tag_1.Tag.Enemy)) {
                return;
            }
            bullet.explode();
            // When friendly-fire - stun the tank which was hit so he can't move
            // but can still fire
            if (bullet.tags.includes(Tag_1.Tag.Player) && this.tags.includes(Tag_1.Tag.Player)) {
                // If already stunned - ignore
                if (this.isStunned()) {
                    return;
                }
                this.stunTimer.reset(config.FRIENDLY_FIRE_STUN_DURATION);
                this.stunBlinkTimer.reset(STUN_BLINK_DELAY);
                this.setVisible(false);
                this.idle();
                return;
            }
            this.receiveHit(bullet.tankDamage, bullet.ownerPartyIndex);
        });
    }
    resolveByRollback(direction) {
        this.position.sub(direction);
        this.updateMatrix(true);
        this.collider.update();
    }
    isFrozenCollision(other) {
        return this.freezeState.is(true) || other.freezeState.is(true);
    }
    getClosestContacts(contacts, selfBox) {
        let minDistance = null;
        for (const contact of contacts) {
            const prevBox = selfBox;
            const distance = prevBox.distanceCenterToCenter(contact.box);
            if (minDistance === null || distance < minDistance) {
                minDistance = distance;
            }
        }
        const closestContacts = [];
        for (const contact of contacts) {
            const prevBox = selfBox;
            const distance = prevBox.distanceCenterToCenter(contact.box);
            if (distance === minDistance) {
                closestContacts.push(contact);
            }
        }
        return closestContacts;
    }
    enablePostSpawnCollision() {
        this.spawnCollisionState.set(SpawnCollisionState.Resolved);
        this.tags.push(Tag_1.Tag.BlockMove);
    }
    getDirection() {
        if (this.rotation === Rotation_1.Rotation.Up) {
            return new core_1.Vector(0, -1);
        }
        if (this.rotation === Rotation_1.Rotation.Down) {
            return new core_1.Vector(0, 1);
        }
        if (this.rotation === Rotation_1.Rotation.Left) {
            return new core_1.Vector(-1, 0);
        }
        if (this.rotation === Rotation_1.Rotation.Right) {
            return new core_1.Vector(1, 0);
        }
    }
    /**
     * @deprecated Use resolveMinkowski, left for history reference
     */
    resolveBasedOnDirection(selfCurrentBox, otherBox, shouldSnap = false) {
        const direction = this.collider.getDirection().normalize();
        if (direction.y < 0) {
            this.position.subY(Math.max(0, selfCurrentBox.min.y - otherBox.max.y));
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (direction.y > 0) {
            this.position.subY(Math.max(0, selfCurrentBox.max.y - otherBox.min.y));
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (direction.x < 0) {
            this.position.subX(Math.max(0, selfCurrentBox.min.x - otherBox.max.x));
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        else if (direction.x > 0) {
            this.position.subX(Math.max(0, selfCurrentBox.max.x - otherBox.min.x));
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        this.updateMatrix(true);
        this.collider.update();
    }
    /**
     * @deprecated Use resolveMinkowski, left for history reference
     */
    resolveBasedOnRotation(selfBox, otherBox, shouldSnap = false) {
        const rotation = this.getWorldRotation();
        // Tied to axis. Reset opposite axis direction so only primary axis
        // will be resolved. Otherwise it conflicts with #rotate() code which
        // aligns tank to a grid during rotation.
        // Snap to avoid situations when between two walls opposite each other,
        // and tank is colliding with right wall, collider pushes tank back to
        // left wall, and wrong resolution branch is applied. Stick tank to grid.
        if (rotation == Rotation_1.Rotation.Up) {
            this.position.addY(otherBox.max.y - selfBox.min.y);
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (rotation === Rotation_1.Rotation.Down) {
            this.position.addY(otherBox.min.y - selfBox.max.y);
            if (shouldSnap) {
                this.position.snapY(SNAP_SIZE);
            }
        }
        else if (rotation === Rotation_1.Rotation.Left) {
            this.position.addX(otherBox.max.x - selfBox.min.x);
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        else if (rotation === Rotation_1.Rotation.Right) {
            this.position.addX(otherBox.min.x - selfBox.max.x);
            if (shouldSnap) {
                this.position.snapX(SNAP_SIZE);
            }
        }
        this.updateMatrix(true);
        // Make sure to update collider
        this.collider.update();
    }
}
exports.Tank = Tank;
