import { RankingClient, RankingResponse, RankingScope } from '../../ranking';

import { PanelScene, UI } from './panelUi';

// Hall of Fame, shop-styled after the Mattle reference: yellow banner title
// plate, your-rank summary card, Gaming/Trading tabs, season selector, and a
// header-bar table with Rank / Player / Perks / Total Points.
export class MainRankingScene extends PanelScene {
  private rankingClient = new RankingClient();
  private scope: RankingScope = 'gaming';
  // null => all-time; '' => current season (resolved server-side).
  private seasonScope: string | null = '';
  private seasonOptions: { id: string | null; label: string }[] = null;
  private data: RankingResponse = null;
  private isLoading = false;

  protected getTitle(): string {
    return '';
  }

  protected load(): void {
    this.isLoading = true;

    this.rankingClient
      .getRankings(this.scope, this.seasonScope === '' ? null : this.seasonScope)
      .then((data) => {
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
    const x = this.pageX;
    const y = this.pageY;

    // Banner plate: yellow slab with dark text, like the reference.
    this.addPanel(x, y - 64, 560, 96, UI.YELLOW, UI.YELLOW_DARK);
    this.addText('HALL OF FAME', x + 34, y - 42, UI.BLACK, 44, '900', 500);

    // Your-rank summary card under the banner.
    this.addPanel(x, y + 44, 560, 96, UI.PANEL, UI.YELLOW_DARK);
    const seasonTag =
      this.data !== null ? `S${this.data.currentSeason.number}` : 'S-';
    this.addText(`GAMING RANK (${seasonTag}):`, x + 24, y + 58, UI.MUTED, 20, '800', 260);
    this.addText('TRADING RANK (ALL):', x + 300, y + 58, UI.MUTED, 20, '800', 240);

    const me = this.data?.me ?? null;
    const gamingRank =
      me === null || me.rank === null ? '--' : `#${me.rank}`;
    const gamingPoints = me === null ? '' : `  ${me.totalPoints}`;
    this.addText(
      `${gamingRank}${this.scope === 'gaming' ? gamingPoints : ''}`,
      x + 24,
      y + 88,
      UI.YELLOW,
      30,
      '900',
      260,
    );
    this.addText('--', x + 300, y + 88, UI.MUTED_LIGHT, 30, '900', 240);

    // Tabs + season selector row.
    const tabsY = y + 168;
    this.addButton(x, tabsY, 190, 48, 'GAMING', 'tab-gaming', () => {
      this.switchScope('gaming');
    }, this.scope === 'gaming');
    this.addButton(x + 210, tabsY, 190, 48, 'TRADING', 'tab-trading', () => {
      this.switchScope('trading');
    }, this.scope === 'trading');

    const seasonLabel = this.getSeasonLabel();
    this.addButton(x + UI.WIDTH - 320, tabsY, 320, 48, `SEASON: ${seasonLabel}`, 'season', () => {
      this.cycleSeason();
    });

    // Leaderboard table.
    const tableY = tabsY + 72;
    this.addTableHeader(x, tableY, UI.WIDTH, [
      { label: 'RANK', offset: 24, width: 100 },
      { label: 'PLAYER', offset: 140, width: 360 },
      { label: 'PERKS', offset: 620, width: 200 },
      { label: 'TOTAL POINTS', offset: UI.WIDTH - 264, width: 240, align: 'right' },
    ]);

    if (this.isLoading) {
      this.addText('LOADING...', x + 24, tableY + 72, UI.MUTED_LIGHT, 24, '800', 400);
      return;
    }

    if (this.data === null) {
      this.addText('RANKINGS UNAVAILABLE', x + 24, tableY + 72, UI.MUTED_LIGHT, 24, '800', 500);
      this.addText('CHECK CONNECTION OR LOGIN', x + 24, tableY + 108, UI.MUTED, 20, '700', 500);
      return;
    }

    if (this.data.rows.length === 0) {
      const emptyText =
        this.scope === 'trading'
          ? 'TRADING RANKS ARRIVE WITH LIVE SWAP VOLUME'
          : 'NO RESULTS YET - PLAY A MATCH';
      this.addText(emptyText, x + 24, tableY + 72, UI.MUTED_LIGHT, 24, '800', 700);
      return;
    }

    this.data.rows.slice(0, 12).forEach((row, index) => {
      const rowY = tableY + 56 + index * 46;
      if (index % 2 === 1) {
        this.addPanel(x, rowY - 8, UI.WIDTH, 44, '#0f0e0a', null);
      }

      const rankColor = row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      this.addText(`${row.rank}`, x + 24, rowY, rankColor, 26, '900', 100);
      this.addText(
        row.displayName.toUpperCase().slice(0, 24),
        x + 140,
        rowY,
        row.rank === 1 ? UI.GREEN : UI.WHITE,
        24,
        '800',
        440,
      );
      this.addText(
        row.perks.length > 0 ? row.perks.join(' ') : '-',
        x + 620,
        rowY,
        UI.MUTED,
        22,
        '700',
        220,
      );
      this.addText(
        `${row.totalPoints}`,
        x + UI.WIDTH - 264,
        rowY,
        row.rank === 1 ? UI.GREEN : UI.YELLOW,
        26,
        '900',
        240,
        'right',
      );
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
    this.load();
    this.refresh(scope === 'gaming' ? 'tab-gaming' : 'tab-trading');
  }

  private cycleSeason(): void {
    if (this.seasonOptions === null) {
      this.seasonScope = this.seasonScope === null ? '' : null;
    } else {
      const currentIndex = this.seasonOptions.findIndex(
        (option) => option.id === this.seasonScope,
      );
      this.seasonScope =
        this.seasonOptions[(currentIndex + 1) % this.seasonOptions.length].id;
    }
    this.load();
    this.refresh('season');
  }
}
