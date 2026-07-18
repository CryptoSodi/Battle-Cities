import { apiFetch } from '../../network/api';
import { StakingClient, StakingSummary } from '../../staking';

import { HeadquartersPanelScene, UI } from './panelUi';

interface LedgerEntry {
  currency: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface TreasuryAccount {
  tokenBalance: number;
  solBalance: number;
  fuelBalance: number;
  inventory: Record<string, number>;
}

const ITEM_ICONS: Record<string, string> = {
  shield: 'powerup.helmet',
  'base-defence': 'powerup.shovel',
  freeze: 'powerup.clock',
  speed: 'powerup.speed',
  upgrade: 'powerup.star',
  'zoom-out': 'powerup.zoomout',
  wipeout: 'powerup.grenade',
  'extra-life': 'powerup.life',
};

export class MainTreasuryScene extends HeadquartersPanelScene {
  private stakingClient = new StakingClient();
  private account: TreasuryAccount = null;
  private staking: StakingSummary = null;
  private entries: LedgerEntry[] = [];
  private showLedger = false;
  private isLoading = false;

  protected getSectionTitle(): string {
    return 'Treasury';
  }

  protected getSectionIcon(): string {
    return 'ui.icon.vault';
  }

  protected getInitialFocusKey(): string {
    return this.showLedger ? 'view-history' : 'view-holdings';
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const activeView = this.showLedger ? 'view-history' : 'view-holdings';
    if (direction > 0 && currentKey === 'back') {
      return activeView;
    }
    if (direction < 0 && currentKey.startsWith('view-')) {
      return 'back';
    }
    return null;
  }

