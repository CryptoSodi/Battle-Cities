"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collision = void 0;
class Collision {
    constructor(collider, box) {
        this.contacts = [];
        this.collider = collider;
        this.box = box;
    }
    addContact(contact) {
        this.contacts.push(contact);
    }
}
exports.Collision = Collision;
