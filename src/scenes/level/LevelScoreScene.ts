import * as config from '../../config';
import { GameUpdateArgs, Session } from '../../game';
import { SessionPlayer } from '../../game/SessionPlayer';
import { PlayerIdentity } from '../../auth';
import { getApiBaseUrl } from '../../network/api';
import { readMultiplayerRuntime } from '../../network/multiplayerRuntime';
import { PointsHighscoreManager } from '../../points';
import { TankTier } from '../../tank';

import { GameSceneType } from '../GameSceneType';
import { PanelScene, UI, UiText } from '../main/panelUi';

const PAGE_GUTTER = 24;
const MOBILE_WIDTH = 744;
const SIMULATION_TICKS_PER_SECOND = 60;
const STAGE_RESULTS_SECONDS = 30;
const STAGE_LOADOUT_SECONDS = 30;
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
  private isObserver = false;
  private isWebRtcMatch = false;
  private webRtcMatch: GameUpdateArgs['webRtcMatch'];
  private stageResultsRemaining = STAGE_RESULTS_SECONDS;
  private stageResultsTimer: UiText = null;
  private stageResultsTimerSecond = STAGE_RESULTS_SECONDS;
  private transitionFinished = false;

  protected setup(updateArgs: GameUpdateArgs): void {
    this.session = updateArgs.session;
    this.playerIdentity = updateArgs.playerIdentity;
    this.pointsHighscoreManager = updateArgs.pointsHighscoreManager;
    this.isObserver = updateArgs.webRtcMatch.isObserver();
    this.isWebRtcMatch = updateArgs.webRtcMatch.isEnabled();
    this.webRtcMatch = updateArgs.webRtcMatch;

    this.applyMultiplayerBonus();
    this.players = this.buildPlayerResults();
    super.setup(updateArgs);
  }

  protected update(updateArgs: GameUpdateArgs): void {
    super.update(updateArgs);
    if (
      this.transitionFinished ||
      !this.isWebRtcMatch ||
      this.session.isGameOver()
    ) {
      return;
    }
    this.stageResultsRemaining = Math.max(
      0,
      this.stageResultsRemaining - updateArgs.deltaTime,
    );
    const nextSecond = Math.ceil(this.stageResultsRemaining);
    if (nextSecond !== this.stageResultsTimerSecond) {
      this.stageResultsTimerSecond = nextSecond;
      this.stageResultsTimer?.setText(this.formatTransitionTime(nextSecond));
    }
    if (this.stageResultsRemaining === 0) {
      this.finish();
    }
  }

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    if (config.isMobileTouchViewport()) {
      return MOBILE_WIDTH;
    }
    return Math.min(UI.WIDTH, Math.max(320, this.root.size.width - PAGE_GUTTER * 2));
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
    const width = this.getContentWidth();
    const actionWidth = this.getBackButtonWidth();
    const actionX =
      x + width - actionWidth - this.getBackButtonRightInset();
    const titleWidth = Math.min(398, Math.max(250, Math.floor(width * 0.33)));
    const summaryX = x + titleWidth + 8;
    const summaryWidth = Math.max(120, actionX - summaryX - 8);

    this.renderTitle(x, y - 57, titleWidth, 58, false);
    this.renderDesktopSummary(summaryX, y - 57, summaryWidth, 58);
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
    const footerY = rowsBottom + 12;
    this.renderFooterStats(x + 18, footerY, width - 36, 86, false);
    this.renderShareButton(
      x + Math.floor((width - 240) / 2),
      footerY + 102,
      240,
      48,
      24,
    );
  }

  private renderMobile(): void {
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();
    const titleWidth = Math.max(
      280,
      width - this.getBackButtonWidth() - 18,
    );

    this.renderTitle(x, 8, titleWidth, 60, true);
    this.renderShell(x, y, width, 12);

    this.renderMobileSummary(x + 14, y + 18, width - 28);
    this.renderStatusStrip(x + 14, y + 146, width - 28, 70, true);

    let rowY = y + 232;
    this.players.forEach((result) => {
      this.renderMobilePlayerCard(result, x + 14, rowY, width - 28, 224);
      rowY += 240;
    });
    const footerY = rowY + 4;
    this.renderFooterStats(x + 14, footerY, width - 28, 102, true);
    this.renderShareButton(
      x + Math.floor((width - 260) / 2),
      footerY + 118,
      260,
      60,
      26,
    );
  }

  private renderShareButton(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
  ): void {
    this.addButton(
      x,
      y,
      width,
      height,
      'SHARE',
      'share',
      () => void this.shareResults(),
      false,
      'normal',
      fontSize,
    );
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
    const showTimer = this.isWebRtcMatch && !this.session.isGameOver();
    const timerWidth = mobile ? 148 : 176;

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
      width - height - 36 - (showTimer ? timerWidth : 0),
    );
    if (showTimer) {
      this.stageResultsTimer = this.addText(
        this.formatTransitionTime(this.stageResultsTimerSecond),
        x + width - timerWidth - 20,
        y + (mobile ? 20 : 18),
        UI.GREEN,
        mobile ? 24 : 27,
        '900',
        timerWidth,
        'right',
      );
    }
  }

  private renderDesktopTableHeader(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 54, UI.PANEL_ALT, UI.PANEL_LINE);
    const { rankWidth, playerWidth, tierWidth, bonusWidth, totalWidth } =
      this.getDesktopTableColumns(width);

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
        x +
          rankWidth +
          playerWidth +
          index * tierWidth +
          Math.floor((tierWidth - 40) / 2),
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
    const { rankWidth, playerWidth, tierWidth, bonusWidth, totalWidth } =
      this.getDesktopTableColumns(width);
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
      x + rankWidth + 10,
      y + 26,
      result.isPrimary ? UI.GREEN : UI.WHITE,
      playerWidth < 220 ? 23 : 28,
      '900',
      playerWidth - 20,
    );
    if (result.isPrimary) {
      this.addText('YOU', x + rankWidth + 10, y + 65, UI.YELLOW, 18, '900', 90);
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

  private getDesktopTableColumns(width: number): {
    rankWidth: number;
    playerWidth: number;
    tierWidth: number;
    bonusWidth: number;
    totalWidth: number;
  } {
    const rankWidth = Math.max(56, Math.floor(width * 0.08));
    const playerWidth = Math.max(140, Math.floor(width * 0.24));
    const tierWidth = Math.max(42, Math.floor(width * 0.09));
    const bonusWidth = Math.max(82, Math.floor(width * 0.14));
    const totalWidth = Math.max(
      76,
      width - rankWidth - playerWidth - tierWidth * 4 - bonusWidth,
    );

    return { rankWidth, playerWidth, tierWidth, bonusWidth, totalWidth };
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
        name: this.isObserver
          ? `PLAYER ${index + 1}`
          : index === 0
            ? primaryName
            : 'PLAYER 2',
        isPrimary: !this.isObserver && index === 0,
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

  private async shareResults(): Promise<void> {
    const primaryResult =
      this.players.find((result) => result.isPrimary) || this.players[0];
    const score = primaryResult?.player.getGamePoints() || 0;
    const defeated = this.session.getLevelEnemiesDefeated();
    const total = this.getEnemyTotal();
    const stage = this.session.getLevelNumber();
    const result = this.session.isGameOver() ? 'Mission failed' : 'Stage clear';
    const title = `Battle Cities - Stage ${stage} Results`;
    const text = `${result}! I scored ${score} points and defeated ${defeated}/${total} enemies in ${this.getBattleTime()}.`;
    const url = new URL('/', getApiBaseUrl()).toString();
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        this.setStatus('RESULT SHARED');
        return;
      }

      if (navigator.clipboard?.writeText !== undefined) {
        await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
        this.setStatus('RESULT COPIED - SHARE IT ANYWHERE');
        return;
      }

      this.setStatus('SHARING IS NOT SUPPORTED ON THIS DEVICE');
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        return;
      }
      this.setStatus('COULD NOT SHARE RESULT - TRY AGAIN');
    }
  }

  private finish(): void {
    if (this.transitionFinished) {
      return;
    }
    this.transitionFinished = true;
    if (
      this.isObserver &&
      this.session.isGameOver()
    ) {
      const returnUrl = this.getObserverReturnUrl();
      if (returnUrl !== null) {
        try {
          if (window.top !== null) {
            window.top.location.href = returnUrl;
            return;
          }
        } catch {
          // Cross-origin frames may reject top-level navigation.
        }
        window.location.assign(returnUrl);
        return;
      }
    }
    if (this.session.isGameOver()) {
      this.navigator.replace(GameSceneType.MainGameOver);
      return;
    }
    if (this.isWebRtcMatch && !this.isObserver) {
      const localPlayer = this.webRtcMatch.getLocalPlayerIndex();
      if (!this.session.getPlayer(localPlayer).isAlive()) {
        const runtime = readMultiplayerRuntime();
        this.session.activateNextLevel();
        this.navigator.replace(GameSceneType.MainTankSelect, {
          multiplayer: true,
          stageRejoin: true,
          playerSlot: localPlayer,
          stage: this.session.getLevelNumber(),
          matchId: runtime?.matchId,
          transitionDeadline: Date.now() + STAGE_LOADOUT_SECONDS * 1000,
        });
        return;
      }
    }
    if (this.session.isLastLevel() && !this.isWebRtcMatch) {
      this.navigator.replace(GameSceneType.MainVictory);
      return;
    }
    this.session.activateNextLevel();
    if (this.isWebRtcMatch && !this.isObserver) {
      const localPlayer = this.webRtcMatch.getLocalPlayerIndex();
      this.navigator.replace(GameSceneType.MainShop, {
        battleSetup: true,
        multiplayer: true,
        stageContinuation: true,
        stage: this.session.getLevelNumber(),
        tankTier: this.session.getPlayerTankTier(localPlayer),
        fuelCost: 0,
        transitionDeadline: Date.now() + STAGE_LOADOUT_SECONDS * 1000,
      });
      return;
    }
    this.webRtcMatch.prepareStage(this.session.getLevelNumber());
    this.navigator.replace(GameSceneType.LevelLoad);
  }

  private formatTransitionTime(seconds: number): string {
    return `NEXT ${Math.max(0, seconds).toString().padStart(2, '0')}S`;
  }

  private getObserverReturnUrl(): string | null {
    const value = new URLSearchParams(window.location.search).get('returnTo');
    if (value === null) return null;
    try {
      const url = new URL(value);
      const isLocal =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        /^192\.168\./.test(url.hostname) ||
        /^10\./.test(url.hostname);
      if (
        (url.protocol !== 'https:' && url.protocol !== 'http:') ||
        (url.hostname !== 'broadcaster.battlecities.com' && !isLocal)
      ) {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }
}
