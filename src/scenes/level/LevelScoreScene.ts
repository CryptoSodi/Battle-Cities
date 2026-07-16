import * as config from '../../config';
import { GameUpdateArgs, Session } from '../../game';
import { SessionPlayer } from '../../game/SessionPlayer';
import { PlayerIdentity } from '../../auth';
import { PointsHighscoreManager } from '../../points';
import { TankTier } from '../../tank';

import { GameSceneType } from '../GameSceneType';
import { PanelScene, UI } from '../main/panelUi';

const MOBILE_WIDTH = 744;
const SIMULATION_TICKS_PER_SECOND = 60;
const TIERS = [TankTier.A, TankTier.B, TankTier.C, TankTier.D];
const TIER_ICONS = [
  'tank.enemy.default.a.up.1',
  'tank.enemy.default.b.up.1',
  'tank.enemy.default.c.up.1',
  'tank.enemy.default.d.up.1',
];

interface ResultPlayer {
  player: SessionPlayer;
  name: string;
  rank: number;
  isPrimary: boolean;
}

export class LevelScoreScene extends PanelScene {
  private session: Session;
  private playerIdentity: PlayerIdentity;
  private pointsHighscoreManager: PointsHighscoreManager;
  private players: ResultPlayer[] = [];

  protected setup(updateArgs: GameUpdateArgs): void {
    this.session = updateArgs.session;
    this.playerIdentity = updateArgs.playerIdentity;
    this.pointsHighscoreManager = updateArgs.pointsHighscoreManager;

    this.applyMultiplayerBonus();
    this.players = this.buildPlayerResults();
    super.setup(updateArgs);
  }

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 76 : 96;
  }

  protected getInitialFocusKey(): string {
    return 'continue';
  }

  protected getBackButtonY(): number {
    return config.isMobileTouchViewport() ? 8 : 44;
  }

  protected getBackButtonWidth(): number {
    return config.isMobileTouchViewport() ? 170 : 176;
  }

  protected getBackButtonRightInset(): number {
    return config.isMobileTouchViewport() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return config.isMobileTouchViewport() ? 60 : 48;
  }

  protected getHeaderActionText(): string {
    return 'CONTINUE  →';
  }

  protected getHeaderActionKey(): string {
    return 'continue';
  }

  protected getHeaderActionVariant(): 'normal' | 'back' {
    return 'normal';
  }

  protected handleHeaderAction(): void {
    this.finish();
  }

  protected load(): void {
    this.statusText = '';
  }

  protected renderContent(): void {
    if (config.isMobileTouchViewport()) {
      this.renderMobile();
      return;
    }
    this.renderDesktop();
  }

  private renderDesktop(): void {
    const x = this.pageX;
    const y = this.pageY;
    const width = UI.WIDTH;

    this.renderTitle(x + 12, y - 57, 398, 58, false);
    this.renderDesktopSummary(x + 422, y - 57, 618, 58);
    this.renderShell(x - 8, y, width + 16, 18);

    const statusY = y + 18;
    this.renderStatusStrip(x + 18, statusY, width - 36, 72, false);

    const tableY = statusY + 92;
    this.renderDesktopTableHeader(x + 18, tableY, width - 36);
    this.players.forEach((result, index) => {
      this.renderDesktopPlayerRow(
        result,
        x + 18,
        tableY + 62 + index * 128,
        width - 36,
        112,
      );
    });

    const rowsBottom = tableY + 62 + this.players.length * 128;
    this.renderFooterStats(x + 18, rowsBottom + 12, width - 36, 86, false);
  }

  private renderMobile(): void {
    const x = this.pageX;
    const y = this.pageY;
    const width = MOBILE_WIDTH;

    this.renderTitle(x, 8, 550, 60, true);
    this.renderShell(x, y, width, 12);

    this.renderMobileSummary(x + 14, y + 18, width - 28);
    this.renderStatusStrip(x + 14, y + 146, width - 28, 70, true);

    let rowY = y + 232;
    this.players.forEach((result) => {
      this.renderMobilePlayerCard(result, x + 14, rowY, width - 28, 224);
      rowY += 240;
    });
    this.renderFooterStats(x + 14, rowY + 4, width - 28, 102, true);
  }

  private renderTitle(
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    this.addPanel(x, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    this.addText(
      `STAGE ${this.session.getLevelNumber()} RESULTS`,
      x + 10,
      y + (mobile ? 17 : 15),
      UI.WHITE,
      mobile ? 29 : 31,
      '900',
      width - 20,
      'center',
    );
  }

  private renderShell(
    x: number,
    y: number,
    width: number,
    bottomInset: number,
  ): void {
    const shell = this.addPanel(
      x,
      y,
      width,
      Math.max(360, this.root.size.height - y - bottomInset),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);
    const accent = this.addPanel(x + 6, y + 5, width - 12, 3, UI.YELLOW, null);
    accent.setZIndex(-1);
  }

  private renderDesktopSummary(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    const cellWidth = width / 3;
    this.renderHeaderMetric(
      x,
      y,
      cellWidth,
      height,
      'HI-SCORE',
      `${this.getDisplayedHighscore()}`,
      UI.YELLOW,
    );
    this.renderHeaderMetric(
      x + cellWidth,
      y,
      cellWidth,
      height,
      'ENEMIES',
      `${this.session.getLevelEnemiesDefeated()} / ${this.getEnemyTotal()}`,
      UI.GREEN,
    );
    this.renderHeaderMetric(
      x + cellWidth * 2,
      y,
      cellWidth,
      height,
      'BATTLE TIME',
      this.getBattleTime(),
      UI.GREEN,
    );
  }

  private renderHeaderMetric(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    valueColor: string,
  ): void {
    this.addText(
      label,
      x + 10,
      y + 9,
      UI.MUTED,
      17,
      '800',
      width - 20,
      'center',
    );
    this.addText(
      value,
      x + 10,
      y + 29,
      valueColor,
      23,
      '900',
      width - 20,
      'center',
    );
    if (x > this.pageX + 430) {
      this.addPanel(x, y + 10, 2, height - 20, UI.PANEL_LINE, null);
    }
  }

  private renderMobileSummary(x: number, y: number, width: number): void {
    const gap = 10;
    const cellWidth = Math.floor((width - gap * 2) / 3);
    this.renderMetricCard(
      x,
      y,
      cellWidth,
      108,
      'HI-SCORE',
      `${this.getDisplayedHighscore()}`,
      UI.YELLOW,
    );
    this.renderMetricCard(
      x + cellWidth + gap,
      y,
      cellWidth,
      108,
      'ENEMIES',
      `${this.session.getLevelEnemiesDefeated()} / ${this.getEnemyTotal()}`,
      UI.GREEN,
    );
    this.renderMetricCard(
      x + (cellWidth + gap) * 2,
      y,
      cellWidth,
      108,
      'BATTLE TIME',
      this.getBattleTime(),
      UI.GREEN,
    );
  }

  private renderMetricCard(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    color: string,
  ): void {
    this.addPanel(x, y, width, height, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      label,
      x + 8,
      y + 19,
      UI.MUTED,
      18,
      '800',
      width - 16,
      'center',
    );
    this.addText(value, x + 8, y + 53, color, 28, '900', width - 16, 'center');
  }

  private renderStatusStrip(
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    const won = !this.session.isGameOver();
    const perfect =
      won && this.session.getLevelEnemiesDefeated() >= this.getEnemyTotal();
    const status = perfect
      ? 'PERFECT CLEAR'
      : won
      ? 'STAGE CLEAR'
      : 'MISSION FAILED';
    const color = won ? UI.GREEN : UI.RED_BORDER;

    this.addPanel(
      x,
      y,
      width,
      height,
      UI.PAGE,
      won ? UI.YELLOW_DARK : UI.RED_DARK,
    );
    this.addIcon(
      won ? 'powerup.star' : 'ui.gameOver',
      x + 20,
      y + 12,
      height - 24,
    );
    this.addText(
      status,
      x + height + 8,
      y + (mobile ? 20 : 18),
      color,
      mobile ? 27 : 30,
      '900',
      width - height - 36,
    );
  }

  private renderDesktopTableHeader(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 54, UI.PANEL_ALT, UI.PANEL_LINE);
    const rankWidth = 100;
    const playerWidth = 300;
    const tierWidth = 112;
    const bonusWidth = 170;
    const totalWidth =
      width - rankWidth - playerWidth - tierWidth * 4 - bonusWidth;

    this.addText(
      'RANK',
      x,
      y + 15,
      UI.MUTED_LIGHT,
      20,
      '800',
      rankWidth,
      'center',
    );
    this.addText(
      'PLAYER',
      x + rankWidth,
      y + 15,
      UI.MUTED_LIGHT,
      20,
      '800',
      playerWidth,
      'center',
    );
    TIERS.forEach((_tier, index) => {
      this.addIcon(
        TIER_ICONS[index],
        x + rankWidth + playerWidth + index * tierWidth + 35,
        y + 7,
        40,
      );
    });
    this.addText(
      'BONUS',
      x + rankWidth + playerWidth + tierWidth * 4,
      y + 15,
      UI.MUTED_LIGHT,
      20,
      '800',
      bonusWidth,
      'center',
    );
    this.addText(
      'TOTAL',
      x + width - totalWidth,
      y + 15,
      UI.YELLOW,
      20,
      '800',
      totalWidth,
      'center',
    );
  }

  private renderDesktopPlayerRow(
    result: ResultPlayer,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const rankWidth = 100;
    const playerWidth = 300;
    const tierWidth = 112;
    const bonusWidth = 170;
    const totalWidth =
      width - rankWidth - playerWidth - tierWidth * 4 - bonusWidth;
    const record = result.player.getLevelPointsRecord();
    const rowFill = result.isPrimary ? UI.GREEN_PANEL : UI.PAGE;
    const rowStroke = result.isPrimary ? UI.GREEN : UI.PANEL_LINE;

    this.addPanel(x, y, width, height, rowFill, rowStroke);
    this.addText(
      `${result.rank}`,
      x,
      y + 32,
      result.rank === 1 ? UI.YELLOW : UI.WHITE,
      38,
      '900',
      rankWidth,
      'center',
    );
    this.addText(
      result.name,
      x + rankWidth + 20,
      y + 26,
      result.isPrimary ? UI.GREEN : UI.WHITE,
      28,
      '900',
      playerWidth - 40,
    );
    if (result.isPrimary) {
      this.addText('YOU', x + rankWidth + 20, y + 65, UI.YELLOW, 18, '900', 90);
    }

    TIERS.forEach((tier, index) => {
      this.addText(
        `${record.getTierKillCount(tier)}`,
        x + rankWidth + playerWidth + index * tierWidth,
        y + 37,
        result.isPrimary ? UI.GREEN : UI.WHITE,
        32,
        '900',
        tierWidth,
        'center',
      );
    });

    const bonusX = x + rankWidth + playerWidth + tierWidth * 4;
    const bonus = record.getBonusTotalPoints();
    this.addText(
      bonus > 0 ? 'STAGE LEADER' : '-',
      bonusX,
      y + 28,
      bonus > 0 ? UI.YELLOW : UI.MUTED,
      18,
      '800',
      bonusWidth,
      'center',
    );
    if (bonus > 0) {
      this.addText(
        `+${bonus}`,
        bonusX,
        y + 58,
        UI.YELLOW,
        22,
        '900',
        bonusWidth,
        'center',
      );
    }

    this.addText(
      `${result.player.getGamePoints()}`,
      x + width - totalWidth,
      y + 32,
      result.isPrimary ? UI.GREEN : UI.YELLOW,
      36,
      '900',
      totalWidth,
      'center',
    );
  }

  private renderMobilePlayerCard(
    result: ResultPlayer,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const record = result.player.getLevelPointsRecord();
    this.addPanel(
      x,
      y,
      width,
      height,
      result.isPrimary ? UI.GREEN_PANEL : UI.PAGE,
      result.isPrimary ? UI.GREEN : UI.PANEL_LINE,
    );
    this.addText(
      `#${result.rank}`,
      x + 22,
      y + 18,
      result.rank === 1 ? UI.YELLOW : UI.WHITE,
      30,
      '900',
      70,
    );
    this.addText(
      result.name,
      x + 100,
      y + 20,
      result.isPrimary ? UI.GREEN : UI.WHITE,
      26,
      '900',
      width - 300,
    );
    this.addText(
      `${result.player.getGamePoints()} PTS`,
      x + width - 210,
      y + 20,
      result.isPrimary ? UI.GREEN : UI.YELLOW,
      28,
      '900',
      188,
      'right',
    );

    const tierY = y + 74;
    const tierWidth = Math.floor((width - 40) / 4);
    TIERS.forEach((tier, index) => {
      const tierX = x + 20 + index * tierWidth;
      this.addIcon(
        TIER_ICONS[index],
        tierX + Math.floor((tierWidth - 52) / 2),
        tierY,
        52,
      );
      this.addText(
        `${record.getTierKillCount(tier)}`,
        tierX,
        tierY + 62,
        result.isPrimary ? UI.GREEN : UI.WHITE,
        27,
        '900',
        tierWidth,
        'center',
      );
    });

    const bonus = record.getBonusTotalPoints();
    const footerY = y + height - 44;
    this.addPanel(x + 10, footerY, width - 20, 34, UI.PANEL_ALT, null);
    this.addText(
      bonus > 0
        ? `STAGE LEADER  +${bonus}`
        : `TOTAL KILLS  ${record.getKillTotalCount()}`,
      x + 18,
      footerY + 8,
      bonus > 0 ? UI.YELLOW : UI.MUTED_LIGHT,
      19,
      '900',
      width - 36,
      'center',
    );
  }

  private renderFooterStats(
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    const totalKills = this.players.reduce(
      (sum, result) =>
        sum + result.player.getLevelPointsRecord().getKillTotalCount(),
      0,
    );
    const mvp = this.players[0]?.name || 'PLAYER';
    const columnWidth = width / 3;
    this.renderFooterMetric(
      x,
      y,
      columnWidth,
      height,
      'TANKS DESTROYED',
      `${totalKills}`,
      UI.GREEN,
      mobile,
    );
    this.renderFooterMetric(
      x + columnWidth,
      y,
      columnWidth,
      height,
      'BATTLE TIME',
      this.getBattleTime(),
      UI.GREEN,
      mobile,
    );
    this.renderFooterMetric(
      x + columnWidth * 2,
      y,
      columnWidth,
      height,
      'MVP',
      mvp,
      UI.YELLOW,
      mobile,
    );
  }

  private renderFooterMetric(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    color: string,
    mobile: boolean,
  ): void {
    this.addText(
      label,
      x + 10,
      y + (mobile ? 18 : 15),
      UI.MUTED,
      mobile ? 17 : 18,
      '800',
      width - 20,
      'center',
    );
    this.addText(
      value,
      x + 10,
      y + (mobile ? 52 : 43),
      color,
      mobile ? 25 : 27,
      '900',
      width - 20,
      'center',
    );
  }

  private applyMultiplayerBonus(): void {
    if (!this.session.isMultiplayer()) {
      return;
    }
    const maxLevelPoints = this.session.getMaxLevelPoints();
    this.session.getPlayers().forEach((player) => {
      if (
        player.getLevelPoints() > 0 &&
        player.getLevelPoints() === maxLevelPoints
      ) {
        player.addBonusPoints();
      }
    });
  }

  private buildPlayerResults(): ResultPlayer[] {
    const activePlayers = this.session.isMultiplayer()
      ? [this.session.primaryPlayer, this.session.secondaryPlayer]
      : [this.session.primaryPlayer];
    const primaryName = this.safeName(this.playerIdentity.getDisplayName());
    const sorted = activePlayers
      .map((player, index) => ({
        player,
        name: index === 0 ? primaryName : 'PLAYER 2',
        isPrimary: index === 0,
      }))
      .sort((a, b) => b.player.getGamePoints() - a.player.getGamePoints());

    return sorted.map((result, index) => ({ ...result, rank: index + 1 }));
  }

  private safeName(name: string): string {
    const clean = (name || 'PLAYER')
      .toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, '')
      .trim();
    return (clean || 'PLAYER').slice(0, 18);
  }

  private getDisplayedHighscore(): number {
    return Math.max(
      this.pointsHighscoreManager.getOverallMaxPoints(),
      ...this.players.map((result) => result.player.getGamePoints()),
    );
  }

  private getEnemyTotal(): number {
    return Math.max(
      this.session.getLevelEnemyTotal(),
      this.session.getLevelEnemiesDefeated(),
    );
  }

  private getBattleTime(): string {
    const totalSeconds = Math.max(
      0,
      Math.floor(
        this.session.getLevelDurationTicks() / SIMULATION_TICKS_PER_SECOND,
      ),
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

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
