import { StakingClient, StakingLeaderboardRow, StakingSummary } from '../../staking';

import { PanelScene, UI } from './panelUi';

const STAKE_STEP = 500;

// Staking, shop-styled after the Mattle reference: epoch/day eyebrow over the
// title, Community Stats column of stat cards, Your Stats card row with
// Stake/Unstake actions, and an Unstake Position table.
export class MainStakingScene extends PanelScene {
  private stakingClient = new StakingClient();
  private summary: StakingSummary = null;
  private leaderboard: StakingLeaderboardRow[] = [];
  private showLeaderboard = false;
  private isLoading = false;

  protected getTitle(): string {
    return 'Staking';
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
    const x = this.pageX;
    const y = this.pageY;

    if (this.isLoading) {
      this.addText('LOADING...', x + 16, y + 60, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    if (this.summary === null) {
      this.addText('STAKING UNAVAILABLE - LOGIN REQUIRED', x + 16, y + 60, UI.MUTED_LIGHT, 26, '800', 700);
      return;
    }

    const { epoch, community, me, unstakes } = this.summary;

    // Epoch eyebrow above the page title area.
    this.addText(
      `EPOCH ${epoch.number} - DAY ${epoch.day}/${epoch.lengthDays}`,
      x + 18,
      y - 96,
      UI.MUTED_LIGHT,
      22,
      '800',
      420,
    );

    if (this.showLeaderboard) {
      this.renderLeaderboard(x, y);
      return;
    }

    // Shell panel.
    this.addPanel(x, y + 20, UI.WIDTH, 560, UI.PANEL, UI.PANEL_LINE);

    // Left column: community stats.
    const leftX = x + 28;
    this.addText('COMMUNITY STATS', leftX, y + 44, UI.MUTED, 24, '800', 300);
    this.addStatCard(leftX, y + 88, 280, 96, 'LOCKED TOKENS', `${community.lockedTokens}`, UI.WHITE, 'shop.coin');
    this.addStatCard(leftX, y + 200, 280, 96, 'STAKING POINT (SP)', `${epoch.totalSp}`);
    this.addStatCard(leftX, y + 312, 280, 96, 'EPOCH REWARD', `${epoch.rewardPool}`, UI.WHITE, 'shop.coin');
    this.addButton(leftX, y + 428, 280, 48, 'LEADERBOARD', 'leaderboard', () => {
      this.showLeaderboard = true;
      this.refresh('back-stats');
    });

    // Divider.
    this.addPanel(x + 336, y + 44, 2, 512, UI.PANEL_LINE, null);

    // Right column: your stats + actions.
    const rightX = x + 372;
    this.addText('YOUR STATS', rightX, y + 44, UI.MUTED, 24, '800', 300);

    this.addButton(x + UI.WIDTH - 344, y + 36, 150, 48, 'UNSTAKE', 'unstake', () => {
      this.handleUnstake();
    });
    this.addButton(x + UI.WIDTH - 178, y + 36, 150, 48, `STAKE ${STAKE_STEP}`, 'stake', () => {
      this.handleStake();
    }, true);

    const cardWidth = 196;
    const cardGap = 22;
    this.addStatCard(rightX, y + 100, cardWidth, 96, 'YOUR STAKE', `${me.staked}`, UI.WHITE, 'shop.coin');
    this.addStatCard(rightX + (cardWidth + cardGap), y + 100, cardWidth, 96, 'LATEST SP', `${me.latestSp}`);
    this.addStatCard(rightX + (cardWidth + cardGap) * 2, y + 100, cardWidth, 96, 'TOTAL SP', `${me.totalSp}`);
    this.addStatCard(rightX + (cardWidth + cardGap) * 3, y + 100, cardWidth, 96, 'EST. REWARD', `${me.estimatedReward}`, UI.YELLOW, 'shop.coin');

    this.addText(
      `PERK TIER ${me.perkTier.level}: +${me.perkTier.hull}% HULL  +${me.perkTier.armor}% ARMOR  +${me.perkTier.engine}% ENGINE  +${me.perkTier.salvage}% SALVAGE`,
      rightX,
      y + 216,
      UI.MUTED_LIGHT,
      20,
      '800',
      840,
    );

    // Unstake positions table.
    this.addText('UNSTAKE POSITION', rightX, y + 268, UI.MUTED, 24, '800', 400);
    const tableWidth = UI.WIDTH - (rightX - x) - 28;
    this.addTableHeader(rightX, y + 308, tableWidth, [
      { label: 'BACT', offset: 20, width: 160 },
      { label: 'COOLDOWN', offset: Math.round(tableWidth / 2) - 60, width: 240 },
      { label: 'ACTION', offset: tableWidth - 180, width: 160, align: 'right' },
    ]);

    if (unstakes.length === 0) {
      this.addText(
        'YOU HAVE NO POSITION OPEN',
        rightX,
        y + 380,
        UI.MUTED,
        22,
        '700',
        tableWidth,
        'center',
      );
      return;
    }

    const claimable = unstakes.some((position) => position.claimable);
    unstakes.slice(0, 3).forEach((position, index) => {
      const rowY = y + 364 + index * 46;
      this.addText(`${position.amount}`, rightX + 20, rowY, UI.WHITE, 24, '800', 160);
      this.addText(
        position.claimable ? 'READY' : `UNLOCKS ${position.claimableAt.slice(0, 10)}`,
        rightX + Math.round(tableWidth / 2) - 60,
        rowY,
        position.claimable ? UI.GREEN : UI.MUTED_LIGHT,
        22,
        '800',
        260,
      );
    });

    if (claimable) {
      this.addButton(rightX + tableWidth - 190, y + 356, 190, 48, 'CLAIM ALL', 'claim', () => {
        this.handleClaim();
      }, true);
    }
  }

  private renderLeaderboard(x: number, y: number): void {
    this.addPanel(x, y + 20, UI.WIDTH, 560, UI.PANEL, UI.PANEL_LINE);
    this.addText('SP LEADERBOARD', x + 28, y + 44, UI.MUTED, 24, '800', 400);
    this.addButton(x + UI.WIDTH - 208, y + 36, 180, 48, 'YOUR STATS', 'back-stats', () => {
      this.showLeaderboard = false;
      this.refresh('leaderboard');
    });

    const tableWidth = UI.WIDTH - 56;
    this.addTableHeader(x + 28, y + 96, tableWidth, [
      { label: 'RANK', offset: 20, width: 100 },
      { label: 'WALLET', offset: 140, width: 360 },
      { label: 'STAKE AMOUNT', offset: Math.round(tableWidth / 2), width: 240 },
      { label: 'TOTAL SP', offset: tableWidth - 220, width: 200, align: 'right' },
    ]);

    if (this.leaderboard.length === 0) {
      this.addText('NO STAKERS YET', x + 28, y + 168, UI.MUTED_LIGHT, 24, '800', 400);
      return;
    }

    this.leaderboard.slice(0, 9).forEach((row, index) => {
      const rowY = y + 152 + index * 46;
      if (index % 2 === 1) {
        this.addPanel(x + 28, rowY - 8, tableWidth, 44, '#0f0e0a', null);
      }
      const rankColor = row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      this.addText(`${row.rank}`, x + 48, rowY, rankColor, 24, '900', 100);
      this.addText(row.displayName.toUpperCase().slice(0, 20), x + 168, rowY, UI.WHITE, 22, '800', 380);
      this.addText(`${row.staked}`, x + 28 + Math.round(tableWidth / 2), rowY, UI.WHITE, 24, '800', 220);
      this.addText(`${row.totalSp}`, x + 28 + tableWidth - 220, rowY, UI.YELLOW, 24, '900', 200, 'right');
    });
  }

  private handleStake(): void {
    this.stakingClient.stake(STAKE_STEP).then((result) => {
      this.setStatus(
        result.ok ? `STAKED ${STAKE_STEP} BACT` : (result.error || 'FAILED').toUpperCase(),
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
