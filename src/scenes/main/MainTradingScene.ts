import { TokenCatalogItem, TradingClient } from '../../trading';

import { HeadquartersPanelScene, UI } from './panelUi';

function createDevSignature(): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';
  for (let i = 0; i < 44; i += 1) {
    signature += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return signature;
}

export class MainTradingScene extends HeadquartersPanelScene {
  private tradingClient = new TradingClient();
  private tokens: TokenCatalogItem[] = [];
  private isLoading = false;

  protected getSectionTitle(): string {
    return 'Trading';
  }

  protected getSectionIcon(): string {
    return 'ui.icon.swap';
  }

  protected getInitialFocusKey(): string {
    return this.tokens.length > 0 ? `swap-${this.tokens[0].mint}` : 'back';
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const firstKey =
      this.tokens.length > 0 ? `swap-${this.tokens[0].mint}` : null;
    if (direction > 0 && currentKey === 'back') {
      return firstKey;
    }
    if (direction < 0 && currentKey.startsWith('swap-')) {
      const index = this.tokens.findIndex(
        (token) => `swap-${token.mint}` === currentKey,
      );
      const columns = this.isMobileLayout() ? 2 : 4;
      return index >= 0 && index < columns ? 'back' : null;
    }
    return null;
  }

  protected load(): void {
    this.isLoading = true;
    this.tradingClient.listTokens().then((tokens) => {
      this.tokens = tokens.filter((token) => token.group !== 'stable');
      this.isLoading = false;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const mobile = this.isMobileLayout();
    const layout = this.renderHeadquartersFrame(mobile ? 1160 : 720);
    const { bodyX, bodyY, bodyWidth } = layout;
    const overviewHeight = mobile ? this.scaleSize(112) : 104;

    this.addPanel(
      bodyX,
      bodyY,
      bodyWidth,
      overviewHeight,
      UI.PAGE,
      UI.YELLOW_DARK,
    );
    this.addText(
      'RAYDIUM MARKET BOOSTS',
      bodyX + this.scaleSize(22),
      bodyY + this.scaleSize(16),
      UI.GREEN,
      this.scaleSize(23),
      '900',
      bodyWidth - this.scaleSize(44),
    );
    this.addText(
      'TRADE LISTED ASSETS TO BUILD 30-DAY BATTLE TRAIT BOOSTS.',
      bodyX + this.scaleSize(22),
      bodyY + this.scaleSize(51),
      UI.MUTED_LIGHT,
      this.scaleSize(18),
      '700',
      bodyWidth - this.scaleSize(220),
    );
    this.addText(
      'DEV MODE',
      bodyX + bodyWidth - this.scaleSize(174),
      bodyY + this.scaleSize(50),
      UI.MUTED,
      this.scaleSize(18),
      '900',
      this.scaleSize(150),
      'center',
    );

    const headingY = bodyY + overviewHeight + this.scaleSize(24);
    this.addSectionHeading('Swap Catalog', bodyX, headingY, bodyWidth);

    if (this.isLoading) {
      this.addText(
        'LOADING MARKET...',
        bodyX,
        headingY + this.scaleSize(86),
        UI.MUTED_LIGHT,
        this.scaleSize(24),
        '800',
        bodyWidth,
        'center',
      );
      return;
    }
    if (this.tokens.length === 0) {
      this.addText(
        'CATALOG UNAVAILABLE',
        bodyX,
        headingY + this.scaleSize(86),
        UI.MUTED_LIGHT,
        this.scaleSize(24),
        '800',
        bodyWidth,
        'center',
      );
      return;
    }

    const columns = mobile ? 2 : 4;
    const gap = mobile ? this.scaleSize(14) : 16;
    const cardWidth = Math.floor((bodyWidth - gap * (columns - 1)) / columns);
    const cardHeight = mobile ? this.scaleSize(214) : 208;
    const gridY = headingY + this.scaleSize(60);

    this.tokens.slice(0, 8).forEach((token, index) => {
      const cardX = bodyX + (index % columns) * (cardWidth + gap);
      const cardY = gridY + Math.floor(index / columns) * (cardHeight + gap);
      const padding = this.scaleSize(16);
      const isNative = token.group === 'native';
      const trait =
        token.trait === 'all'
          ? 'ALL STATS'
          : (token.trait || 'armor').toUpperCase();

      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        UI.YELLOW_DARK,
      );
      this.addPanel(
        cardX + this.scaleSize(5),
        cardY + this.scaleSize(5),
        cardWidth - this.scaleSize(10),
        this.scaleSize(2),
        UI.PANEL_LINE,
        null,
      );
      this.addText(
        token.symbol,
        cardX + padding,
        cardY + this.scaleSize(18),
        isNative ? UI.GREEN : UI.YELLOW,
        this.scaleSize(27),
        '900',
        cardWidth - padding * 2,
        'center',
      );
      this.addText(
        token.name.toUpperCase(),
        cardX + padding,
        cardY + this.scaleSize(61),
        UI.WHITE,
        this.scaleSize(19),
        '800',
        cardWidth - padding * 2,
        'center',
      );
      this.addText(
        `BOOSTS  ${trait}`,
        cardX + padding,
        cardY + this.scaleSize(102),
        UI.MUTED_LIGHT,
        this.scaleSize(19),
        '800',
        cardWidth - padding * 2,
        'center',
      );
      this.addButton(
        cardX + this.scaleSize(8),
        cardY + cardHeight - this.scaleSize(52),
        cardWidth - this.scaleSize(16),
        this.scaleSize(44),
        'SWAP $100',
        `swap-${token.mint}`,
        () => this.swap(token),
        false,
        'purchase',
        this.scaleSize(20),
      );
    });
  }

  private swap(token: TokenCatalogItem): void {
    this.tradingClient
      .verifySwap({
        signature: createDevSignature(),
        fromMint: 'So11111111111111111111111111111111111111112',
        toMint: token.mint,
        volumeUsd: 100,
      })
      .then((result) => {
        this.setStatus(
          result.ok
            ? `+$100 VOLUME -> ${token.symbol}`
            : (result.error || 'SWAP FAILED').toUpperCase(),
        );
      });
  }
}
