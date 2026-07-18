import {
  StakingClient,
  StakingLeaderboardRow,
  StakingSummary,
} from '../../staking';

import { HeadquartersPanelScene, UI } from './panelUi';

const STAKE_STEP = 500;

export class MainStakingScene extends HeadquartersPanelScene {
  private stakingClient = new StakingClient();
  private summary: StakingSummary = null;
  private leaderboard: StakingLeaderboardRow[] = [];
  private showLeaderboard = false;
  private isLoading = false;

  protected getSectionTitle(): string {
    return 'Staking';
  }

  protected getSectionIcon(): string {
    return 'ui.icon.lock';
  }

  protected getInitialFocusKey(): string {
    return this.showLeaderboard ? 'view-leaderboard' : 'view-stats';
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const activeView = this.showLeaderboard ? 'view-leaderboard' : 'view-stats';
    if (direction > 0 && currentKey === 'back') {
      return activeView;
    }
    if (direction < 0 && currentKey.startsWith('view-')) {
      return 'back';
    }
    return null;
  }

  protected load(): void {
    this.isLoading = true;
    Promise.all([
      this.stakingClient.getSummary(),
      this.stakingClient.getLeaderboard(),
    ]).then(([summary, leaderboard]) => {
      this.summary = summary;
      this.leaderboard = leaderboard;
      this.isLoading = false;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const mobile = this.isMobileLayout();
    const layout = this.renderHeadquartersFrame(mobile ? 1080 : 820);
    const { bodyX, bodyY, bodyWidth } = layout;

    if (this.isLoading) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOADING STAKING...');
      return;
    }
    if (this.summary === null) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOGIN TO ACCESS STAKING');
      return;
    }

    const tabGap = this.scaleSize(12);
    const tabWidth = Math.floor((bodyWidth - tabGap) / 2);
    const tabHeight = this.scaleSize(50);
    this.addButton(
      bodyX,
      bodyY,
      tabWidth,
      tabHeight,
      'YOUR STATS',
      'view-stats',
      () => {
        this.showLeaderboard = false;
        this.refresh('view-stats');
      },
      !this.showLeaderboard,
      'normal',
      this.scaleSize(22),
      true,
    );
    this.addButton(
      bodyX + tabWidth + tabGap,
      bodyY,
      tabWidth,
      tabHeight,
      'LEADERBOARD',
      'view-leaderboard',
      () => {
        this.showLeaderboard = true;
        this.refresh('view-leaderboard');
      },
      this.showLeaderboard,
      'normal',
      this.scaleSize(22),
      true,
    );

    if (this.showLeaderboard) {
      this.renderLeaderboard(
        bodyX,
        bodyY + tabHeight + this.scaleSize(24),
        bodyWidth,
      );
      return;
    }

    this.renderStats(
      bodyX,
      bodyY + tabHeight + this.scaleSize(24),
      bodyWidth,
      mobile,
    );
  }

