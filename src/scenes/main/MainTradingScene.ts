import { TextMenuItem } from '../../gameObjects';
import { TokenCatalogItem, TradingClient } from '../../trading';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

// Trade & Boost terminal (Milestone 5). Top: explanation; bottom: the
// token-to-trait catalog. Swaps are DEV MOCKS until an RPC provider and the
// Jupiter integration are decided (open decisions in the plan doc) — the
// server still enforces signature idempotency and pair eligibility.
export class MainTradingScene extends BoardScene {
  private tradingClient = new TradingClient();
  private tokens: TokenCatalogItem[] = [];
  private selectedIndex = 0;
  private tokenItem: TextMenuItem;

  protected getTitle(): string {
    return 'TRADE AND BOOST';
  }

  protected createMenuItems(): TextMenuItem[] {
    this.tokenItem = new TextMenuItem('TOKEN: -');
    this.tokenItem.selected.addListener(this.handleSelectNext);

    const swapItem = new TextMenuItem('DEV SWAP $100');
    swapItem.selected.addListener(this.handleSwap);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [this.tokenItem, swapItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    this.tradingClient.listTokens().then((tokens) => {
      // Only non-stable tokens are swap targets (stable side is implied SOL).
      this.tokens = tokens.filter((token) => token.group !== 'stable');
      this.isLoading = false;
      this.updateTokenLabel();
      this.requestRender();
    });
  }

  protected renderBoard(): void {
    this.addLine('LISTED TOKENS BOOST TRAITS VIA', 120, config.COLOR_GRAY_LIGHT);
    this.addLine('TRADING VOLUME. UNLISTED VOLUME', 148, config.COLOR_GRAY_LIGHT);
    this.addLine('COMBINES TO BOOST ARMOR.', 176, config.COLOR_GRAY_LIGHT);

    this.addLine('TOKEN            TRAIT', 232, config.COLOR_YELLOW);
    if (this.tokens.length === 0) {
      this.addLine('CATALOG UNAVAILABLE', 264, config.COLOR_GRAY_LIGHT);
      return;
    }

    this.tokens.slice(0, 8).forEach((token, index) => {
      const marker = index === this.selectedIndex ? '>' : ' ';
      const trait = token.trait === 'all' ? 'ALL STATS' : traitLabel(token.trait);
      this.addLine(
        `${marker}${token.symbol.padEnd(8, ' ')} -> ${trait}`,
        264 + index * 32,
        token.group === 'native' ? config.COLOR_YELLOW : config.COLOR_WHITE,
      );
    });

    this.addLine('SWAPS ARE DEV MOCKS UNTIL RPC', 540, config.COLOR_GRAY_LIGHT);
  }

  private updateTokenLabel(): void {
    const token = this.tokens[this.selectedIndex];
    this.tokenItem.setText(`TOKEN: ${token === undefined ? '-' : token.symbol}`);
  }

  private handleSelectNext = (): void => {
    if (this.tokens.length === 0) {
      return;
    }
    this.selectedIndex = (this.selectedIndex + 1) % this.tokens.length;
    this.updateTokenLabel();
    this.requestRender();
  };

  private handleSwap = (): void => {
    const token = this.tokens[this.selectedIndex];
    if (token === undefined) {
      return;
    }

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
  };
}

function traitLabel(trait: string): string {
  switch (trait) {
    case 'hull':
      return 'HULL';
    case 'armor':
      return 'ARMOR';
    case 'engine':
      return 'ENGINE';
    case 'salvage':
      return 'SALVAGE';
    default:
      return 'ARMOR';
  }
}

// Dev-mode stand-in for a real transaction signature (base58 alphabet, unique
// enough for idempotency testing). Replaced by the wallet's actual signature
// once real swaps exist.
function createDevSignature(): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';
  for (let i = 0; i < 44; i += 1) {
    signature += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return signature;
}
