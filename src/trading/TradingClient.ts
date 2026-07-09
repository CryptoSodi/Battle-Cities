import { apiFetch } from '../network/api';

import {
  BoostStatus,
  SwapVerifyInput,
  SwapVerifyResult,
  TokenCatalogItem,
} from './TradingTypes';

export class TradingClient {
  public async listTokens(): Promise<TokenCatalogItem[]> {
    try {
      const response = await apiFetch('/api/trading/tokens');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.items) ? body.items : [];
    } catch {
      return [];
    }
  }

  public async verifySwap(input: SwapVerifyInput): Promise<SwapVerifyResult> {
    try {
      const response = await apiFetch('/api/trading/verify-swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      return typeof body?.ok === 'boolean' ? body : { ok: false, error: 'FAILED' };
    } catch {
      return { ok: false, error: 'OFFLINE' };
    }
  }

  public async getBoostStatus(): Promise<BoostStatus | null> {
    try {
      const response = await apiFetch('/api/boost/status');
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as BoostStatus;
    } catch {
      return null;
    }
  }
}
