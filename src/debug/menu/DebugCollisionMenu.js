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
exports.DebugCollisionMenu = void 0;
const core_1 = require("../../core");
const config = __importStar(require("../../config"));
const DebugMenu_1 = require("../DebugMenu");
class DebugCollisionMenu extends DebugMenu_1.DebugMenu {
    constructor(collisionSystem, root, 
    // Returns the zoomed subtree root (the field) so the debug rects can be
    // drawn with the same camera zoom; otherwise they'd be drawn at unzoomed
    // coordinates and misalign with the zoomed gameplay.
    getCameraSource = () => null, options = {}) {
        super('Collision', options);
        this.items = [];
        this.isShown = false;
        this.handleShow = () => {
            this.show();
        };
        this.handleHide = () => {
            this.hide();
        };
        this.handleUpdate = () => {
            this.update();
        };
        this.collisionSystem = collisionSystem;
        this.root = root;
        this.getCameraSource = getCameraSource;
        this.itemsContainer = new core_1.GameObject();
        this.appendButton('Show', this.handleShow);
        this.appendButton('Hide', this.handleHide);
        this.appendButton('Update', this.handleUpdate);
    }
    show() {
        this.isShown = true;
        this.root.add(this.itemsContainer);
    }
    hide() {
        this.isShown = false;
        this.root.remove(this.itemsContainer);
        this.clear();
    }
    update() {
        if (!this.isShown) {
            return;
        }
        // Match the gameplay camera zoom so the debug rects line up with the
        // zoomed field instead of being drawn at 1:1.
        const cameraSource = this.getCameraSource();
        if (cameraSource !== null) {
            this.itemsContainer.cameraZoom = cameraSource.cameraZoom;
            this.itemsContainer.cameraPivotX = cameraSource.cameraPivotX;
            this.itemsContainer.cameraPivotY = cameraSource.cameraPivotY;
        }
        this.clear();
        const collisions = this.collisionSystem.getCollisions();
        collisions.forEach((collision) => {
            const selfItem = this.createItem(collision.box, 'green');
            this.items.push(selfItem);
            this.itemsContainer.add(selfItem);
            collision.contacts.forEach((contact) => {
                const otherItem = this.createItem(contact.box, 'yellow');
                this.items.push(otherItem);
                this.itemsContainer.add(otherItem);
            });
        });
    }
    clear() {
        this.items.forEach((item) => {
            item.removeSelf();
        });
        this.items = [];
    }
    createItem(box, color) {
        const rect = box.toRect();
        const item = new core_1.GameObject(rect.width, rect.height);
        item.position.set(rect.x, rect.y);
        item.updateMatrix();
        item.setZIndex(config.DEBUG_COLLISION_RECT_Z_INDEX);
        item.painter = new core_1.RectPainter(null, color);
        return item;
    }
}
exports.DebugCollisionMenu = DebugCollisionMenu;
