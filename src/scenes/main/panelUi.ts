import { GameObject, RectPainter, SpriteAlignment, SpritePainter, Vector } from '../../core';
import { Painter } from '../../core/Painter';
import { RenderContext } from '../../core/render';
import { GameUpdateArgs } from '../../game';
import { MenuInputContext } from '../../input';
import * as config from '../../config';

import { GameScene } from '../GameScene';

// Shared UI kit for the economy/meta screens (ranking, staking, events,
// trading, boost, treasury, airdrop, wiki). Mirrors MainShopScene's visual
// language — same palette, same native-font text, same panel/button styling,
// same pointer + arrow-key navigation — so every screen feels like the shop.
// The shop keeps its own private copies on purpose: it is complete and
// shouldn't be destabilized by kit changes.

export const UI = {
  PAGE: '#080806',
  PANEL: '#171611',
  PANEL_ALT: '#211f18',
  PANEL_LINE: '#2c2a22',
  SIDE: '#14130f',
  CARD: '#2b2605',
  CARD_FOCUS: '#4a3f0b',
  YELLOW: config.COLOR_YELLOW,
  YELLOW_DARK: '#8a6b00',
  MUTED: config.COLOR_GRAY,
  MUTED_LIGHT: config.COLOR_GRAY_LIGHT,
  WHITE: config.COLOR_WHITE,
  BLACK: config.COLOR_BLACK,
  RED: config.COLOR_RED,
  GREEN: '#3ddc84',
  FONT: 'Inter, Segoe UI, Arial, sans-serif',
  WIDTH: 1240,
};

class UiTextPainter extends Painter {
  public text: string;
  public color: string;
  public fontSize: number;
  public fontWeight: string;
  public maxWidth: number;
  public align: CanvasTextAlign;

  constructor(
    text: string,
    color: string,
    fontSize: number,
    fontWeight: string,
    maxWidth: number,
    align: CanvasTextAlign = 'left',
  ) {
    super();
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.fontWeight = fontWeight;
    this.maxWidth = maxWidth;
    this.align = align;
  }

  public paint(context: RenderContext, renderObject: GameObject): void {
    const { min } = renderObject.getWorldBoundingBox();
    context.drawText(
      this.text,
      min.x,
      min.y,
      this.maxWidth,
      this.fontSize,
      UI.FONT,
      this.fontWeight,
      this.color,
      this.align,
    );
  }
}

export class UiText extends GameObject {
  public painter: UiTextPainter;

  constructor(
    text = '',
    color = UI.WHITE,
    fontSize = 24,
    fontWeight = '700',
    maxWidth: number = null,
    align: CanvasTextAlign = 'left',
  ) {
    const width = maxWidth ?? Math.max(24, Math.ceil(text.length * fontSize * 0.62));
    super(width, Math.ceil(fontSize * 1.35));
    this.painter = new UiTextPainter(text, color, fontSize, fontWeight, width, align);
  }

  public setText(text: string): void {
    this.painter.text = text;
    this.setNeedsPaint();
  }

  public setColor(color: string): void {
    this.painter.color = color;
    this.setNeedsPaint();
  }
}

export class UiPanel extends GameObject {
  public painter: RectPainter;

  constructor(width: number, height: number, fill = UI.PANEL, stroke: string = null) {
    super(width, height);
    this.painter = new RectPainter(fill, stroke);
    this.painter.lineWidth = 2;
  }
}

export class UiIcon extends GameObject {
  public painter: SpritePainter = null;
  private readonly spriteId: string;

  constructor(spriteId: string, size = 42) {
    super(size, size);
    this.spriteId = spriteId;
  }

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    this.painter = new SpritePainter(
      spriteLoader.load(this.spriteId),
      SpriteAlignment.Stretch,
    );
  }
}

export class UiButton extends GameObject {
  private background: RectPainter;
  private label: UiText;
  private active = false;
  private focused = false;
  private readonly variant: 'normal' | 'back';

  constructor(
    width: number,
    height: number,
    text: string,
    variant: 'normal' | 'back' = 'normal',
    fontSize = 26,
  ) {
    super(width, height);
    this.variant = variant;

    this.background = new RectPainter(UI.PANEL_ALT, UI.YELLOW_DARK);
    this.background.lineWidth = 2;
    this.painter = this.background;

    this.label = new UiText(text, UI.WHITE, fontSize, '800', width - 4, 'center');
    this.label.position.set(2, Math.max(8, Math.round((height - fontSize) / 2)));
    this.add(this.label);
  }

