"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollisionSystem = void 0;
const Collision_1 = require("./Collision");
const CollisionContact_1 = require("./CollisionContact");
class CollisionSystem {
    constructor() {
        this.dynamicColliders = [];
        this.staticColliders = [];
        this.collisions = [];
    }
    register(collider) {
        if (collider.dynamic) {
            this.dynamicColliders.push(collider);
        }
        else {
            this.staticColliders.push(collider);
        }
        collider.unregisterRequested.addListenerOnce(() => {
            this.unregister(collider);
        });
        collider.init();
    }
    unregister(collider) {
        const list = collider.dynamic
            ? this.dynamicColliders
            : this.staticColliders;
        const index = list.indexOf(collider);
        if (index !== -1) {
            list.splice(index, 1);
        }
    }
    update() {
        const bothColliders = this.dynamicColliders.concat(this.staticColliders);
        this.collisions = [];
        for (const selfCollider of this.dynamicColliders) {
            let collision = null;
            for (const otherCollider of bothColliders) {
                // Prevent colliding with itself
                if (otherCollider === selfCollider) {
                    continue;
                }
                // Prevent children colliding with parents
                if (otherCollider.object.hasParent(selfCollider.object)) {
                    continue;
                }
                if (selfCollider.object.hasParent(otherCollider.object)) {
                    continue;
                }
                const selfBox = selfCollider.getBox();
                const otherBox = otherCollider.getBox();
                if (selfBox.intersectsBox(otherBox)) {
                    // Lazy create collision if we have at least one intersestion
                    if (collision === null) {
                        collision = new Collision_1.Collision(selfCollider, selfBox);
                    }
                    const contact = new CollisionContact_1.CollisionContact(otherCollider, otherBox);
                    collision.addContact(contact);
                }
            }
            if (collision !== null) {
                this.collisions.push(collision);
            }
        }
    }
    getCollisionByCollider(collider) {
        for (const collision of this.collisions) {
            if (collision.collider === collider) {
                return collision;
            }
        }
        return null;
    }
    collide() {
        this.collisions.forEach((collision) => {
            collision.collider.object.invokeCollide(collision);
        });
    }
    getCollisions() {
        return this.collisions;
    }
    // Read-only access to the registered static colliders, for queries that
    // need to look at world geometry beyond a collision's own contact list
    // (e.g. line-of-sight / cover checks).
    getStaticColliders() {
        return this.staticColliders;
    }
    reset() {
        this.dynamicColliders = [];
        this.staticColliders = [];
        this.collisions = [];
    }
}
exports.CollisionSystem = CollisionSystem;
