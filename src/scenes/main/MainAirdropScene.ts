import { TextMenuItem } from '../../gameObjects';
import { AirdropCampaign, AirdropClient, AirdropEligibility } from '../../airdrops';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

// Airdrop eligibility (Milestone 6): campaign card, the caller's weight
// breakdown before the freeze, and the fixed allocation + claim after it.
export class MainAirdropScene extends BoardScene {
  private airdropClient = new AirdropClient();
  private campaigns: AirdropCampaign[] = [];
  private eligibility: AirdropEligibility = null;

  protected getTitle(): string {
    return 'AIRDROP';
  }

  protected createMenuItems(): TextMenuItem[] {
    const claimItem = new TextMenuItem('CLAIM');
    claimItem.selected.addListener(this.handleClaim);

    const refreshItem = new TextMenuItem('REFRESH');
    refreshItem.selected.addListener(this.handleRefresh);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [claimItem, refreshItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    this.airdropClient.listCampaigns().then((campaigns) => {
      this.campaigns = campaigns;
      if (campaigns.length === 0) {
        this.isLoading = false;
        this.requestRender();
        return;
      }

      this.airdropClient.getEligibility(campaigns[0].slug).then((eligibility) => {
        this.eligibility = eligibility;
        this.isLoading = false;
        this.requestRender();
      });
    });
  }

  protected renderBoard(): void {
    if (this.campaigns.length === 0) {
      this.addLine('NO AIRDROP CAMPAIGNS', 140, config.COLOR_GRAY_LIGHT);
      return;
    }

    const campaign = this.campaigns[0];
    this.addLine(campaign.name, 120, config.COLOR_YELLOW);
    this.addLine(`STATUS ${campaign.status.toUpperCase()}`, 152);
    this.addLine(`POOL ${campaign.allocationPool} BCT`, 184);

    if (this.eligibility === null) {
      this.addLine('LOGIN TO SEE YOUR ELIGIBILITY', 248, config.COLOR_GRAY_LIGHT);
      return;
    }

    const eligibility = this.eligibility;
    this.addLine('YOUR ELIGIBILITY', 248, config.COLOR_YELLOW);
    this.addLine(`WEIGHT ${eligibility.weight}`, 280);

    if (!eligibility.frozen) {
      if (eligibility.parts !== undefined) {
        this.addLine(`GAME POINTS ${eligibility.parts.gamePoints}`, 312);
        this.addLine(`STAKING SP ${eligibility.parts.stakingSp}`, 344);
        this.addLine(`TRADING $${eligibility.parts.tradingUsd}`, 376);
      }
      this.addLine(
        'ALLOCATION LOCKS WHEN THE CAMPAIGN CLOSES',
        424,
        config.COLOR_GRAY_LIGHT,
      );
      return;
    }

    this.addLine(`ALLOCATION ${eligibility.allocation} BCT`, 312, config.COLOR_YELLOW);
    this.addLine(
      eligibility.claimedAt !== null
        ? `CLAIMED ${eligibility.claimedAt.slice(0, 10)}`
        : 'READY TO CLAIM',
      344,
      eligibility.claimedAt !== null ? config.COLOR_GRAY_LIGHT : config.COLOR_YELLOW,
    );
  }

  private handleClaim = (): void => {
    if (this.campaigns.length === 0) {
      return;
    }

    this.airdropClient.claim(this.campaigns[0].slug).then((result) => {
      this.setStatus(
        result.ok
          ? `CLAIMED ${result.allocation} BCT`
          : (result.error || 'CLAIM FAILED').toUpperCase(),
      );
      if (result.ok) {
        this.load();
      }
    });
  };

  private handleRefresh = (): void => {
    this.load();
  };
}
