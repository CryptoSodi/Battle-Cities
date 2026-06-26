import {
  BoundingBox,
  CollisionSystem,
  GameObject,
  RectPainter,
} from '../../core';
import * as config from '../../config';

import { DebugMenu, DebugMenuOptions } from '../DebugMenu';

export class DebugCollisionMenu extends DebugMenu {
  private collisionSystem: CollisionSystem;
  private itemsContainer: GameObject;
  private items: GameObject[] = [];
  private root: GameObject;
  private getCameraSource: () => GameObject | null;
  private isShown = false;

  constructor(
    collisionSystem: CollisionSystem,
    root: GameObject,
    // Returns the zoomed subtree root (the field) so the debug rects can be
    // drawn with the same camera zoom; otherwise they'd be drawn at unzoomed
    // coordinates and misalign with the zoomed gameplay.
    getCameraSource: () => GameObject | null = (): GameObject | null => null,
    options: DebugMenuOptions = {},
  ) {
    super('Collision', options);

    this.collisionSystem = collisionSystem;
    this.root = root;
    this.getCameraSource = getCameraSource;

    this.itemsContainer = new GameObject();

    this.appendButton('Show', this.handleShow);
    this.appendButton('Hide', this.handleHide);
    this.appendButton('Update', this.handleUpdate);
  }

  public show(): void {
    this.isShown = true;
    this.root.add(this.itemsContainer);
  }

  public hide(): void {
    this.isShown = false;
    this.root.remove(this.itemsContainer);
    this.clear();
  }

  public update(): void {
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

  private clear(): void {
    this.items.forEach((item) => {
      item.removeSelf();
    });
    this.items = [];
  }

  private handleShow = (): void => {
    this.show();
  };

  private handleHide = (): void => {
    this.hide();
  };

  private handleUpdate = (): void => {
    this.update();
  };

  private createItem(box: BoundingBox, color: string): GameObject {
    const rect = box.toRect();
    const item = new GameObject(rect.width, rect.height);
    item.position.set(rect.x, rect.y);
    item.updateMatrix();
    item.setZIndex(config.DEBUG_COLLISION_RECT_Z_INDEX);
    item.painter = new RectPainter(null, color);
    return item;
  }
}
