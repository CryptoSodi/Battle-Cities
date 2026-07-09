import { apiFetch } from '../network/api';

import {
  EventBoard,
  EventLeaderboardRow,
  EventSummary,
  PhaseSummary,
  QuestClaimResult,
} from './EventTypes';

// Best-effort client for the event/quest/phase APIs — failures resolve to
// null/empty so menu scenes render their unavailable states instead of
// blocking.
export class EventClient {
  public async listEvents(): Promise<EventSummary[]> {
    try {
      const response = await apiFetch('/api/events');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.items) ? body.items : [];
    } catch {
      return [];
    }
  }

  public async listPhases(): Promise<PhaseSummary[]> {
    try {
      const response = await apiFetch('/api/phases');
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.items) ? body.items : [];
    } catch {
      return [];
    }
  }

  public async getEventDetail(
    slug: string,
  ): Promise<{ item: EventBoard; me: { rank: number; amount: number } | null } | null> {
    try {
      const response = await apiFetch(
        `/api/events/detail?slug=${encodeURIComponent(slug)}`,
      );
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return body?.item !== undefined ? body : null;
    } catch {
      return null;
    }
  }

  public async getEventLeaderboard(slug: string): Promise<EventLeaderboardRow[]> {
    try {
      const response = await apiFetch(
        `/api/events/leaderboard?slug=${encodeURIComponent(slug)}`,
      );
      if (!response.ok) {
        return [];
      }
      const body = await response.json();
      return Array.isArray(body?.rows) ? body.rows : [];
    } catch {
      return [];
    }
  }

  public async claimQuest(questId: string): Promise<QuestClaimResult> {
    try {
      const response = await apiFetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questId }),
      });
      const body = await response.json();
      return typeof body?.ok === 'boolean' ? body : { ok: false, error: 'FAILED' };
    } catch {
      return { ok: false, error: 'OFFLINE' };
    }
  }
}
