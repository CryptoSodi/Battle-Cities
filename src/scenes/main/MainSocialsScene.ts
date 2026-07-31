import { AirdropClient, DiscordVerification } from '../../airdrops';
import { HeadquartersPanelScene, UI } from './panelUi';

interface SocialLink {
  key: string;
  title: string;
  detail: string;
  action: string;
  mark: string;
  url?: string;
  onSelect?: () => void;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    key: 'website',
    title: 'WEBSITE',
    detail: 'BATTLECITIES.COM',
    action: 'VISIT WEBSITE',
    mark: 'WWW',
    url: 'http://www.battlecities.com',
  },
  {
    key: 'x',
    title: 'X',
    detail: '@BATTLECITIESHQ',
    action: 'FOLLOW ON X',
    mark: 'X',
    url: 'https://x.com/BattleCitiesHQ',
  },
  {
    key: 'instagram',
    title: 'INSTAGRAM',
    detail: '@BATTLECITIESHQ',
    action: 'FOLLOW INSTAGRAM',
    mark: 'IG',
    url: 'https://www.instagram.com/battlecitieshq',
  },
];

export class MainSocialsScene extends HeadquartersPanelScene {
  private airdropClient = new AirdropClient();
  private discordVerification: DiscordVerification = null;
  private verificationRequestId = 0;

  protected getSectionTitle(): string {
    return 'Socials';
  }

  protected getSectionIcon(): string | null {
    return null;
  }

  protected getSectionIconText(): string {
    return '@';
  }

  protected getInitialFocusKey(): string {
    return this.getSocialKey(this.getSocialLinks()[0]);
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    if (direction > 0 && currentKey === 'back') {
      return this.getSocialKey(this.getSocialLinks()[0]);
    }

    const socials = this.getSocialLinks();
    const index = socials.findIndex(
      (social) => this.getSocialKey(social) === currentKey,
    );
    if (index < 0) {
      return null;
    }

    const columns = this.isMobileLayout() ? 2 : 4;
    const row = Math.floor(index / columns);
    if (direction < 0 && row === 0) {
      return 'back';
    }

    const targetIndex = index + direction * columns;
    return targetIndex >= 0 && targetIndex < socials.length
      ? this.getSocialKey(socials[targetIndex])
      : null;
  }

  protected load(): void {
    this.statusText = '';
    this.discordVerification = null;
    const requestId = ++this.verificationRequestId;
    this.airdropClient.getDiscordVerification().then((verification) => {
      if (requestId !== this.verificationRequestId) {
        return;
      }
      this.discordVerification = verification;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const layout = this.renderHeadquartersFrame(
      this.isMobileLayout() ? 720 : 680,
    );
    const { mobile, bodyX, bodyY, bodyWidth } = layout;

    this.addPanel(
      bodyX,
      bodyY,
      bodyWidth,
      this.scaleSize(106),
      UI.PAGE,
      UI.PANEL_LINE,
    );
    this.addText(
      'JOIN THE BATTLE CITIES COMMUNITY',
      bodyX + this.scaleSize(22),
      bodyY + this.scaleSize(18),
      UI.GREEN,
      this.scaleSize(25),
      '900',
      bodyWidth - this.scaleSize(44),
      'center',
    );
    this.addText(
      'NEWS, DEVELOPMENT UPDATES, EVENTS AND COMMUNITY SUPPORT.',
      bodyX + this.scaleSize(22),
      bodyY + this.scaleSize(59),
      UI.MUTED_LIGHT,
      this.scaleSize(17),
      '700',
      bodyWidth - this.scaleSize(44),
      'center',
    );

    const columns = mobile ? 2 : 4;
    const gap = this.scaleSize(mobile ? 14 : 16);
    const cardWidth = Math.floor((bodyWidth - gap * (columns - 1)) / columns);
    const cardHeight = this.scaleSize(mobile ? 238 : 224);
    const cardsY = bodyY + this.scaleSize(130);

    this.getSocialLinks().forEach((social, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      this.renderSocialCard(
        social,
        bodyX + column * (cardWidth + gap),
        cardsY + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
      );
    });
  }

  private renderSocialCard(
    social: SocialLink,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const padding = this.scaleSize(14);
    const markSize = this.scaleSize(68);
    const actionHeight = this.scaleSize(48);
    const actionInset = this.scaleSize(8);

    this.addPanel(x, y, width, height, UI.CARD, UI.YELLOW_DARK);
    this.addText(
      social.title,
      x + padding,
      y + this.scaleSize(16),
      UI.GREEN,
      this.scaleSize(23),
      '900',
      width - padding * 2,
      'center',
    );

    const markX = x + Math.floor((width - markSize) / 2);
    const markY = y + this.scaleSize(52);
    this.addPanel(
      markX,
      markY,
      markSize,
      markSize,
      UI.PANEL_ALT,
      UI.PANEL_LINE,
    );
    this.addText(
      social.mark,
      markX,
      markY + this.scaleSize(social.mark === 'WWW' ? 22 : 16),
      UI.WHITE,
      this.scaleSize(social.mark === 'WWW' ? 18 : 28),
      '900',
      markSize,
      'center',
    );
    this.addText(
      social.detail,
      x + padding,
      y + this.scaleSize(132),
      UI.MUTED_LIGHT,
      this.scaleSize(16),
      '700',
      width - padding * 2,
      'center',
    );

    this.addButton(
      x + actionInset,
      y + height - actionHeight - actionInset,
      width - actionInset * 2,
      actionHeight,
      social.action,
      this.getSocialKey(social),
      () => this.openSocial(social),
      false,
      'purchase',
      this.scaleSize(19),
    );
  }

  private getSocialKey(social: SocialLink): string {
    return `social-${social.key}`;
  }

  private openSocial(social: SocialLink): void {
    if (social.onSelect !== undefined) {
      social.onSelect();
      return;
    }
    if (social.url === undefined) {
      return;
    }
    const opened = window.open(social.url, '_blank');
    if (opened === null) {
      window.location.href = social.url;
      return;
    }

    opened.opener = null;
    this.setStatus(`${social.title} OPENED`);
  }

  private getSocialLinks(): SocialLink[] {
    const verified = this.discordVerification?.verified === true;
    return [
      ...SOCIAL_LINKS,
      {
        key: 'discord',
        title: 'DISCORD',
        detail: verified ? 'DISCORD VERIFIED' : 'AUTHORIZE TO VERIFY',
        action: verified ? 'VERIFIED' : 'VERIFY DISCORD',
        mark: 'D',
        onSelect: () => this.handleDiscordVerification(),
      },
    ];
  }

  private handleDiscordVerification(): void {
    if (this.discordVerification?.verified) {
      this.setStatus('DISCORD ALREADY VERIFIED');
      return;
    }
    this.airdropClient.startDiscordVerification();
  }
}
