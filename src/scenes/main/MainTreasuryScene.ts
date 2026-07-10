import { apiFetch } from '../../network/api';
import { StakingClient, StakingSummary } from '../../staking';

import { PanelScene, UI } from './panelUi';

interface LedgerEntry {
  currency: string;
  amount: number;
  reason: string;
  createdAt: string;
}

// Owned items reuse the in-game powerup art from the main atlas.
const ITEM_ICONS: Record<string, string> = {
  shield: 'powerup.helmet',
  'base-defence': 'powerup.shovel',
  freeze: 'powerup.clock',
  speed: 'powerup.speed',
  upgrade: 'powerup.star',
  'zoom-out': 'powerup.zoomout',
  wipeout: 'powerup.grenade',
  'extra-life': 'powerup.tank',
};

// The player's treasury, shop-styled: balance stat cards on top, owned item
// tiles in the middle (shop side-panel look), and the ledger history table.
export class MainTreasuryScene extends PanelScene {
  private stakingClient = new StakingClient();
  private account: any = null;
  private staking: StakingSummary = null;
  private entries: LedgerEntry[] = [];
  private showLedger = false;
  private isLoading = false;

  protected getTitle(): string {
    return 'Treasury';
  }

  protected getTitleIcon(): string {
    return 'ui.icon.vault';
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
    const x = this.pageX;
    const y = this.pageY;

    if (this.isLoading) {
      this.addText('LOADING...', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    if (this.account === null) {
      this.addText('LOGIN TO SEE YOUR TREASURY', x + 16, y + 40, UI.MUTED_LIGHT, 26, '800', 600);
      return;
    }

    // Balance stat cards.
    const cardWidth = 232;
    const cardGap = 24;
    const staked = this.staking === null ? 0 : this.staking.me.staked;
    const cooldown =
      this.staking === null
        ? 0
        : this.staking.unstakes.reduce((sum, position) => sum + position.amount, 0);

    this.addStatCard(x, y, cardWidth, 96, 'BACT', `${this.account.tokenBalance}`, UI.YELLOW, 'shop.coin');
    this.addStatCard(x + (cardWidth + cardGap), y, cardWidth, 96, 'SOL', `${this.account.solBalance}`);
    this.addStatCard(x + (cardWidth + cardGap) * 2, y, cardWidth, 96, 'FUEL', `${this.account.fuelBalance}`, UI.WHITE, 'shop.fuel');
    this.addStatCard(
      x + (cardWidth + cardGap) * 3,
      y,
      cardWidth,
      96,
      'STAKED',
      cooldown > 0 ? `${staked} (+${cooldown})` : `${staked}`,
    );

    // View toggle.
    this.addButton(x + UI.WIDTH - 200, y + 24, 176, 48, this.showLedger ? 'HOLDINGS' : 'HISTORY', 'toggle', () => {
      this.showLedger = !this.showLedger;
      this.refresh('toggle');
    });

    if (this.showLedger) {
      this.renderLedger(x, y + 132);
      return;
    }

    this.renderItems(x, y + 132);
  }

  private renderItems(x: number, y: number): void {
    this.addText('ITEMS', x + 4, y, UI.MUTED, 24, '800', 300);

    const inventory = this.account.inventory || {};
    const owned = Object.keys(inventory).filter((key) => inventory[key] > 0);

    if (owned.length === 0) {
      this.addPanel(x, y + 40, UI.WIDTH, 96, UI.PANEL, UI.PANEL_LINE);
      this.addText(
        'NO ITEMS OWNED - VISIT THE SHOP',
        x,
        y + 74,
        UI.MUTED_LIGHT,
        22,
        '800',
        UI.WIDTH,
        'center',
      );
      return;
    }

    const tileWidth = 292;
    const tileGap = 24;
    owned.slice(0, 8).forEach((itemId, index) => {
      const tileX = x + (index % 4) * (tileWidth + tileGap);
      const tileY = y + 40 + Math.floor(index / 4) * 92;
      this.addPanel(tileX, tileY, tileWidth, 72, UI.PANEL_ALT, UI.PANEL_LINE);

      // In-game powerup art on the tile, like the shop's item cards.
      const iconId = ITEM_ICONS[itemId];
      if (iconId !== undefined) {
        this.addIcon(iconId, tileX + 14, tileY + 16, 40);
      }

      this.addText(
        itemId.replace(/-/g, ' ').toUpperCase(),
        tileX + (iconId !== undefined ? 66 : 18),
        tileY + 24,
        UI.WHITE,
        22,
        '800',
        tileWidth - (iconId !== undefined ? 150 : 110),
      );
      this.addText(
        `X${this.account.inventory[itemId]}`,
        tileX + tileWidth - 82,
        tileY + 22,
        UI.YELLOW,
        26,
        '900',
        64,
        'right',
      );
    });
  }

  private renderLedger(x: number, y: number): void {
    this.addText('RECENT ACTIVITY', x + 4, y, UI.MUTED, 24, '800', 300);

    this.addTableHeader(x, y + 40, UI.WIDTH, [
      { label: 'ACTION', offset: 24, width: 360 },
      { label: 'AMOUNT', offset: 620, width: 240 },
      { label: 'DATE', offset: UI.WIDTH - 224, width: 200, align: 'right' },
    ]);

    if (this.entries.length === 0) {
      this.addText('NO ACTIVITY YET', x + 24, y + 112, UI.MUTED_LIGHT, 24, '800', 400);
      return;
    }

    this.entries.slice(0, 8).forEach((entry, index) => {
      const rowY = y + 96 + index * 46;
      if (index % 2 === 1) {
        this.addPanel(x, rowY - 8, UI.WIDTH, 44, '#0f0e0a', null);
      }

      this.addText(
        entry.reason.replace(/-/g, ' ').toUpperCase(),
        x + 24,
        rowY,
        UI.WHITE,
        22,
        '800',
        420,
      );
      const sign = entry.amount > 0 ? '+' : '';
      this.addText(
        `${sign}${entry.amount} ${entry.currency.replace('item:', '').toUpperCase()}`,
        x + 620,
        rowY,
        entry.amount > 0 ? UI.GREEN : UI.MUTED_LIGHT,
        22,
        '800',
        280,
      );
      this.addText(
        entry.createdAt.slice(0, 10),
        x + UI.WIDTH - 224,
        rowY,
        UI.MUTED,
        20,
        '700',
        200,
        'right',
      );
    });
  }

  private async fetchAccount(): Promise<any> {
    try {
      const response = await apiFetch('/api/economy/account');
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
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
