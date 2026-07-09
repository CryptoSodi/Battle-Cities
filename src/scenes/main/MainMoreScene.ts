import { GameSceneType } from '../GameSceneType';

import { PanelScene, UI } from './panelUi';

// Headquarters hub, shop-styled: a card grid of the economy/meta screens
// (the plan's "More" nav group), so the main menu stays a tank menu.
export class MainMoreScene extends PanelScene {
  protected getTitle(): string {
    return 'Headquarters';
  }

  protected load(): void {
    // Static content.
  }

  protected renderContent(): void {
    const x = this.pageX;
    const y = this.pageY;

    const entries: [string, string, GameSceneType][] = [
      ['TREASURY', 'YOUR BALANCES, ITEMS AND HISTORY', GameSceneType.MainTreasury],
      ['CAMPAIGNS', 'EVENTS, OPERATIONS AND PHASE REWARDS', GameSceneType.MainEvents],
      ['STAKING', 'LOCK BACT, EARN SP AND PERKS', GameSceneType.MainStaking],
      ['TRADING', 'SWAP TOKENS ON RAYDIUM FOR BOOSTS', GameSceneType.MainTrading],
      ['BOOST', 'YOUR ACTIVE TRAIT BOOSTS AND PERKS', GameSceneType.MainBoost],
      ['AIRDROP', 'BACT ALLOCATION AND CLAIMS', GameSceneType.MainAirdrop],
      ['FIELD MANUAL', 'TANKS, WEAPONS, POWERUPS, ENEMIES', GameSceneType.MainWiki],
    ];

    const cardWidth = Math.floor((UI.WIDTH - 24) / 2);
    const cardHeight = 116;

    entries.forEach(([label, detail, sceneType], index) => {
      const cardX = x + (index % 2) * (cardWidth + 24);
      const cardY = y + Math.floor(index / 2) * (cardHeight + 24);

      this.addPanel(cardX, cardY, cardWidth, cardHeight, UI.PANEL, UI.PANEL_LINE);
      this.addText(detail, cardX + 24, cardY + 64, UI.MUTED_LIGHT, 17, '700', cardWidth - 48);
      this.addButton(
        cardX + 12,
        cardY + 12,
        cardWidth - 24,
        44,
        label,
        `hub-${label}`,
        () => {
          this.navigator.push(sceneType);
        },
        false,
        'normal',
        24,
      );
    });
  }
}
