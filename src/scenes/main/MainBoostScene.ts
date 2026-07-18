import { BoostStatus, TradingClient } from '../../trading';

import { HeadquartersPanelScene, UI } from './panelUi';

interface TierRow {
  level: number;
  stake: number;
  hull: number;
  armor: number;
  engine: number;
  salvage: number;
}

export class MainBoostScene extends HeadquartersPanelScene {
  private tradingClient = new TradingClient();
  private status: BoostStatus = null;
  private isLoading = false;

  protected getSectionTitle(): string {
    return 'Boosts';
  }

  protected getSectionIcon(): string {
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
    const mobile = this.isMobileLayout();
    const layout = this.renderHeadquartersFrame(mobile ? 1060 : 800);
    const { bodyX, bodyY, bodyWidth } = layout;

    if (this.isLoading) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOADING BOOST STATUS...');
      return;
    }
    if (this.status === null || this.status.authenticated !== true) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOGIN TO VIEW YOUR BOOSTS');
      return;
    }

    const { trading, staking } = this.status;
    const traits = [
      { label: 'HULL', value: trading.boosts.hull, detail: 'HULL INTEGRITY' },
      {
        label: 'ARMOR',
        value: trading.boosts.armor,
        detail: 'DAMAGE RESISTANCE',
      },
      {
        label: 'ENGINE',
        value: trading.boosts.engine,
        detail: 'MOVEMENT SPEED',
      },
      {
        label: 'SALVAGE',
        value: trading.boosts.salvage,
        detail: 'REWARD RECOVERY',
      },
    ];
    const columns = mobile ? 2 : 4;
    const gap = mobile ? this.scaleSize(12) : 16;
    const cardWidth = Math.floor((bodyWidth - gap * (columns - 1)) / columns);
    const cardHeight = mobile ? this.scaleSize(116) : 112;

    traits.forEach(({ label, value, detail }, index) => {
      const cardX = bodyX + (index % columns) * (cardWidth + gap);
      const cardY = bodyY + Math.floor(index / columns) * (cardHeight + gap);
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        UI.YELLOW_DARK,
      );
      this.addText(
        `${label} BOOST`,
        cardX + this.scaleSize(14),
        cardY + this.scaleSize(14),
        UI.GREEN,
        this.scaleSize(20),
        '900',
        cardWidth - this.scaleSize(28),
      );
      this.addText(
        `+${value}%`,
        cardX + this.scaleSize(14),
        cardY + this.scaleSize(43),
        value > 0 ? UI.YELLOW : UI.WHITE,
        this.scaleSize(31),
        '900',
        cardWidth - this.scaleSize(28),
      );
      this.addText(
        detail,
        cardX + this.scaleSize(14),
        cardY + this.scaleSize(82),
        UI.MUTED,
        this.scaleSize(15),
        '700',
        cardWidth - this.scaleSize(28),
      );
    });

    const traitRows = Math.ceil(traits.length / columns);
    const volumeY =
      bodyY +
      traitRows * cardHeight +
      (traitRows - 1) * gap +
      this.scaleSize(24);
    this.addSectionHeading('30-Day Trading Volume', bodyX, volumeY, bodyWidth);
    this.addText(
      `$${trading.totalVolumeUsd}`,
      bodyX + bodyWidth - this.scaleSize(260),
      volumeY,
      UI.YELLOW,
      this.scaleSize(27),
      '900',
      this.scaleSize(260),
      'right',
    );

    const tableY = volumeY + this.scaleSize(58);
    this.addTableHeader(bodyX, tableY, bodyWidth, [
      { label: 'ASSET', offset: 18, width: Math.round(bodyWidth * 0.24) },
      {
        label: 'TYPE',
        offset: Math.round(bodyWidth * 0.28),
        width: Math.round(bodyWidth * 0.18),
      },
      {
        label: 'PERK',
        offset: Math.round(bodyWidth * 0.5),
        width: Math.round(bodyWidth * 0.2),
      },
      { label: 'VOLUME', offset: bodyWidth - 190, width: 172, align: 'right' },
    ]);

    if (trading.rows.length === 0) {
      this.addPanel(
        bodyX,
        tableY + this.scaleSize(54),
        bodyWidth,
        this.scaleSize(92),
        UI.PAGE,
        UI.PANEL_LINE,
      );
      this.addText(
        'NO TRADES IN THE LAST 30 DAYS',
        bodyX,
        tableY + this.scaleSize(78),
        UI.MUTED_LIGHT,
        this.scaleSize(21),
        '800',
        bodyWidth,
        'center',
      );
    } else {
      trading.rows.slice(0, 5).forEach((row, index) => {
        const rowY = tableY + this.scaleSize(54 + index * 50);
        this.addPanel(
          bodyX,
          rowY,
          bodyWidth,
          this.scaleSize(46),
          index % 2 === 0 ? UI.PAGE : UI.PANEL_ALT,
          UI.PANEL_LINE,
        );
        this.addText(
          row.symbol,
          bodyX + 18,
          rowY + 11,
          UI.WHITE,
          this.scaleSize(20),
          '900',
          Math.round(bodyWidth * 0.22),
        );
        this.addText(
          row.group.toUpperCase(),
          bodyX + Math.round(bodyWidth * 0.28),
          rowY + 12,
          UI.MUTED_LIGHT,
          this.scaleSize(18),
          '700',
          Math.round(bodyWidth * 0.18),
        );
        this.addText(
          row.trait === 'all' ? 'ALL STATS' : row.trait.toUpperCase(),
          bodyX + Math.round(bodyWidth * 0.5),
          rowY + 12,
          UI.GREEN,
          this.scaleSize(18),
          '800',
          Math.round(bodyWidth * 0.2),
        );
        this.addText(
          `$${row.volumeUsd}`,
          bodyX + bodyWidth - 190,
          rowY + 11,
          UI.YELLOW,
          this.scaleSize(20),
          '900',
          172,
          'right',
        );
      });
    }

    const volumeRowsHeight =
      trading.rows.length === 0
        ? this.scaleSize(160)
        : this.scaleSize(54 + Math.min(5, trading.rows.length) * 50);
    const perksY = tableY + volumeRowsHeight + this.scaleSize(24);
    this.addSectionHeading('Staking Perks', bodyX, perksY, bodyWidth);
    const perksPanelY = perksY + this.scaleSize(58);
    const perksHeight = this.scaleSize(220);
    this.addPanel(
      bodyX,
      perksPanelY,
      bodyWidth,
      perksHeight,
      UI.PAGE,
      UI.PANEL_LINE,
    );

    const summaryWidth = mobile
      ? Math.round(bodyWidth * 0.34)
      : Math.round(bodyWidth * 0.28);
    this.addText(
      `LEVEL ${staking.tier.level}`,
      bodyX + this.scaleSize(20),
      perksPanelY + this.scaleSize(20),
      UI.YELLOW,
      this.scaleSize(30),
      '900',
      summaryWidth - this.scaleSize(40),
    );
    this.addText(
      `STAKED  ${staking.staked}`,
      bodyX + this.scaleSize(20),
      perksPanelY + this.scaleSize(68),
      UI.WHITE,
      this.scaleSize(20),
      '800',
      summaryWidth - this.scaleSize(40),
    );
    this.addText(
      staking.nextTier === null
        ? 'MAXIMUM TIER'
        : `NEXT  ${staking.nextTier.stake}`,
      bodyX + this.scaleSize(20),
      perksPanelY + this.scaleSize(104),
      UI.MUTED_LIGHT,
      this.scaleSize(18),
      '800',
      summaryWidth - this.scaleSize(40),
    );

    const tierX = bodyX + summaryWidth;
    const tierWidth = bodyWidth - summaryWidth - this.scaleSize(16);
    this.addTableHeader(tierX, perksPanelY + this.scaleSize(12), tierWidth, [
      { label: 'LVL', offset: 12, width: 56 },
      {
        label: 'STAKE',
        offset: Math.round(tierWidth * 0.16),
        width: Math.round(tierWidth * 0.25),
      },
      { label: 'HULL', offset: Math.round(tierWidth * 0.48), width: 80 },
      { label: 'ARM', offset: Math.round(tierWidth * 0.64), width: 70 },
      { label: 'ENG', offset: Math.round(tierWidth * 0.78), width: 70 },
      { label: 'SLV', offset: tierWidth - 62, width: 50, align: 'right' },
    ]);
    this.getTierRows().forEach((tier, index) => {
      const rowY = perksPanelY + this.scaleSize(64 + index * 30);
      const active = tier.level === staking.tier.level;
      if (active) {
        this.addPanel(
          tierX,
          rowY - 3,
          tierWidth,
          this.scaleSize(28),
          UI.GREEN_PANEL,
          UI.PRICE_BORDER,
        );
      }
      const color = active ? UI.GREEN : UI.MUTED_LIGHT;
      this.addText(
        `${tier.level}`,
        tierX + 12,
        rowY,
        color,
        this.scaleSize(16),
        '800',
        56,
      );
      this.addText(
        `${tier.stake}`,
        tierX + Math.round(tierWidth * 0.16),
        rowY,
        color,
        this.scaleSize(16),
        '800',
        Math.round(tierWidth * 0.25),
      );
      this.addText(
        `+${tier.hull}%`,
        tierX + Math.round(tierWidth * 0.48),
        rowY,
        color,
        this.scaleSize(16),
        '800',
        80,
      );
      this.addText(
        `+${tier.armor}%`,
        tierX + Math.round(tierWidth * 0.64),
        rowY,
        color,
        this.scaleSize(16),
        '800',
        70,
      );
      this.addText(
        `+${tier.engine}%`,
        tierX + Math.round(tierWidth * 0.78),
        rowY,
        color,
        this.scaleSize(16),
        '800',
        70,
      );
      this.addText(
        `+${tier.salvage}%`,
        tierX + tierWidth - 72,
        rowY,
        color,
        this.scaleSize(16),
        '800',
        60,
        'right',
      );
    });
  }

  private renderMessage(
    x: number,
    y: number,
    width: number,
    text: string,
  ): void {
    this.addPanel(x, y, width, this.scaleSize(128), UI.PAGE, UI.PANEL_LINE);
    this.addText(
      text,
      x,
      y + this.scaleSize(48),
      UI.MUTED_LIGHT,
      this.scaleSize(24),
      '800',
      width,
      'center',
    );
  }

  private getTierRows(): TierRow[] {
    return [
      { level: 0, stake: 0, hull: 0, armor: 0, engine: 0, salvage: 0 },
      { level: 1, stake: 2000, hull: 2, armor: 3, engine: 2, salvage: 3 },
      { level: 2, stake: 10000, hull: 5, armor: 8, engine: 5, salvage: 8 },
      { level: 3, stake: 50000, hull: 10, armor: 15, engine: 10, salvage: 15 },
      { level: 4, stake: 200000, hull: 20, armor: 30, engine: 20, salvage: 30 },
    ];
  }
}
