import { TextMenuItem } from '../../gameObjects';
import { StakingClient, StakingLeaderboardRow, StakingSummary } from '../../staking';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

const STAKE_STEP = 500;

// Utility staking (Milestone 4, dev/off-chain): epoch header, community and
// personal stats, unstake cooldown positions, perk tiers, SP leaderboard.
export class MainStakingScene extends BoardScene {
  private stakingClient = new StakingClient();
  private summary: StakingSummary = null;
  private leaderboard: StakingLeaderboardRow[] = [];
  private showLeaderboard = false;
  private boardItem: TextMenuItem;

  protected getTitle(): string {
    return 'STAKING';
  }

  protected createMenuItems(): TextMenuItem[] {
    const stakeItem = new TextMenuItem(`STAKE ${STAKE_STEP}`);
    stakeItem.selected.addListener(this.handleStake);

    const unstakeItem = new TextMenuItem(`UNSTAKE ${STAKE_STEP}`);
    unstakeItem.selected.addListener(this.handleUnstake);

    const claimItem = new TextMenuItem('CLAIM UNSTAKED');
    claimItem.selected.addListener(this.handleClaim);

    this.boardItem = new TextMenuItem('SP LEADERBOARD');
    this.boardItem.selected.addListener(this.handleToggleLeaderboard);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [stakeItem, unstakeItem, claimItem, this.boardItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    Promise.all([
      this.stakingClient.getSummary(),
      this.stakingClient.getLeaderboard(),
    ]).then(([summary, leaderboard]) => {
      this.summary = summary;
      this.leaderboard = leaderboard;
      this.isLoading = false;
      this.requestRender();
    });
  }

  protected renderBoard(): void {
    if (this.summary === null) {
      this.addLine('STAKING UNAVAILABLE - LOGIN REQUIRED', 140, config.COLOR_GRAY_LIGHT);
      return;
    }

    if (this.showLeaderboard) {
      this.renderLeaderboard();
      return;
    }

    const { epoch, community, me, unstakes } = this.summary;

    this.addLine(
      `EPOCH ${epoch.number} - DAY ${epoch.day}/${epoch.lengthDays}`,
      120,
      config.COLOR_YELLOW,
    );
    this.addLine(`LOCKED ${community.lockedTokens}   TOTAL SP ${epoch.totalSp}`, 152);
    this.addLine(`EPOCH REWARD ${epoch.rewardPool} BCT`, 184);

    this.addLine('YOUR STATS', 232, config.COLOR_YELLOW);
    this.addLine(`YOUR STAKE ${me.staked}`, 264);
    this.addLine(`LATEST SP ${me.latestSp}   TOTAL SP ${me.totalSp}`, 296);
    this.addLine(`EST REWARD ${me.estimatedReward} BCT`, 328);
    this.addLine(
      `PERK TIER ${me.perkTier.level}: +${me.perkTier.hull}% HULL +${me.perkTier.armor}% ARMOR`,
      360,
    );

    this.addLine('UNSTAKE POSITIONS', 408, config.COLOR_YELLOW);
    if (unstakes.length === 0) {
      this.addLine('NONE', 440, config.COLOR_GRAY_LIGHT);
    }
    unstakes.slice(0, 3).forEach((position, index) => {
      this.addLine(
        `${position.amount} - ${
          position.claimable
            ? 'CLAIMABLE'
            : `UNLOCKS ${position.claimableAt.slice(0, 10)}`
        }`,
        440 + index * 32,
        position.claimable ? config.COLOR_YELLOW : config.COLOR_WHITE,
      );
    });
  }

  private renderLeaderboard(): void {
    this.addLine('SP LEADERBOARD', 120, config.COLOR_YELLOW);
    if (this.leaderboard.length === 0) {
      this.addLine('NO STAKERS YET', 160, config.COLOR_GRAY_LIGHT);
      return;
    }
    this.leaderboard.slice(0, 10).forEach((row, index) => {
      const color = row.rank <= 3 ? config.COLOR_YELLOW : config.COLOR_WHITE;
      this.addLine(
        `${`${row.rank}`.padStart(2, ' ')}. ${row.displayName
          .toUpperCase()
          .slice(0, 12)
          .padEnd(13, ' ')}${`${row.staked}`.padStart(7, ' ')} ${`${row.totalSp}`.padStart(8, ' ')}`,
        160 + index * 32,
        color,
      );
    });
  }

  private handleStake = (): void => {
    this.stakingClient.stake(STAKE_STEP).then((result) => {
      this.setStatus(
        result.ok ? `STAKED ${STAKE_STEP}` : (result.error || 'FAILED').toUpperCase(),
      );
      if (result.ok) {
        this.load();
      }
    });
  };

  private handleUnstake = (): void => {
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
  };

  private handleClaim = (): void => {
    this.stakingClient.claimUnstaked().then((result) => {
      this.setStatus(
        result.ok && result.amount > 0
          ? `CLAIMED ${result.amount} BCT`
          : 'NOTHING CLAIMABLE YET',
      );
      if (result.ok && result.amount > 0) {
        this.load();
      }
    });
  };

  private handleToggleLeaderboard = (): void => {
    this.showLeaderboard = !this.showLeaderboard;
    this.boardItem.setText(this.showLeaderboard ? 'YOUR STATS' : 'SP LEADERBOARD');
    this.requestRender();
  };
}
