import { apiFetch } from '../network/api';

export interface CurrentPlayer {
  id: string;
  provider: 'guest' | 'wallet' | 'google';
  displayName: string;
  walletAddress: string | null;
  googleEmail: string | null;
  googleName: string | null;
  googlePicture: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface PlayerResponse {
  authenticated?: boolean;
  player?: CurrentPlayer;
}

export class PlayerIdentity {
  private player: CurrentPlayer = null;

  public async refresh(): Promise<boolean> {
    const response = await apiFetch('/api/player');

    if (!response.ok) {
      this.player = null;
      return false;
    }

    const body = (await response.json()) as PlayerResponse;
    if (body.authenticated === true && isCurrentPlayer(body.player)) {
      this.player = body.player;
      return true;
    }

    this.player = null;
    return false;
  }

  public clear(): void {
    this.player = null;
  }

  public getPlayer(): CurrentPlayer {
    return this.player;
  }

  public isAuthenticated(): boolean {
    return this.player !== null;
  }

  public getDisplayName(): string {
    return this.player?.displayName || 'Player';
  }

  public getProviderLabel(): string {
    switch (this.player?.provider) {
      case 'wallet':
        return 'Phantom';
      case 'google':
        return 'Google';
      case 'guest':
        return 'Guest';
      default:
        return 'Offline';
    }
  }
}

function isCurrentPlayer(value: CurrentPlayer): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    (value.provider === 'guest' ||
      value.provider === 'wallet' ||
      value.provider === 'google') &&
    typeof value.displayName === 'string'
  );
}
