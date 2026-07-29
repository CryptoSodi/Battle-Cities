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
  GREEN_PANEL: '#0d2412',
  PRICE: '#174d11',
  PRICE_BORDER: '#4d982f',
  PRICE_TEXT: '#f3e6a6',
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
      SpriteAlignment.AspectFit,
    );
  }
}

export class UiButton extends GameObject {
  private background: RectPainter;
  private highlight: UiPanel;
  private label: UiText;
  private active = false;
  private focused = false;
  private readonly variant: 'normal' | 'back' | 'purchase';

  constructor(
    width: number,
    height: number,
    text: string,
    variant: 'normal' | 'back' | 'purchase' = 'normal',
    fontSize = 26,
    fontWeight = '800',
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
      fontWeight,
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
    if (this.active || (this.focused && this.variant === 'purchase')) {
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
    } else if (this.variant === 'purchase') {
      this.background.fillColor = UI.PRICE;
      this.background.strokeColor = UI.PRICE_BORDER;
      this.highlight.painter.fillColor = UI.PRICE_BORDER;
      this.label.setColor(UI.PRICE_TEXT);
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

export class UiToggleButton extends GameObject {
  private background: RectPainter;
  private highlight: UiPanel;
  private label: UiText;
  private indicator: UiPanel;
  private enabled: boolean;
  private focused = false;

  constructor(width: number, height: number, enabled: boolean) {
    super(width, height);
    this.enabled = enabled;

    this.background = new RectPainter(UI.PANEL_ALT, UI.PANEL_LINE);
    this.background.lineWidth = 2;
    this.painter = this.background;

    this.highlight = new UiPanel(width - 8, 2, UI.PANEL_LINE, null);
    this.highlight.position.set(4, 4);
    this.add(this.highlight);

    const indicatorSize = Math.max(36, height - 24);
    const indicatorX = width - indicatorSize - 12;
    this.indicator = new UiPanel(
      indicatorSize,
      indicatorSize,
      UI.PANEL_RAISED,
      UI.PANEL_LINE,
    );
    this.indicator.position.set(
      indicatorX,
      Math.floor((height - indicatorSize) / 2),
    );
    this.add(this.indicator);

    this.label = new UiText(
      enabled ? 'ON' : 'OFF',
      UI.MUTED_LIGHT,
      30,
      '900',
      indicatorX - 12,
      'center',
    );
    const lineHeight = Math.ceil(30 * 1.18);
    this.label.position.set(4, Math.floor((height - lineHeight) / 2) + 3);
    this.add(this.label);

    this.refreshStyle();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.label.setText(enabled ? 'ON' : 'OFF');
    this.refreshStyle();
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.refreshStyle();
  }

  private refreshStyle(): void {
    this.background.fillColor = UI.PANEL_ALT;
    this.background.strokeColor = this.focused ? UI.YELLOW : UI.PANEL_LINE;
    this.background.lineWidth = this.focused ? 3 : 2;
    this.highlight.painter.fillColor = this.focused ? UI.YELLOW : UI.PANEL_LINE;
    this.label.setColor(
      this.enabled ? UI.YELLOW : this.focused ? UI.WHITE : UI.MUTED,
    );
    this.indicator.painter.fillColor = this.enabled
      ? UI.YELLOW
      : UI.PANEL_RAISED;
    this.indicator.painter.strokeColor = this.enabled
      ? UI.YELLOW_LIGHT
      : UI.PANEL_LINE;
    this.setNeedsPaint();
  }
}

export interface UiActionTarget extends GameObject {
  setFocused(focused: boolean): void;
}

interface UiAction {
  key: string;
  target: UiActionTarget;
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

  protected getBackButtonHeight(): number {
    return 44;
  }

  protected getHeaderActionText(): string {
    return '←  BACK';
  }

  protected getHeaderActionKey(): string {
    return 'back';
  }

  protected getHeaderActionVariant(): 'normal' | 'back' | 'purchase' {
    return 'back';
  }

  protected getHeaderActionFontSize(): number {
    return 26;
  }

  protected getHeaderActionFontWeight(): string {
    return '800';
  }

  protected handleHeaderAction(): void {
    this.navigator.back();
  }

  protected isActionNavigable(_key: string): boolean {
    void _key;
    return true;
  }

  protected getPreferredVerticalNavigationKey(
    _currentKey: string,
    _direction: number,
  ): string {
    void _currentKey;
    void _direction;
    return null;
  }

  protected handleTouchScroll(_direction: number): boolean {
    void _direction;
    return false;
  }

  // Optional sprite drawn left of the page title (see data/graphics/ui/).
  protected getTitleIcon(): string {
    return null;
  }

  protected setup(_updateArgs: GameUpdateArgs): void {
    void _updateArgs;
    this.pageY = this.getPageTop();
    this.pageX = Math.max(
      24,
      Math.round((this.root.size.width - this.getContentWidth()) / 2),
    );
    this.load();
    this.refresh();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager, pointerClick, pointerSwipe } = updateArgs;
    const inputMethod = inputManager.getActiveMethod();

    if (
      pointerSwipe !== null &&
      config.isMobileTouchViewport() &&
      this.handleTouchScroll(pointerSwipe)
    ) {
      updateArgs.pointerSwipe = null;
    } else if (pointerClick !== null && this.handlePointer(pointerClick)) {
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
      this.getBackButtonHeight(),
      this.getHeaderActionText(),
      this.getHeaderActionKey(),
      () => this.handleHeaderAction(),
      false,
      this.getHeaderActionVariant(),
      this.getHeaderActionFontSize(),
      false,
      this.getHeaderActionFontWeight(),
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
    variant: 'normal' | 'back' | 'purchase' = 'normal',
    fontSize = 26,
    autoActivate = false,
    fontWeight = '800',
  ): UiButton {
    const button = new UiButton(
      width,
      height,
      text,
      variant,
      fontSize,
      fontWeight,
    );
    button.position.set(x, y);
    button.setActive(active);
    this.root.add(button);
    this.actions.push({ key, target: button, onSelect, autoActivate });
    return button;
  }

  protected addActionTarget(
    key: string,
    target: UiActionTarget,
    onSelect: () => void,
    autoActivate = false,
  ): void {
    this.actions.push({ key, target, onSelect, autoActivate });
  }

  protected addToggle(
    x: number,
    y: number,
    width: number,
    height: number,
    enabled: boolean,
    key: string,
    onSelect: () => void,
  ): UiToggleButton {
    const toggle = new UiToggleButton(width, height, enabled);
    toggle.position.set(x, y);
    this.root.add(toggle);
    this.actions.push({
      key,
      target: toggle,
      onSelect,
      autoActivate: false,
    });
    return toggle;
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

    if (dy !== 0) {
      const preferredKey = this.getPreferredVerticalNavigationKey(
        currentAction.key,
        dy,
      );
      if (preferredKey !== null) {
        const preferredIndex = this.actions.findIndex(
          (action) =>
            action.key === preferredKey && this.isActionNavigable(action.key),
        );
        if (preferredIndex !== -1) {
          this.setFocusedAction(preferredIndex);
          return;
        }
      }
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
      .filter((action) => this.isActionNavigable(action.key))
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

const HEADQUARTERS_MOBILE_WIDTH = 744;

export interface HeadquartersLayout {
  mobile: boolean;
  x: number;
  y: number;
  width: number;
  inset: number;
  bodyX: number;
  bodyY: number;
  bodyWidth: number;
}

// Shared chrome for every destination opened from Headquarters. Keeping this
// here makes the mobile canvas width, header, frame, and Back geometry match
// the Shop and Headquarters screens without duplicating those rules per page.
export abstract class HeadquartersPanelScene extends PanelScene {
  protected abstract getSectionTitle(): string;
  protected abstract getSectionIcon(): string | null;

  protected getSectionIconText(): string {
    return '';
  }

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return this.isMobileLayout() ? HEADQUARTERS_MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return this.isMobileLayout() ? this.scaleSize(76) : 96;
  }

  protected getBackButtonY(): number {
    return this.isMobileLayout() ? this.scaleSize(8) : 44;
  }

  protected getBackButtonWidth(): number {
    return this.isMobileLayout() ? this.scaleSize(152) : 140;
  }

  protected getBackButtonRightInset(): number {
    return this.isMobileLayout() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return this.isMobileLayout() ? this.scaleSize(60) : 48;
  }

  protected isMobileLayout(): boolean {
    return config.isMobileTouchViewport();
  }

  protected scaleSize(value: number): number {
    return this.isMobileLayout()
      ? Math.round((value * this.getContentWidth()) / HEADQUARTERS_MOBILE_WIDTH)
      : value;
  }

  protected renderHeadquartersFrame(minimumHeight = 680): HeadquartersLayout {
    const mobile = this.isMobileLayout();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();
    const inset = mobile ? this.scaleSize(18) : 24;
    const headerY = mobile ? this.scaleSize(8) : y - 57;
    const headerWidth = mobile ? this.scaleSize(420) : 440;
    const headerHeight = mobile ? this.scaleSize(60) : 58;
    const iconSize = mobile ? this.scaleSize(42) : 42;
    const headerX = x + (mobile ? 0 : 12);

    this.addPanel(
      headerX,
      headerY,
      headerWidth,
      headerHeight,
      UI.YELLOW,
      UI.YELLOW_LIGHT,
    );
    const iconX = headerX + (mobile ? this.scaleSize(22) : 22);
    const iconY = headerY + Math.floor((headerHeight - iconSize) / 2);
    const sectionIcon = this.getSectionIcon();
    if (sectionIcon !== null) {
      this.addIcon(sectionIcon, iconX, iconY, iconSize);
    } else {
      this.addText(
        this.getSectionIconText(),
        iconX,
        iconY + (mobile ? this.scaleSize(7) : 7),
        UI.BLACK,
        mobile ? this.scaleSize(28) : 28,
        '900',
        iconSize,
        'center',
      );
    }
    this.addText(
      this.getSectionTitle().toUpperCase(),
      headerX + (mobile ? this.scaleSize(76) : 76),
      headerY + (mobile ? this.scaleSize(17) : 15),
      UI.WHITE,
      mobile ? this.scaleSize(29) : 30,
      '900',
      headerWidth - (mobile ? this.scaleSize(94) : 94),
      'center',
    );

    const sideInset = mobile ? 0 : 8;
    const bottomInset = mobile ? this.scaleSize(12) : 18;
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      Math.max(
        mobile ? this.scaleSize(minimumHeight) : minimumHeight,
        this.root.size.height - y - bottomInset,
      ),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + (mobile ? this.scaleSize(6) : 6),
      y + (mobile ? this.scaleSize(5) : 5),
      width + sideInset * 2 - (mobile ? this.scaleSize(12) : 12),
      mobile ? this.scaleSize(3) : 3,
      UI.YELLOW,
      null,
    );
    accent.setZIndex(-1);

    return {
      mobile,
      x,
      y,
      width,
      inset,
      bodyX: x + inset,
      bodyY: y + (mobile ? this.scaleSize(22) : 22),
      bodyWidth: width - inset * 2,
    };
  }

  protected addSectionHeading(
    text: string,
    x: number,
    y: number,
    width: number,
  ): void {
    const mobile = this.isMobileLayout();
    this.addText(
      text.toUpperCase(),
      x,
      y,
      UI.WHITE,
      mobile ? this.scaleSize(26) : 28,
      '900',
      width,
    );
    this.addPanel(
      x,
      y + (mobile ? this.scaleSize(40) : 42),
      width,
      mobile ? this.scaleSize(2) : 2,
      UI.PANEL_LINE,
      null,
    );
  }
}
