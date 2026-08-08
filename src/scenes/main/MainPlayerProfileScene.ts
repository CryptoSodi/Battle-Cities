import * as config from '../../config';
import {
  PlayerProfileClient,
  PlayerProfileRequestError,
  PublicMatch,
  PublicProfile,
} from '../../playerProfile';
import { GameUpdateArgs } from '../../game';
import { MapConfig, MapLoader } from '../../map';
import { SavedReplay } from '../../replay';

import { PanelScene, UI } from './panelUi';
import { GameSceneType } from '../GameSceneType';

const MOBILE_WIDTH = 744;
const DESKTOP_WIDTH = UI.WIDTH;
const FALLBACK_VISIBLE_MATCHES = 5;

export interface PlayerProfileSceneParams {
  playerId: string;
}

export class MainPlayerProfileScene extends PanelScene {
  private readonly profileClient = new PlayerProfileClient();
  private profile: PublicProfile = null;
  private isLoading = false;
  private errorMessage = '';
  private loadRequestId = 0;
  private matchScrollRow = 0;
  private visibleMatchRows = FALLBACK_VISIBLE_MATCHES;
  private mapLoader: MapLoader;
  private isLoadingReplay = false;

  protected setup(updateArgs: GameUpdateArgs): void {
    this.mapLoader = updateArgs.mapLoader;
    super.setup(updateArgs);
  }

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return this.isMobileLayout() ? MOBILE_WIDTH : DESKTOP_WIDTH;
  }

  protected getPageTop(): number {
    return this.isMobileLayout() ? 76 : 96;
  }

  protected getBackButtonY(): number {
    return this.isMobileLayout() ? 8 : 39;
  }

  protected getBackButtonWidth(): number {
    return this.isMobileLayout() ? 152 : 140;
  }

  protected getBackButtonRightInset(): number {
    return this.isMobileLayout() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return this.isMobileLayout() ? 60 : 58;
  }

  protected getInitialFocusKey(): string {
    return 'share-profile';
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    if (!currentKey.startsWith('profile-match:') || this.profile === null) {
      return null;
    }

    const currentIndex = Number(currentKey.slice('profile-match:'.length));
    if (!Number.isInteger(currentIndex)) {
      return null;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0) {
      return 'share-profile';
    }
    if (targetIndex >= this.profile.recentMatches.length) {
      return null;
    }

    let nextScrollRow = this.matchScrollRow;
    if (targetIndex < this.matchScrollRow) {
      nextScrollRow = targetIndex;
    } else if (targetIndex >= this.matchScrollRow + this.visibleMatchRows) {
      nextScrollRow = targetIndex - this.visibleMatchRows + 1;
    }

    const targetKey = this.getMatchKey(targetIndex);
    if (nextScrollRow !== this.matchScrollRow) {
      this.matchScrollRow = nextScrollRow;
      this.refresh(targetKey);
    }
    return targetKey;
  }

  protected handleTouchScroll(direction: number): boolean {
    if (!this.isMobileLayout() || this.profile === null) {
      return false;
    }

    const maxScrollRow = Math.max(
      0,
      this.profile.recentMatches.length - this.visibleMatchRows,
    );
    const nextScrollRow = Math.max(
      0,
      Math.min(this.matchScrollRow + direction, maxScrollRow),
    );
    if (nextScrollRow === this.matchScrollRow) {
      return false;
    }

    this.matchScrollRow = nextScrollRow;
    this.refresh(this.getMatchKey(nextScrollRow));
    return true;
  }

  protected load(): void {
    const playerId = (this.params as PlayerProfileSceneParams).playerId;
    if (typeof playerId !== 'string' || playerId.trim() === '') {
      this.errorMessage = 'INVALID PLAYER PROFILE';
      this.refresh('back');
      return;
    }

    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.errorMessage = '';
    this.profile = null;
    this.matchScrollRow = 0;

    this.profileClient
      .getProfile(playerId)
      .then((profile) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.profile = profile;
        this.isLoading = false;
        this.refresh('share-profile');
      })
      .catch((error) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.isLoading = false;
        this.errorMessage =
          error instanceof PlayerProfileRequestError && error.status === 404
            ? 'PLAYER NOT FOUND'
            : 'PROFILE SERVICE UNAVAILABLE';
        this.refresh('retry-profile');
      });
  }

  protected renderContent(): void {
    const mobile = this.isMobileLayout();
    const x = this.pageX;
    const width = this.getContentWidth();
    this.renderHeaderLabel(x, mobile);
    this.renderContentShell(x, mobile ? 76 : 104, width, mobile ? 12 : 18);

    if (this.isLoading) {
      this.renderLoading(x, mobile ? 96 : 126, width);
      return;
    }
    if (this.profile === null) {
      this.renderError(x, mobile ? 96 : 126, width);
      return;
    }

    if (mobile) {
      this.renderMobileProfile(x, width);
      return;
    }
    this.renderDesktopProfile(x, width);
  }

  private isMobileLayout(): boolean {
    return config.isMobileTouchViewport();
  }

  private renderHeaderLabel(x: number, mobile: boolean): void {
    const y = mobile ? 8 : 39;
    const width = mobile ? 350 : 360;
    const height = mobile ? 60 : 58;
    this.addPanel(x, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    this.addText(
      'PLAYER PROFILE',
      x + 18,
      y + (mobile ? 17 : 15),
      UI.WHITE,
      mobile ? 28 : 27,
      '900',
      width - 36,
      'center',
    );
  }

  private renderContentShell(
    x: number,
    y: number,
    width: number,
    bottomInset: number,
  ): void {
    const sideInset = this.isMobileLayout() ? 12 : 8;
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

  private renderDesktopProfile(x: number, width: number): void {
    const heroY = 122;
    this.renderHero(x, heroY, width, 126, false);

    const statY = heroY + 142;
    const gap = 12;
    const statWidth = Math.floor((width - gap * 3) / 4);
    this.renderStats(x, statY, statWidth, 94, gap, false);

    const logTitleY = statY + 116;
    this.renderBattleLogTitle(x, logTitleY, width, false);
    const headerY = logTitleY + 42;
    this.renderMatchHeader(x, headerY, width, false);
    this.renderMatches(x, headerY + 48, width, false);
  }

  private renderMobileProfile(x: number, width: number): void {
    const heroY = 92;
    this.renderHero(x, heroY, width, 140, true);

    const statY = heroY + 154;
    const gap = 8;
    const statWidth = Math.floor((width - gap) / 2);
    this.renderStats(x, statY, statWidth, 84, gap, true);

    const logTitleY = statY + 188;
    this.renderBattleLogTitle(x, logTitleY, width, true);
    const headerY = logTitleY + 42;
    this.renderMatchHeader(x, headerY, width, true);
    this.renderMatches(x, headerY + 54, width, true);
  }

  private renderHero(
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    const profile = this.profile;
    this.addPanel(x, y, width, height, UI.PAGE, UI.PANEL_LINE);

    const avatarSize = mobile ? 88 : 92;
    const avatarX = x + (mobile ? 18 : 24);
    const avatarY = y + Math.floor((height - avatarSize) / 2);
    this.addPanel(
      avatarX,
      avatarY,
      avatarSize,
      avatarSize,
      UI.PANEL_RAISED,
      UI.YELLOW_DARK,
    );
    this.addText(
      this.getInitials(profile.displayName),
      avatarX,
      avatarY + (mobile ? 24 : 25),
      UI.YELLOW_LIGHT,
      mobile ? 34 : 35,
      '900',
      avatarSize,
      'center',
    );

    const identityX = avatarX + avatarSize + (mobile ? 20 : 26);
    const actionWidth = mobile ? 170 : 190;
    const identityWidth = width - (identityX - x) - actionWidth - 44;
    this.addText(
      (profile.displayName || 'PLAYER').toUpperCase(),
      identityX,
      y + (mobile ? 17 : 19),
      UI.GREEN,
      mobile ? 31 : 34,
      '900',
      identityWidth,
    );
    this.addText(
      `${this.getProviderLabel(profile.provider)}  |  JOINED ${this.formatDate(
        profile.joinedAt,
      )}`,
      identityX,
      y + (mobile ? 60 : 65),
      UI.MUTED_LIGHT,
      mobile ? 18 : 19,
      '800',
      identityWidth,
    );
    this.addText(
      this.shortenPlayerId(profile.walletAddress || profile.id, mobile),
      identityX,
      y + (mobile ? 91 : 94),
      UI.MUTED,
      mobile ? 16 : 17,
      '700',
      identityWidth,
    );

    this.addButton(
      x + width - actionWidth - (mobile ? 18 : 24),
      y + Math.floor((height - 50) / 2),
      actionWidth,
      50,
      'SHARE PROFILE',
      'share-profile',
      () => void this.shareProfile(),
      false,
      'normal',
      mobile ? 21 : 22,
    );
  }

  private renderStats(
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    gap: number,
    mobile: boolean,
  ): void {
    const stats = [
      {
        label: 'SEASON RANK',
        value: this.formatRank(this.profile.stats.currentSeason.rank),
        note: this.profile.stats.currentSeason.name,
        color: UI.YELLOW,
      },
      {
        label: 'GAME POINTS',
        value: this.formatNumber(this.profile.stats.allTime.totalPoints),
        note: 'ALL TIME',
        color: UI.GREEN,
      },
      {
        label: 'MATCHES',
        value: this.formatNumber(this.profile.stats.allTime.matches),
        note: 'RECORDED RUNS',
        color: UI.WHITE,
      },
      {
        label: 'BEST SCORE',
        value: this.formatNumber(this.profile.highscores.primary),
        note: 'PRIMARY MODE',
        color: UI.YELLOW,
      },
    ];

    stats.forEach((stat, index) => {
      const column = mobile ? index % 2 : index;
      const row = mobile ? Math.floor(index / 2) : 0;
      const cardX = x + column * (cardWidth + gap);
      const cardY = y + row * (cardHeight + gap);
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      this.addText(
        stat.label,
        cardX + 14,
        cardY + 10,
        UI.MUTED,
        mobile ? 17 : 18,
        '800',
        cardWidth - 28,
      );
      this.addText(
        stat.value,
        cardX + 14,
        cardY + (mobile ? 33 : 37),
        stat.color,
        mobile ? 27 : 30,
        '900',
        cardWidth - 28,
      );
      this.addText(
        stat.note.toUpperCase(),
        cardX + 14,
        cardY + cardHeight - 24,
        UI.MUTED,
        mobile ? 14 : 15,
        '700',
        cardWidth - 28,
        'right',
      );
    });
  }

  private renderBattleLogTitle(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    this.addText(
      'RECENT BATTLES',
      x + 8,
      y,
      UI.WHITE,
      mobile ? 28 : 29,
      '900',
      width / 2,
    );
    const count = this.profile.recentMatches.length;
    this.addText(
      `${count} ${count === 1 ? 'RECORD' : 'RECORDS'}`,
      x + width / 2,
      y + 4,
      UI.MUTED,
      mobile ? 18 : 19,
      '800',
      width / 2 - 8,
      'right',
    );
  }

  private renderMatchHeader(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const height = mobile ? 52 : 44;
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    const textY = y + (mobile ? 15 : 11);
    if (mobile) {
      this.addText('RESULT', x + 20, textY, UI.MUTED, 18, '800', 120);
      this.addText('STAGE', x + 190, textY, UI.MUTED, 18, '800', 100);
      this.addText('SCORE', x + 330, textY, UI.MUTED, 18, '800', 130);
      this.addText(
        'PLAYED / REPLAY',
        x + width - 190,
        textY,
        UI.MUTED,
        18,
        '800',
        170,
        'right',
      );
      return;
    }

    this.addText('RESULT', x + 28, textY, UI.MUTED, 18, '800', 130);
    this.addText('MODE', x + 190, textY, UI.MUTED, 18, '800', 130);
    this.addText('STAGE', x + 360, textY, UI.MUTED, 18, '800', 100);
    this.addText('SCORE', x + 520, textY, UI.MUTED, 18, '800', 150);
    this.addText('POINTS', x + 720, textY, UI.MUTED, 18, '800', 150);
    this.addText(
      'PLAYED / REPLAY',
      x + width - 260,
      textY,
      UI.MUTED,
      18,
      '800',
      230,
      'right',
    );
  }

  private renderMatches(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const matches = this.profile.recentMatches;
    if (matches.length === 0) {
      this.addPanel(x, y, width, 108, UI.PAGE, UI.PANEL_LINE);
      this.addText(
        'NO RECORDED BATTLES YET',
        x + 20,
        y + 38,
        UI.MUTED_LIGHT,
        mobile ? 23 : 24,
        '800',
        width - 40,
        'center',
      );
      return;
    }

    const rowHeight = mobile ? 72 : 58;
    const bottomInset = mobile ? 24 : 22;
    this.visibleMatchRows = Math.max(
      1,
      Math.floor((this.root.size.height - y - bottomInset) / rowHeight),
    );
    const maxScrollRow = Math.max(0, matches.length - this.visibleMatchRows);
    this.matchScrollRow = Math.max(
      0,
      Math.min(this.matchScrollRow, maxScrollRow),
    );

    matches
      .slice(this.matchScrollRow, this.matchScrollRow + this.visibleMatchRows)
      .forEach((match, visibleIndex) => {
        const matchIndex = this.matchScrollRow + visibleIndex;
        const rowY = y + visibleIndex * rowHeight;
        this.addButton(
          x,
          rowY,
          width,
          rowHeight - 4,
          '',
          this.getMatchKey(matchIndex),
          () => this.openMatchReplay(match),
          false,
          'normal',
          1,
        );
        this.renderMatchRow(match, x, rowY, width, mobile);
      });
  }

  private renderMatchRow(
    match: PublicMatch,
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const color = match.won ? UI.GREEN : UI.RED_BORDER;
    const textY = y + (mobile ? 23 : 16);
    this.addText(
      match.won ? 'VICTORY' : 'DEFEAT',
      x + (mobile ? 20 : 28),
      textY,
      color,
      mobile ? 21 : 22,
      '900',
      mobile ? 145 : 130,
    );
    if (mobile) {
      this.addText(
        `S${match.levelNumber}`,
        x + 190,
        textY,
        UI.WHITE,
        21,
        '800',
        100,
      );
      this.addText(
        this.formatNumber(match.score),
        x + 330,
        textY,
        UI.YELLOW,
        21,
        '900',
        140,
      );
      this.addText(
        this.getReplayLabel(match),
        x + width - 190,
        textY,
        match.replayAvailable ? UI.YELLOW : UI.MUTED_LIGHT,
        19,
        '800',
        170,
        'right',
      );
      return;
    }

    this.addText(
      match.mode === 'multi' ? 'MULTI' : 'SINGLE',
      x + 190,
      textY,
      UI.MUTED_LIGHT,
      21,
      '800',
      130,
    );
    this.addText(
      `${match.levelNumber}`,
      x + 360,
      textY,
      UI.WHITE,
      21,
      '800',
      100,
    );
    this.addText(
      this.formatNumber(match.score),
      x + 520,
      textY,
      UI.YELLOW,
      21,
      '900',
      150,
    );
    this.addText(
      this.formatNumber(match.gamePoints),
      x + 720,
      textY,
      UI.GREEN,
      21,
      '900',
      150,
    );
    this.addText(
      this.getReplayLabel(match),
      x + width - 260,
      textY,
      match.replayAvailable ? UI.YELLOW : UI.MUTED_LIGHT,
      20,
      '800',
      230,
      'right',
    );
  }

  private renderLoading(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 170, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      'LOADING PLAYER PROFILE...',
      x + 24,
      y + 65,
      UI.MUTED_LIGHT,
      25,
      '800',
      width - 48,
      'center',
    );
  }

  private renderError(x: number, y: number, width: number): void {
    this.addPanel(x, y, width, 190, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      this.errorMessage || 'PROFILE UNAVAILABLE',
      x + 24,
      y + 36,
      UI.RED_BORDER,
      27,
      '900',
      width - 48,
      'center',
    );
    this.addText(
      'CHECK YOUR CONNECTION, THEN TRY AGAIN',
      x + 24,
      y + 78,
      UI.MUTED,
      19,
      '800',
      width - 48,
      'center',
    );
    this.addButton(
      x + Math.floor((width - 200) / 2),
      y + 124,
      200,
      48,
      'RETRY',
      'retry-profile',
      () => this.load(),
      false,
      'normal',
      22,
    );
  }

  private async shareProfile(): Promise<void> {
    const url = `${window.location.origin}/player-profile/${encodeURIComponent(
      this.profile.id,
    )}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `${this.profile.displayName} | Battle Cities`,
          text: `View ${this.profile.displayName}'s Battle Cities combat record.`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.setStatus('PROFILE LINK COPIED');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        this.setStatus('PROFILE SHARE UNAVAILABLE');
      }
    }
  }

  private async openMatchReplay(match: PublicMatch): Promise<void> {
    if (!match.replayAvailable) {
      this.setStatus('REPLAY UNAVAILABLE FOR THIS BATTLE');
      return;
    }
    if (this.isLoadingReplay) {
      return;
    }

    this.isLoadingReplay = true;
    this.setStatus('LOADING REPLAY...');
    try {
      const replay = await this.profileClient.getReplay(this.profile.id, match.id);
      this.loadReplayMap(replay);
    } catch {
      this.isLoadingReplay = false;
      this.setStatus('REPLAY UNAVAILABLE FOR THIS BATTLE');
    }
  }

  private loadReplayMap(replay: SavedReplay): void {
    const handleLoaded = (mapConfig: MapConfig): void => {
      this.mapLoader.error.removeListener(handleError);
      this.navigator.push(GameSceneType.LevelPlay, { mapConfig, replay });
    };
    const handleError = (): void => {
      this.mapLoader.loaded.removeListener(handleLoaded);
      this.isLoadingReplay = false;
      this.setStatus('REPLAY MAP UNAVAILABLE');
    };

    this.mapLoader.loaded.addListenerOnce(handleLoaded);
    this.mapLoader.error.addListenerOnce(handleError);
    this.mapLoader.loadAsync(replay.levelNumber);
  }

  private getReplayLabel(match: PublicMatch): string {
    const date = this.formatShortDate(match.createdAt);
    return match.replayAvailable ? `WATCH · ${date}` : date;
  }

  private getMatchKey(index: number): string {
    return `profile-match:${index}`;
  }

  private getInitials(displayName: string): string {
    const parts = (displayName || 'BC')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    return (
      parts
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'BC'
    );
  }

  private getProviderLabel(provider: PublicProfile['provider']): string {
    if (provider === 'google') return 'GOOGLE PLAYER';
    if (provider === 'wallet') return 'WALLET PLAYER';
    return 'GUEST PLAYER';
  }

  private shortenPlayerId(value: string, mobile: boolean): string {
    const limit = mobile ? 26 : 42;
    if (value.length <= limit) {
      return value;
    }
    const side = Math.floor((limit - 3) / 2);
    return `${value.slice(0, side)}...${value.slice(-side)}`;
  }

  private formatRank(rank: number | null): string {
    return rank === null ? '--' : `#${this.formatNumber(rank)}`;
  }

  private formatNumber(value: number): string {
    return Math.max(0, Number(value) || 0).toLocaleString('en-US');
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'UNKNOWN'
      : new Intl.DateTimeFormat('en', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
          .format(date)
          .toUpperCase();
  }

  private formatShortDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '--'
      : new Intl.DateTimeFormat('en', {
          day: '2-digit',
          month: 'short',
        })
          .format(date)
          .toUpperCase();
  }
}
