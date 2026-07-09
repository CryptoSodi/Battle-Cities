import { TextMenuItem } from '../../gameObjects';
import { BoostStatus, TradingClient } from '../../trading';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

// Boost status dashboard (Milestone 5): trait boosts from 30-day trading
// volume, the asset breakdown, staking perk tier progress — and an explicit
// statement of where perks apply (never Ranked, per the plan's fairness rule).
export class MainBoostScene extends BoardScene {
  private tradingClient = new TradingClient();
  private status: BoostStatus = null;

  protected getTitle(): string {
    return 'BOOST';
  }

  protected createMenuItems(): TextMenuItem[] {
    const refreshItem = new TextMenuItem('REFRESH');
    refreshItem.selected.addListener(this.handleRefresh);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [refreshItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    this.tradingClient.getBoostStatus().then((status) => {
      this.status = status;
      this.isLoading = false;
      this.requestRender();
    });
  }

  protected renderBoard(): void {
    if (this.status === null || this.status.authenticated !== true) {
      this.addLine('LOGIN TO SEE BOOST STATUS', 140, config.COLOR_GRAY_LIGHT);
      return;
    }

    const { trading, staking } = this.status;
    const boosts = trading.boosts;

    this.addLine(
      `HULL +${boosts.hull}%  ARMOR +${boosts.armor}%`,
      120,
      config.COLOR_YELLOW,
    );
    this.addLine(
      `ENGINE +${boosts.engine}%  SALVAGE +${boosts.salvage}%`,
      152,
      config.COLOR_YELLOW,
    );
    this.addLine(`${trading.windowDays}-DAY VOLUME $${trading.totalVolumeUsd}`, 200);

    this.addLine('ASSET     TRAIT     VOLUME', 248, config.COLOR_YELLOW);
    if (trading.rows.length === 0) {
      this.addLine('NO TRADES IN THE LAST 30 DAYS.', 280, config.COLOR_GRAY_LIGHT);
      this.addLine('START TRADING TO BOOST TRAITS.', 312, config.COLOR_GRAY_LIGHT);
    }
    trading.rows.slice(0, 5).forEach((row, index) => {
      this.addLine(
        `${row.symbol.padEnd(9, ' ')} ${row.trait.toUpperCase().padEnd(9, ' ')} $${row.volumeUsd}`,
        280 + index * 32,
      );
    });

    this.addLine('STAKING PERKS', 456, config.COLOR_YELLOW);
    this.addLine(
      `LEVEL ${staking.tier.level} (STAKE ${staking.staked})` +
        (staking.nextTier !== null ? `  NEXT AT ${staking.nextTier.stake}` : ''),
      488,
    );
    this.addLine(
      `+${staking.tier.hull}% HULL +${staking.tier.armor}% ARMOR +${staking.tier.engine}% ENGINE`,
      520,
    );

    this.addLine('APPLIES TO ALL MATCHES INCLUDING RANKED.', 560, config.COLOR_GRAY_LIGHT);
  }

  private handleRefresh = (): void => {
    this.load();
  };
}
