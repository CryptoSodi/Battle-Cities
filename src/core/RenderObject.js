"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderObject = void 0;
const Transform_1 = require("./Transform");
class RenderObject extends Transform_1.Transform {
    constructor() {
        super(...arguments);
        // TODO: circular reference
        this.painter = null;
        // Render-time camera zoom for this object's subtree (does NOT touch the
        // transform tree or collision). 1 = no zoom. Set on the world/field root; the
        // renderer scales that subtree around (cameraPivotX, cameraPivotY) in screen
        // space, so gameplay zooms while the HUD/menus stay at their normal size.
        this.cameraZoom = 1;
        this.cameraPivotX = 0;
        this.cameraPivotY = 0;
        // Optional culling camera for dev visual zoom-out. Null means cull with the
        // rendered camera; set it on the camera root to keep culling on gameplay zoom.
        this.cameraCullZoom = null;
        this.cameraCullPivotX = 0;
        this.cameraCullPivotY = 0;
        // 0 by default
        // If null - will inherit from parent
        this.zIndex = null;
        // Computed, don't change
        this.worldZIndex = null;
        // Visible by default
        // If null - will inherit from parent
        this.visible = null;
        // Computed, don't change
        this.worldVisible = null;
        this.prevDirtyBox = null;
        this.needsPaint = true;
    }
    canRender() {
        if (this.painter === null) {
            return false;
        }
        if (this.getWorldVisible() === false) {
            return false;
        }
        return true;
    }
    // Visibility
    setVisible(visible) {
        this.visible = visible;
        this.updateWorldVisible(true);
    }
    getVisible() {
        return this.visible;
    }
    getWorldVisible() {
        return this.worldVisible;
    }
    updateWorldVisible(updateParents = false) {
        if (this.parent !== null && updateParents === true) {
            this.parent.updateWorldVisible(true);
        }
        if (this.parent === null) {
            this.worldVisible = this.visible ?? true;
        }
        else {
            this.worldVisible = this.visible ?? this.parent.worldVisible;
        }
        for (const child of this.children) {
            child.updateWorldVisible();
        }
    }
    // Z-index
    setZIndex(zIndex) {
        this.zIndex = zIndex;
        this.updateWorldZIndex(true);
    }
    getZIndex() {
        return this.zIndex;
    }
    getWorldZIndex() {
        return this.worldZIndex;
    }
    updateWorldZIndex(updateParents = false) {
        if (this.parent !== null && updateParents === true) {
            this.parent.updateWorldZIndex(true);
        }
        if (this.parent === null) {
            this.worldZIndex = this.zIndex ?? 0;
        }
        else {
            this.worldZIndex = this.zIndex ?? this.parent.worldZIndex;
        }
        for (const child of this.children) {
            child.updateWorldZIndex();
        }
    }
    // Dirty box
    dirtyPaintBox() {
        this.prevDirtyBox = this.getWorldBoundingBox().clone();
        this.needsPaint = true;
        for (const child of this.children) {
            child.dirtyPaintBox();
        }
    }
    getPrevDirtyBox() {
        return this.prevDirtyBox;
    }
    resetPrevDirtyBox() {
        this.prevDirtyBox = null;
    }
    // Paint flag
    setNeedsPaint() {
        this.needsPaint = true;
        for (const child of this.children) {
            child.setNeedsPaint();
        }
    }
    doesNeedPaint() {
        return this.needsPaint;
    }
    resetNeedsPaint() {
        this.needsPaint = false;
    }
}
exports.RenderObject = RenderObject;
