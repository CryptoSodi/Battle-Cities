import {
  BoxCollider,
  Collision,
  GameObject,
  RectPainter,
  Subject,
  Timer,
  Vector,
} from '../../core';
import { GameUpdateArgs, Tag } from '../../game';
import {
  EditorMapInputContext,
  InputHoldThrottle,
  InputHoldThrottleOptions,
} from '../../input';
import * as config from '../../config';

import { EditorBaseBrush } from './EditorBaseBrush';

const BLINK_DELAY = 0.2;

const HOLD_THROTTLE_OPTIONS: InputHoldThrottleOptions = {
  activationDelay: 0.12,
  delay: 0.024,
};

export class EditorTool extends GameObject {
  public collider = new BoxCollider(this, true);
  public painter = new RectPainter(null, config.COLOR_RED);
  public zIndex = config.EDITOR_TOOL_Z_INDEX;
  public draw = new Subject();
  public erase = new Subject();
  public brushChanged = new Subject<GameObject>();
  private cursorOverlay: GameObject;
  private brushes: GameObject[] = [];
  private selectedBrush: GameObject = null;
  private velocity = new Vector(0, 0);
  private holdThrottles: InputHoldThrottle[] = [];
  private blinkTimer = new Timer();
  private isBlinkVisible = true;

  constructor() {
    super();

    this.holdThrottles = [
      new InputHoldThrottle(
        EditorMapInputContext.MoveUp,
        this.moveUp,
        HOLD_THROTTLE_OPTIONS,
      ),
      new InputHoldThrottle(
        EditorMapInputContext.MoveDown,
        this.moveDown,
        HOLD_THROTTLE_OPTIONS,
      ),
      new InputHoldThrottle(
        EditorMapInputContext.MoveLeft,
        this.moveLeft,
        HOLD_THROTTLE_OPTIONS,
      ),
      new InputHoldThrottle(
        EditorMapInputContext.MoveRight,
        this.moveRight,
        HOLD_THROTTLE_OPTIONS,
      ),
    ];
  }

  public setBrushes(brushes: GameObject[]): void {
    this.brushes = brushes;
    this.selectBrush(0);
  }

  public selectBrushIndex(index: number): void {
    this.selectBrush(index);
  }

  public getSelectedBrush(): GameObject {
    return this.selectedBrush;
  }

  public getSelectedBrushIndex(): number {
    return this.brushes.indexOf(this.selectedBrush);
  }

  protected setup({ collisionSystem }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);

    this.cursorOverlay = new GameObject(this.size.width, this.size.height);
    this.cursorOverlay.painter = new RectPainter(
      'rgba(255, 255, 255, 0.12)',
      config.COLOR_YELLOW,
    );
    (this.cursorOverlay.painter as RectPainter).lineWidth = 2;
    this.cursorOverlay.setZIndex(config.EDITOR_BRUSH_Z_INDEX + 10);
    this.add(this.cursorOverlay);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    this.dirtyPaintBox();

    this.updatePosition(updateArgs);
    this.updateBlinking(updateArgs);

    const { inputManager } = updateArgs;

    const inputMethod = inputManager.getActiveMethod();

    if (inputMethod.isDownAny(EditorMapInputContext.Draw)) {
      this.draw.notify(null);
    }
    if (inputMethod.isDownAny(EditorMapInputContext.Erase)) {
      this.erase.notify(null);
    }
    if (inputMethod.isDownAny(EditorMapInputContext.NextBrush)) {
      this.selectNextBrush();
    }
    if (inputMethod.isDownAny(EditorMapInputContext.PrevBrush)) {
      this.selectPrevBrush();
    }

    this.collider.update();
  }

  protected collide(collision: Collision): void {
    const blockMoveContacts = collision.contacts.filter((contact) => {
      return contact.collider.object.tags.includes(Tag.EditorBlockMove);
    });

    if (blockMoveContacts.length > 0) {
      this.position.sub(this.velocity);
      this.updateMatrix(true);
    }
  }

  private updatePosition(updateArgs: GameUpdateArgs): void {
    const { deltaTime, inputManager } = updateArgs;

    const inputMethod = inputManager.getActiveMethod();

    this.velocity.set(0, 0);

    if (inputMethod.isDownAny(EditorMapInputContext.MoveUp)) {
      this.moveUp();
    } else if (inputMethod.isDownAny(EditorMapInputContext.MoveDown)) {
      this.moveDown();
    } else if (inputMethod.isDownAny(EditorMapInputContext.MoveLeft)) {
      this.moveLeft();
    } else if (inputMethod.isDownAny(EditorMapInputContext.MoveRight)) {
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

  private moveUp = (): void => {
    this.velocity.set(0, -this.getSnapStepY());
  };

  private moveDown = (): void => {
    this.velocity.set(0, this.getSnapStepY());
  };

  private moveLeft = (): void => {
    this.velocity.set(-this.getSnapStepX(), 0);
  };

  private moveRight = (): void => {
    this.velocity.set(this.getSnapStepX(), 0);
  };

  private updateBlinking({ deltaTime }: GameUpdateArgs): void {
    if (this.blinkTimer.isDone()) {
      this.isBlinkVisible = !this.isBlinkVisible;
      this.blinkTimer.reset(BLINK_DELAY);
    } else {
      this.blinkTimer.update(deltaTime);
    }

    if (this.selectedBrush !== null) {
      this.selectedBrush.setVisible(this.isBlinkVisible);
    }

    if (this.cursorOverlay !== undefined) {
      this.cursorOverlay.setVisible(this.isBlinkVisible);
    }
  }

  private selectNextBrush(): void {
    const selectedBrushIndex = this.brushes.indexOf(this.selectedBrush);

    let nextBrushIndex = selectedBrushIndex + 1;
    if (nextBrushIndex > this.brushes.length - 1) {
      nextBrushIndex = 0;
    }

    this.selectBrush(nextBrushIndex);
  }

  private selectPrevBrush(): void {
    const selectedBrushIndex = this.brushes.indexOf(this.selectedBrush);

    let prevBrushIndex = selectedBrushIndex - 1;
    if (prevBrushIndex < 0) {
      prevBrushIndex = this.brushes.length - 1;
    }

    this.selectBrush(prevBrushIndex);
  }

  private selectBrush(index: number): void {
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
    this.painter = new RectPainter(null, config.COLOR_RED);

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

  public getSnapStepX(): number {
    if (this.selectedBrush instanceof EditorBaseBrush) {
      return config.TILE_SIZE_MEDIUM;
    }

    return this.size.width;
  }

  public getSnapStepY(): number {
    if (this.selectedBrush instanceof EditorBaseBrush) {
      return config.TILE_SIZE_MEDIUM;
    }

    return this.size.height;
  }
}
