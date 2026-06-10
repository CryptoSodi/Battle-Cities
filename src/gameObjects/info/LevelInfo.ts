import { GameObject, RectPainter } from '../../core';
import * as config from '../../config';

import { SpriteText } from '../text';

const BAR_HEIGHT = 40;
const BLOCK_TOP = 10;
const BLOCK_GAP = 16;
const EDGE_PADDING_LEFT = 56;
const EDGE_PADDING_RIGHT = 32;
const CENTER_GAP = 40;

export class LevelInfo extends GameObject {
  public zIndex = config.LEVEL_INFO_Z_INDEX;
  private enemyTitle = new SpriteText('ENEMY', { color: config.COLOR_YELLOW });
  private enemyValue = new SpriteText('00', { color: config.COLOR_WHITE });
  private primaryLivesTitle = new SpriteText('1P', { color: config.COLOR_YELLOW });
  private primaryLivesValue = new SpriteText('00', { color: config.COLOR_WHITE });
  private secondaryLivesTitle = new SpriteText('2P', { color: config.COLOR_YELLOW });
  private secondaryLivesValue = new SpriteText('00', { color: config.COLOR_WHITE });
  private stageTitle = new SpriteText('STAGE', { color: config.COLOR_YELLOW });
  private stageValue = new SpriteText('00', { color: config.COLOR_WHITE });
  private readonly isMultiplayer: boolean;

  constructor(width: number, isMultiplayer: boolean) {
    super(width, BAR_HEIGHT);

    this.isMultiplayer = isMultiplayer;
  }

  protected setup(): void {
    this.painter = new RectPainter('rgba(6, 6, 6, 0.92)', '#3f3f3f');

    this.add(this.enemyTitle);
    this.add(this.enemyValue);

    this.add(this.primaryLivesTitle);
    this.add(this.primaryLivesValue);

    if (this.isMultiplayer) {
      this.add(this.secondaryLivesTitle);
      this.add(this.secondaryLivesValue);
    }

    this.add(this.stageTitle);
    this.add(this.stageValue);

    this.layout();
  }

  public setLevelNumber(levelNumber: number): void {
    this.stageValue.setText(levelNumber.toString().padStart(2, '0'));
    this.layout();
  }

  public setLivesCount(playerIndex: number, livesCount: number): void {
    const displayLivesCount = Math.max(0, livesCount - 1)
      .toString()
      .padStart(2, '0');

    if (playerIndex === 0) {
      this.primaryLivesValue.setText(displayLivesCount);
    }

    if (playerIndex === 1) {
      this.secondaryLivesValue.setText(displayLivesCount);
    }

    this.layout();
  }

  public setEnemyCount(enemyCount: number): void {
    this.enemyValue.setText(enemyCount.toString().padStart(2, '0'));
    this.layout();
  }

  private layout(): void {
    const enemyWidth = this.getBlockWidth(this.enemyTitle, this.enemyValue);
    const stageWidth = this.getBlockWidth(this.stageTitle, this.stageValue);

    this.positionBlock(this.enemyTitle, this.enemyValue, EDGE_PADDING_LEFT);
    this.positionBlock(
      this.stageTitle,
      this.stageValue,
      this.size.width - EDGE_PADDING_RIGHT - stageWidth,
    );

    const centerX = this.size.width / 2;
    const primaryWidth = this.getBlockWidth(
      this.primaryLivesTitle,
      this.primaryLivesValue,
    );

    if (this.isMultiplayer) {
      const secondaryWidth = this.getBlockWidth(
        this.secondaryLivesTitle,
        this.secondaryLivesValue,
      );
      const totalPlayersWidth = primaryWidth + CENTER_GAP + secondaryWidth;
      const playerStartX = centerX - totalPlayersWidth / 2;

      this.positionBlock(
        this.primaryLivesTitle,
        this.primaryLivesValue,
        playerStartX,
      );
      this.positionBlock(
        this.secondaryLivesTitle,
        this.secondaryLivesValue,
        playerStartX + primaryWidth + CENTER_GAP,
      );
      return;
    }

    this.positionBlock(
      this.primaryLivesTitle,
      this.primaryLivesValue,
      centerX - primaryWidth / 2,
    );
  }

  private positionBlock(
    title: SpriteText,
    value: SpriteText,
    startX: number,
  ): void {
    title.position.set(startX, BLOCK_TOP);
    title.updateMatrix();

    value.position.set(
      startX + title.getTextSize().width + BLOCK_GAP,
      BLOCK_TOP,
    );
    value.updateMatrix();
  }

  private getBlockWidth(title: SpriteText, value: SpriteText): number {
    return title.getTextSize().width + BLOCK_GAP + value.getTextSize().width;
  }
}
