import { apiFetchDirect } from '../network/api';

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class AdminClient {
  getWalletChallenge(walletAddress: string): Promise<any> {
    return this.request('/api/session', { method: 'PUT', body: JSON.stringify({ walletAddress }) });
  }

  loginWallet(walletAddress: string, challenge: any, signature: string): Promise<any> {
    return this.request('/api/session', { method: 'POST',
      body: JSON.stringify({ provider: 'wallet', walletAddress, nonce: challenge.nonce, message: challenge.message, signature }) });
  }

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

  getMatches(status = '', offset = 0): Promise<any> {
    const query = new URLSearchParams({ limit: '100', offset: String(offset) });
    if (status !== '') query.set('status', status);
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

  sendTestNotification(playerId: string): Promise<any> {
    return this.request('/api/admin/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  }

  getNotificationStatus(): Promise<any> {
    return this.request('/api/admin/notifications');
  }

  sendNotification(payload: {
    audience: 'all' | 'player'; playerId?: string; title: string; message: string;
    type: string; route: string; imageUrl?: string; externalUrl?: string; actionLabel?: string;
  }): Promise<any> {
    return this.request('/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
