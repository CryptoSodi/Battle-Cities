import {
  GameObject,
  RectPainter,
  SpriteAlignment,
  SpritePainter,
  Vector,
} from '../../core';
import { Painter } from '../../core/Painter';
import { RenderContext } from '../../core/render';
import { GameUpdateArgs } from '../../game';
import { MenuInputContext } from '../../input';
import * as config from '../../config';

import { GameScene } from '../GameScene';
import {
  UI_FONT_FAMILY,
  UI_TEXT_LETTER_SPACING,
  UI_TEXT_STROKE_COLOR,
  UI_TEXT_STROKE_WIDTH,
} from '../../core/text/UiTypography';

// Shared UI kit for the economy/meta screens (ranking, staking, events,
// trading, boost, treasury, airdrop, wiki). Mirrors MainShopScene's visual
// language — same palette, same native-font text, same panel/button styling,
// same pointer + arrow-key navigation — so every screen feels like the shop.
// The shop keeps its own private copies on purpose: it is complete and
// shouldn't be destabilized by kit changes.

export const UI = {
  PAGE: '#05080a',
  PANEL: '#0b1014',
  PANEL_ALT: '#12181d',
  PANEL_RAISED: '#182026',
  PANEL_LINE: '#35414a',
  PANEL_HIGHLIGHT: '#65717a',
  SIDE: '#0b1014',
  CARD: '#0b1013',
  CARD_FOCUS: '#18242b',
  YELLOW: '#f2ad0d',
  YELLOW_LIGHT: '#ffd75a',
  YELLOW_DARK: '#8f6506',
  MUTED: '#8f989f',
  MUTED_LIGHT: '#c0c7cc',
  WHITE: config.COLOR_WHITE,
  BLACK: config.COLOR_BLACK,
  RED: '#982d26',
  RED_DARK: '#5b1b18',
  RED_BORDER: '#d34c3e',
  GREEN: '#35cf06',
  FONT: UI_FONT_FAMILY,
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
      UI_TEXT_STROKE_COLOR,
      UI_TEXT_STROKE_WIDTH,
      UI_TEXT_LETTER_SPACING,
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
    const width =
      maxWidth ?? Math.max(24, Math.ceil(text.length * fontSize * 0.62));
    super(width, Math.ceil(fontSize * 1.35));
    this.painter = new UiTextPainter(
      text,
      color,
      fontSize,
      fontWeight,
      width,
      align,
    );
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

  constructor(
    width: number,
    height: number,
    fill = UI.PANEL,
    stroke: string = null,
  ) {
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
  private highlight: UiPanel;
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

    this.background = new RectPainter(UI.PANEL_ALT, UI.PANEL_LINE);
    this.background.lineWidth = 2;
    this.painter = this.background;

    this.highlight = new UiPanel(width - 8, 2, UI.PANEL_LINE, null);
    this.highlight.position.set(4, 4);
    this.add(this.highlight);

    this.label = new UiText(
      text,
      UI.WHITE,
      fontSize,
      '800',
      width - 4,
      'center',
    );
    const lineHeight = Math.ceil(fontSize * 1.18);
    this.label.position.set(2, Math.floor((height - lineHeight) / 2) + 3);
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
    if (this.active) {
      this.background.fillColor = UI.YELLOW;
      this.background.strokeColor = UI.YELLOW_LIGHT;
      this.highlight.painter.fillColor = UI.YELLOW_LIGHT;
      this.label.setColor(UI.WHITE);
    } else if (this.focused && this.variant === 'back') {
      this.background.fillColor = UI.RED;
      this.background.strokeColor = UI.RED_BORDER;
      this.highlight.painter.fillColor = UI.RED_BORDER;
      this.label.setColor(UI.WHITE);
    } else if (this.focused) {
      this.background.fillColor = UI.PANEL_RAISED;
      this.background.strokeColor = UI.YELLOW;
      this.highlight.painter.fillColor = UI.PANEL_HIGHLIGHT;
      this.label.setColor(UI.WHITE);
    } else {
      this.background.fillColor = UI.PANEL_ALT;
      this.background.strokeColor = UI.PANEL_LINE;
      this.highlight.painter.fillColor = UI.PANEL_LINE;
      this.label.setColor(UI.YELLOW);
    }

    this.background.lineWidth = this.focused ? 3 : 2;
    this.setNeedsPaint();
  }
}

interface UiAction {
  key: string;
  target: UiButton;
  onSelect: () => void;
  // Tab-style buttons activate as focus slides onto them horizontally, the
  // way the shop's market/view/category tabs do.
  autoActivate: boolean;
}

