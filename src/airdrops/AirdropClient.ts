import { apiFetch } from '../network/api';

export interface AirdropCampaign {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'upcoming' | 'live' | 'ended';
  allocationPool: number;
}

export interface AirdropEligibility {
  campaign: AirdropCampaign;
  frozen: boolean;
  weight: number;
  parts?: { gamePoints: number; stakingSp: number; tradingUsd: number };
  allocation: number | null;
  claimedAt: string | null;
}

export class AirdropClient {
  public async listCampaigns(): Promise<AirdropCampaign[]> {
    try {
      const response = await apiFetch('/api/airdrops/eligibility');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.items) ? body.items : [];
    } catch {
      return [];
    }
  }

  public async getEligibility(slug: string): Promise<AirdropEligibility | null> {
    try {
      const response = await apiFetch(
        `/api/airdrops/eligibility?slug=${encodeURIComponent(slug)}`,
      );
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return body?.eligibility !== undefined ? body.eligibility : null;
    } catch {
      return null;
    }
  }

  public async claim(slug: string): Promise<{ ok: boolean; error?: string; allocation?: number }> {
    try {
      const response = await apiFetch('/api/airdrops/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const body = await response.json();
      return typeof body?.ok === 'boolean' ? body : { ok: false, error: 'FAILED' };
    } catch {
      return { ok: false, error: 'OFFLINE' };
    }
  }
}
