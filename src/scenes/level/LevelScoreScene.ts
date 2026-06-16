import { RectPainter, Timer } from '../../core';
import { AudioManager, GameUpdateArgs, Session } from '../../game';
import {
  LevelTitle,
  ScoreBonus,
  ScoreTable,
  SpriteText,
} from '../../gameObjects';
import { LevelScoreInputContext } from '../../input';
import { PointsHighscoreManager } from '../../points';
import * as config from '../../config';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

const BONUS_DELAY = 0.5;
const POST_DELAY = 3;
const HIGHSCORE_GAP = 256;
const SINGLE_PLAYER_SCORE_TABLE_OFFSET_X = 146;

enum State {
  Idle,
  Counting,
  Bonus,
  Post,
}

export class LevelScoreScene extends GameScene {
  private session: Session;
  private audioManager: AudioManager;
  private highscoreTitle: SpriteText;
  private highscorePoints: SpriteText;
  private levelTitle: LevelTitle;
  private scoreTable: ScoreTable;
  private primaryBonus: ScoreBonus;
  private secondaryBonus: ScoreBonus;
  private bonusTimer = new Timer();
  private postTimer = new Timer();
  private state = State.Idle;
  private pointsHighscoreManager: PointsHighscoreManager;

  protected setup({
    audioManager,
    pointsHighscoreManager,
    session,
  }: GameUpdateArgs): void {
    this.audioManager = audioManager;
    this.pointsHighscoreManager = pointsHighscoreManager;
    this.session = session;

    // Find players who got most points during this level. It can be both.
    // Bonus points are awarded to balance highscore with single-player
    if (this.session.isMultiplayer()) {
      const maxLevelPoints = this.session.getMaxLevelPoints();

      this.session.getPlayers().forEach((playerSession) => {
        const levelPoints = playerSession.getLevelPoints();

        if (levelPoints > 0 && levelPoints === maxLevelPoints) {
          playerSession.addBonusPoints();
        }
      });
    }

    this.root.painter = new RectPainter(config.COLOR_BLACK);

    this.highscoreTitle = new SpriteText('HI-SCORE', {
      color: config.COLOR_RED,
    });
    this.highscoreTitle.origin.setX(1);
    this.highscoreTitle.position.set(
      this.root.getSelfCenter().x - HIGHSCORE_GAP / 2,
      64,
    );
    this.root.add(this.highscoreTitle);

    this.highscorePoints = new SpriteText(this.getCommonHighscoreText(), {
      color: config.COLOR_YELLOW,
    });
    this.highscorePoints.position.set(
      this.root.getSelfCenter().x + HIGHSCORE_GAP / 2,
      64,
    );
    this.root.add(this.highscorePoints);

    this.levelTitle = new LevelTitle(
      this.session.getLevelNumber(),
      this.session.isPlaytest(),
      {
        color: config.COLOR_WHITE,
      },
    );
    this.levelTitle.origin.set(0.5, 0);
    this.levelTitle.setCenter(this.root.getSelfCenter());
    this.levelTitle.position.setY(128);
    this.root.add(this.levelTitle);

    this.scoreTable = new ScoreTable(this.session.isMultiplayer());
    this.scoreTable.updateMatrix();
    this.scoreTable.setCenter(this.root.getSelfCenter());
    if (!this.session.isMultiplayer()) {
      this.scoreTable.position.setX(
        this.scoreTable.position.x + SINGLE_PLAYER_SCORE_TABLE_OFFSET_X,
      );
    }
    this.scoreTable.done.addListener(this.handleScoreTableDone);
    this.root.add(this.scoreTable);

    this.primaryBonus = new ScoreBonus();
    this.primaryBonus.position.set(96, 754);

    this.secondaryBonus = new ScoreBonus();
    this.secondaryBonus.position.set(712, 754);

    this.bonusTimer.done.addListener(this.handleBonus);
    this.postTimer.done.addListener(this.handlePost);

    this.state = State.Counting;
    this.scoreTable.start();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { deltaTime, inputManager } = updateArgs;

    const inputMethod = inputManager.getActiveMethod();

    if (inputMethod.isDownAny(LevelScoreInputContext.Skip)) {
      if (this.state === State.Counting) {
        this.scoreTable.skip();
        this.showBonus();
        return;
      }
      if (this.state === State.Bonus) {
        this.showBonus();
        return;
      }
      if (this.state === State.Post) {
        this.finish();
        return;
      }
    }

    if (this.state === State.Bonus) {
      this.bonusTimer.update(deltaTime);
    }

    if (this.state === State.Post) {
      this.postTimer.update(deltaTime);
    }

    super.update(updateArgs);
  }

  private getCommonHighscoreText(): string {
    const points = this.pointsHighscoreManager.getOverallMaxPoints();
    const pointsText = points.toString().padStart(6, ' ');

    return pointsText;
  }

  private showBonus(): void {
    this.bonusTimer.stop();

    this.audioManager.play('score.bonus');

    if (this.session.primaryPlayer.hasBonusPoints()) {
      this.root.add(this.primaryBonus);
    }

    if (this.session.secondaryPlayer.hasBonusPoints()) {
      this.root.add(this.secondaryBonus);
    }
  }

  private handleScoreTableDone = (): void => {
    if (this.session.anybodyHasBonusPoints()) {
      this.state = State.Bonus;
      this.bonusTimer.reset(BONUS_DELAY);
      return;
    }

    this.state = State.Post;
    this.postTimer.reset(POST_DELAY);
  };

  private handleBonus = (): void => {
    this.showBonus();

    this.state = State.Post;
    this.postTimer.reset(POST_DELAY);
  };

  private handlePost = (): void => {
    this.finish();
  };

  private finish(): void {
    if (this.session.isGameOver()) {
      this.navigator.replace(GameSceneType.MainGameOver);
      return;
    }
    if (this.session.isLastLevel()) {
      this.navigator.replace(GameSceneType.MainVictory);
      return;
    }
    this.session.activateNextLevel();
    this.navigator.replace(GameSceneType.LevelLoad);
  }
}
