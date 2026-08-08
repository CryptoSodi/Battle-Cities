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
exports.Curtain = void 0;
const core_1 = require("../core");
const config = __importStar(require("../config"));
var State;
(function (State) {
    State[State["Closed"] = 0] = "Closed";
    State[State["Closing"] = 1] = "Closing";
    State[State["Open"] = 2] = "Open";
    State[State["Opening"] = 3] = "Opening";
})(State || (State = {}));
const SLIDE_SPEED = 1500;
class Curtain extends core_1.GameObject {
    constructor(width, height, isOpen = true) {
        super(width, height);
        this.zIndex = config.CURTAIN_Z_INDEX;
        this.state = isOpen ? State.Open : State.Closed;
    }
    setup() {
        // Curtain part is half a size of full curtain
        this.targetHeight = this.size.height / 2;
        const initialHeight = this.state === State.Open ? 0 : this.targetHeight;
        this.topPart = new core_1.GameObject(this.size.width, initialHeight + 1);
        this.topPart.painter = new core_1.RectPainter(config.COLOR_GRAY);
        this.bottomPart = new core_1.GameObject(this.size.width, initialHeight + 1);
        this.bottomPart.painter = new core_1.RectPainter(config.COLOR_GRAY);
        this.bottomPart.origin.set(0, 1);
        this.bottomPart.position.setY(this.size.height);
        this.add(this.topPart);
        this.add(this.bottomPart);
    }
    update(updateArgs) {
        const { deltaTime } = updateArgs;
        if (this.state === State.Open || this.state === State.Closed) {
            return;
        }
        let nextHeight = this.topPart.size.height;
        if (this.state === State.Closing) {
            nextHeight += SLIDE_SPEED * deltaTime;
            if (nextHeight >= this.targetHeight) {
                nextHeight = this.targetHeight;
                this.state = State.Closed;
            }
        }
        else if (this.state === State.Opening) {
            nextHeight -= SLIDE_SPEED * deltaTime;
            if (nextHeight <= 0) {
                nextHeight = 0;
                this.state = State.Open;
            }
        }
        this.topPart.size.setHeight(nextHeight + 1);
        this.topPart.updateMatrix();
        this.bottomPart.size.setHeight(nextHeight + 1);
        this.bottomPart.updateMatrix();
        this.dirtyPaintBox();
    }
    close() {
        if (this.state !== State.Open) {
            return;
        }
        this.state = State.Closing;
    }
    open() {
        if (this.state !== State.Closed) {
            return;
        }
        this.state = State.Opening;
    }
}
exports.Curtain = Curtain;
