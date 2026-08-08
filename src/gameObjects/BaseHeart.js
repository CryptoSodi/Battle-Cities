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
exports.BaseHeart = void 0;
const core_1 = require("../core");
const Tag_1 = require("../game/Tag");
const Explosion_1 = require("./Explosion");
const config = __importStar(require("../config"));
class BaseHeart extends core_1.GameObject {
    constructor() {
        super(64, 64);
        this.collider = new core_1.BoxCollider(this, true);
        this.tags = [Tag_1.Tag.BlockMove];
        this.painter = new core_1.SpritePainter();
        this.zIndex = config.BASE_HEART_Z_INDEX;
        this.died = new core_1.Subject();
        this.isDead = false;
    }
    explode() {
        if (this.isDead) {
            return;
        }
        this.isDead = true;
        const explosion = new Explosion_1.Explosion();
        explosion.updateMatrix();
        explosion.setCenter(this.getSelfCenter());
        this.add(explosion);
        this.painter.sprite = this.deadSprite;
        this.died.notify(null);
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        this.aliveSprite = spriteLoader.load('base.heart.alive');
        this.deadSprite = spriteLoader.load('base.heart.dead');
        this.painter.sprite = this.aliveSprite;
    }
    update() {
        this.collider.update();
    }
    collide(collision) {
        // If dead, don't collide with bullets, but they can still pass through
        if (this.isDead) {
            return;
        }
        const bulletContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(Tag_1.Tag.Bullet);
        });
        if (bulletContacts.length > 0) {
            const firstBulletContact = bulletContacts[0];
            const bullet = firstBulletContact.collider.object;
            if (bullet.isLocalDamageDisabled()) {
                return;
            }
            bullet.explode();
            this.explode();
        }
    }
}
exports.BaseHeart = BaseHeart;
