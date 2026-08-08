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
exports.Spawn = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
class Spawn extends core_1.GameObject {
    constructor() {
        super(64, 64);
        this.zIndex = config.SPAWN_Z_INDEX;
        this.painter = new core_1.SpritePainter();
        this.completed = new core_1.Subject();
        this.painter.alignment = core_1.SpriteAlignment.MiddleCenter;
    }
    setup({ spriteLoader }) {
        this.animation = new core_1.Animation(spriteLoader.loadList(['spawn.1', 'spawn.2', 'spawn.3', 'spawn.4']), { delay: 0.05, loop: 3 });
    }
    update({ deltaTime }) {
        if (this.animation.isComplete()) {
            this.completed.notify(null);
            return;
        }
        this.animation.update(deltaTime);
        this.painter.sprite = this.animation.getCurrentFrame();
        this.setNeedsPaint();
    }
}
exports.Spawn = Spawn;
