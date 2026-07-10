import { BoostStatus, TradingClient } from '../../trading';

import { PanelScene, UI } from './panelUi';

// Boost dashboard, shop-styled after the Mattle reference: four trait stat
// cards on top, the 30-day volume table in the middle, and a Staking Perks
// side panel with the tier table.
export class MainBoostScene extends PanelScene {
  private tradingClient = new TradingClient();
  private status: BoostStatus = null;
  private isLoading = false;

  protected getTitle(): string {
    return 'Boost';
  }

  protected getTitleIcon(): string {
    return 'ui.icon.badge.boost';
  }

  protected load(): void {
    this.isLoading = true;

    this.tradingClient.getBoostStatus().then((status) => {
      this.status = status;
      this.isLoading = false;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const x = this.pageX;
    const y = this.pageY;

    if (this.isLoading) {
      this.addText('LOADING...', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    if (this.status === null || this.status.authenticated !== true) {
      this.addText('LOGIN TO SEE BOOST STATUS', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 600);
      return;
    }

    const { trading, staking } = this.status;
    const boosts = trading.boosts;

    // Trait summary cards.
    const cardWidth = 232;
    const cardGap = 24;
    const traits: [string, number][] = [
      ['HULL BOOST', boosts.hull],
      ['ARMOR BOOST', boosts.armor],
      ['ENGINE BOOST', boosts.engine],
      ['SALVAGE BOOST', boosts.salvage],
    ];
    traits.forEach(([label, value], index) => {
      this.addStatCard(
        x + index * (cardWidth + cardGap),
        y,
        cardWidth,
        96,
        label,
        `+${value}%`,
        value > 0 ? UI.YELLOW : UI.WHITE,
      );
    });

    // Main volume panel.
    const mainWidth = UI.WIDTH - 340;
    this.addPanel(x, y + 124, mainWidth, 420, UI.PANEL, UI.PANEL_LINE);
    this.addText('30-DAY TRADING VOLUME', x + 24, y + 144, UI.MUTED, 22, '800', 400);
    this.addText(`$${trading.totalVolumeUsd}`, x + mainWidth - 264, y + 138, UI.YELLOW, 30, '900', 240, 'right');

    this.addTableHeader(x + 24, y + 192, mainWidth - 48, [
      { label: 'ASSET', offset: 16, width: 200 },
      { label: 'TYPE', offset: 260, width: 160 },
      { label: 'PERKS', offset: 440, width: 160 },
      { label: 'VOLUME', offset: mainWidth - 48 - 196, width: 180, align: 'right' },
    ]);

    if (trading.rows.length === 0) {
      this.addText(
        'NO TRADES RECORDED IN THE LAST 30 DAYS.',
        x + 24,
        y + 280,
        UI.MUTED_LIGHT,
        22,
        '800',
        mainWidth - 48,
        'center',
      );
      this.addText(
        'START TRADING TO BOOST IN-GAME TRAITS.',
        x + 24,
        y + 316,
        UI.MUTED,
        20,
        '700',
        mainWidth - 48,
        'center',
      );
    }

    trading.rows.slice(0, 6).forEach((row, index) => {
      const rowY = y + 248 + index * 46;
      if (index % 2 === 1) {
        this.addPanel(x + 24, rowY - 8, mainWidth - 48, 44, '#0f0e0a', null);
      }
      this.addText(row.symbol, x + 40, rowY, UI.WHITE, 24, '900', 200);
      this.addText(row.group.toUpperCase(), x + 284, rowY, UI.MUTED_LIGHT, 20, '700', 160);
      this.addText(
        row.trait === 'all' ? 'ALL STATS' : row.trait.toUpperCase(),
        x + 464,
        rowY,
        UI.YELLOW,
        20,
        '800',
        160,
      );
      this.addText(`$${row.volumeUsd}`, x + mainWidth - 220, rowY, UI.WHITE, 24, '800', 180, 'right');
    });

    this.addText(
      'APPLIES TO ALL MATCHES INCLUDING RANKED.',
      x + 24,
      y + 508,
      UI.MUTED,
      18,
      '800',
      mainWidth - 48,
    );

    // Staking perks side panel.
    const sideX = x + mainWidth + 24;
    const sideWidth = UI.WIDTH - mainWidth - 24;
    this.addPanel(sideX, y + 124, sideWidth, 420, UI.SIDE, UI.PANEL_LINE);
    this.addText('STAKING PERKS', sideX + 20, y + 144, UI.MUTED, 22, '800', sideWidth - 40);
    this.addText(
      `LEVEL ${staking.tier.level}`,
      sideX + 20,
      y + 180,
      UI.YELLOW,
      28,
      '900',
      sideWidth - 40,
    );
    this.addText(
      `STAKE ${staking.staked}` +
        (staking.nextTier !== null ? `  /  NEXT ${staking.nextTier.stake}` : ''),
      sideX + 20,
      y + 218,
      UI.MUTED_LIGHT,
      18,
      '800',
      sideWidth - 40,
    );

    // Tier table.
    this.addText('LVL   STAKE      HULL ARM ENG SLV', sideX + 20, y + 262, UI.MUTED, 16, '800', sideWidth - 40);
    const tiers: any[] = (this.status as any).staking.tier !== undefined
      ? this.getTierRows()
      : [];
    tiers.forEach((tier, index) => {
      const rowY = y + 292 + index * 36;
      const isCurrent = tier.level === staking.tier.level;
      if (isCurrent) {
        this.addPanel(sideX + 12, rowY - 6, sideWidth - 24, 34, UI.CARD, null);
      }
      this.addText(
        `${tier.level}     ${`${tier.stake}`.padEnd(9, ' ')} +${tier.hull}% +${tier.armor}% +${tier.engine}% +${tier.salvage}%`,
        sideX + 20,
        rowY,
        isCurrent ? UI.YELLOW : UI.MUTED_LIGHT,
        16,
        '800',
        sideWidth - 40,
      );
    });
  }

  // The status payload carries only the current/next tier; show the standard
  // ladder (kept in sync with server/stakingStore.js PERK_TIERS).
  private getTierRows(): { level: number; stake: number; hull: number; armor: number; engine: number; salvage: number }[] {
    return [
      { level: 0, stake: 0, hull: 0, armor: 0, engine: 0, salvage: 0 },
      { level: 1, stake: 2000, hull: 2, armor: 3, engine: 2, salvage: 3 },
      { level: 2, stake: 10000, hull: 5, armor: 8, engine: 5, salvage: 8 },
      { level: 3, stake: 50000, hull: 10, armor: 15, engine: 10, salvage: 15 },
      { level: 4, stake: 200000, hull: 20, armor: 30, engine: 20, salvage: 30 },
    ];
  }
}
