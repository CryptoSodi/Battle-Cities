import { apiFetchDirect } from '../network/api';

import { PowerupType } from './PowerupType';

const PENDING_CLAIMS_KEY = 'battlecities.pendingBatcDropClaims';

export interface BatcDropRoll {
  claimId: string;
  type: PowerupType.Batc100 | PowerupType.Batc200;
}

function readPendingClaims(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_CLAIMS_KEY) || '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === 'string').slice(-20)
      : [];
  } catch {
    return [];
  }
}

function addPendingClaim(claimId: string): void {
  if (typeof window === 'undefined') return;
  const claims = new Set(readPendingClaims());
  claims.add(claimId);
  window.localStorage.setItem(
    PENDING_CLAIMS_KEY,
    JSON.stringify(Array.from(claims).slice(-20)),
  );
}

function removePendingClaim(claimId: string): void {
  if (typeof window === 'undefined') return;
  const claims = readPendingClaims().filter((value) => value !== claimId);
  window.localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(claims));
}

export async function rollBatcDrop(
  requestId: string,
  levelNumber: number,
): Promise<BatcDropRoll | null> {
  try {
    const response = await apiFetchDirect('/api/economy/drops/roll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId, levelNumber }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (body?.amount !== 100 && body?.amount !== 200) return null;
    if (typeof body?.claimId !== 'string') return null;
    return {
      claimId: body.claimId,
      type: body.amount === 200 ? PowerupType.Batc200 : PowerupType.Batc100,
    };
  } catch {
    return null;
  }
}

export async function claimBatcDrop(claimId: string): Promise<void> {
  addPendingClaim(claimId);
  try {
    const response = await apiFetchDirect('/api/economy/drops/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimId }),
    });
    if (!response.ok) return;
    const body = await response.json();
    if (body?.delivered !== true) return;
    removePendingClaim(claimId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('battlecities:batc-drop-claimed', {
          detail: { amount: body.amount, signature: body.signature },
        }),
      );
    }
  } catch {
    // Persisted below; retry when gameplay is loaded again.
  }
}

export function retryPendingBatcDropClaims(): void {
  readPendingClaims().forEach((claimId) => void claimBatcDrop(claimId));
}
