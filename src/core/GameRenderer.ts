import { CanvasRenderContext, RenderContext, WebglRenderContext } from './render';

import { BoundingBox } from './BoundingBox';
import { RenderObject } from './RenderObject';

export type RendererKind = 'auto' | 'webgl' | 'canvas';

export interface GameRendererOptions {
  debug?: boolean;
  height?: number;
  width?: number;
  renderer?: RendererKind;
  renderScale?: number;
}

const DEFAULT_OPTIONS = {
  debug: false,
  height: 640,
  width: 640,
  renderer: 'auto' as RendererKind,
  renderScale: 1,
};

export class GameRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly options: GameRendererOptions;
  private readonly context: RenderContext;

  constructor(options: GameRendererOptions = {}) {
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

  private createContext(kind: RendererKind): RenderContext {
    if (kind !== 'canvas') {
      try {
        const webgl = new WebglRenderContext(this.canvas, this.options.renderScale);
        webgl.init();
        return webgl;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('WebGL renderer unavailable; using Canvas2D.', error);
      }
    }
    const canvas2d = new CanvasRenderContext(this.canvas);
    canvas2d.init();
    return canvas2d;
  }

  public getDomElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public render(root: RenderObject): void {
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

    const objects: RenderObject[] = [];

    root.traverse((object) => {
      // The root is the scene container itself; it has nothing to paint.
      if (object === root) {
        return;
      }
      if (object.isRemoved) {
        return;
      }
      if (!object.canRender()) {
        return;
      }

      objects.push(object);
    });

    // Paint low z-index first so higher layers (tanks, effects, UI) sit on top.
    objects.sort((a, b) => {
      return a.getWorldZIndex() - b.getWorldZIndex();
    });

    objects.forEach((object) => {
      this.renderObject(object);
    });
  }

  private renderObject(renderObject: RenderObject): void {
    if (this.options.debug) {
      this.renderDebugBox(renderObject.getWorldBoundingBox());
    }

    renderObject.painter.paint(this.context, renderObject);
    renderObject.resetNeedsPaint();
  }

  private renderDebugBox(box: BoundingBox, color = '#fff'): void {
    this.context.strokeRect(
      box.min.x,
      box.min.y,
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      color,
    );
  }
}
