import { TextMenuItem } from '../../gameObjects';
import { apiFetch } from '../../network/api';
import { StakingClient, StakingSummary } from '../../staking';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

interface LedgerEntry {
  currency: string;
  amount: number;
  reason: string;
  createdAt: string;
}

// The player's treasury: everything they hold in one place — BACT/SOL/fuel
// balances, owned items, locked stake with cooldowns, and the recent ledger
// history behind it all.
export class MainTreasuryScene extends BoardScene {
  private stakingClient = new StakingClient();
  private account: any = null;
  private staking: StakingSummary = null;
  private entries: LedgerEntry[] = [];
  private showLedger = false;
  private viewItem: TextMenuItem;

  protected getTitle(): string {
    return 'TREASURY';
  }

  protected createMenuItems(): TextMenuItem[] {
    this.viewItem = new TextMenuItem('HISTORY');
    this.viewItem.selected.addListener(this.handleToggleView);

    const refreshItem = new TextMenuItem('REFRESH');
    refreshItem.selected.addListener(this.handleRefresh);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [this.viewItem, refreshItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    Promise.all([
      this.fetchAccount(),
      this.stakingClient.getSummary(),
      this.fetchLedger(),
    ]).then(([account, staking, entries]) => {
      this.account = account;
      this.staking = staking;
      this.entries = entries;
      this.isLoading = false;
      this.requestRender();
    });
  }

  protected renderBoard(): void {
    if (this.account === null) {
      this.addLine('LOGIN TO SEE YOUR TREASURY', 140, config.COLOR_GRAY_LIGHT);
      return;
    }

    if (this.showLedger) {
      this.renderLedger();
      return;
    }

    this.addLine('BALANCES', 120, config.COLOR_YELLOW);
    this.addLine(`BACT ${this.account.tokenBalance}   SOL ${this.account.solBalance}`, 152);
    this.addLine(`FUEL ${this.account.fuelBalance}`, 184);

    if (this.staking !== null) {
      const pendingUnstake = this.staking.unstakes.reduce(
        (sum, position) => sum + position.amount,
        0,
      );
      this.addLine(
        `STAKED ${this.staking.me.staked}` +
          (pendingUnstake > 0 ? `   IN COOLDOWN ${pendingUnstake}` : ''),
        216,
      );
    }

    this.addLine('ITEMS', 264, config.COLOR_YELLOW);
    const inventory = this.account.inventory || {};
    const owned = Object.keys(inventory).filter((key) => inventory[key] > 0);
    if (owned.length === 0) {
      this.addLine('NO ITEMS OWNED - VISIT THE SHOP', 296, config.COLOR_GRAY_LIGHT);
      return;
    }

    owned.slice(0, 8).forEach((itemId, index) => {
      this.addLine(
        `${itemId.replace(/-/g, ' ').toUpperCase().padEnd(16, ' ')}X${inventory[itemId]}`,
        296 + index * 32,
      );
    });
  }

  private renderLedger(): void {
    this.addLine('RECENT ACTIVITY', 120, config.COLOR_YELLOW);
    if (this.entries.length === 0) {
      this.addLine('NO ACTIVITY YET', 160, config.COLOR_GRAY_LIGHT);
      return;
    }

    this.entries.slice(0, 12).forEach((entry, index) => {
      const sign = entry.amount > 0 ? '+' : '';
      const color = entry.amount > 0 ? config.COLOR_YELLOW : config.COLOR_WHITE;
      this.addLine(
        `${entry.reason.replace(/-/g, ' ').toUpperCase().slice(0, 16).padEnd(17, ' ')}` +
          `${sign}${entry.amount} ${entry.currency.replace('item:', '').toUpperCase()}`,
        160 + index * 32,
        color,
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

  private handleToggleView = (): void => {
    this.showLedger = !this.showLedger;
    this.viewItem.setText(this.showLedger ? 'HOLDINGS' : 'HISTORY');
    this.requestRender();
  };

  private handleRefresh = (): void => {
    this.load();
  };
}
