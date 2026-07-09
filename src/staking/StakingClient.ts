import { apiFetch } from '../network/api';

import {
  StakingActionResult,
  StakingLeaderboardRow,
  StakingSummary,
} from './StakingTypes';

export class StakingClient {
  public async getSummary(): Promise<StakingSummary | null> {
    try {
      const response = await apiFetch('/api/staking/summary');
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return body?.epoch !== undefined ? (body as StakingSummary) : null;
    } catch {
      return null;
    }
  }

  public async getLeaderboard(): Promise<StakingLeaderboardRow[]> {
    try {
      const response = await apiFetch('/api/staking/leaderboard');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.rows) ? body.rows : [];
    } catch {
      return [];
    }
  }

  public async stake(amount: number): Promise<StakingActionResult> {
    return this.post('/api/staking/stake', { amount });
  }

  public async unstake(amount: number): Promise<StakingActionResult> {
    return this.post('/api/staking/unstake', { amount });
  }

  public async claimUnstaked(): Promise<StakingActionResult> {
    return this.post('/api/staking/claim', {});
  }

  private async post(path: string, payload: object): Promise<StakingActionResult> {
    try {
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      return typeof body?.ok === 'boolean' ? body : { ok: false, error: 'FAILED' };
    } catch {
      return { ok: false, error: 'OFFLINE' };
    }
  }
}
