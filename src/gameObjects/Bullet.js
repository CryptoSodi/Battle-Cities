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
exports.Bullet = void 0;
const core_1 = require("../core");
const Rotation_1 = require("../game/Rotation");
const Tag_1 = require("../game/Tag");
const TankBulletWallDamage_1 = require("../tank/TankBulletWallDamage");
const config = __importStar(require("../config"));
const explosionEffect_1 = require("./explosionEffect");
const SmallExplosion_1 = require("./SmallExplosion");
const TerrainTileDestroyer_1 = require("./TerrainTileDestroyer");
class Bullet extends core_1.GameObject {
    constructor(ownerPartyIndex, speed, tankDamage, wallDamage) {
        super(config.BULLET_WIDTH, 16);
        this.collider = new core_1.SweptBoxCollider(this, true);
        this.painter = new core_1.SpritePainter();
        this.zIndex = config.BULLET_Z_INDEX;
        this.tags = [Tag_1.Tag.Bullet];
        this.died = new core_1.Subject();
        // Becomes true once the bullet has been spent (exploded or nullified) so it
        // can only deal damage once — e.g. it can't kill two overlapping tanks.
        this.consumed = false;
        this.networkControlled = false;
        this.networkMovementControlled = false;
        this.localDamageDisabled = false;
        this.ownerPartyIndex = ownerPartyIndex;
        this.speed = speed;
        this.tankDamage = tankDamage;
        this.wallDamage = wallDamage;
        this.pivot.set(0.5, 0.5);
    }
    setNetworkControlled(networkControlled) {
        this.networkControlled = networkControlled;
        this.networkMovementControlled = networkControlled;
    }
    setNetworkCollisionControlled(networkControlled) {
        this.networkControlled = networkControlled;
        this.networkMovementControlled = false;
    }
    setLocalDamageDisabled(disabled) {
        this.localDamageDisabled = disabled;
    }
    isLocalDamageDisabled() {
        return this.localDamageDisabled;
    }
    setup({ audioLoader, collisionSystem, particles, spriteLoader, }) {
        collisionSystem.register(this.collider);
        this.hitBrickSound = audioLoader.load('hit.brick');
        this.hitSteelSound = audioLoader.load('hit.steel');
        const rotation = this.getWorldRotation();
        const spriteId = `bullet.${this.getRotationString(rotation)}`;
        const sprite = spriteLoader.load(spriteId);
        this.painter.sprite = sprite;
        // Muzzle flash at the gun tip (bullet spawn), pointed the way it's headed.
        let dirX = 0;
        let dirY = 0;
        if (rotation === Rotation_1.Rotation.Up) {
            dirY = -1;
        }
        else if (rotation === Rotation_1.Rotation.Down) {
            dirY = 1;
        }
        else if (rotation === Rotation_1.Rotation.Left) {
            dirX = -1;
        }
        else if (rotation === Rotation_1.Rotation.Right) {
            dirX = 1;
        }
        // attach() (in Tank.fire) reparents the bullet to the field and rewrites
        // its matrix/position but leaves boundingBox stale; with matrixAutoUpdate
        // off, getCenter() would otherwise read the old tank-local box and emit the
        // flash at the world origin (top-left). Refresh the box first.
        this.updateMatrix();
        const center = this.getCenter();
        (0, explosionEffect_1.emitMuzzleFlash)(particles, center.x, center.y, dirX, dirY);
    }
    update(updateArgs) {
        this.dirtyPaintBox();
        if (!this.networkMovementControlled) {
            this.translateY(this.speed * updateArgs.deltaTime);
        }
        this.updateMatrix();
        this.collider.update();
        this.setNeedsPaint();
    }
    collide(collision) {
        // Local-server bullets are render replicas. The Rust simulation owns all
        // hits, terrain damage, and projectile cancellation.
        if (this.networkControlled) {
            return;
        }
        this.collideBullets(collision);
        this.collideWalls(collision);
    }
    // True once the bullet has already hit something this collision pass. Tanks
    // check this so a single bullet can't damage more than one of them.
    isSpent() {
        return this.consumed;
    }
    nullify() {
        if (this.consumed) {
            return;
        }
        this.consumed = true;
        this.removeSelf();
        this.collider.unregister();
        this.died.notify(null);
    }
    explode() {
        if (this.consumed) {
            return;
        }
        this.consumed = true;
        const explosion = new SmallExplosion_1.SmallExplosion();
        explosion.updateMatrix();
        explosion.setCenter(this.getCenter());
        this.replaceSelf(explosion);
        this.collider.unregister();
        this.died.notify(null);
    }
    collideBullets(collision) {
        const bulletContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(Tag_1.Tag.Bullet);
        });
        bulletContacts.forEach((contact) => {
            const bullet = contact.collider.object;
            // Enemy bullets don't discard each other, they pass thru
            if (bullet.tags.includes(Tag_1.Tag.Enemy) && this.tags.includes(Tag_1.Tag.Enemy)) {
                return;
            }
            // Bullets fired by the same player pass through each other. Bullets from
            // different players cancel out just like player and enemy bullets.
            if (bullet.tags.includes(Tag_1.Tag.Player) &&
                this.tags.includes(Tag_1.Tag.Player) &&
                bullet.ownerPartyIndex === this.ownerPartyIndex) {
                return;
            }
            // Opposing bullets cancel each other.
            this.nullify();
            bullet.nullify();
        });
    }
    collideWalls(collision) {
        const wallContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(Tag_1.Tag.Wall);
        });
        if (wallContacts.length === 0) {
            return;
        }
        // Find closest wall we are colliding with. It solves the "tunneling"
        // problem when bullet is going too fast it can jump over some walls.
        // By using swept box collider and then finding closest points of contact,
        // we make bullet interact with the first object on the way.
        // Bullet can also hit multiple blocks (most likely two) at the same time.
        let minDistance = null;
        wallContacts.forEach((contact) => {
            const prevBox = this.collider.getPrevBox();
            const distance = prevBox.distanceCenterToCenter(contact.box);
            if (minDistance === null || distance < minDistance) {
                minDistance = distance;
            }
        });
        const closestWallContacts = wallContacts.filter((contact) => {
            const prevBox = this.collider.getPrevBox();
            const distance = prevBox.distanceCenterToCenter(contact.box);
            return distance === minDistance;
        });
        if (closestWallContacts.length > 0) {
            const firstClosestWallContact = closestWallContacts[0];
            const wallWorldBox = firstClosestWallContact.box;
            const selfWorldBox = this.getWorldBoundingBox();
            const wall = firstClosestWallContact.collider.object;
            const isBrickWall = wall.tags.includes(Tag_1.Tag.Brick);
            const isBorderWall = wall.tags.includes(Tag_1.Tag.Border);
            const isSteelWall = wall.tags.includes(Tag_1.Tag.Steel);
            const canDestroySteelWall = this.wallDamage === TankBulletWallDamage_1.TankBulletWallDamage.High;
            if (isBrickWall || (isSteelWall && canDestroySteelWall)) {
                const destroyer = new TerrainTileDestroyer_1.TerrainTileDestroyer(this.wallDamage);
                this.updateWorldMatrix(true);
                this.add(destroyer);
                destroyer.updateMatrix();
                destroyer.setCenter(this.getSelfCenter());
                // At this point destroyer is aligned by the main axis, i.e.
                // if bullet rotation is left/right - destroyer is aligned at "y";
                // if bullet rotation is up/down - destroyer is aligned at "x".
                // What is left is to fix counterpart axis.
                destroyer.updateMatrix();
                const destroyerWorldBox = destroyer.getWorldBoundingBox();
                const rotation = destroyer.getWorldRotation();
                if (rotation === Rotation_1.Rotation.Up) {
                    destroyer.translateY(destroyerWorldBox.max.y - wallWorldBox.max.y);
                }
                else if (rotation === Rotation_1.Rotation.Down) {
                    destroyer.translateY(wallWorldBox.min.y - destroyerWorldBox.min.y);
                }
                else if (rotation === Rotation_1.Rotation.Left) {
                    destroyer.translateY(destroyerWorldBox.max.x - wallWorldBox.max.x);
                }
                else if (rotation === Rotation_1.Rotation.Right) {
                    destroyer.translateY(wallWorldBox.min.x - destroyerWorldBox.min.x);
                }
                this.parent.attach(destroyer);
                this.snapDestroyerToBrickGrid(destroyer);
                // TODO: it collides with multiple "bricks", multiple audio sources are
                // triggered
                // Only player bullets make sound
                if (this.tags.includes(Tag_1.Tag.Player)) {
                    this.hitBrickSound.play();
                }
            }
            else if (isSteelWall || isBorderWall) {
                // TODO: when tank is grade 4, it can destroy steel walls, and in that
                // case they make the same sound as brick walls
                // Only player bullets make sound
                if (this.tags.includes(Tag_1.Tag.Player)) {
                    this.hitSteelSound.play();
                }
            }
            // Reposition bullet to the place where it hits the wall so explosion
            // will go off in the right place. Now it is tied to axis.
            const rotation = this.getWorldRotation();
            if (rotation === Rotation_1.Rotation.Up) {
                this.translateY(selfWorldBox.max.y - wallWorldBox.max.y);
            }
            else if (rotation === Rotation_1.Rotation.Down) {
                this.translateY(wallWorldBox.min.y - selfWorldBox.min.y);
            }
            else if (rotation === Rotation_1.Rotation.Left) {
                this.translateY(selfWorldBox.max.x - wallWorldBox.max.x);
            }
            else if (rotation === Rotation_1.Rotation.Right) {
                this.translateY(wallWorldBox.min.x - selfWorldBox.min.x);
            }
            this.updateMatrix();
            this.explode();
        }
    }
    getRotationString(rotation) {
        switch (rotation) {
            case Rotation_1.Rotation.Up:
                return 'up';
            case Rotation_1.Rotation.Down:
                return 'down';
            case Rotation_1.Rotation.Left:
                return 'left';
            case Rotation_1.Rotation.Right:
                return 'right';
            default:
                return 'unknown';
        }
    }
    snapDestroyerToBrickGrid(destroyer) {
        destroyer.updateMatrix();
        const destroyerBox = destroyer.getBoundingBox();
        const rotation = destroyer.getWorldRotation();
        if (rotation === Rotation_1.Rotation.Up || rotation === Rotation_1.Rotation.Down) {
            const snappedMinX = Math.round(destroyerBox.min.x / config.TILE_SIZE_SMALL) *
                config.TILE_SIZE_SMALL;
            destroyer.position.addX(snappedMinX - destroyerBox.min.x);
        }
        else if (rotation === Rotation_1.Rotation.Left || rotation === Rotation_1.Rotation.Right) {
            const snappedMinY = Math.round(destroyerBox.min.y / config.TILE_SIZE_SMALL) *
                config.TILE_SIZE_SMALL;
            destroyer.position.addY(snappedMinY - destroyerBox.min.y);
        }
        destroyer.updateMatrix(true);
    }
}
exports.Bullet = Bullet;
