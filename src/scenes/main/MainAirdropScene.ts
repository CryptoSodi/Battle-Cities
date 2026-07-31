import * as config from '../../config';
import {
  AirdropCampaign,
  AirdropClient,
  AirdropEligibility,
  DiscordVerification,
} from '../../airdrops';

import { PanelScene, UI } from './panelUi';

const MOBILE_WIDTH = 744;
const BATTLE_CITIES_X_URL = 'https://x.com/BattleCitiesHQ';
const BATTLE_CITIES_DISCORD_URL = 'https://discord.gg/jHmYTCVJgm';
const BATTLE_CITIES_INSTAGRAM_URL = 'https://www.instagram.com/battlecitieshq';

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
  private discordVerification: DiscordVerification = null;
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
    return config.isMobileTouchViewport() ? this.mobileSize(76) : 96;
  }

  protected getInitialFocusKey(): string {
    if (this.isClaimAvailable()) {
      return 'claim';
    }
    if (!this.isLoading && this.campaigns.length > 0) {
      return 'quest-x';
    }
    if (!this.isLoading && this.campaigns.length === 0) {
      return 'retry';
    }
    return 'back';
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    if (direction > 0 && currentKey === 'back' && this.campaigns.length > 0) {
      return 'quest-x';
    }
    if (direction < 0 && currentKey.startsWith('quest-')) {
      return 'back';
    }
    return null;
  }

  protected getBackButtonY(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(8) : 44;
  }

  protected getBackButtonWidth(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(152) : 140;
  }

  protected getBackButtonRightInset(): number {
    return config.isMobileTouchViewport() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(60) : 48;
  }

  private mobileSize(value: number): number {
    return Math.round((value * this.getContentWidth()) / MOBILE_WIDTH);
  }

  protected load(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.isClaiming = false;
    this.campaigns = [];
    this.eligibility = null;
    this.discordVerification = null;

    this.airdropClient.getDiscordVerification().then((verification) => {
      if (requestId !== this.loadRequestId) {
        return;
      }
      this.discordVerification = verification;
      if (!this.isLoading) {
        this.refresh();
      }
    });

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
          this.refresh(this.isClaimAvailable() ? 'claim' : 'quest-x');
        });
    });
  }

  protected renderContent(): void {
    const mobile = config.isMobileTouchViewport();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();

    this.renderHeader(x, mobile ? this.mobileSize(8) : y - 57, mobile);
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
    const width = mobile ? this.mobileSize(360) : 400;
    const height = mobile ? this.mobileSize(60) : 58;
    const headerX = x + (mobile ? 0 : 12);

    this.addPanel(headerX, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    this.addIcon(
      'ui.icon.chute',
      headerX + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(9) : 9),
      height - (mobile ? this.mobileSize(18) : 18),
    );
    this.addText(
      'AIRDROP',
      headerX + (mobile ? this.mobileSize(78) : 78),
      y + (mobile ? this.mobileSize(17) : 15),
      UI.WHITE,
      mobile ? this.mobileSize(31) : 32,
      '900',
      width - (mobile ? this.mobileSize(102) : 102),
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
    const bottomInset = mobile ? this.mobileSize(12) : 18;
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      Math.max(
        mobile ? this.mobileSize(420) : 420,
        this.root.size.height - y - bottomInset,
      ),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + (mobile ? this.mobileSize(6) : 6),
      y + (mobile ? this.mobileSize(5) : 5),
      width + sideInset * 2 - (mobile ? this.mobileSize(12) : 12),
      mobile ? this.mobileSize(3) : 3,
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
    const inset = mobile ? this.mobileSize(16) : 24;
    const innerWidth = width - inset * 2;
    const heroHeight = mobile ? this.mobileSize(190) : 142;
    const cardGap = mobile ? this.mobileSize(12) : 16;
    const columns = mobile ? 2 : 4;
    const cardWidth = Math.floor(
      (innerWidth - cardGap * (columns - 1)) / columns,
    );
    const cardsY = y + heroHeight + (mobile ? this.mobileSize(78) : 90);

    this.addPanel(
      x + inset,
      y + (mobile ? this.mobileSize(20) : 20),
      innerWidth,
      heroHeight,
      UI.PANEL_ALT,
      UI.PANEL_LINE,
    );
    this.addText(
      'LOADING AIRDROP',
      x + inset + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(46) : 46),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(27) : 30,
      '900',
      innerWidth - (mobile ? this.mobileSize(48) : 48),
    );

    for (let index = 0; index < 4; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      this.addPanel(
        x + inset + column * (cardWidth + cardGap),
        cardsY + row * (mobile ? this.mobileSize(138) : 134),
        cardWidth,
        mobile ? this.mobileSize(126) : 118,
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
    const inset = mobile ? this.mobileSize(24) : 48;
    const panelY = y + (mobile ? this.mobileSize(34) : 48);
    const panelHeight = mobile ? this.mobileSize(300) : 260;
    const panelWidth = width - inset * 2;
    const iconSize = mobile ? this.mobileSize(64) : 64;

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
      x + Math.floor((width - iconSize) / 2),
      panelY + (mobile ? this.mobileSize(32) : 32),
      iconSize,
    );
    this.addText(
      'NO ACTIVE AIRDROP',
      x + inset + (mobile ? this.mobileSize(24) : 24),
      panelY + (mobile ? this.mobileSize(112) : 112),
      UI.WHITE,
      mobile ? this.mobileSize(30) : 32,
      '900',
      panelWidth - (mobile ? this.mobileSize(48) : 48),
      'center',
    );
    this.addText(
      'No campaign is available right now. Check again soon.',
      x + inset + (mobile ? this.mobileSize(24) : 24),
      panelY + (mobile ? this.mobileSize(158) : 158),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(21) : 22,
      '700',
      panelWidth - (mobile ? this.mobileSize(48) : 48),
      'center',
    );
    this.addButton(
      x + Math.floor((width - (mobile ? this.mobileSize(220) : 220)) / 2),
      panelY + panelHeight - (mobile ? this.mobileSize(68) : 68),
      mobile ? this.mobileSize(220) : 220,
      mobile ? this.mobileSize(48) : 48,
      'REFRESH',
      'retry',
      () => this.load(),
      true,
      'normal',
      mobile ? this.mobileSize(24) : 24,
    );
  }

  private renderCampaign(
    campaign: AirdropCampaign,
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? this.mobileSize(16) : 24;
    const innerX = x + inset;
    const innerWidth = width - inset * 2;
    const heroY = y + (mobile ? this.mobileSize(20) : 20);
    const heroHeight = mobile ? this.mobileSize(190) : 142;

    this.renderCampaignHero(
      campaign,
      innerX,
      heroY,
      innerWidth,
      heroHeight,
      mobile,
    );

    const questsY = heroY + heroHeight + (mobile ? this.mobileSize(28) : 30);
    const questsBottom = this.renderSocialQuests(
      innerX,
      questsY,
      innerWidth,
      mobile,
    );
    const eligibilityY = questsBottom + (mobile ? this.mobileSize(30) : 32);
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

  private renderSocialQuests(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): number {
    const cardGap = mobile ? this.mobileSize(12) : 16;
    const columns = 3;
    const cardWidth = Math.floor((width - cardGap * (columns - 1)) / columns);
    const cardHeight = mobile ? this.mobileSize(202) : 188;
    const cardY = y + (mobile ? this.mobileSize(56) : 54);
    const quests: Array<{
      key: string;
      label: string;
      mark: string;
      detail: string;
      action: string;
      url?: string;
      onSelect?: () => void;
    }> = [
      {
        key: 'x',
        label: 'FOLLOW X',
        mark: 'X',
        detail: '@BattleCitiesHQ',
        action: 'OPEN X',
        url: BATTLE_CITIES_X_URL,
      },
      {
        key: 'discord',
        label: 'JOIN DISCORD',
        mark: 'D',
        detail: 'BATTLE CITIES COMMUNITY',
        action: 'OPEN DISCORD',
        url: BATTLE_CITIES_DISCORD_URL,
      },
      {
        key: 'instagram',
        label: 'FOLLOW INSTAGRAM',
        mark: 'IG',
        detail: '@BattleCitiesHQ',
        action: 'OPEN INSTAGRAM',
        url: BATTLE_CITIES_INSTAGRAM_URL,
      },
    ];

    this.addText(
      'SOCIAL QUESTS',
      x,
      y,
      UI.WHITE,
      mobile ? this.mobileSize(27) : 29,
      '900',
      width - (mobile ? this.mobileSize(120) : 120),
    );
    this.addText(
      `${this.discordVerification?.verified ? 1 : 0} / 3`,
      x + width - (mobile ? this.mobileSize(120) : 120),
      y + (mobile ? this.mobileSize(4) : 4),
      UI.MUTED,
      mobile ? this.mobileSize(21) : 22,
      '800',
      mobile ? this.mobileSize(120) : 120,
      'right',
    );

    quests.forEach((quest, index) => {
      this.renderSocialQuestCard(
        quest,
        x + index * (cardWidth + cardGap),
        cardY,
        cardWidth,
        cardHeight,
        mobile,
      );
    });

    return cardY + cardHeight;
  }

  private renderSocialQuestCard(
    quest: {
      key: string;
      label: string;
      mark: string;
      detail: string;
      action: string;
      url?: string;
      onSelect?: () => void;
    },
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    const sidePadding = mobile ? this.mobileSize(12) : 14;
    const markSize = mobile ? this.mobileSize(52) : 52;
    const buttonInset = mobile ? this.mobileSize(8) : 8;
    const buttonHeight = mobile ? this.mobileSize(44) : 44;

    this.addPanel(x, y, width, height, UI.CARD, UI.YELLOW_DARK);
    this.addPanel(
      x + (mobile ? this.mobileSize(5) : 5),
      y + (mobile ? this.mobileSize(5) : 5),
      width - (mobile ? this.mobileSize(10) : 10),
      mobile ? this.mobileSize(2) : 2,
      UI.PANEL_LINE,
      null,
    );
    this.addText(
      quest.label,
      x + sidePadding,
      y + (mobile ? this.mobileSize(15) : 15),
      UI.GREEN,
      mobile ? this.mobileSize(22) : 24,
      '900',
      width - sidePadding * 2,
      'center',
    );
    this.addPanel(
      x + Math.floor((width - markSize) / 2),
      y + (mobile ? this.mobileSize(50) : 48),
      markSize,
      markSize,
      UI.PANEL_ALT,
      UI.PANEL_LINE,
    );
    this.addText(
      quest.mark,
      x + Math.floor((width - markSize) / 2),
      y + (mobile ? this.mobileSize(61) : 59),
      UI.WHITE,
      mobile ? this.mobileSize(27) : 27,
      '900',
      markSize,
      'center',
    );
    this.addText(
      quest.detail,
      x + sidePadding,
      y + (mobile ? this.mobileSize(112) : 108),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(17) : 18,
      '700',
      width - sidePadding * 2,
      'center',
    );
    this.addButton(
      x + buttonInset,
      y + height - buttonHeight - buttonInset,
      width - buttonInset * 2,
      buttonHeight,
      quest.action,
      `quest-${quest.key}`,
      () => {
        if (quest.onSelect !== undefined) {
          quest.onSelect();
          return;
        }
        if (quest.url !== undefined) {
          this.openSocialQuest(quest.url, quest.mark);
          return;
        }
        this.setStatus(`${quest.label} LINK COMING SOON`);
      },
      false,
      'purchase',
      mobile ? this.mobileSize(19) : 20,
    );
  }

  private getDiscordQuestDetail(): string {
    if (this.discordVerification?.verified) {
      return 'DISCORD VERIFIED';
    }
    return 'AUTHORIZE TO VERIFY';
  }

  private getDiscordQuestAction(): string {
    if (this.discordVerification?.verified) {
      return 'VERIFIED';
    }
    return 'VERIFY DISCORD';
  }

  private handleDiscordQuest(): void {
    if (this.discordVerification?.verified) {
      this.setStatus('DISCORD ALREADY VERIFIED');
      return;
    }
    this.airdropClient.startDiscordVerification();
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
      x + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(18) : 18),
      UI.WHITE,
      mobile ? this.mobileSize(27) : 31,
      '900',
      width - (mobile ? this.mobileSize(190) : 360),
    );

    const badgeWidth = mobile ? this.mobileSize(126) : 136;
    this.addPanel(
      x + width - badgeWidth - (mobile ? this.mobileSize(22) : 22),
      y + (mobile ? this.mobileSize(18) : 18),
      badgeWidth,
      mobile ? this.mobileSize(38) : 38,
      live ? UI.GREEN_PANEL : UI.PANEL_ALT,
      statusColor,
    );
    this.addText(
      campaign.status.toUpperCase(),
      x + width - badgeWidth - (mobile ? this.mobileSize(22) : 22),
      y + (mobile ? this.mobileSize(27) : 27),
      statusColor,
      mobile ? this.mobileSize(18) : 18,
      '900',
      badgeWidth,
      'center',
    );

    this.addText(
      'CAMPAIGN WINDOW',
      x + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(72) : 72),
      UI.MUTED,
      mobile ? this.mobileSize(17) : 17,
      '800',
      mobile ? this.mobileSize(260) : 260,
    );
    this.addText(
      `${this.formatDate(campaign.startsAt)} - ${this.formatDate(
        campaign.endsAt,
      )}`,
      x + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(96) : 96),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(20) : 21,
      '800',
      mobile ? width - this.mobileSize(48) : 560,
    );

    if (mobile) {
      this.addText(
        `POOL  ${this.formatNumber(campaign.allocationPool)} BACT`,
        x + this.mobileSize(24),
        y + this.mobileSize(130),
        UI.YELLOW,
        this.mobileSize(22),
        '900',
        width - this.mobileSize(48),
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

    const progressX = x + (mobile ? this.mobileSize(24) : 24);
    const progressY = y + height - (mobile ? this.mobileSize(18) : 18);
    const progressWidth = width - (mobile ? this.mobileSize(48) : 48);
    const progressHeight = mobile ? this.mobileSize(6) : 6;
    this.addPanel(
      progressX,
      progressY,
      progressWidth,
      progressHeight,
      UI.PANEL_RAISED,
      null,
    );
    this.addPanel(
      progressX,
      progressY,
      Math.max(
        progressHeight,
        Math.floor(progressWidth * this.getCampaignProgress(campaign)),
      ),
      progressHeight,
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
    const height = mobile ? this.mobileSize(174) : 150;
    this.addPanel(x, y, width, height, UI.PAGE, UI.PANEL_LINE);
    this.addText(
      'SIGN IN TO VIEW ELIGIBILITY',
      x + (mobile ? this.mobileSize(24) : 24),
      y + (mobile ? this.mobileSize(32) : 32),
      UI.WHITE,
      mobile ? this.mobileSize(28) : 30,
      '900',
      width - (mobile ? this.mobileSize(48) : 48),
      'center',
    );
    this.addText(
      'Use Google or your Phantom wallet from the main menu to view your allocation.',
      x + (mobile ? this.mobileSize(32) : 32),
      y + (mobile ? this.mobileSize(82) : 82),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(20) : 21,
      '700',
      width - (mobile ? this.mobileSize(64) : 64),
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
      mobile ? this.mobileSize(27) : 29,
      '900',
      width,
    );
    this.addText(
      eligibility.frozen
        ? 'Campaign scoring is locked.'
        : 'Your allocation grows with your contribution.',
      x,
      y + (mobile ? this.mobileSize(38) : 38),
      UI.MUTED,
      mobile ? this.mobileSize(18) : 19,
      '700',
      width,
    );

    const stats = this.getEligibilityStats(eligibility);
    const cardsY = y + (mobile ? this.mobileSize(78) : 78);
    const cardsBottom = this.renderEligibilityCards(
      stats,
      x,
      cardsY,
      width,
      mobile,
    );

    if (!eligibility.frozen) {
      this.renderWeightNotice(
        x,
        cardsBottom + (mobile ? this.mobileSize(20) : 20),
        width,
        mobile,
      );
      return;
    }

    this.renderClaimState(
      campaign,
      eligibility,
      x,
      cardsBottom + (mobile ? this.mobileSize(22) : 22),
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
    const gap = mobile ? this.mobileSize(12) : 16;
    const cardHeight = mobile ? this.mobileSize(126) : 118;
    const rowGap = mobile ? this.mobileSize(12) : 16;
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
        UI.CARD,
        UI.YELLOW_DARK,
      );
      this.addText(
        stat.label,
        cardX + (mobile ? this.mobileSize(12) : 12),
        cardY + (mobile ? this.mobileSize(14) : 14),
        UI.GREEN,
        mobile ? this.mobileSize(19) : 20,
        '900',
        cardWidth - (mobile ? this.mobileSize(24) : 24),
        'center',
      );

      const valueBarHeight = mobile ? this.mobileSize(40) : 38;
      const valueBarY = cardY + cardHeight - valueBarHeight;
      this.addPanel(
        cardX + (mobile ? this.mobileSize(8) : 8),
        valueBarY,
        cardWidth - (mobile ? this.mobileSize(16) : 16),
        valueBarHeight - (mobile ? this.mobileSize(8) : 8),
        UI.GREEN_PANEL,
        UI.GREEN,
      );

      if (stat.iconId !== undefined) {
        const iconSize = mobile ? this.mobileSize(40) : 40;
        this.addIcon(
          stat.iconId,
          cardX + Math.floor((cardWidth - iconSize) / 2),
          cardY + (mobile ? this.mobileSize(42) : 42),
          iconSize,
        );
      } else {
        this.addText(
          'CURRENT',
          cardX + (mobile ? this.mobileSize(12) : 12),
          cardY + (mobile ? this.mobileSize(51) : 51),
          UI.MUTED,
          mobile ? this.mobileSize(17) : 18,
          '800',
          cardWidth - (mobile ? this.mobileSize(24) : 24),
          'center',
        );
      }

      this.addText(
        stat.value,
        cardX + (mobile ? this.mobileSize(16) : 16),
        valueBarY + (mobile ? this.mobileSize(7) : 6),
        stat.color || UI.YELLOW_LIGHT,
        mobile ? this.mobileSize(22) : 23,
        '900',
        cardWidth - (mobile ? this.mobileSize(32) : 32),
        'center',
      );
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
    const height = mobile ? this.mobileSize(112) : 88;
    this.addPanel(x, y, width, height, UI.PANEL_ALT, UI.PANEL_LINE);
    this.addText(
      'HOW TO GROW YOUR SHARE',
      x + (mobile ? this.mobileSize(22) : 22),
      y + (mobile ? this.mobileSize(18) : 18),
      UI.YELLOW,
      mobile ? this.mobileSize(20) : 21,
      '900',
      width - (mobile ? this.mobileSize(44) : 44),
    );
    this.addText(
      'Keep playing, staking, and trading before the campaign closes. Final allocations lock when scoring ends.',
      x + (mobile ? this.mobileSize(22) : 22),
      y + (mobile ? this.mobileSize(51) : 50),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(18) : 19,
      '700',
      width - (mobile ? this.mobileSize(44) : 44),
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
      this.addPanel(
        x,
        y,
        width,
        mobile ? this.mobileSize(92) : 78,
        UI.GREEN_PANEL,
        UI.GREEN,
      );
      this.addText(
        `CLAIMED ${this.formatNumber(eligibility.allocation || 0)} BACT`,
        x + (mobile ? this.mobileSize(24) : 24),
        y + (mobile ? this.mobileSize(29) : 23),
        UI.GREEN,
        mobile ? this.mobileSize(25) : 27,
        '900',
        width - (mobile ? this.mobileSize(48) : 48),
        'center',
      );
      return;
    }

    if ((eligibility.allocation || 0) <= 0) {
      this.addPanel(
        x,
        y,
        width,
        mobile ? this.mobileSize(92) : 78,
        UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      this.addText(
        'NO CLAIMABLE ALLOCATION FOR THIS CAMPAIGN',
        x + (mobile ? this.mobileSize(24) : 24),
        y + (mobile ? this.mobileSize(29) : 23),
        UI.MUTED_LIGHT,
        mobile ? this.mobileSize(22) : 24,
        '800',
        width - (mobile ? this.mobileSize(48) : 48),
        'center',
      );
      return;
    }

    const buttonWidth = mobile ? this.mobileSize(360) : 320;
    const buttonHeight = mobile ? this.mobileSize(60) : 54;
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
        y + (mobile ? this.mobileSize(17) : 15),
        UI.MUTED_LIGHT,
        mobile ? this.mobileSize(25) : 24,
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
      mobile ? this.mobileSize(24) : 23,
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

  private openSocialQuest(url: string, platform: string): void {
    const opened = window.open(url, '_blank');
    if (opened === null) {
      window.location.href = url;
      return;
    }
    opened.opener = null;
    this.setStatus(`${platform} OPENED - RETURN AFTER COMPLETING THE QUEST`);
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
