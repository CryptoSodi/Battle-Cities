import { apiFetchDirect } from '../network/api';

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class AdminClient {
  getSession(): Promise<any> {
    return this.request('/api/admin/session');
  }

  getOverview(): Promise<any> {
    return this.request('/api/admin/overview');
  }

  getLiveUsersSetting(): Promise<any> {
    return this.request('/api/admin/site-settings/live-users');
  }

  setLiveUsersEnabled(enabled: boolean): Promise<any> {
    return this.request('/api/admin/site-settings/live-users', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  }

  getMatches(status = '', category = '', offset = 0): Promise<any> {
    const query = new URLSearchParams({ limit: '100', offset: String(offset) });
    if (status !== '') query.set('status', status);
    if (category !== '') query.set('category', category);
    return this.request(`/api/admin/matches?${query}`);
  }

  getReplays(offset = 0): Promise<any> {
    return this.request(`/api/admin/replays?limit=100&offset=${offset}`);
  }

  getReplay(id: string): Promise<any> {
    return this.request(`/api/admin/replays?id=${encodeURIComponent(id)}`);
  }

  getPlayers(
    query = '',
    lastSeenFrom = '',
    lastSeenTo = '',
    offset = 0,
  ): Promise<any> {
    const search = new URLSearchParams({ limit: '100', offset: String(offset) });
    if (query !== '') search.set('q', query);
    if (lastSeenFrom !== '') search.set('lastSeenFrom', lastSeenFrom);
    if (lastSeenTo !== '') search.set('lastSeenTo', lastSeenTo);
    return this.request(`/api/admin/players?${search}`);
  }

  getXConnections(offset = 0): Promise<any> {
    const search = new URLSearchParams({
      limit: '100',
      offset: String(offset),
      xConnected: 'true',
    });
    return this.request(`/api/admin/players?${search}`);
  }

  disconnectX(playerId: string): Promise<any> {
    return this.request(
      `/api/admin/players/${encodeURIComponent(playerId)}/x-connection`,
      { method: 'DELETE' },
    );
  }

  getXRepostTasks(): Promise<any> {
    return this.request('/api/admin/x/repost-tasks');
  }

  createXRepostTask(post: string): Promise<any> {
    return this.request('/api/admin/x/repost-tasks', {
      method: 'POST',
      body: JSON.stringify({ post }),
    });
  }
  getXCommentTasks(): Promise<any> { return this.request('/api/admin/x/comment-tasks'); }
  createXCommentTask(post: string): Promise<any> { return this.request('/api/admin/x/comment-tasks', { method: 'POST', body: JSON.stringify({ post }) }); }

  getTournaments(): Promise<any> {
    return this.request('/api/admin/tournaments');
  }

  spectate(matchId: string): Promise<any> {
    return this.request(
      `/api/multiplayer/matches/${encodeURIComponent(matchId)}/spectate`,
      { method: 'POST', body: '{}' },
    );
  }

  getTournamentLeaderboard(id: string): Promise<any> {
    return this.request(`/api/admin/tournaments/${encodeURIComponent(id)}/leaderboard`);
  }

  saveTournament(value: any, id: string | null): Promise<any> {
    return this.request(
      id === null
        ? '/api/admin/tournaments'
        : `/api/admin/tournaments/${encodeURIComponent(id)}`,
      { method: id === null ? 'POST' : 'PATCH', body: JSON.stringify(value) },
    );
  }

  distributePrizes(id: string, allocations: any[]): Promise<any> {
    return this.request(
      `/api/admin/tournaments/${encodeURIComponent(id)}/prizes/distribute`,
      { method: 'POST', body: JSON.stringify({ allocations }) },
    );
  }

  async logout(): Promise<void> {
    await apiFetchDirect('/api/session', { method: 'DELETE' });
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const response = await apiFetchDirect(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    });
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      throw new AdminRequestError(body?.error || 'Admin request failed', response.status);
    }
    return body;
  }
}