  private renderStats(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const { epoch, community, me, unstakes } = this.summary;
    const epochHeight = this.scaleSize(84);
    this.addPanel(x, y, width, epochHeight, UI.PAGE, UI.YELLOW_DARK);
    this.addText(
      `EPOCH ${epoch.number}`,
      x + this.scaleSize(20),
      y + this.scaleSize(14),
      UI.GREEN,
      this.scaleSize(24),
      '900',
      this.scaleSize(240),
    );
    this.addText(
      `DAY ${epoch.day}/${epoch.lengthDays}`,
      x + this.scaleSize(20),
      y + this.scaleSize(47),
      UI.MUTED_LIGHT,
      this.scaleSize(18),
      '800',
      this.scaleSize(240),
    );
    this.addText(
      `PERK TIER ${me.perkTier.level}`,
      x + width - this.scaleSize(260),
      y + this.scaleSize(18),
      UI.YELLOW,
      this.scaleSize(24),
      '900',
      this.scaleSize(240),
      'right',
    );
    this.addText(
      `+${me.perkTier.hull}% HULL  +${me.perkTier.armor}% ARMOR  +${me.perkTier.engine}% ENGINE`,
      x + width - this.scaleSize(470),
      y + this.scaleSize(51),
      UI.MUTED_LIGHT,
      this.scaleSize(16),
      '800',
      this.scaleSize(450),
      'right',
    );

    const communityY = y + epochHeight + this.scaleSize(24);
    this.addSectionHeading('Community', x, communityY, width);
    const communityCardsY = communityY + this.scaleSize(58);
    const communityGap = this.scaleSize(12);
    const communityWidth = Math.floor((width - communityGap * 2) / 3);
    const communityStats = [
      {
        label: 'LOCKED TOKENS',
        value: `${community.lockedTokens}`,
        icon: 'shop.coin',
      },
      { label: 'TOTAL SP', value: `${epoch.totalSp}`, icon: null },
      { label: 'REWARD POOL', value: `${epoch.rewardPool}`, icon: 'shop.coin' },
    ];
    communityStats.forEach(({ label, value, icon }, index) => {
      this.addCompactStat(
        x + index * (communityWidth + communityGap),
        communityCardsY,
        communityWidth,
        label,
        value,
        icon,
      );
    });

    const yourY = communityCardsY + this.scaleSize(104 + 24);
    this.addSectionHeading('Your Position', x, yourY, width);
    const actionWidth = mobile ? this.scaleSize(156) : 168;
    this.addButton(
      x + width - actionWidth * 2 - this.scaleSize(12),
      yourY - this.scaleSize(4),
      actionWidth,
      this.scaleSize(46),
      'UNSTAKE',
      'unstake',
      () => this.handleUnstake(),
      false,
      'purchase',
      this.scaleSize(20),
    );
    this.addButton(
      x + width - actionWidth,
      yourY - this.scaleSize(4),
      actionWidth,
      this.scaleSize(46),
      `STAKE ${STAKE_STEP}`,
      'stake',
      () => this.handleStake(),
      false,
      'purchase',
      this.scaleSize(20),
    );

    const yourCardsY = yourY + this.scaleSize(58);
    const columns = mobile ? 2 : 4;
    const statGap = this.scaleSize(12);
    const statWidth = Math.floor((width - statGap * (columns - 1)) / columns);
    const stats = [
      { label: 'YOUR STAKE', value: `${me.staked}` },
      { label: 'LATEST SP', value: `${me.latestSp}` },
      { label: 'TOTAL SP', value: `${me.totalSp}` },
      { label: 'EST. REWARD', value: `${me.estimatedReward}` },
    ];
    stats.forEach(({ label, value }, index) => {
      const cardX = x + (index % columns) * (statWidth + statGap);
      const cardY =
        yourCardsY + Math.floor(index / columns) * this.scaleSize(104 + 12);
      this.addCompactStat(
        cardX,
        cardY,
        statWidth,
        label,
        value,
        null,
        UI.YELLOW,
      );
    });

    const statRows = Math.ceil(stats.length / columns);
    const unstakeY =
      yourCardsY +
      statRows * this.scaleSize(104) +
      (statRows - 1) * statGap +
      this.scaleSize(24);
    this.addSectionHeading('Unstake Positions', x, unstakeY, width);
    const tableY = unstakeY + this.scaleSize(58);
    this.addTableHeader(x, tableY, width, [
      { label: 'BACT', offset: 18, width: Math.round(width * 0.25) },
      {
        label: 'COOLDOWN',
        offset: Math.round(width * 0.38),
        width: Math.round(width * 0.35),
      },
      { label: 'STATUS', offset: width - 190, width: 172, align: 'right' },
    ]);

    if (unstakes.length === 0) {
      this.addText(
        'NO OPEN UNSTAKE POSITIONS',
        x,
        tableY + this.scaleSize(72),
        UI.MUTED,
        this.scaleSize(21),
        '800',
        width,
        'center',
      );
      return;
    }

    unstakes.slice(0, 3).forEach((position, index) => {
      const rowY = tableY + this.scaleSize(54 + index * 50);
      this.addPanel(
        x,
        rowY,
        width,
        this.scaleSize(46),
        index % 2 === 0 ? UI.PAGE : UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      this.addText(
        `${position.amount}`,
        x + 18,
        rowY + 11,
        UI.WHITE,
        this.scaleSize(20),
        '800',
        Math.round(width * 0.25),
      );
      this.addText(
        position.claimable
          ? 'COOLDOWN COMPLETE'
          : `UNLOCKS ${position.claimableAt.slice(0, 10)}`,
        x + Math.round(width * 0.38),
        rowY + 12,
        UI.MUTED_LIGHT,
        this.scaleSize(18),
        '800',
        Math.round(width * 0.38),
      );
      this.addText(
        position.claimable ? 'READY' : 'LOCKED',
        x + width - 190,
        rowY + 11,
        position.claimable ? UI.GREEN : UI.MUTED,
        this.scaleSize(20),
        '900',
        172,
        'right',
      );
    });

    if (unstakes.some((position) => position.claimable)) {
      this.addButton(
        x + width - this.scaleSize(190),
        tableY + this.scaleSize(54 + Math.min(3, unstakes.length) * 50 + 10),
        this.scaleSize(190),
        this.scaleSize(46),
        'CLAIM ALL',
        'claim',
        () => this.handleClaim(),
        false,
        'purchase',
        this.scaleSize(20),
      );
    }
  }

  private renderLeaderboard(x: number, y: number, width: number): void {
    this.addSectionHeading('SP Leaderboard', x, y, width);
    const tableY = y + this.scaleSize(58);
    this.addTableHeader(x, tableY, width, [
      { label: 'RANK', offset: 18, width: 92 },
      {
        label: 'COMMANDER',
        offset: Math.round(width * 0.17),
        width: Math.round(width * 0.38),
      },
      {
        label: 'STAKE',
        offset: Math.round(width * 0.6),
        width: Math.round(width * 0.18),
      },
      { label: 'TOTAL SP', offset: width - 190, width: 172, align: 'right' },
    ]);
    if (this.leaderboard.length === 0) {
      this.addText(
        'NO STAKERS YET',
        x,
        tableY + this.scaleSize(74),
        UI.MUTED_LIGHT,
        this.scaleSize(23),
        '800',
        width,
        'center',
      );
      return;
    }
    this.leaderboard.slice(0, 10).forEach((row, index) => {
      const rowY = tableY + this.scaleSize(54 + index * 52);
      this.addPanel(
        x,
        rowY,
        width,
        this.scaleSize(48),
        index % 2 === 0 ? UI.PAGE : UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      const rankColor =
        row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      this.addText(
        `${row.rank}`,
        x + 18,
        rowY + 11,
        rankColor,
        this.scaleSize(21),
        '900',
        92,
      );
      this.addText(
        row.displayName.toUpperCase().slice(0, 20),
        x + Math.round(width * 0.17),
        rowY + 12,
        UI.WHITE,
        this.scaleSize(19),
        '800',
        Math.round(width * 0.38),
      );
      this.addText(
        `${row.staked}`,
        x + Math.round(width * 0.6),
        rowY + 11,
        UI.WHITE,
        this.scaleSize(20),
        '800',
        Math.round(width * 0.18),
      );
      this.addText(
        `${row.totalSp}`,
        x + width - 190,
        rowY + 11,
        UI.YELLOW,
        this.scaleSize(21),
        '900',
        172,
        'right',
      );
    });
  }

  private addCompactStat(
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    iconId: string = null,
    valueColor = UI.WHITE,
  ): void {
    const height = this.scaleSize(104);
    this.addPanel(x, y, width, height, UI.CARD, UI.PANEL_LINE);
    this.addText(
      label,
      x + this.scaleSize(14),
      y + this.scaleSize(13),
      UI.MUTED,
      this.scaleSize(17),
      '800',
      width - this.scaleSize(28),
    );
    const iconSpace = iconId === null ? 0 : this.scaleSize(38);
    this.addText(
      value,
      x + this.scaleSize(14),
      y + this.scaleSize(47),
      valueColor,
      this.scaleSize(28),
      '900',
      width - this.scaleSize(28) - iconSpace,
    );
    if (iconId !== null) {
      this.addIcon(
        iconId,
        x + width - this.scaleSize(48),
        y + this.scaleSize(48),
        this.scaleSize(34),
      );
    }
  }

  private renderMessage(
    x: number,
    y: number,
    width: number,
    text: string,
  ): void {
    this.addPanel(x, y, width, this.scaleSize(128), UI.PAGE, UI.PANEL_LINE);
    this.addText(
      text,
      x,
      y + this.scaleSize(48),
      UI.MUTED_LIGHT,
      this.scaleSize(24),
      '800',
      width,
      'center',
    );
  }

  private handleStake(): void {
    this.stakingClient.stake(STAKE_STEP).then((result) => {
      this.setStatus(
        result.ok
          ? `STAKED ${STAKE_STEP} BACT`
          : (result.error || 'FAILED').toUpperCase(),
      );
      if (result.ok) {
        this.load();
      }
    });
  }

  private handleUnstake(): void {
    this.stakingClient.unstake(STAKE_STEP).then((result) => {
      this.setStatus(
        result.ok
          ? `UNSTAKING ${STAKE_STEP} - 10 DAY COOLDOWN`
          : (result.error || 'FAILED').toUpperCase(),
      );
      if (result.ok) {
        this.load();
      }
    });
  }

  private handleClaim(): void {
    this.stakingClient.claimUnstaked().then((result) => {
      this.setStatus(
        result.ok && result.amount > 0
          ? `CLAIMED ${result.amount} BACT`
          : 'NOTHING CLAIMABLE YET',
      );
      if (result.ok && result.amount > 0) {
        this.load();
      }
    });
  }
}