  protected load(): void {
    this.isLoading = true;
    Promise.all([
      this.fetchAccount(),
      this.stakingClient.getSummary(),
      this.fetchLedger(),
    ]).then(([account, staking, entries]) => {
      this.account = account;
      this.staking = staking;
      this.entries = entries;
      this.isLoading = false;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const layout = this.renderHeadquartersFrame(820);
    const { mobile, bodyX, bodyY, bodyWidth } = layout;

    if (this.isLoading) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOADING TREASURY...');
      return;
    }
    if (this.account === null) {
      this.renderMessage(
        bodyX,
        bodyY,
        bodyWidth,
        'LOGIN TO VIEW YOUR TREASURY',
      );
      return;
    }

    const staked = this.staking === null ? 0 : this.staking.me.staked;
    const cooldown =
      this.staking === null
        ? 0
        : this.staking.unstakes.reduce(
            (sum, position) => sum + position.amount,
            0,
          );
    const balances = [
      {
        label: 'BACT',
        value: `${this.account.tokenBalance}`,
        icon: 'shop.coin',
        color: UI.YELLOW,
      },
      {
        label: 'SOL',
        value: `${this.account.solBalance}`,
        icon: 'shop.tab.solana',
        color: UI.WHITE,
      },
      {
        label: 'FUEL',
        value: `${this.account.fuelBalance}`,
        icon: 'shop.fuel',
        color: UI.WHITE,
      },
      {
        label: 'STAKED',
        value: cooldown > 0 ? `${staked} +${cooldown}` : `${staked}`,
        icon: 'ui.icon.lock',
        color: UI.WHITE,
      },
    ];
    const gap = mobile ? this.scaleSize(10) : 16;
    const balanceWidth = Math.floor((bodyWidth - gap * 3) / 4);
    const balanceHeight = mobile ? this.scaleSize(102) : 100;

    balances.forEach(({ label, value, icon, color }, index) => {
      const cardX = bodyX + index * (balanceWidth + gap);
      this.addPanel(
        cardX,
        bodyY,
        balanceWidth,
        balanceHeight,
        UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      const iconSize = mobile ? this.scaleSize(38) : 38;
      this.addIcon(
        icon,
        cardX + (mobile ? this.scaleSize(14) : 14),
        bodyY + Math.floor((balanceHeight - iconSize) / 2),
        iconSize,
      );
      this.addText(
        label,
        cardX + (mobile ? this.scaleSize(62) : 62),
        bodyY + (mobile ? this.scaleSize(18) : 17),
        UI.MUTED,
        mobile ? this.scaleSize(18) : 19,
        '800',
        balanceWidth - (mobile ? this.scaleSize(76) : 76),
      );
      this.addText(
        value,
        cardX + (mobile ? this.scaleSize(62) : 62),
        bodyY + (mobile ? this.scaleSize(51) : 49),
        color,
        mobile ? this.scaleSize(25) : 26,
        '900',
        balanceWidth - (mobile ? this.scaleSize(76) : 76),
      );
    });

    const tabY = bodyY + balanceHeight + (mobile ? this.scaleSize(22) : 22);
    const tabGap = mobile ? this.scaleSize(12) : 14;
    const tabWidth = Math.floor((bodyWidth - tabGap) / 2);
    const tabHeight = mobile ? this.scaleSize(50) : 48;
    this.addButton(
      bodyX,
      tabY,
      tabWidth,
      tabHeight,
      'HOLDINGS',
      'view-holdings',
      () => {
        this.showLedger = false;
        this.refresh('view-holdings');
      },
      !this.showLedger,
      'normal',
      mobile ? this.scaleSize(22) : 23,
      true,
    );
    this.addButton(
      bodyX + tabWidth + tabGap,
      tabY,
      tabWidth,
      tabHeight,
      'HISTORY',
      'view-history',
      () => {
        this.showLedger = true;
        this.refresh('view-history');
      },
      this.showLedger,
      'normal',
      mobile ? this.scaleSize(22) : 23,
      true,
    );

    const contentY = tabY + tabHeight + (mobile ? this.scaleSize(24) : 24);
    if (this.showLedger) {
      this.renderLedger(bodyX, contentY, bodyWidth, mobile);
    } else {
      this.renderItems(bodyX, contentY, bodyWidth, mobile);
    }
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

  private renderItems(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    this.addSectionHeading('Owned Items', x, y, width);
    const inventory = this.account.inventory || {};
    const owned = Object.keys(inventory).filter((key) => inventory[key] > 0);
    const gridY = y + (mobile ? this.scaleSize(58) : 60);

    if (owned.length === 0) {
      this.addPanel(
        x,
        gridY,
        width,
        this.scaleSize(112),
        UI.PAGE,
        UI.PANEL_LINE,
      );
      this.addText(
        'NO ITEMS OWNED - VISIT THE SHOP',
        x,
        gridY + this.scaleSize(40),
        UI.MUTED_LIGHT,
        this.scaleSize(22),
        '800',
        width,
        'center',
      );
      return;
    }

    const columns = 4;
    const gap = mobile ? this.scaleSize(12) : 16;
    const cardWidth = Math.floor((width - gap * (columns - 1)) / columns);
    const cardHeight = mobile ? this.scaleSize(164) : 158;
    owned.slice(0, 8).forEach((itemId, index) => {
      const cardX = x + (index % columns) * (cardWidth + gap);
      const cardY = gridY + Math.floor(index / columns) * (cardHeight + gap);
      const iconId = ITEM_ICONS[itemId];
      const iconSize = mobile ? this.scaleSize(68) : 66;
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        UI.YELLOW_DARK,
      );
      this.addText(
        itemId.replace(/-/g, ' ').toUpperCase(),
        cardX + 10,
        cardY + (mobile ? this.scaleSize(14) : 13),
        UI.GREEN,
        mobile ? this.scaleSize(20) : 21,
        '900',
        cardWidth - 20,
        'center',
      );
      if (iconId !== undefined) {
        this.addIcon(
          iconId,
          cardX + Math.floor((cardWidth - iconSize) / 2),
          cardY + (mobile ? this.scaleSize(48) : 45),
          iconSize,
        );
      }
      this.addPanel(
        cardX + 8,
        cardY + cardHeight - this.scaleSize(42) - 8,
        cardWidth - 16,
        this.scaleSize(42),
        UI.PRICE,
        UI.PRICE_BORDER,
      );
      this.addText(
        `OWNED  ${inventory[itemId]}`,
        cardX + 10,
        cardY + cardHeight - this.scaleSize(40),
        UI.PRICE_TEXT,
        mobile ? this.scaleSize(19) : 20,
        '900',
        cardWidth - 20,
        'center',
      );
    });
  }

  private renderLedger(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    this.addSectionHeading('Recent Activity', x, y, width);
    const tableY = y + (mobile ? this.scaleSize(58) : 60);
    this.addTableHeader(x, tableY, width, [
      { label: 'ACTION', offset: 18, width: Math.round(width * 0.46) },
      {
        label: 'AMOUNT',
        offset: Math.round(width * 0.5),
        width: Math.round(width * 0.22),
      },
      { label: 'DATE', offset: width - 190, width: 172, align: 'right' },
    ]);

    if (this.entries.length === 0) {
      this.addText(
        'NO ACTIVITY YET',
        x,
        tableY + this.scaleSize(74),
        UI.MUTED_LIGHT,
        this.scaleSize(23),
        '800',
        width,
        'center',
      );
      return;
    }

    this.entries.slice(0, 8).forEach((entry, index) => {
      const rowY = tableY + 54 + index * (mobile ? this.scaleSize(54) : 52);
      this.addPanel(
        x,
        rowY,
        width,
        mobile ? this.scaleSize(48) : 46,
        index % 2 === 0 ? UI.PAGE : UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      this.addText(
        entry.reason.replace(/-/g, ' ').toUpperCase(),
        x + 18,
        rowY + 12,
        UI.WHITE,
        mobile ? this.scaleSize(18) : 19,
        '800',
        Math.round(width * 0.44),
      );
      const sign = entry.amount > 0 ? '+' : '';
      this.addText(
        `${sign}${entry.amount} ${entry.currency
          .replace('item:', '')
          .toUpperCase()}`,
        x + Math.round(width * 0.5),
        rowY + 12,
        entry.amount > 0 ? UI.GREEN : UI.MUTED_LIGHT,
        mobile ? this.scaleSize(18) : 19,
        '800',
        Math.round(width * 0.25),
      );
      this.addText(
        entry.createdAt.slice(0, 10),
        x + width - 190,
        rowY + 12,
        UI.MUTED,
        mobile ? this.scaleSize(17) : 18,
        '700',
        172,
        'right',
      );
    });
  }

  private async fetchAccount(): Promise<TreasuryAccount> {
    try {
      const response = await apiFetch('/api/economy/account');
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as {
        authenticated?: boolean;
        account?: TreasuryAccount;
      };
      return body?.authenticated === true ? body.account : null;
    } catch {
      return null;
    }
  }

  private async fetchLedger(): Promise<LedgerEntry[]> {
    try {
      const response = await apiFetch('/api/economy/ledger');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.entries) ? body.entries : [];
    } catch {
      return [];
    }
  }
}
