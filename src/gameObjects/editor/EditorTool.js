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
exports.EditorTool = void 0;
const core_1 = require("../../core");
const game_1 = require("../../game");
const input_1 = require("../../input");
const config = __importStar(require("../../config"));
const EditorBaseBrush_1 = require("./EditorBaseBrush");
const BLINK_DELAY = 0.2;
const HOLD_THROTTLE_OPTIONS = {
    activationDelay: 0.12,
    delay: 0.024,
};
class EditorTool extends core_1.GameObject {
    constructor() {
        super();
        this.collider = new core_1.BoxCollider(this, true);
        this.painter = new core_1.RectPainter(null, config.COLOR_RED);
        this.zIndex = config.EDITOR_TOOL_Z_INDEX;
        this.draw = new core_1.Subject();
        this.erase = new core_1.Subject();
        this.brushChanged = new core_1.Subject();
        this.brushes = [];
        this.selectedBrush = null;
        this.velocity = new core_1.Vector(0, 0);
        this.holdThrottles = [];
        this.blinkTimer = new core_1.Timer();
        this.isBlinkVisible = true;
        this.moveUp = () => {
            this.velocity.set(0, -this.getSnapStepY());
        };
        this.moveDown = () => {
            this.velocity.set(0, this.getSnapStepY());
        };
        this.moveLeft = () => {
            this.velocity.set(-this.getSnapStepX(), 0);
        };
        this.moveRight = () => {
            this.velocity.set(this.getSnapStepX(), 0);
        };
        this.holdThrottles = [
            new input_1.InputHoldThrottle(input_1.EditorMapInputContext.MoveUp, this.moveUp, HOLD_THROTTLE_OPTIONS),
            new input_1.InputHoldThrottle(input_1.EditorMapInputContext.MoveDown, this.moveDown, HOLD_THROTTLE_OPTIONS),
            new input_1.InputHoldThrottle(input_1.EditorMapInputContext.MoveLeft, this.moveLeft, HOLD_THROTTLE_OPTIONS),
            new input_1.InputHoldThrottle(input_1.EditorMapInputContext.MoveRight, this.moveRight, HOLD_THROTTLE_OPTIONS),
        ];
    }
    setBrushes(brushes) {
        this.brushes = brushes;
        this.selectBrush(0);
    }
    selectBrushIndex(index) {
        this.selectBrush(index);
    }
    getSelectedBrush() {
        return this.selectedBrush;
    }
    getSelectedBrushIndex() {
        return this.brushes.indexOf(this.selectedBrush);
    }
    setup({ collisionSystem }) {
        collisionSystem.register(this.collider);
        this.cursorOverlay = new core_1.GameObject(this.size.width, this.size.height);
        this.cursorOverlay.painter = new core_1.RectPainter('rgba(255, 255, 255, 0.12)', config.COLOR_YELLOW);
        this.cursorOverlay.painter.lineWidth = 2;
        this.cursorOverlay.setZIndex(config.EDITOR_BRUSH_Z_INDEX + 10);
        this.add(this.cursorOverlay);
    }
    update(updateArgs) {
        this.dirtyPaintBox();
        this.updatePosition(updateArgs);
        this.updateBlinking(updateArgs);
        const { inputManager } = updateArgs;
        const inputMethod = inputManager.getActiveMethod();
        if (inputMethod.isDownAny(input_1.EditorMapInputContext.Draw)) {
            this.draw.notify(null);
        }
        if (inputMethod.isDownAny(input_1.EditorMapInputContext.Erase)) {
            this.erase.notify(null);
        }
        if (inputMethod.isDownAny(input_1.EditorMapInputContext.NextBrush)) {
            this.selectNextBrush();
        }
        if (inputMethod.isDownAny(input_1.EditorMapInputContext.PrevBrush)) {
            this.selectPrevBrush();
        }
        this.collider.update();
    }
    collide(collision) {
        const blockMoveContacts = collision.contacts.filter((contact) => {
            return contact.collider.object.tags.includes(game_1.Tag.EditorBlockMove);
        });
        if (blockMoveContacts.length > 0) {
            this.position.sub(this.velocity);
            this.updateMatrix(true);
        }
    }
    updatePosition(updateArgs) {
        const { deltaTime, inputManager } = updateArgs;
        const inputMethod = inputManager.getActiveMethod();
        this.velocity.set(0, 0);
        if (inputMethod.isDownAny(input_1.EditorMapInputContext.MoveUp)) {
            this.moveUp();
        }
        else if (inputMethod.isDownAny(input_1.EditorMapInputContext.MoveDown)) {
            this.moveDown();
        }
        else if (inputMethod.isDownAny(input_1.EditorMapInputContext.MoveLeft)) {
            this.moveLeft();
        }
        else if (inputMethod.isDownAny(input_1.EditorMapInputContext.MoveRight)) {
            this.moveRight();
        }
        for (const holdThrottle of this.holdThrottles) {
            holdThrottle.update(inputMethod, deltaTime);
        }
        if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            this.position.add(this.velocity);
            this.updateMatrix(true);
        }
    }
    updateBlinking({ deltaTime }) {
        if (this.blinkTimer.isDone()) {
            this.isBlinkVisible = !this.isBlinkVisible;
            this.blinkTimer.reset(BLINK_DELAY);
        }
        else {
            this.blinkTimer.update(deltaTime);
        }
        if (this.selectedBrush !== null) {
            this.selectedBrush.setVisible(this.isBlinkVisible);
        }
        if (this.cursorOverlay !== undefined) {
            this.cursorOverlay.setVisible(this.isBlinkVisible);
        }
    }
    selectNextBrush() {
        const selectedBrushIndex = this.brushes.indexOf(this.selectedBrush);
        let nextBrushIndex = selectedBrushIndex + 1;
        if (nextBrushIndex > this.brushes.length - 1) {
            nextBrushIndex = 0;
        }
        this.selectBrush(nextBrushIndex);
    }
    selectPrevBrush() {
        const selectedBrushIndex = this.brushes.indexOf(this.selectedBrush);
        let prevBrushIndex = selectedBrushIndex - 1;
        if (prevBrushIndex < 0) {
            prevBrushIndex = this.brushes.length - 1;
        }
        this.selectBrush(prevBrushIndex);
    }
    selectBrush(index) {
        // Clear previous brush
        if (this.selectedBrush !== null) {
            // Restore visibility
            this.selectedBrush.setVisible(true);
            this.remove(this.selectedBrush);
        }
        if (this.brushes[index] === undefined) {
            this.selectBrush = null;
            return;
        }
        this.selectedBrush = this.brushes[index];
        this.selectedBrush.setVisible(this.isBlinkVisible);
        this.size.copyFrom(this.selectedBrush.size);
        this.painter = new core_1.RectPainter(null, config.COLOR_RED);
        const snapStepX = this.getSnapStepX();
        const snapStepY = this.getSnapStepY();
        this.position.x -= this.position.x % snapStepX;
        this.position.y -= this.position.y % snapStepY;
        this.add(this.selectedBrush);
        if (this.cursorOverlay !== undefined) {
            this.cursorOverlay.size.copyFrom(this.size);
            this.cursorOverlay.updateMatrix(true);
        }
        this.updateMatrix(true);
        this.brushChanged.notify(this.selectedBrush);
    }
    getSnapStepX() {
        if (this.selectedBrush instanceof EditorBaseBrush_1.EditorBaseBrush) {
            return config.TILE_SIZE_MEDIUM;
        }
        return this.size.width;
    }
    getSnapStepY() {
        if (this.selectedBrush instanceof EditorBaseBrush_1.EditorBaseBrush) {
            return config.TILE_SIZE_MEDIUM;
        }
        return this.size.height;
    }
}
exports.EditorTool = EditorTool;
