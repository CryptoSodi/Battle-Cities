import { GameObject } from '../../core';
import { GameUpdateArgs } from '../../game';
import { SceneMenu, SceneMenuTitle, SpriteText, TextMenuItem } from '../../gameObjects';
import { RankingClient, RankingResponse, RankingScope } from '../../ranking';
import * as config from '../../config';

import { GameScene } from '../GameScene';

// Hall of Fame (Milestone 2 of the infrastructure plan): Gaming and Trading
// tabs, a season scope toggle, the player's own rank summary, and the ranked
// rows (Rank / Player / Points). Trading rows stay empty until Milestone 5.
export class MainRankingScene extends GameScene {
  private rankingClient = new RankingClient();
  private title: SceneMenuTitle;
  private menu: SceneMenu;
  private scopeItem: TextMenuItem;
  private seasonItem: TextMenuItem;
  private backItem: TextMenuItem;
  private board: GameObject;

  private scope: RankingScope = 'gaming';
  // null => all-time; otherwise a season id ('' means "current", resolved by
  // the server).
  private seasonScope: string | null = '';
  // Cycle order for the season item: current, all-time, then every stored
  // season (newest first). Filled from the first successful response.
  private seasonOptions: { id: string | null; label: string }[] = null;
  private data: RankingResponse = null;
  private isLoading = false;
  private needsRender = false;

  protected setup(): void {
    this.title = new SceneMenuTitle('HALL OF FAME');
    this.root.add(this.title);

    this.board = new GameObject();
    this.board.size.copyFrom(this.root.size);
    this.root.add(this.board);

    this.scopeItem = new TextMenuItem('VIEW: GAMING');
    this.scopeItem.selected.addListener(this.handleScopeSelected);

    this.seasonItem = new TextMenuItem('SEASON: CURRENT');
    this.seasonItem.selected.addListener(this.handleSeasonSelected);

    this.backItem = new TextMenuItem('BACK');
    this.backItem.selected.addListener(this.handleBackSelected);

    this.menu = new SceneMenu();
    this.menu.position.addY(420);
    this.menu.setItems([this.scopeItem, this.seasonItem, this.backItem]);
    this.root.add(this.menu);

    this.load();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.needsRender) {
      this.needsRender = false;
      this.renderBoard();
    }

    super.update(updateArgs);
  }

  private load(): void {
    this.isLoading = true;
    this.data = null;
    this.needsRender = true;

    this.rankingClient
      .getRankings(this.scope, this.seasonScope === '' ? null : this.seasonScope)
      .then((data) => {
        this.data = data;
        this.isLoading = false;
        this.needsRender = true;

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
      });
  }

  // Rebuilds the board text objects from the latest response. Scene objects
  // are cheap SpriteTexts, so a full clear-and-rebuild keeps the logic simple.
  private renderBoard(): void {
    this.board.removeAllChildren();

    if (this.isLoading) {
      this.addLine('LOADING...', 120, config.COLOR_GRAY_LIGHT);
      return;
    }

    if (this.data === null) {
      this.addLine('RANKINGS UNAVAILABLE', 120, config.COLOR_GRAY_LIGHT);
      this.addLine('CHECK CONNECTION OR LOGIN', 156, config.COLOR_GRAY_LIGHT);
      return;
    }

    const selectedSeason = this.data.seasons.find(
      (season) => season.id === this.data.seasonId,
    );
    const seasonLabel =
      this.seasonScope === null
        ? 'ALL TIME'
        : (selectedSeason || this.data.currentSeason).name.toUpperCase();
    this.addLine(
      `${this.scope.toUpperCase()} - ${seasonLabel}`,
      120,
      config.COLOR_YELLOW,
    );

    if (this.data.me !== null) {
      const rankText = this.data.me.rank === null ? '--' : `#${this.data.me.rank}`;
      this.addLine(
        `YOUR RANK ${rankText}  ${this.data.me.totalPoints} PTS`,
        156,
        config.COLOR_WHITE,
      );
    }

    if (this.data.rows.length === 0) {
      const emptyText =
        this.scope === 'trading'
          ? 'TRADING RANKS COMING SOON'
          : 'NO RESULTS YET - PLAY A MATCH';
      this.addLine(emptyText, 220, config.COLOR_GRAY_LIGHT);
      return;
    }

    this.data.rows.slice(0, 10).forEach((row, index) => {
      const y = 220 + index * 36;
      const color = row.rank <= 3 ? config.COLOR_YELLOW : config.COLOR_WHITE;
      const rank = `${row.rank}`.padStart(2, ' ');
      const name = normalizeName(row.displayName).padEnd(16, ' ');
      const points = `${row.totalPoints}`.padStart(7, ' ');

      this.addLine(`${rank}. ${name}${points}`, y, color);
    });
  }

  private addLine(text: string, y: number, color: string): void {
    const line = new SpriteText(text, { color });
    line.position.set(112, y);
    this.board.add(line);
  }

  private handleScopeSelected = (): void => {
    this.scope = this.scope === 'gaming' ? 'trading' : 'gaming';
    this.scopeItem.setText(`VIEW: ${this.scope.toUpperCase()}`);
    this.load();
  };

  private handleSeasonSelected = (): void => {
    // Before the first response arrives only current/all-time can toggle.
    if (this.seasonOptions === null) {
      this.seasonScope = this.seasonScope === null ? '' : null;
      this.seasonItem.setText(
        this.seasonScope === null ? 'SEASON: ALL TIME' : 'SEASON: CURRENT',
      );
      this.load();
      return;
    }

    const currentIndex = this.seasonOptions.findIndex(
      (option) => option.id === this.seasonScope,
    );
    const next = this.seasonOptions[
      (currentIndex + 1) % this.seasonOptions.length
    ];

    this.seasonScope = next.id;
    this.seasonItem.setText(`SEASON: ${next.label}`);
    this.load();
  };

  private handleBackSelected = (): void => {
    this.navigator.back();
  };
}

// The sprite font covers a limited glyph set; keep names to safe uppercase
// characters and a sane length for column alignment.
function normalizeName(value: string): string {
  const name = (value || 'PLAYER').toUpperCase().replace(/[^A-Z0-9 .\-_]/g, '');
  return name.length > 16 ? name.slice(0, 16) : name;
}
