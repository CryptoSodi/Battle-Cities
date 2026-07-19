import { TokenCatalogItem, TradingClient } from '../../trading';

import { HeadquartersPanelScene, UI } from './panelUi';

const DESKTOP_COLUMNS = 4;
const DESKTOP_VISIBLE_ROWS = 2;
const MOBILE_COLUMNS = 2;
const MOBILE_VISIBLE_ROWS = 4;

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
  private scrollRow = 0;

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
    const columns = this.getColumnCount();
    const visibleRows = this.getVisibleRowCount();
    const firstVisible = this.tokens[this.scrollRow * columns];
    if (direction > 0 && currentKey === 'back') {
      return firstVisible === undefined ? null : this.getTokenKey(firstVisible);
    }

    const currentIndex = this.tokens.findIndex(
      (token) => this.getTokenKey(token) === currentKey,
    );
    if (currentIndex < 0) {
      return null;
    }

    const currentRow = Math.floor(currentIndex / columns);
    const currentColumn = currentIndex % columns;
    const nextRow = currentRow + direction;
    const totalRows = Math.ceil(this.tokens.length / columns);
    if (nextRow < 0) {
      return 'back';
    }
    if (nextRow >= totalRows) {
      return null;
    }

    const targetIndex = Math.min(
      this.tokens.length - 1,
      nextRow * columns + currentColumn,
    );
    const targetKey = this.getTokenKey(this.tokens[targetIndex]);
    let nextScrollRow = this.scrollRow;
    if (nextRow < this.scrollRow) {
      nextScrollRow = nextRow;
    } else if (nextRow >= this.scrollRow + visibleRows) {
      nextScrollRow = nextRow - visibleRows + 1;
    }

    if (nextScrollRow !== this.scrollRow) {
      this.scrollRow = nextScrollRow;
      this.refresh(targetKey);
    }

    return targetKey;
  }

  protected load(): void {
    this.isLoading = true;
    this.tradingClient.listTokens().then((tokens) => {
      this.tokens = tokens.filter((token) => token.group !== 'stable');
      this.scrollRow = 0;
      this.isLoading = false;
      this.refresh();
    });
  }

  protected handleTouchScroll(direction: number): boolean {
    if (!this.isMobileLayout()) {
      return false;
    }

    const columns = this.getColumnCount();
    const totalRows = Math.ceil(this.tokens.length / columns);
    const maxScrollRow = Math.max(0, totalRows - this.getVisibleRowCount());
    const nextScrollRow = Math.max(
      0,
      Math.min(this.scrollRow + direction, maxScrollRow),
    );
    if (nextScrollRow === this.scrollRow) {
      return false;
    }

    this.scrollRow = nextScrollRow;
    const firstVisible = this.tokens[nextScrollRow * columns];
    this.refresh(
      firstVisible === undefined ? null : this.getTokenKey(firstVisible),
    );
    return true;
  }

  protected renderContent(): void {
    const mobile = this.isMobileLayout();
    const layout = this.renderHeadquartersFrame(mobile ? 1160 : 720);
    const { bodyX, bodyY, bodyWidth } = layout;
    const overviewHeight = mobile ? this.scaleSize(112) : 104;
    const columns = this.getColumnCount();
    const visibleRows = this.getVisibleRowCount();
    const totalRows = Math.ceil(this.tokens.length / columns);
    const maxScrollRow = Math.max(0, totalRows - visibleRows);
    this.scrollRow = Math.max(0, Math.min(this.scrollRow, maxScrollRow));
    const firstVisibleIndex = this.scrollRow * columns;
    const visibleTokens = this.tokens.slice(
      firstVisibleIndex,
      firstVisibleIndex + columns * visibleRows,
    );

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
    const range =
      this.tokens.length === 0
        ? '0/0'
        : `${firstVisibleIndex + 1}-${firstVisibleIndex +
            visibleTokens.length}/${this.tokens.length}`;
    this.addSectionHeading(
      `Swap Catalog  ${range}`,
      bodyX,
      headingY,
      bodyWidth,
    );

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

    const gap = mobile ? this.scaleSize(14) : 16;
    const cardWidth = Math.floor((bodyWidth - gap * (columns - 1)) / columns);
    const cardHeight = mobile ? this.scaleSize(214) : 208;
    const gridY = headingY + this.scaleSize(60);

    visibleTokens.forEach((token, index) => {
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
        this.getTokenKey(token),
        () => this.swap(token),
        false,
        'purchase',
        this.scaleSize(20),
      );
    });
  }

  private getColumnCount(): number {
    return this.isMobileLayout() ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
  }

  private getVisibleRowCount(): number {
    return this.isMobileLayout() ? MOBILE_VISIBLE_ROWS : DESKTOP_VISIBLE_ROWS;
  }

  private getTokenKey(token: TokenCatalogItem): string {
    return `swap-${token.mint}`;
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