// Buttons whose vertical centers are within this many pixels of a row's
// first button belong to the same navigation row.
const NAV_ROW_TOLERANCE = 24;

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

  protected getContentWidth(): number {
    return UI.WIDTH;
  }

  protected getPageTop(): number {
    return 96;
  }

  protected getInitialFocusKey(): string {
    return null;
  }

  protected getBackButtonY(): number {
    return this.pageY - 56;
  }

  protected getBackButtonWidth(): number {
    return 120;
  }

  protected getBackButtonRightInset(): number {
    return 22;
  }

  // Optional sprite drawn left of the page title (see data/graphics/ui/).
  protected getTitleIcon(): string {
    return null;
  }

  protected setup(): void {
    this.pageY = this.getPageTop();
    this.pageX = Math.max(
      24,
      Math.round((this.root.size.width - this.getContentWidth()) / 2),
    );
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
      preferredFocusKey ??
      this.actions[this.focusedActionIndex]?.key ??
      this.getInitialFocusKey();
    const contentWidth = this.getContentWidth();

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

    let titleX = this.pageX + 16;
    const titleIconId = this.getTitleIcon();
    if (titleIconId !== null) {
      this.addIcon(titleIconId, titleX, this.pageY - 72, 56);
      titleX += 76;
    }

    const title = new UiText(this.getTitle(), UI.YELLOW, 54, '900', 620);
    title.position.set(titleX, this.pageY - 70);
    this.root.add(title);

    const backButtonWidth = this.getBackButtonWidth();
    this.addButton(
      this.pageX +
        contentWidth -
        backButtonWidth -
        this.getBackButtonRightInset(),
      this.getBackButtonY(),
      backButtonWidth,
      44,
      '←  BACK',
      'back',
      () => {
        this.navigator.back();
      },
      false,
      'back',
    );

    this.renderContent();

    if (this.statusText !== '') {
      this.statusLine = new UiText(
        this.statusText,
        UI.YELLOW,
        24,
        '800',
        contentWidth - 32,
      );
      this.statusLine.position.set(this.pageX + 16, this.root.size.height - 56);
      this.root.add(this.statusLine);
    }

    const index = this.actions.findIndex(
      (action) => action.key === previousKey,
    );
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
    const uiText = new UiText(
      text,
      color,
      fontSize,
      fontWeight,
      maxWidth,
      align,
    );
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
    autoActivate = false,
  ): UiButton {
    const button = new UiButton(width, height, text, variant, fontSize);
    button.position.set(x, y);
    button.setActive(active);
    this.root.add(button);
    this.actions.push({ key, target: button, onSelect, autoActivate });
    return button;
  }

  protected addIcon(spriteId: string, x: number, y: number, size = 34): UiIcon {
    const icon = new UiIcon(spriteId, size);
    icon.position.set(x, y);
    this.root.add(icon);
    return icon;
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
    columns: {
      label: string;
      offset: number;
      align?: CanvasTextAlign;
      width?: number;
    }[],
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

  // Same movement model as the shop: buttons form ROWS (derived from their
  // on-screen vertical position). Left/right steps through the current row
  // and stops at its ends — and slides ACTIVATE tab-style buttons, exactly
  // like the shop's market/view/category tabs. Up/down jumps to the adjacent
  // row and lands on the button whose column is closest to the current one.
  private focusDirection(dx: number, dy: number): void {
    const currentAction = this.actions[this.focusedActionIndex];
    if (currentAction === undefined) {
      return;
    }

    const rows = this.buildNavRows();
    const rowIndex = rows.findIndex((row) => row.includes(currentAction));
    if (rowIndex === -1) {
      return;
    }

    if (dx !== 0) {
      const row = rows[rowIndex];
      const nextAction = row[row.indexOf(currentAction) + dx];
      if (nextAction === undefined) {
        return; // row ends don't wrap, like the shop
      }

      const nextIndex = this.actions.indexOf(nextAction);
      this.setFocusedAction(nextIndex);
      if (nextAction.autoActivate) {
        this.pendingActionIndex = nextIndex;
      }
      return;
    }

    const nextRow = rows[rowIndex + dy];
    if (nextRow === undefined) {
      return;
    }

    const currentCenterX = currentAction.target
      .getWorldBoundingBox()
      .getCenter().x;
    let closest: UiAction = null;
    let closestDistance: number = null;
    nextRow.forEach((action) => {
      const distance = Math.abs(
        action.target.getWorldBoundingBox().getCenter().x - currentCenterX,
      );
      if (closestDistance === null || distance < closestDistance) {
        closestDistance = distance;
        closest = action;
      }
    });

    if (closest !== null) {
      // Vertical moves never auto-activate (matches the shop).
      this.setFocusedAction(this.actions.indexOf(closest));
    }
  }

  // Groups the actions into navigation rows by vertical position: sorted top
  // to bottom, a button joins the current row when its center is within
  // NAV_ROW_TOLERANCE of the row's first button; rows are ordered left to
  // right. Rebuilt on demand so it always matches the latest refresh().
  private buildNavRows(): UiAction[][] {
    const sorted = this.actions
      .slice()
      .sort(
        (a, b) =>
          a.target.getWorldBoundingBox().getCenter().y -
          b.target.getWorldBoundingBox().getCenter().y,
      );

    const rows: UiAction[][] = [];
    let rowStartY: number = null;

    for (const action of sorted) {
      const centerY = action.target.getWorldBoundingBox().getCenter().y;
      if (rowStartY === null || centerY - rowStartY > NAV_ROW_TOLERANCE) {
        rows.push([action]);
        rowStartY = centerY;
      } else {
        rows[rows.length - 1].push(action);
      }
    }

    rows.forEach((row) => {
      row.sort(
        (a, b) =>
          a.target.getWorldBoundingBox().getCenter().x -
          b.target.getWorldBoundingBox().getCenter().x,
      );
    });

    return rows;
  }
}
