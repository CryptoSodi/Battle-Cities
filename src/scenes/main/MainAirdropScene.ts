import * as config from '../../config';
import {
  AirdropCampaign,
  AirdropClient,
  AirdropEligibility,
} from '../../airdrops';

import { PanelScene, UI } from './panelUi';

const MOBILE_WIDTH = 744;

interface EligibilityStat {
  label: string;
  value: string;
  color?: string;
  iconId?: string;
}

export class MainAirdropScene extends PanelScene {
  private airdropClient = new AirdropClient();
  private campaigns: AirdropCampaign[] = [];
  private eligibility: AirdropEligibility = null;
  private isLoading = false;
  private isClaiming = false;
  private loadRequestId = 0;

  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? 76 : 96;
  }

  protected getInitialFocusKey(): string {
    if (this.isClaimAvailable()) {
      return 'claim';
    }
    if (!this.isLoading && this.campaigns.length === 0) {
      return 'retry';
    }
    return 'back';
  }

  protected getBackButtonY(): number {
    return config.isMobileTouchViewport() ? 8 : 44;
  }

  protected getBackButtonWidth(): number {
    return config.isMobileTouchViewport() ? 152 : 140;
  }

  protected getBackButtonRightInset(): number {
    return config.isMobileTouchViewport() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return config.isMobileTouchViewport() ? 60 : 48;
  }

  protected load(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.isClaiming = false;
    this.campaigns = [];
    this.eligibility = null;

    this.airdropClient.listCampaigns().then((campaigns) => {
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.campaigns = campaigns;
      if (campaigns.length === 0) {
        this.isLoading = false;
        this.refresh('retry');
        return;
      }

      this.airdropClient
        .getEligibility(campaigns[0].slug)
        .then((eligibility) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.eligibility = eligibility;
          this.isLoading = false;
          this.refresh(this.isClaimAvailable() ? 'claim' : 'back');
        });
    });
  }

  protected renderContent(): void {
    const mobile = config.isMobileTouchViewport();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();

    this.renderHeader(x, mobile ? 8 : y - 57, mobile);
    this.renderShell(x, y, width, mobile);

    if (this.isLoading) {
      this.renderLoading(x, y, width, mobile);
      return;
    }

    if (this.campaigns.length === 0) {
      this.renderEmpty(x, y, width, mobile);
      return;
    }

    this.renderCampaign(this.campaigns[0], x, y, width, mobile);
  }

  private renderHeader(x: number, y: number, mobile: boolean): void {
    const width = mobile ? 360 : 400;
    const height = mobile ? 60 : 58;
    const headerX = x + (mobile ? 0 : 12);

    this.addPanel(headerX, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    this.addIcon('ui.icon.chute', headerX + 24, y + 9, height - 18);
    this.addText(
      'AIRDROP',
      headerX + 78,
      y + (mobile ? 17 : 15),
      UI.WHITE,
      mobile ? 31 : 32,
      '900',
      width - 102,
      'center',
    );
  }

  private renderShell(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const sideInset = mobile ? 0 : 8;
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      Math.max(420, this.root.size.height - y - (mobile ? 12 : 18)),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + 6,
      y + 5,
      width + sideInset * 2 - 12,
      3,
      UI.YELLOW,
      null,
    );
    accent.setZIndex(-1);
  }

  private renderLoading(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? 16 : 24;
    const innerWidth = width - inset * 2;
    const heroHeight = mobile ? 190 : 142;
    const cardGap = mobile ? 12 : 16;
    const columns = mobile ? 2 : 4;
    const cardWidth = Math.floor(
      (innerWidth - cardGap * (columns - 1)) / columns,
    );
    const cardsY = y + heroHeight + (mobile ? 78 : 90);

    this.addPanel(
      x + inset,
      y + 20,
      innerWidth,
      heroHeight,
      UI.PANEL_ALT,
      UI.PANEL_LINE,
    );
    this.addText(
      'LOADING AIRDROP',
      x + inset + 24,
      y + 46,
      UI.MUTED_LIGHT,
      mobile ? 27 : 30,
      '900',
      innerWidth - 48,
    );

    for (let index = 0; index < 4; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      this.addPanel(
        x + inset + column * (cardWidth + cardGap),
        cardsY + row * (mobile ? 138 : 134),
        cardWidth,
        mobile ? 126 : 118,
        UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
    }
  }

  private renderEmpty(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? 24 : 48;
    const panelY = y + (mobile ? 34 : 48);
    const panelHeight = mobile ? 300 : 260;
    const panelWidth = width - inset * 2;

    this.addPanel(
      x + inset,
      panelY,
      panelWidth,
      panelHeight,
      UI.PAGE,
      UI.PANEL_LINE,
    );
    this.addIcon(
      'ui.icon.chute',
      x + Math.floor((width - 64) / 2),
      panelY + 32,
      64,
    );
    this.addText(
      'NO ACTIVE AIRDROP',
      x + inset + 24,
      panelY + 112,
      UI.WHITE,
      mobile ? 30 : 32,
      '900',
      panelWidth - 48,
      'center',
    );
    this.addText(
      'No campaign is available right now. Check again soon.',
      x + inset + 24,
      panelY + 158,
      UI.MUTED_LIGHT,
      mobile ? 21 : 22,
      '700',
      panelWidth - 48,
      'center',
    );
    this.addButton(
      x + Math.floor((width - 220) / 2),
      panelY + panelHeight - 68,
      220,
      48,
      'REFRESH',
      'retry',
      () => this.load(),
      true,
      'normal',
      24,
    );
  }

  private renderCampaign(
    campaign: AirdropCampaign,
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? 16 : 24;
    const innerX = x + inset;
    const innerWidth = width - inset * 2;
    const heroY = y + 20;
    const heroHeight = mobile ? 190 : 142;

    this.renderCampaignHero(
      campaign,
      innerX,
      heroY,
      innerWidth,
      heroHeight,
      mobile,
    );

    const eligibilityY = heroY + heroHeight + (mobile ? 30 : 34);
    if (this.eligibility === null) {
      this.renderSignedOut(innerX, eligibilityY, innerWidth, mobile);
      return;
    }

    this.renderEligibility(
      campaign,
      this.eligibility,
      innerX,
      eligibilityY,
      innerWidth,
      mobile,
    );
  }

  private renderCampaignHero(
    campaign: AirdropCampaign,
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    const live = campaign.status === 'live';
    const statusColor = live
      ? UI.GREEN
      : campaign.status === 'upcoming'
      ? UI.YELLOW
      : UI.MUTED_LIGHT;

    this.addPanel(
      x,
      y,
      width,
      height,
      UI.PAGE,
      live ? UI.YELLOW_DARK : UI.PANEL_LINE,
    );
    this.addText(
      campaign.name.toUpperCase(),
      x + 24,
      y + 18,
      UI.WHITE,
      mobile ? 27 : 31,
      '900',
      width - (mobile ? 190 : 360),
    );

    const badgeWidth = mobile ? 126 : 136;
    this.addPanel(
      x + width - badgeWidth - 22,
      y + 18,
      badgeWidth,
      38,
      live ? UI.GREEN_PANEL : UI.PANEL_ALT,
      statusColor,
    );
    this.addText(
      campaign.status.toUpperCase(),
      x + width - badgeWidth - 22,
      y + 27,
      statusColor,
      18,
      '900',
      badgeWidth,
      'center',
    );

    this.addText('CAMPAIGN WINDOW', x + 24, y + 72, UI.MUTED, 17, '800', 260);
    this.addText(
      `${this.formatDate(campaign.startsAt)} - ${this.formatDate(
        campaign.endsAt,
      )}`,
      x + 24,
      y + 96,
      UI.MUTED_LIGHT,
      mobile ? 20 : 21,
      '800',
      mobile ? width - 48 : 560,
    );

    if (mobile) {
      this.addText(
        `POOL  ${this.formatNumber(campaign.allocationPool)} BACT`,
        x + 24,
        y + 130,
        UI.YELLOW,
        22,
        '900',
        width - 48,
        'right',
      );
    } else {
      this.addText(
        'ALLOCATION POOL',
        x + width - 340,
        y + 72,
        UI.MUTED,
        17,
        '800',
        316,
        'right',
      );
      this.addText(
        `${this.formatNumber(campaign.allocationPool)} BACT`,
        x + width - 340,
        y + 96,
        UI.YELLOW,
        23,
        '900',
        316,
        'right',
      );
    }

    const progressX = x + 24;
    const progressY = y + height - 18;
    const progressWidth = width - 48;
    this.addPanel(
      progressX,
      progressY,
      progressWidth,
      6,
      UI.PANEL_RAISED,
      null,
    );
    this.addPanel(
      progressX,
      progressY,
      Math.max(
        6,
        Math.floor(progressWidth * this.getCampaignProgress(campaign)),
      ),
      6,
      live ? UI.GREEN : UI.YELLOW,
      null,
    );
  }

  private renderSignedOut(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const height = mobile ? 174 : 150;
    this.addPanel(x, y, width, height, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      'SIGN IN TO VIEW ELIGIBILITY',
      x + 24,
      y + 32,
      UI.WHITE,
      mobile ? 28 : 30,
      '900',
      width - 48,
      'center',
    );
    this.addText(
      'Use Google or your Phantom wallet from the main menu to view your allocation.',
      x + 32,
      y + 82,
      UI.MUTED_LIGHT,
      mobile ? 20 : 21,
      '700',
      width - 64,
      'center',
    );
  }

  private renderEligibility(
    campaign: AirdropCampaign,
    eligibility: AirdropEligibility,
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    this.addText(
      eligibility.frozen ? 'YOUR ALLOCATION' : 'YOUR AIRDROP WEIGHT',
      x,
      y,
      UI.WHITE,
      mobile ? 27 : 29,
      '900',
      width,
    );
    this.addText(
      eligibility.frozen
        ? 'Campaign scoring is locked.'
        : 'Your allocation grows with your contribution.',
      x,
      y + 38,
      UI.MUTED,
      mobile ? 18 : 19,
      '700',
      width,
    );

    const stats = this.getEligibilityStats(eligibility);
    const cardsY = y + 78;
    const cardsBottom = this.renderEligibilityCards(
      stats,
      x,
      cardsY,
      width,
      mobile,
    );

    if (!eligibility.frozen) {
      this.renderWeightNotice(x, cardsBottom + 20, width, mobile);
      return;
    }

    this.renderClaimState(
      campaign,
      eligibility,
      x,
      cardsBottom + 22,
      width,
      mobile,
    );
  }

  private getEligibilityStats(
    eligibility: AirdropEligibility,
  ): EligibilityStat[] {
    if (eligibility.frozen) {
      return [
        {
          label: 'FROZEN WEIGHT',
          value: this.formatNumber(eligibility.weight),
        },
        {
          label: 'BACT ALLOCATION',
          value: this.formatNumber(eligibility.allocation || 0),
          color: UI.YELLOW,
          iconId: 'shop.coin',
        },
        {
          label: 'CLAIM STATUS',
          value: eligibility.claimedAt !== null ? 'CLAIMED' : 'READY',
          color: eligibility.claimedAt !== null ? UI.MUTED_LIGHT : UI.GREEN,
        },
      ];
    }

    return [
      {
        label: 'TOTAL WEIGHT',
        value: this.formatNumber(eligibility.weight),
        color: UI.YELLOW,
      },
      {
        label: 'GAME POINTS',
        value: this.formatNumber(eligibility.parts?.gamePoints || 0),
      },
      {
        label: 'STAKING SP',
        value: this.formatNumber(eligibility.parts?.stakingSp || 0),
      },
      {
        label: 'TRADING USD',
        value: `$${this.formatNumber(eligibility.parts?.tradingUsd || 0)}`,
      },
    ];
  }

  private renderEligibilityCards(
    stats: EligibilityStat[],
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): number {
    const columns = mobile ? 2 : stats.length;
    const gap = mobile ? 12 : 16;
    const cardHeight = mobile ? 126 : 118;
    const rowGap = mobile ? 12 : 16;
    const cardWidth = Math.floor((width - gap * (columns - 1)) / columns);

    stats.forEach((stat, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const cardX = x + column * (cardWidth + gap);
      const cardY = y + row * (cardHeight + rowGap);
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.PAGE,
        UI.PANEL_LINE,
      );
      this.addText(
        stat.label,
        cardX + 18,
        cardY + 17,
        UI.MUTED,
        mobile ? 18 : 19,
        '800',
        cardWidth - 36,
      );

      const iconSpace = stat.iconId !== undefined ? 48 : 0;
      this.addText(
        stat.value,
        cardX + 18,
        cardY + 59,
        stat.color || UI.WHITE,
        mobile ? 29 : 31,
        '900',
        cardWidth - 36 - iconSpace,
        'right',
      );
      if (stat.iconId !== undefined) {
        this.addIcon(stat.iconId, cardX + cardWidth - 54, cardY + 56, 36);
      }
    });

    const rows = Math.ceil(stats.length / columns);
    return y + rows * cardHeight + Math.max(0, rows - 1) * rowGap;
  }

  private renderWeightNotice(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const height = mobile ? 112 : 88;
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    this.addText(
      'HOW TO GROW YOUR SHARE',
      x + 22,
      y + 18,
      UI.YELLOW,
      mobile ? 20 : 21,
      '900',
      width - 44,
    );
    this.addText(
      'Keep playing, staking, and trading before the campaign closes. Final allocations lock when scoring ends.',
      x + 22,
      y + (mobile ? 51 : 50),
      UI.MUTED_LIGHT,
      mobile ? 18 : 19,
      '700',
      width - 44,
    );
  }

  private renderClaimState(
    campaign: AirdropCampaign,
    eligibility: AirdropEligibility,
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    if (eligibility.claimedAt !== null) {
      this.addPanel(x, y, width, mobile ? 92 : 78, UI.GREEN_PANEL, UI.GREEN);
      this.addText(
        `CLAIMED ${this.formatNumber(eligibility.allocation || 0)} BACT`,
        x + 24,
        y + (mobile ? 29 : 23),
        UI.GREEN,
        mobile ? 25 : 27,
        '900',
        width - 48,
        'center',
      );
      return;
    }

    if ((eligibility.allocation || 0) <= 0) {
      this.addPanel(x, y, width, mobile ? 92 : 78, UI.PANEL_ALT, UI.PANEL_LINE);
      this.addText(
        'NO CLAIMABLE ALLOCATION FOR THIS CAMPAIGN',
        x + 24,
        y + (mobile ? 29 : 23),
        UI.MUTED_LIGHT,
        mobile ? 22 : 24,
        '800',
        width - 48,
        'center',
      );
      return;
    }

    const buttonWidth = mobile ? 360 : 320;
    const buttonHeight = mobile ? 60 : 54;
    const buttonX = x + Math.floor((width - buttonWidth) / 2);
    if (this.isClaiming) {
      this.addPanel(
        buttonX,
        y,
        buttonWidth,
        buttonHeight,
        UI.PANEL_RAISED,
        UI.PANEL_LINE,
      );
      this.addText(
        'CLAIMING...',
        buttonX,
        y + (mobile ? 17 : 15),
        UI.MUTED_LIGHT,
        mobile ? 25 : 24,
        '900',
        buttonWidth,
        'center',
      );
      return;
    }

    this.addButton(
      buttonX,
      y,
      buttonWidth,
      buttonHeight,
      `CLAIM ${this.formatNumber(eligibility.allocation || 0)} BACT`,
      'claim',
      () => this.claim(campaign.slug),
      true,
      'normal',
      mobile ? 24 : 23,
    );
  }

  private claim(slug: string): void {
    if (this.isClaiming) {
      return;
    }

    this.isClaiming = true;
    this.refresh('claim');
    this.airdropClient.claim(slug).then((result) => {
      this.isClaiming = false;
      if (!result.ok) {
        this.setStatus((result.error || 'CLAIM FAILED').toUpperCase());
        this.refresh('claim');
        return;
      }

      this.setStatus(`CLAIMED ${result.allocation || 0} BACT`);
      this.load();
    });
  }

  private isClaimAvailable(): boolean {
    return (
      !this.isClaiming &&
      this.eligibility !== null &&
      this.eligibility.frozen &&
      this.eligibility.claimedAt === null &&
      (this.eligibility.allocation || 0) > 0
    );
  }

  private formatNumber(value: number): string {
    return Math.max(0, value || 0).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10).toUpperCase();
    }
    return date
      .toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
      .toUpperCase();
  }

  private getCampaignProgress(campaign: AirdropCampaign): number {
    if (campaign.status === 'upcoming') {
      return 0;
    }
    if (campaign.status === 'ended') {
      return 1;
    }

    const startsAt = new Date(campaign.startsAt).getTime();
    const endsAt = new Date(campaign.endsAt).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
      return 0.5;
    }
    const duration = Math.max(1, endsAt - startsAt);
    return Math.max(0, Math.min(1, (Date.now() - startsAt) / duration));
  }
}
