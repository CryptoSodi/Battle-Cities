"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRenderer = void 0;
const render_1 = require("./render");
const DEFAULT_OPTIONS = {
    debug: false,
    height: 640,
    width: 640,
    renderer: 'auto',
    renderScale: 1,
};
const WORLD_VIEWPORT_PADDING = 192;
class GameRenderer {
    constructor(options = {}) {
        // Per-frame working collections, reused across frames so a full-frame redraw
        // does not allocate (GC pauses read as frame drops).
        this.frameObjects = [];
        this.worldObjects = new Set();
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.canvas = document.createElement('canvas');
        this.canvas.width = options.width;
        this.canvas.height = options.height;
        // Prefer the WebGL2 renderer (HD-clean NEAREST sampling, the base for
        // additive glow + lighting). 'canvas' forces the 2D path; 'auto' tries
        // WebGL and falls back if it's unavailable (getContext returns null before
        // binding, so the 2D path stays valid).
        this.context = this.createContext(this.options.renderer);
    }
    createContext(kind) {
        if (kind !== 'canvas') {
            try {
                const webgl = new render_1.WebglRenderContext(this.canvas, this.options.renderScale);
                webgl.init();
                return webgl;
            }
            catch (error) {
                // eslint-disable-next-line no-console
                console.warn('WebGL renderer unavailable; using Canvas2D.', error);
            }
        }
        const canvas2d = new render_1.CanvasRenderContext(this.canvas);
        canvas2d.init();
        return canvas2d;
    }
    getDomElement() {
        return this.canvas;
    }
    resizeBackingStore(width, height) {
        this.context.resizeBackingStore(width, height);
    }
    render(root, alpha = 0) {
        // Render interpolation: temporarily move objects to their interpolated
        // position between fixed sim steps (alpha = fraction toward the next step),
        // so motion is smooth even when the display refresh rate differs from the
        // sim rate. Positions are restored after drawing, so the sim is untouched.
        const interpolating = alpha > 0;
        if (interpolating) {
            root.traverse((object) => {
                object.interpApply(alpha);
            });
        }
        // Recompute world matrices for the whole tree. Cheap when little moved
        // thanks to the internal dirty flag.
        root.updateWorldMatrix(false, true);
        // Full-frame redraw: clear everything, then repaint every visible object
        // in z-order, every frame.
        //
        // This intentionally replaces the previous dirty-rectangle renderer, which
        // only repainted changed regions and cleared each mover's *previous*
        // bounding box. That approach breaks here in two ways:
        //   1. A scrolling camera marks the whole field dirty every frame, so the
        //      "only repaint what changed" optimization buys nothing.
        //   2. The fixed-timestep loop can advance more than one sim step per
        //      rendered frame, so a fast mover (bullet, tank) moves twice while
        //      RenderObject.dirtyPaintBox() only remembers the latest previous box
        //      — leaving the earliest position uncleared as a visible trail.
        // Repainting the whole frame is robust and, at this game's object counts,
        // cheap. A later batched WebGL renderer keeps this same full-frame model.
        this.context.clear();
        const objects = this.frameObjects;
        objects.length = 0;
        // Objects within a camera-zoomed subtree (the field). Tracked during the
        // pre-order traversal: a node is "world" if it is the zoom root or its
        // parent already is. They get the view transform; everything else (HUD,
        // menus) renders at scale 1.
        const worldObjects = this.worldObjects;
        worldObjects.clear();
        let viewScale = 1;
        let viewOffsetX = 0;
        let viewOffsetY = 0;
        const viewportWidth = this.options.width || DEFAULT_OPTIONS.width;
        const viewportHeight = this.options.height || DEFAULT_OPTIONS.height;
        let viewportMinX = -WORLD_VIEWPORT_PADDING;
        let viewportMinY = -WORLD_VIEWPORT_PADDING;
        let viewportMaxX = viewportWidth + WORLD_VIEWPORT_PADDING;
        let viewportMaxY = viewportHeight + WORLD_VIEWPORT_PADDING;
        root.traverse((object) => {
            // The root is the scene container itself; it has nothing to paint.
            if (object === root) {
                return;
            }
            const parentIsWorld = object.parent !== null && worldObjects.has(object.parent);
            const isCameraRoot = object.cameraZoom !== 1 || object.cameraCullZoom !== null;
            if (isCameraRoot || parentIsWorld) {
                worldObjects.add(object);
                if (isCameraRoot) {
                    viewScale = object.cameraZoom;
                    // screen = world * scale + offset, pivoting around the play center.
                    viewOffsetX = object.cameraPivotX * (1 - object.cameraZoom);
                    viewOffsetY = object.cameraPivotY * (1 - object.cameraZoom);
                    const cullScale = object.cameraCullZoom ?? object.cameraZoom;
                    const cullPivotX = object.cameraCullZoom === null
                        ? object.cameraPivotX
                        : object.cameraCullPivotX;
                    const cullPivotY = object.cameraCullZoom === null
                        ? object.cameraPivotY
                        : object.cameraCullPivotY;
                    const cullOffsetX = cullPivotX * (1 - cullScale);
                    const cullOffsetY = cullPivotY * (1 - cullScale);
                    const invScale = 1 / cullScale;
                    viewportMinX = -cullOffsetX * invScale - WORLD_VIEWPORT_PADDING;
                    viewportMinY = -cullOffsetY * invScale - WORLD_VIEWPORT_PADDING;
                    viewportMaxX =
                        (viewportWidth - cullOffsetX) * invScale + WORLD_VIEWPORT_PADDING;
                    viewportMaxY =
                        (viewportHeight - cullOffsetY) * invScale + WORLD_VIEWPORT_PADDING;
                }
            }
            if (object.isRemoved) {
                return;
            }
            if (!object.canRender()) {
                return;
            }
            if (worldObjects.has(object) &&
                !this.intersectsWorldViewport(object.getWorldBoundingBox(), viewportMinX, viewportMinY, viewportMaxX, viewportMaxY)) {
                return;
            }
            objects.push(object);
        });
        // Paint low z-index first so higher layers (tanks, effects, UI) sit on top.
        objects.sort((a, b) => {
            return a.getWorldZIndex() - b.getWorldZIndex();
        });
        objects.forEach((object) => {
            if (worldObjects.has(object)) {
                this.context.setView(viewScale, viewOffsetX, viewOffsetY);
                this.context.setWorldCullBounds(viewportMinX, viewportMinY, viewportMaxX, viewportMaxY);
            }
            else {
                this.context.setView(1, 0, 0);
                this.context.clearWorldCullBounds();
            }
            this.renderObject(object);
        });
        this.context.setView(1, 0, 0);
        this.context.clearWorldCullBounds();
        // Submit whatever the batching backend is still holding for this frame.
        this.context.flush();
        // Undo the interpolation so the next sim step reads real positions.
        if (interpolating) {
            root.traverse((object) => {
                object.interpRestore();
            });
            root.updateWorldMatrix(false, true);
        }
    }
    renderObject(renderObject) {
        if (this.options.debug) {
            this.renderDebugBox(renderObject.getWorldBoundingBox());
        }
        renderObject.painter.paint(this.context, renderObject);
        renderObject.resetNeedsPaint();
    }
    renderDebugBox(box, color = '#fff') {
        this.context.strokeRect(box.min.x, box.min.y, box.max.x - box.min.x, box.max.y - box.min.y, color);
    }
    intersectsWorldViewport(box, minX, minY, maxX, maxY) {
        return (box.min.x < maxX &&
            box.max.x > minX &&
            box.min.y < maxY &&
            box.max.y > minY);
    }
}
exports.GameRenderer = GameRenderer;
