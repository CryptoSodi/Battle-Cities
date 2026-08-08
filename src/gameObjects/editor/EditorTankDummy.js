"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorTankDummy = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const tank_1 = require("../../tank");
class EditorTankDummy extends core_1.GameObject {
    constructor(type, color, rotation = game_1.Rotation.Up, blockMove = false) {
        super(64, 64);
        this.collider = new core_1.BoxCollider(this);
        this.painter = new core_1.SpritePainter();
        this.tags = [];
        this.type = type;
        this.color = color;
        this.pivot.set(0.5, 0.5);
        this.rotation = rotation;
        if (blockMove) {
            this.tags = [game_1.Tag.EditorBlockMove];
        }
    }
    setup({ collisionSystem, spriteLoader }) {
        collisionSystem.register(this.collider);
        const spriteId = tank_1.TankSpriteId.create(this.type, this.color, this.rotation, 1);
        const sprite = spriteLoader.load(spriteId);
        this.painter.sprite = sprite;
    }
    update() {
        this.collider.update();
    }
}
exports.EditorTankDummy = EditorTankDummy;
