import { AirdropCampaign, AirdropClient, AirdropEligibility } from '../../airdrops';

import { PanelScene, UI } from './panelUi';

// Airdrop eligibility, shop-styled: campaign hero panel with status badge,
// eligibility stat cards (weight breakdown pre-freeze, allocation after),
// and a claim action.
export class MainAirdropScene extends PanelScene {
  private airdropClient = new AirdropClient();
  private campaigns: AirdropCampaign[] = [];
  private eligibility: AirdropEligibility = null;
  private isLoading = false;

  protected getTitle(): string {
    return 'Airdrop';
  }

  protected load(): void {
    this.isLoading = true;

    this.airdropClient.listCampaigns().then((campaigns) => {
      this.campaigns = campaigns;
      if (campaigns.length === 0) {
        this.isLoading = false;
        this.refresh();
        return;
      }

      this.airdropClient.getEligibility(campaigns[0].slug).then((eligibility) => {
        this.eligibility = eligibility;
        this.isLoading = false;
        this.refresh();
      });
    });
  }

  protected renderContent(): void {
    const x = this.pageX;
    const y = this.pageY;

    if (this.isLoading) {
      this.addText('LOADING...', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    if (this.campaigns.length === 0) {
      this.addText('NO AIRDROP CAMPAIGNS', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 500);
      return;
    }

    const campaign = this.campaigns[0];
    const live = campaign.status === 'live';

    // Campaign hero.
    this.addPanel(x, y, UI.WIDTH, 128, UI.PANEL, live ? UI.YELLOW_DARK : UI.PANEL_LINE);
    this.addText(campaign.name, x + 28, y + 20, UI.YELLOW, 34, '900', 700);
    this.addPanel(x + UI.WIDTH - 130, y + 24, 92, 34, live ? UI.YELLOW : UI.PANEL_ALT, null);
    this.addText(
      campaign.status.toUpperCase(),
      x + UI.WIDTH - 130,
      y + 31,
      live ? UI.BLACK : UI.MUTED_LIGHT,
      18,
      '900',
      92,
      'center',
    );
    this.addText(
      `${campaign.startsAt.slice(0, 10)} - ${campaign.endsAt.slice(0, 10)}   ALLOCATION POOL ${campaign.allocationPool} BACT`,
      x + 28,
      y + 76,
      UI.MUTED_LIGHT,
      22,
      '700',
      900,
    );

    if (this.eligibility === null) {
      this.addText('LOGIN TO SEE YOUR ELIGIBILITY', x + 16, y + 180, UI.MUTED_LIGHT, 24, '800', 600);
      return;
    }

    const eligibility = this.eligibility;
    this.addText('YOUR ELIGIBILITY', x + 4, y + 168, UI.MUTED, 24, '800', 400);

    const cardWidth = 232;
    const cardGap = 24;

    if (!eligibility.frozen) {
      this.addStatCard(x, y + 208, cardWidth, 96, 'TOTAL WEIGHT', `${eligibility.weight}`, UI.YELLOW);
      if (eligibility.parts !== undefined) {
        this.addStatCard(x + (cardWidth + cardGap), y + 208, cardWidth, 96, 'GAME POINTS', `${eligibility.parts.gamePoints}`);
        this.addStatCard(x + (cardWidth + cardGap) * 2, y + 208, cardWidth, 96, 'STAKING SP', `${eligibility.parts.stakingSp}`);
        this.addStatCard(x + (cardWidth + cardGap) * 3, y + 208, cardWidth, 96, 'TRADING USD', `$${eligibility.parts.tradingUsd}`);
      }

      this.addPanel(x, y + 336, UI.WIDTH, 64, UI.PANEL_ALT, UI.PANEL_LINE);
      this.addText(
        'ALLOCATIONS LOCK WHEN THE CAMPAIGN CLOSES. KEEP PLAYING, STAKING, AND TRADING TO GROW YOUR WEIGHT.',
        x,
        y + 356,
        UI.MUTED_LIGHT,
        18,
        '800',
        UI.WIDTH,
        'center',
      );
      return;
    }

    this.addStatCard(x, y + 208, cardWidth, 96, 'FROZEN WEIGHT', `${eligibility.weight}`);
    this.addStatCard(
      x + (cardWidth + cardGap),
      y + 208,
      cardWidth,
      96,
      'YOUR ALLOCATION',
      `${eligibility.allocation}`,
      UI.YELLOW,
      'shop.coin',
    );
    this.addStatCard(
      x + (cardWidth + cardGap) * 2,
      y + 208,
      cardWidth,
      96,
      'STATUS',
      eligibility.claimedAt !== null ? 'CLAIMED' : 'CLAIMABLE',
      eligibility.claimedAt !== null ? UI.MUTED_LIGHT : UI.GREEN,
    );

    if (eligibility.claimedAt === null && eligibility.allocation > 0) {
      this.addButton(x + (cardWidth + cardGap) * 3, y + 232, cardWidth, 52, 'CLAIM', 'claim', () => {
        this.claim(campaign.slug);
      }, true);
    }
  }

  private claim(slug: string): void {
    this.airdropClient.claim(slug).then((result) => {
      this.setStatus(
        result.ok
          ? `CLAIMED ${result.allocation} BACT`
          : (result.error || 'CLAIM FAILED').toUpperCase(),
      );
      if (result.ok) {
        this.load();
      }
    });
  }
}
