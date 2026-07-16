import * as config from '../../config';
import { RankingClient, RankingResponse, RankingScope } from '../../ranking';

import { PanelScene, UI } from './panelUi';

const MOBILE_WIDTH = 744;
const LEADERBOARD_ROWS = 6;

// Responsive Hall of Fame built from the same native-font panels, buttons,
// focus colors, and arrow navigation as the shop.
export class MainRankingScene extends PanelScene {
  private rankingClient = new RankingClient();
  private scope: RankingScope = 'gaming';
  // null => all-time; '' => current season (resolved server-side).
  private seasonScope: string | null = '';
  private seasonOptions: { id: string | null; label: string }[] = null;
  private seasonDropdownOpen = false;
  private data: RankingResponse = null;
  private isLoading = false;
  private loadRequestId = 0;

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 72 : 96;
  }

  protected getInitialFocusKey(): string {
    return 'tab-gaming';
  }

  protected getBackButtonY(): number {
    return this.pageY - (config.isMobileTouchViewport() ? 36 : 16);
  }

  protected getBackButtonWidth(): number {
    return 140;
  }

  protected getBackButtonRightInset(): number {
    return 12;
  }

  protected load(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.data = null;

    this.rankingClient
      .getRankings(
        this.scope,
        this.seasonScope === '' ? null : this.seasonScope,
      )
      .then((data) => {
        if (requestId !== this.loadRequestId) {
          return;
        }

        this.data = data;
        this.isLoading = false;

        if (data !== null && this.seasonOptions === null) {
          this.seasonOptions = [
            { id: '', label: 'CURRENT' },
            { id: null, label: 'ALL TIME' },
            ...data.seasons
              .filter((season) => season.id !== data.currentSeason.id)
              .map((season) => ({
                id: season.id,
                label: season.name.toUpperCase(),
              })),
          ];
        }

        this.refresh();
      });
  }

  protected renderContent(): void {
    if (config.isMobileTouchViewport()) {
      this.renderMobileContent();
      return;
    }

    this.renderDesktopContent();
  }

  private renderDesktopContent(): void {
    const x = this.pageX;
    const y = this.pageY;
    const width = UI.WIDTH;

    this.renderTitleBanner(x, y - 72, 560, 96, false);
    this.renderContentShell(x, y + 40, width, 18);

    const summaryY = y + 52;
    this.renderDesktopSummary(x, summaryY, width);

    const controlsY = summaryY + 132;
    this.renderScopeButtons(x, controlsY, 228, 60, 8);
    this.renderSeasonSelector(x + width - 350, controlsY, 350, 60, 46);

    const tableY = controlsY + 82;
    this.renderTableHeader(x, tableY, width, false);
    this.renderLeaderboard(x, tableY + 56, width, false);
  }

  private renderMobileContent(): void {
    const x = this.pageX;
    const y = this.pageY;
    const width = MOBILE_WIDTH;

    this.renderTitleBanner(x, y - 64, 500, 72, true);
    this.renderContentShell(x, y + 20, width, 12);

    const summaryY = y + 36;
    this.renderMobileSummary(x, summaryY, width);

    const controlsY = summaryY + 128;
    const gap = 8;
    const tabWidth = Math.floor((width - gap) / 2);
    this.renderScopeButtons(x, controlsY, tabWidth, 56, gap);

    const seasonY = controlsY + 66;
    this.renderSeasonSelector(x, seasonY, width, 58, 46);

    const tableY = seasonY + 78;
    this.renderTableHeader(x, tableY, width, true);
    this.renderLeaderboard(x, tableY + 66, width, true);
  }

  private renderContentShell(
    x: number,
    y: number,
    width: number,
    bottomInset: number,
  ): void {
    const sideInset = config.isMobileTouchViewport() ? 12 : 8;
    const shellHeight = Math.max(120, this.root.size.height - y - bottomInset);
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      shellHeight,
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + 6,
      y + 5,
      width + sideInset * 2 - 12,
      2,
      UI.YELLOW_DARK,
      null,
    );
    accent.setZIndex(-1);
  }

  private renderTitleBanner(
    x: number,
    y: number,
    width: number,
    height: number,
    compact: boolean,
  ): void {
    this.addPanel(x, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    const iconSize = compact ? 42 : 58;
    this.addIcon(
      'ui.icon.trophy',
      x + (compact ? 24 : 30),
      y + Math.floor((height - iconSize) / 2),
      iconSize,
    );
    this.addText(
      'HALL OF FAME',
      x + (compact ? 88 : 112),
      y + (compact ? 20 : 25),
      UI.WHITE,
      compact ? 34 : 46,
      '900',
      width - (compact ? 106 : 132),
    );
  }

  private renderDesktopSummary(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 108, UI.PAGE, UI.PANEL_LINE);
    const columnWidth = Math.floor(width / 2);
    this.addPanel(x + columnWidth, y + 12, 2, 84, UI.PANEL_LINE, null);

    this.renderGamingRank(x + 24, y + 17, columnWidth - 48);
    this.renderTradingRank(x + columnWidth + 34, y + 17, columnWidth - 58);
  }

  private renderMobileSummary(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 108, UI.PAGE, UI.YELLOW_DARK);
    const columnWidth = Math.floor(width / 2);
    this.addPanel(x + columnWidth, y + 12, 2, 84, UI.PANEL_LINE, null);

    this.renderGamingRank(x + 20, y + 17, columnWidth - 40);
    this.renderTradingRank(x + columnWidth + 24, y + 17, columnWidth - 44);
  }

  private renderGamingRank(x: number, y: number, width: number): void {
    const seasonTag =
      this.data !== null ? `S${this.data.currentSeason.number}` : 'S-';
    this.addText(
      `GAMING RANK (${seasonTag}):`,
      x,
      y,
      UI.MUTED,
      21,
      '800',
      width,
    );

    const me = this.data?.me ?? null;
    if (me !== null && me.guest === true) {
      this.addText('GUEST', x, y + 37, UI.GREEN, 30, '900', width);
      return;
    }

    const rank = me === null || me.rank === null ? '--' : `#${me.rank}`;
    const points = me === null ? '' : `  ${me.totalPoints} PTS`;
    this.addText(`${rank}${points}`, x, y + 37, UI.YELLOW, 30, '900', width);
  }

  private renderTradingRank(x: number, y: number, width: number): void {
    this.addText('TRADING RANK (ALL):', x, y, UI.MUTED, 21, '800', width);

    const me = this.data?.me ?? null;
    if (me !== null && me.guest === true) {
      this.addText(
        'LOG IN WITH WALLET OR GOOGLE TO COMPETE',
        x,
        y + 40,
        UI.MUTED,
        18,
        '800',
        width,
      );
      return;
    }

    this.addText('--', x, y + 37, UI.MUTED_LIGHT, 30, '900', width);
  }

  private renderScopeButtons(
    x: number,
    y: number,
    width: number,
    height: number,
    gap: number,
  ): void {
    this.addButton(
      x,
      y,
      width,
      height,
      'GAMING',
      'tab-gaming',
      () => this.switchScope('gaming'),
      this.scope === 'gaming',
      'normal',
      26,
      true,
    );
    this.addButton(
      x + width + gap,
      y,
      width,
      height,
      'TRADING',
      'tab-trading',
      () => this.switchScope('trading'),
      this.scope === 'trading',
      'normal',
      26,
      true,
    );
  }

  private renderSeasonSelector(
    x: number,
    y: number,
    width: number,
    height: number,
    optionHeight: number,
  ): void {
    const selector = this.addButton(
      x,
      y,
      width,
      height,
      `SEASON: ${this.getSeasonLabel()}  ${
        this.seasonDropdownOpen ? '^' : 'V'
      }`,
      'season',
      () => {
        this.seasonDropdownOpen = !this.seasonDropdownOpen;
        this.refresh('season');
      },
      this.seasonDropdownOpen,
      'normal',
      25,
    );
    selector.setZIndex(40);

    if (!this.seasonDropdownOpen) {
      return;
    }

    this.getSeasonOptions().forEach((option, index) => {
      const key = `season-option:${
        option.id === null ? 'all-time' : option.id || 'current'
      }`;
      const button = this.addButton(
        x,
        y + height + index * optionHeight,
        width,
        optionHeight,
        option.label,
        key,
        () => this.selectSeason(option.id),
        option.id === this.seasonScope,
        'normal',
        22,
      );
      button.setZIndex(40);
    });
  }

  private getSeasonOptions(): { id: string | null; label: string }[] {
    return (
      this.seasonOptions || [
        { id: '', label: 'CURRENT' },
        { id: null, label: 'ALL TIME' },
      ]
    );
  }

  private selectSeason(seasonId: string | null): void {
    this.seasonScope = seasonId;
    this.seasonDropdownOpen = false;
    this.load();
    this.refresh('season');
  }

  private renderTableHeader(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const height = mobile ? 58 : 48;
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    const textY = y + (mobile ? 18 : 13);

    if (mobile) {
      this.addText('RANK', x + 20, textY, UI.MUTED, 20, '800', 110);
      this.addText('PLAYER', x + 110, textY, UI.MUTED, 20, '800', 280);
      this.addText('PERKS', x + 430, textY, UI.MUTED, 20, '800', 100);
      this.addText(
        'POINTS',
        x + width - 160,
        textY,
        UI.MUTED,
        20,
        '800',
        140,
        'right',
      );
      return;
    }

    this.addText('RANK', x + 36, textY, UI.MUTED, 20, '800', 120);
    this.addText('PLAYER', x + 194, textY, UI.MUTED, 20, '800', 360);
    this.addText('PERKS', x + 630, textY, UI.MUTED, 20, '800', 180);
    this.addText(
      'TOTAL POINTS',
      x + width - 270,
      textY,
      UI.MUTED,
      20,
      '800',
      230,
      'right',
    );
  }

  private renderLeaderboard(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    if (this.isLoading) {
      this.renderLoadingState(x, y, width, mobile);
      return;
    }

    if (this.data === null) {
      this.renderUnavailableState(x, y, width);
      return;
    }

    if (this.data.rows.length === 0) {
      const message =
        this.scope === 'trading'
          ? 'TRADING RANKS ARRIVE WITH LIVE SWAP VOLUME'
          : 'NO RESULTS YET - PLAY A MATCH TO CLAIM A RANK';
      this.addPanel(x, y, width, 116, UI.PAGE, UI.PANEL_LINE);
      this.addText(
        message,
        x + 24,
        y + 40,
        UI.MUTED_LIGHT,
        23,
        '800',
        width - 48,
        'center',
      );
      return;
    }

    const rowHeight = mobile ? 92 : 62;
    this.data.rows.slice(0, LEADERBOARD_ROWS).forEach((row, index) => {
      const rowY = y + index * rowHeight;
      this.addPanel(
        x,
        rowY,
        width,
        rowHeight - (mobile ? 8 : 2),
        index % 2 === 0 ? UI.PAGE : UI.PANEL,
        UI.PANEL_LINE,
      );

      const rankColor =
        row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      const textY = rowY + (mobile ? 27 : 17);

      this.addText(
        `${row.rank}`,
        x + (mobile ? 24 : 38),
        textY,
        rankColor,
        mobile ? 30 : 27,
        '900',
        70,
      );

      this.addText(
        row.displayName.toUpperCase().slice(0, mobile ? 18 : 24),
        x + (mobile ? 110 : 194),
        textY,
        row.rank === 1 ? UI.GREEN : UI.WHITE,
        mobile ? 23 : 24,
        '800',
        mobile ? 270 : 390,
      );
      this.renderPerkBadges(row.perks, x + (mobile ? 430 : 630), textY, mobile);
      this.addText(
        `${row.totalPoints}`,
        x + width - (mobile ? 160 : 270),
        textY,
        row.rank === 1 ? UI.GREEN : UI.YELLOW,
        mobile ? 29 : 27,
        '900',
        mobile ? 140 : 230,
        'right',
      );
    });
  }

  private renderLoadingState(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const rowHeight = mobile ? 92 : 62;
    for (let index = 0; index < LEADERBOARD_ROWS; index += 1) {
      this.addPanel(
        x,
        y + index * rowHeight,
        width,
        rowHeight - (mobile ? 8 : 2),
        index % 2 === 0 ? UI.PAGE : UI.PANEL,
        UI.PANEL_LINE,
      );
    }
    this.addText(
      'LOADING RANKINGS...',
      x + 24,
      y + 34,
      UI.MUTED_LIGHT,
      23,
      '800',
      width - 48,
      'center',
    );
  }

  private renderUnavailableState(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 146, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      'RANKINGS UNAVAILABLE',
      x + 24,
      y + 24,
      UI.MUTED_LIGHT,
      24,
      '800',
      width - 48,
      'center',
    );
    this.addText(
      'CHECK YOUR CONNECTION, THEN TRY AGAIN',
      x + 24,
      y + 58,
      UI.MUTED,
      19,
      '700',
      width - 48,
      'center',
    );
    this.addButton(
      x + Math.floor((width - 180) / 2),
      y + 92,
      180,
      44,
      'RETRY',
      'retry',
      () => {
        this.load();
        this.refresh('retry');
      },
      false,
      'normal',
      22,
    );
  }

  private renderPerkBadges(
    perks: string[],
    x: number,
    rowY: number,
    compact: boolean,
  ): void {
    if (perks.length === 0) {
      this.addText('-', x, rowY, UI.MUTED, 22, '700', 60);
      return;
    }

    let offsetX = x;
    perks.slice(0, compact ? 2 : 4).forEach((perk) => {
      if (perk.startsWith('stake-')) {
        this.addIcon('ui.icon.badge.stake', offsetX, rowY - 3, 28);
        this.addText(
          perk.slice(6),
          offsetX + 30,
          rowY + 1,
          UI.YELLOW,
          20,
          '900',
          24,
        );
        offsetX += 62;
        return;
      }
      if (perk === 'boost') {
        this.addIcon('ui.icon.badge.boost', offsetX, rowY - 3, 28);
        offsetX += 40;
        return;
      }
      this.addText(
        perk.toUpperCase(),
        offsetX,
        rowY + 1,
        UI.MUTED,
        18,
        '800',
        86,
      );
      offsetX += 92;
    });
  }

  private getSeasonLabel(): string {
    if (this.seasonScope === null) {
      return 'ALL TIME';
    }
    if (this.seasonScope === '') {
      return 'CURRENT';
    }
    const option = (this.seasonOptions || []).find(
      (candidate) => candidate.id === this.seasonScope,
    );
    return option === undefined ? 'CURRENT' : option.label;
  }

  private switchScope(scope: RankingScope): void {
    if (this.scope === scope) {
      return;
    }
    this.scope = scope;
    this.seasonDropdownOpen = false;
    this.load();
    this.refresh(scope === 'gaming' ? 'tab-gaming' : 'tab-trading');
  }
}
