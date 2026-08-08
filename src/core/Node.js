"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
class Node {
    constructor() {
        this.children = [];
        this.parent = null;
        this.removedChildren = [];
        this.isRemoved = false;
    }
    // TODO: figure out input type for a child
    add(...childrenToAdd) {
        for (const childToAdd of childrenToAdd) {
            if (childToAdd.parent !== null) {
                childToAdd.parent.remove(childToAdd, false);
            }
            childToAdd.parent = this;
            this.children.push(childToAdd);
        }
        return this;
    }
    replaceSelf(replacement) {
        if (this.parent === null) {
            return this;
        }
        this.parent.remove(this);
        this.parent.add(replacement);
        return this;
    }
    remove(childToRemove, addToRemoved = true) {
        const index = this.children.indexOf(childToRemove);
        if (index === -1) {
            return false;
        }
        if (addToRemoved) {
            childToRemove.isRemoved = true;
            this.removedChildren.push(childToRemove);
        }
        this.children.splice(index, 1);
        return true;
    }
    removeSelf() {
        if (this.parent === null) {
            return this;
        }
        this.parent.remove(this);
        return this;
    }
    removeAllChildren() {
        this.children = [];
        return this;
    }
    cleanupRemoved() {
        this.removedChildren = [];
    }
    traverse(callback) {
        callback(this);
        for (const child of this.children) {
            child.traverse(callback);
        }
        return this;
    }
    traverseDescedants(callback) {
        for (const child of this.children) {
            child.traverse(callback);
        }
        return this;
    }
    hasParent(parentToFind) {
        let parent = this.parent;
        while (parent !== null) {
            if (parent === parentToFind) {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }
    traverseParents(callback) {
        const parent = this.parent;
        if (parent !== null) {
            callback(parent);
            parent.traverseParents(callback);
        }
        return this;
    }
    flatten() {
        const nodes = [];
        this.traverse((node) => {
            nodes.push(node);
        });
        return nodes;
    }
}
exports.Node = Node;