  public setText(text: string): void {
    this.label.setText(text);
  }

  public setActive(active: boolean): void {
    this.active = active;
    this.refreshStyle();
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.refreshStyle();
  }

  // Focus reads like the shop's focused CARDS, not just a border: the fill
  // brightens to the warm card-focus tone and the label goes yellow, so the
  // cursor is obvious at a glance.
  private refreshStyle(): void {
    const focusedBack = this.focused && this.variant === 'back';

    if (this.active) {
      this.background.fillColor = UI.YELLOW;
      this.label.setColor(UI.BLACK);
    } else if (focusedBack) {
      this.background.fillColor = UI.RED;
      this.label.setColor(UI.WHITE);
    } else if (this.focused) {
      this.background.fillColor = UI.CARD_FOCUS;
      this.label.setColor(UI.YELLOW);
    } else {
      this.background.fillColor = UI.PANEL_ALT;
      this.label.setColor(UI.WHITE);
    }

    this.background.strokeColor = this.focused
      ? focusedBack
        ? UI.RED
        : UI.WHITE
      : UI.YELLOW_DARK;
    this.background.lineWidth = this.focused ? 4 : 2;
    this.setNeedsPaint();
  }
}

interface UiAction {
  key: string;
  target: UiButton;
  onSelect: () => void;
}

// Base for panel-style pages: dark full-screen background, big yellow title,
// BACK button, focusable buttons with pointer + arrow-key navigation, and a
// clear-and-rebuild render model (renderContent runs again on every refresh,
// e.g. when async data lands).
export abstract class PanelScene extends GameScene {
  protected pageX = 0;
  protected pageY = 96;
  protected statusText = '';
  private actions: UiAction[] = [];
  private focusedActionIndex = 0;
  private pendingActionIndex: number = null;
  private statusLine: UiText = null;

  protected abstract getTitle(): string;
  protected abstract renderContent(): void;
  // First data load; called once from setup. Static pages just call refresh().
  protected abstract load(): void;

  protected setup(): void {
    this.pageX = Math.max(24, Math.round((this.root.size.width - UI.WIDTH) / 2));
    this.load();
    this.refresh();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager, pointerClick } = updateArgs;
    const inputMethod = inputManager.getActiveMethod();

    if (pointerClick !== null && this.handlePointer(pointerClick)) {
      updateArgs.pointerClick = null;
    } else if (inputMethod.isDownAny(MenuInputContext.HorizontalPrev)) {
      this.focusDirection(-1, 0);
    } else if (inputMethod.isDownAny(MenuInputContext.HorizontalNext)) {
      this.focusDirection(1, 0);
    } else if (inputMethod.isDownAny(MenuInputContext.VerticalPrev)) {
      this.focusDirection(0, -1);
    } else if (inputMethod.isDownAny(MenuInputContext.VerticalNext)) {
      this.focusDirection(0, 1);
    } else if (inputMethod.isDownAny(MenuInputContext.Select)) {
      this.pendingActionIndex = this.focusedActionIndex;
    }

    this.activatePendingAction();

