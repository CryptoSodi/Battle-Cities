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
exports.Powerup = void 0;
const core_1 = require("../core");
const game_1 = require("../game");
const powerup_1 = require("../powerup");
const config = __importStar(require("../config"));
const PICKUP_MIN_INTERSECTION_SIZE = 16;
class Powerup extends core_1.GameObject {
    constructor(type) {
        super(64, 64);
        this.zIndex = config.POWERUP_Z_INDEX;
        this.collider = new core_1.BoxCollider(this, true);
        this.painter = new core_1.SpritePainter();
        this.ignorePause = true;
        this.picked = new core_1.Subject();
        this.networkControlled = false;
        this.type = type;
    }
    destroy() {
        this.dirtyPaintBox();
        this.removeSelf();
        this.collider.unregister();
    }
    setNetworkControlled(controlled) {
        this.networkControlled = controlled;
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        const spriteId = this.getSpriteId();
        // Null as a second frame adds a blink effect
        const frames = [spriteLoader.load(spriteId), null];
        this.animation = new core_1.Animation(frames, {
            delay: 0.12,
            loop: true,
        });
    }
    update(updateArgs) {
        this.collider.update();
        this.animation.update(updateArgs.deltaTime);
        this.painter.sprite = this.animation.getCurrentFrame();
        this.setNeedsPaint();
    }
    collide(collision) {
        if (this.networkControlled) {
            return;
        }
        const playerTankContacts = collision.contacts.filter((contact) => {
            return (contact.collider.object.tags.includes(game_1.Tag.Tank) &&
                contact.collider.object.tags.includes(game_1.Tag.Player));
        });
        if (playerTankContacts.length > 0) {
            const firstPlayerTankContact = playerTankContacts[0];
            const tankBox = firstPlayerTankContact.collider.getBox();
            const selfBox = this.collider.getBox();
            // Fixes the issue that tank can pick up powerup with his collision box
            // even though tank is visually not exactly touching the powerup.
            // Calculate minimum intersection area in order for powerup to get
            // picked up.
            const intersectionBox = selfBox.clone().intersectWith(tankBox);
            const intersectionRect = intersectionBox.toRect();
            if (intersectionRect.width > PICKUP_MIN_INTERSECTION_SIZE &&
                intersectionRect.height > PICKUP_MIN_INTERSECTION_SIZE) {
                const tank = firstPlayerTankContact.collider.object;
                const { partyIndex } = tank;
                this.destroy();
                this.picked.notify({ partyIndex });
            }
        }
    }
    getSpriteId() {
        switch (this.type) {
            case powerup_1.PowerupType.BaseDefence:
                return 'powerup.shovel';
            case powerup_1.PowerupType.Freeze:
                return 'powerup.clock';
            case powerup_1.PowerupType.Life:
                return 'powerup.life';
            case powerup_1.PowerupType.Shield:
                return 'powerup.helmet';
            case powerup_1.PowerupType.Speed:
                return 'powerup.speed';
            case powerup_1.PowerupType.Upgrade:
                return 'powerup.star';
            case powerup_1.PowerupType.ZoomOut:
                return 'powerup.zoomout';
            case powerup_1.PowerupType.Wipeout:
                return 'powerup.grenade';
        }
        return 'unknown';
    }
}
exports.Powerup = Powerup;
