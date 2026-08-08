"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneRouter = void 0;
const Subject_1 = require("../Subject");
class SceneRouter {
    constructor() {
        this.transitionStarted = new Subject_1.Subject();
        this.routes = new Map();
        this.scene = null;
        this.stack = [];
    }
    register(type, Scene) {
        this.routes.set(type, Scene);
    }
    start(type, params) {
        this.assertRegistered(type);
        this.push(type, params);
    }
    getCurrentScene() {
        return this.scene;
    }
    getCurrentType() {
        return this.location?.type ?? null;
    }
    push(type, params) {
        this.assertRegistered(type);
        const location = this.transition(type, params);
        this.stack.push(location);
    }
    replace(type, params) {
        this.assertRegistered(type);
        this.stack.pop();
        const location = this.transition(type, params);
        this.stack.push(location);
    }
    back() {
        // Can't back if only one scene left in stack
        if (this.stack.length === 1) {
            return;
        }
        this.stack.pop();
        const lastLocation = this.stack[this.stack.length - 1];
        this.transition(lastLocation.type, lastLocation.params);
    }
    clearAndPush(type, params) {
        this.assertRegistered(type);
        this.stack = [];
        this.push(type, params);
    }
    transition(type, params = {}) {
        this.assertRegistered(type);
        this.transitionStarted.notify(null);
        const NextSceneClass = this.routes.get(type);
        const nextScene = new NextSceneClass(this, params);
        this.scene = nextScene;
        const nextLocation = {
            type,
            params,
        };
        this.location = nextLocation;
        return this.location;
    }
    assertRegistered(type) {
        if (!this.routes.has(type)) {
            throw new Error(`Scene "${type}" not registered`);
        }
    }
}
exports.SceneRouter = SceneRouter;