    super.update(updateArgs);
  }

  // Clears and redraws the whole page, keeping focus on the same action key
  // when it still exists after the rebuild.
  protected refresh(preferredFocusKey: string = null): void {
    const previousKey =
      preferredFocusKey ?? this.actions[this.focusedActionIndex]?.key ?? null;

    this.root.removeAllChildren();
    this.actions = [];
    this.statusLine = null;

    const background = new UiPanel(
      this.root.size.width,
      this.root.size.height,
      UI.PAGE,
    );
    background.setZIndex(-10);
    this.root.add(background);

    const title = new UiText(this.getTitle(), UI.YELLOW, 54, '900', 620);
    title.position.set(this.pageX + 16, this.pageY - 70);
    this.root.add(title);

    this.addButton(this.pageX + UI.WIDTH - 142, this.pageY - 56, 120, 44, 'BACK', 'back', () => {
      this.navigator.back();
    }, false, 'back');

    this.renderContent();

    if (this.statusText !== '') {
      this.statusLine = new UiText(this.statusText, UI.YELLOW, 24, '800', UI.WIDTH - 32);
      this.statusLine.position.set(this.pageX + 16, this.root.size.height - 56);
      this.root.add(this.statusLine);
    }

    const index = this.actions.findIndex((action) => action.key === previousKey);
    this.setFocusedAction(index === -1 ? 0 : index);
  }

  protected setStatus(text: string): void {
    this.statusText = text;
    if (this.statusLine !== null) {
      this.statusLine.setText(text);
      return;
    }
    this.refresh();
  }

  // ---------- building blocks ----------

  protected addPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    fill = UI.PANEL,
    stroke: string = UI.PANEL_LINE,
  ): UiPanel {
    const panel = new UiPanel(width, height, fill, stroke);
    panel.position.set(x, y);
    this.root.add(panel);
    return panel;
  }

  protected addText(
    text: string,
    x: number,
    y: number,
    color = UI.WHITE,
    fontSize = 24,
    fontWeight = '700',
    maxWidth: number = null,
    align: CanvasTextAlign = 'left',
  ): UiText {
    const uiText = new UiText(text, color, fontSize, fontWeight, maxWidth, align);
    uiText.position.set(x, y);
    this.root.add(uiText);
    return uiText;
  }

  protected addButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    key: string,
    onSelect: () => void,
    active = false,
    variant: 'normal' | 'back' = 'normal',
    fontSize = 26,
  ): UiButton {
    const button = new UiButton(width, height, text, variant, fontSize);
    button.position.set(x, y);
    button.setActive(active);
    this.root.add(button);
    this.actions.push({ key, target: button, onSelect });
    return button;
  }

  // Mattle-style stat box: muted label top-left, big value bottom-right.
  protected addStatCard(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    valueColor = UI.WHITE,
    iconId: string = null,
  ): void {
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    this.addText(label, x + 18, y + 14, UI.MUTED, 20, '800', width - 36);

    const iconSpace = iconId !== null ? 46 : 0;
    this.addText(
      value,
      x + 16,
      y + height - 46,
      valueColor,
      30,
      '900',
      width - 32 - iconSpace,
      'right',
    );

    if (iconId !== null) {
      const icon = new UiIcon(iconId, 34);
      icon.position.set(x + width - 46, y + height - 48);
      this.root.add(icon);
    }
  }

  // Table header bar (RANK / PLAYER / POINTS ... columns give x offsets).
  protected addTableHeader(
    x: number,
    y: number,
    width: number,
    columns: { label: string; offset: number; align?: CanvasTextAlign; width?: number }[],
  ): void {
    this.addPanel(x, y, width, 44, UI.PANEL_ALT, null);
    columns.forEach((column) => {
      this.addText(
        column.label,
        x + column.offset,
        y + 10,
        UI.MUTED,
        20,
        '800',
        column.width ?? 220,
        column.align ?? 'left',
      );
    });
  }

  // ---------- navigation (same model as the shop) ----------

  private handlePointer(point: Vector): boolean {
    const actionIndex = this.actions.findIndex((action) =>
      action.target.getWorldBoundingBox().containsPoint(point),
    );

    if (actionIndex === -1) {
      return false;
    }

    this.setFocusedAction(actionIndex);
    this.pendingActionIndex = actionIndex;
    return true;
  }

  private activatePendingAction(): void {
    if (this.pendingActionIndex === null) {
      return;
    }

    const action = this.actions[this.pendingActionIndex];
    this.pendingActionIndex = null;

    if (action !== undefined) {
      action.onSelect();
    }
  }

  private setFocusedAction(index: number): void {
    this.actions.forEach((action, actionIndex) => {
      action.target.setFocused(actionIndex === index);
    });
    this.focusedActionIndex = Math.max(0, index);
  }

  // Spatial navigation: move focus to the nearest button in the pressed
  // direction (the shop's generic fallback strategy).
  private focusDirection(dx: number, dy: number): void {
    const currentAction = this.actions[this.focusedActionIndex];
    if (currentAction === undefined) {
      return;
    }

    const currentCenter = currentAction.target.getWorldBoundingBox().getCenter();
    let bestIndex = -1;
    let bestScore: number = null;

    this.actions.forEach((action, index) => {
      if (index === this.focusedActionIndex) {
        return;
      }

      const center = action.target.getWorldBoundingBox().getCenter();
      const deltaX = center.x - currentCenter.x;
      const deltaY = center.y - currentCenter.y;

      if ((dx < 0 && deltaX >= 0) || (dx > 0 && deltaX <= 0)) {
        return;
      }
      if ((dy < 0 && deltaY >= 0) || (dy > 0 && deltaY <= 0)) {
        return;
      }

      const primary = dx !== 0 ? Math.abs(deltaX) : Math.abs(deltaY);
      const secondary = dx !== 0 ? Math.abs(deltaY) : Math.abs(deltaX);
      const score = primary * 4 + secondary;

      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex !== -1) {
      this.setFocusedAction(bestIndex);
    }
  }
}
