import { TokenCatalogItem, TradingClient } from '../../trading';

import { PanelScene, UI } from './panelUi';

// Trade & Boost, shop-styled after the Mattle reference: explanation panel on
// top, token-to-trait catalog table below with a swap action per row. Swaps
// stay DEV MOCKS until the BACT testnet mint + Raydium terminal are live —
// the server still enforces signature idempotency and eligibility.
export class MainTradingScene extends PanelScene {
  private tradingClient = new TradingClient();
  private tokens: TokenCatalogItem[] = [];
  private isLoading = false;

  protected getTitle(): string {
    return 'Trade and Boost';
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
    const x = this.pageX;
    const y = this.pageY;

    // Explanation panel (reference: swap terminal + short explanation).
    this.addPanel(x, y, UI.WIDTH, 96, UI.PANEL, UI.PANEL_LINE);
    this.addText(
      'LISTED TOKENS BOOST SPECIFIC TRAITS VIA TRADING VOLUME.',
      x + 24,
      y + 16,
      UI.WHITE,
      22,
      '800',
      UI.WIDTH - 300,
    );
    this.addText(
      'UNLISTED TOKEN VOLUME COMBINES TO BOOST ARMOR. SWAPS RUN ON RAYDIUM.',
      x + 24,
      y + 52,
      UI.MUTED_LIGHT,
      20,
      '700',
      UI.WIDTH - 300,
    );
    this.addText('DEV MODE', x + UI.WIDTH - 170, y + 32, UI.MUTED, 22, '900', 150, 'center');

    if (this.isLoading) {
      this.addText('LOADING...', x + 16, y + 140, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    // Token catalog table.
    const tableY = y + 128;
    this.addTableHeader(x, tableY, UI.WIDTH, [
      { label: 'TOKEN', offset: 24, width: 240 },
      { label: 'NAME', offset: 280, width: 360 },
      { label: 'BOOSTS', offset: 680, width: 220 },
      { label: 'ACTION', offset: UI.WIDTH - 204, width: 180, align: 'right' },
    ]);

    if (this.tokens.length === 0) {
      this.addText('CATALOG UNAVAILABLE', x + 24, tableY + 72, UI.MUTED_LIGHT, 24, '800', 400);
      return;
    }

    this.tokens.slice(0, 8).forEach((token, index) => {
      const rowY = tableY + 60 + index * 56;
      if (index % 2 === 1) {
        this.addPanel(x, rowY - 10, UI.WIDTH, 52, '#0f0e0a', null);
      }

      const isNative = token.group === 'native';
      this.addText(token.symbol, x + 24, rowY, isNative ? UI.YELLOW : UI.WHITE, 26, '900', 240);
      this.addText(token.name, x + 280, rowY + 4, UI.MUTED_LIGHT, 20, '700', 380);
      this.addText(
        token.trait === 'all' ? 'ALL STATS' : (token.trait || 'armor').toUpperCase(),
        x + 680,
        rowY + 2,
        isNative ? UI.YELLOW : UI.WHITE,
        22,
        '800',
        220,
      );
      this.addButton(
        x + UI.WIDTH - 204,
        rowY - 6,
        180,
        44,
        'SWAP $100',
        `swap-${token.mint}`,
        () => {
          this.swap(token);
        },
        false,
        'normal',
        20,
      );
    });
  }

  private swap(token: TokenCatalogItem): void {
    this.tradingClient
      .verifySwap({
        signature: createDevSignature(),
        fromMint: 'So11111111111111111111111111111111111111112', // SOL
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

// Dev-mode stand-in for a real transaction signature (base58 alphabet).
// Replaced by the wallet's actual signature once real swaps exist.
function createDevSignature(): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';
  for (let i = 0; i < 44; i += 1) {
    signature += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return signature;
}
