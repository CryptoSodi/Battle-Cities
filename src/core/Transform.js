"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transform = void 0;
const BoundingBox_1 = require("./BoundingBox");
const Matrix3_1 = require("./Matrix3");
const Node_1 = require("./Node");
const Size_1 = require("./Size");
const Vector_1 = require("./Vector");
const utils_1 = require("./utils");
// Refenreces:
// https://docs.unity3d.com/ScriptReference/RectTransform.html
// https://github.com/mrdoob/three.js/blob/dev/src/core/Object3D.js
// https://github.com/SFML/SFML/blob/master/src/SFML/Graphics/Transformable.cpp
// http://gameprogrammingpatterns.com/dirty-flag.html
// https://en.wikipedia.org/wiki/Transformation_matrix
// https://en.wikipedia.org/wiki/Affine_transformation
// https://medium.com/swlh/understanding-3d-matrix-transforms-with-pixijs-c76da3f8bd8
// -1 is because coordinate system start is at top left
const X_AXIS = new Vector_1.Vector(1, 0);
const Y_AXIS = new Vector_1.Vector(0, -1);
class Transform extends Node_1.Node {
    constructor(width = 0, height = 0) {
        super();
        this.size = new Size_1.Size();
        this.position = new Vector_1.Vector(0, 0);
        // Values in range [0,1] based on size.
        this.origin = new Vector_1.Vector(0, 0);
        // Degrees; clockwise
        this.rotation = 0;
        // Pivot for rotation. Values in range [0,1] based on size.
        this.pivot = new Vector_1.Vector(0, 0);
        this.matrix = new Matrix3_1.Matrix3();
        this.worldMatrix = new Matrix3_1.Matrix3();
        this.boundingBox = new BoundingBox_1.BoundingBox();
        this.worldBoundingBox = new BoundingBox_1.BoundingBox();
        this.matrixAutoUpdate = false;
        this.worldMatrixNeedsUpdate = false;
        // Render interpolation: position at the start of the current sim step
        // (interpPrev) and the real position (interpActual) saved while the object is
        // temporarily moved to its interpolated position for drawing. Presentation
        // only — the sim always runs on the real position.
        this.interpPrev = new Vector_1.Vector(0, 0);
        this.interpActual = new Vector_1.Vector(0, 0);
        this.interpHasPrev = false;
        this.interpApplied = false;
        this.size = new Size_1.Size(width, height);
    }
    // Snapshot the current position as the "previous" step state. Called once per
    // fixed sim step (before the step moves anything) so the renderer can
    // interpolate between steps.
    interpCapture() {
        this.interpPrev.copyFrom(this.position);
        this.interpHasPrev = true;
    }
    // Temporarily move the object forward along last step's velocity for
    // rendering: current + (current - prev) * alpha, where alpha is the fraction
    // into the not-yet-simulated next step. Extrapolation (not interpolation) is
    // used so there is NO added latency when the display is matched to the sim
    // rate (alpha ~ 0 -> draw the real position), while still smoothing motion on
    // higher-refresh displays. Only position is extrapolated (rotation is
    // discrete). Marks the subtree dirty so world matrices recompute. No-op for
    // objects that didn't move (prev == current) or have no captured previous.
    interpApply(alpha) {
        this.interpApplied = false;
        if (!this.interpHasPrev) {
            return;
        }
        if (this.interpPrev.x === this.position.x &&
            this.interpPrev.y === this.position.y) {
            return;
        }
        this.interpActual.copyFrom(this.position);
        this.position.set(this.interpActual.x + (this.interpActual.x - this.interpPrev.x) * alpha, this.interpActual.y + (this.interpActual.y - this.interpPrev.y) * alpha);
        this.updateMatrix(true);
        this.interpApplied = true;
    }
    // Restore the real position after drawing an interpolated frame.
    interpRestore() {
        if (!this.interpApplied) {
            return;
        }
        this.position.copyFrom(this.interpActual);
        this.updateMatrix(true);
        this.interpApplied = false;
    }
    rotate(rotation) {
        this.rotation = rotation;
    }
    // Add child while keeping it's world position.
    // Modifies attachable object local matrix, position and rotation.
    attach(target) {
        // Make sure self tree is up-to-date, because we need a correct world matrix
        this.updateWorldMatrix(true);
        // Self object will become a parent for a target object
        const invSelfWorldTransformMatrix = this.worldMatrix.clone().invert();
        if (target.parent !== null) {
            target.parent.updateWorldMatrix(true);
            invSelfWorldTransformMatrix.premultiply(target.parent.worldMatrix);
        }
        // Revert all world transformations of self (new parent) from the target,
        // so target's local matrix will now be relative to a new parent.
        target.updateMatrix();
        target.applyMatrix3(invSelfWorldTransformMatrix);
        this.add(target);
        return this;
    }
    applyMatrix3(transformMatrix) {
        if (this.matrixAutoUpdate) {
            this.updateMatrix();
        }
        this.matrix.multiply(transformMatrix);
        const { rotation, position } = this.decomposeTransformMatrix(this.matrix, this.getPivotOffset(), this.getOriginOffset());
        this.rotation = rotation;
        this.position = position;
    }
    translateX(distance) {
        this.translateOnAxis(X_AXIS, distance);
        return this;
    }
    translateY(distance) {
        this.translateOnAxis(Y_AXIS, distance);
        return this;
    }
    translateOnAxis(axis, distance) {
        const d = Matrix3_1.Matrix3.createRotation(this.rotation)
            .applyToVector(axis.clone())
            .multScalar(distance);
        this.position.add(d);
        return this;
    }
    getWorldPosition() {
        const { position: worldPosition } = this.decomposeTransformMatrix(this.worldMatrix, this.getPivotOffset(), this.getOriginOffset());
        return worldPosition;
    }
    getWorldRotation() {
        const { rotation: worldRotation } = this.decomposeTransformMatrix(this.worldMatrix, this.getPivotOffset(), this.getOriginOffset());
        return worldRotation;
    }
    getCenter() {
        return this.getBoundingBox().getCenter();
    }
    setCenter(v) {
        const size = this.getBoundingBox().getSize();
        this.position.set(v.x - size.width / 2, v.y - size.height / 2);
    }
    setCenterX(x) {
        const size = this.getBoundingBox().getSize();
        this.position.setX(x - size.width / 2);
    }
    setCenterY(y) {
        const size = this.getBoundingBox().getSize();
        this.position.setY(y - size.height / 2);
    }
    getSelfCenter() {
        return this.size.toVector().divideScalar(2);
    }
    getBoundingBox() {
        if (this.matrixAutoUpdate) {
            this.updateMatrix();
        }
        return this.boundingBox;
    }
    getWorldBoundingBox() {
        this.updateWorldMatrix(true);
        return this.worldBoundingBox;
    }
    getSelfPoints() {
        const { width, height } = this.size;
        const points = [
            new Vector_1.Vector(0, 0),
            new Vector_1.Vector(width, 0),
            new Vector_1.Vector(width, height),
            new Vector_1.Vector(0, height),
        ];
        return points;
    }
    getPoints() {
        const selfPoints = this.getSelfPoints();
        const points = selfPoints.map((point) => {
            return this.matrix.applyToVector(point);
        });
        return points;
    }
    getWorldPoints() {
        const selfPoints = this.getSelfPoints();
        const points = selfPoints.map((point) => {
            return this.worldMatrix.applyToVector(point);
        });
        return points;
    }
    updateMatrix(childrenNeedUpdate = false) {
        // Inlined composeTransformMatrix + corner-based bounding box. This runs
        // for every mover on every sim tick AND every rendered frame (render
        // interpolation), so it must not allocate — temporary matrices/vectors
        // here used to be the game's main source of GC pauses (felt as frame
        // drops). The arithmetic is kept operation-for-operation identical to the
        // compose/getPoints path so simulation results (and replays) are
        // unchanged.
        const width = this.size.width;
        const height = this.size.height;
        const pivX = -this.pivot.x * width;
        const pivY = -this.pivot.y * height;
        const orgX = -this.origin.x * width;
        const orgY = -this.origin.y * height;
        const cos = utils_1.MathUtils.cosDegrees(this.rotation);
        const sin = utils_1.MathUtils.sinDegrees(this.rotation);
        const tx = pivX * cos - pivY * sin - pivX + orgX + this.position.x;
        const ty = pivX * sin + pivY * cos - pivY + orgY + this.position.y;
        this.matrix.set(cos, sin, 0, -sin, cos, 0, tx, ty, 1);
        this.writeTransformedBox(this.boundingBox, this.matrix, width, height);
        this.setWorldMatrixNeedsUpdate(childrenNeedUpdate);
    }
    // Writes the axis-aligned bounding box of this transform's local rect
    // (0,0,width,height) under the given matrix, corner by corner, without
    // allocating point vectors (allocation-free twin of
    // boundingBox.fromPoints(getPoints())).
    writeTransformedBox(box, m, width, height) {
        const e = m.elements;
        const e0 = e[0];
        const e1 = e[1];
        const e3 = e[3];
        const e4 = e[4];
        const e6 = e[6];
        const e7 = e[7];
        // Corners in the same order getSelfPoints() produced them:
        // (0,0), (width,0), (width,height), (0,height).
        const x0 = e6;
        const y0 = e7;
        const x1 = width * e0 + e6;
        const y1 = width * e1 + e7;
        const x2 = width * e0 + height * e3 + e6;
        const y2 = width * e1 + height * e4 + e7;
        const x3 = height * e3 + e6;
        const y3 = height * e4 + e7;
        let minX = x0;
        let maxX = x0;
        let minY = y0;
        let maxY = y0;
        if (x1 < minX)
            minX = x1;
        if (x1 > maxX)
            maxX = x1;
        if (y1 < minY)
            minY = y1;
        if (y1 > maxY)
            maxY = y1;
        if (x2 < minX)
            minX = x2;
        if (x2 > maxX)
            maxX = x2;
        if (y2 < minY)
            minY = y2;
        if (y2 > maxY)
            maxY = y2;
        if (x3 < minX)
            minX = x3;
        if (x3 > maxX)
            maxX = x3;
        if (y3 < minY)
            minY = y3;
        if (y3 > maxY)
            maxY = y3;
        box.min.set(minX, minY);
        box.max.set(maxX, maxY);
    }
    setWorldMatrixNeedsUpdate(updateChildren = false) {
        this.worldMatrixNeedsUpdate = true;
        if (updateChildren) {
            for (const child of this.children) {
                child.setWorldMatrixNeedsUpdate(updateChildren);
            }
        }
    }
    updateWorldMatrix(updateParents = false, updateChildren = false) {
        // Goes up the tree to all parents and updates their local and world matrix.
        // Note, that it will update all parents starting from the root, before it
        // continues updating current object.
        if (updateParents === true && this.parent !== null) {
            this.parent.updateWorldMatrix(true, false);
        }
        // Update current node local matrix
        if (this.matrixAutoUpdate) {
            this.updateMatrix();
        }
        if (this.worldMatrixNeedsUpdate) {
            // Update current node world matrix
            if (this.parent === null) {
                this.worldMatrix.copyFrom(this.matrix);
            }
            else {
                this.worldMatrix.multiplyMatrices(this.matrix, this.parent.worldMatrix);
            }
            this.writeTransformedBox(this.worldBoundingBox, this.worldMatrix, this.size.width, this.size.height);
            this.worldMatrixNeedsUpdate = false;
        }
        // Goes down the tree and updates all children local and world matrix
        if (updateChildren === true) {
            for (const child of this.children) {
                child.updateWorldMatrix(false, true);
            }
        }
    }
    getPivotOffset() {
        const pivotOffset = new Vector_1.Vector(-this.pivot.x * this.size.width, -this.pivot.y * this.size.height);
        return pivotOffset;
    }
    getOriginOffset() {
        const originOffset = new Vector_1.Vector(-this.origin.x * this.size.width, -this.origin.y * this.size.height);
        return originOffset;
    }
    /**
     * P (Pivot offset for rotation around it)
     *   [1  0  0]
     *   [0  1  0]
     *   [px py 1]
  
     * R (Rotation)
     *   [cos -sin 0]
     *   [sin  cos 0]
     *   [ 0    0  1]
     *
     * -P (Pivot offset cancellation)
     *   [1    0  0]
     *   [0    1  0]
     *   [-px -py 1]
     *
     * O (Origin offset for translation around it)
     *   [1  0  0]
     *   [0  1  0]
     *   [ox oy 1]
     *
     * T (Translation):
     *   [1  0  0]
     *   [0  1  0]
     *   [tx ty 1]
     *
     * All combined into a single transform matrix
     *
     *   TM = P * R * (-P) * O * T
     *
     * which can be applied to a vector V to transform it:
     *
     *   V' = V * TM
     */
    composeTransformMatrix(pivotOffset, originOffset, rotation, position) {
        const pivX = pivotOffset.x;
        const pivY = pivotOffset.y;
        const orgX = originOffset.x;
        const orgY = originOffset.y;
        const posX = position.x;
        const posY = position.y;
        const cos = utils_1.MathUtils.cosDegrees(rotation);
        const sin = utils_1.MathUtils.sinDegrees(rotation);
        const tx = pivX * cos - pivY * sin - pivX + orgX + posX;
        const ty = pivX * sin + pivY * cos - pivY + orgY + posY;
        const transformMatrix = new Matrix3_1.Matrix3().set(cos, sin, 0, -sin, cos, 0, tx, ty, 1);
        return transformMatrix;
    }
    decomposeTransformMatrix(transformMatrix, pivotOffset, originOffset) {
        const pivX = pivotOffset.x;
        const pivY = pivotOffset.y;
        const orgX = originOffset.x;
        const orgY = originOffset.y;
        const cos = transformMatrix.elements[0];
        const sin = transformMatrix.elements[1];
        const tx = transformMatrix.elements[6];
        const ty = transformMatrix.elements[7];
        let rotation = utils_1.MathUtils.atan2Degrees(sin, cos);
        if (rotation < 0) {
            rotation += 360;
        }
        const posX = tx - (pivX * cos - pivY * sin - pivX + orgX);
        const posY = ty - (pivX * sin + pivY * cos - pivY + orgY);
        const position = new Vector_1.Vector(posX, posY);
        return {
            rotation,
            position,
        };
    }
}
exports.Transform = Transform;
