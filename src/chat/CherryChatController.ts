import { CherryEmbed } from '@cherrydotfun/chat-embed-sdk';

import { PlayerIdentity } from '../auth';
import { Logger } from '../core';
import { apiFetchDirect } from '../network/api';
import { getPhantomProvider, PhantomProvider } from '../wallet';

const APP_ID = '148185d2-9181-4e2f-9e4d-47e5b5c12f2a';
const ROOM_ID = 'ffd51288-710c-4558-83dc-d5fe9b04451d';
const EMBED_URL = 'https://embed.cherry.fun';

interface WalletAuth {
  provider: PhantomProvider;
  token: string | null;
  walletAddress: string;
}

export class CherryChatController {
  private readonly log = new Logger('cherry-chat', Logger.Level.Debug);
  private chat: CherryEmbed | null = null;
  private lifecycleId = 0;
  private mounting = false;

  public constructor(private readonly playerIdentity: PlayerIdentity) {}

  public setMainMenuVisible(visible: boolean): void {
    if (!visible) {
      this.lifecycleId += 1;
      this.mounting = false;
      this.chat?.destroy();
      this.chat = null;
      return;
    }

    if (this.chat === null && !this.mounting) {
      const lifecycleId = ++this.lifecycleId;
      void this.mount(lifecycleId);
    }
  }

  private async mount(lifecycleId: number): Promise<void> {
    this.mounting = true;
    let walletAuth: WalletAuth | null = null;
    try {
      walletAuth = await this.getWalletAuth();
    } catch (error) {
      this.log.warn('Wallet chat authentication is unavailable', error);
    }

    if (lifecycleId !== this.lifecycleId) {
      return;
    }

    const chat = new CherryEmbed({
      appId: APP_ID,
      embedUrl: EMBED_URL,
      roomId: ROOM_ID,
      mode: 'single',
      position: 'floating-right',
      collapsed: false,
      theme: { mode: 'dark', primaryColor: '#FFB30F' },
      ...(walletAuth === null
        ? {}
        : {
            token: walletAuth.token || undefined,
            walletAddress: walletAuth.walletAddress,
            signChallengeHandler: this.createSignHandler(walletAuth),
          }),
    });
    chat.on('walletConnectRequested', () => {
      void this.handleWalletConnectRequested(chat);
    });
    this.chat = chat;

    try {
      await chat.mount();
      if (lifecycleId !== this.lifecycleId) {
        chat.destroy();
      }
    } catch (error) {
      if (lifecycleId === this.lifecycleId) {
        chat.destroy();
        this.chat = null;
        this.log.warn('Cherry chat could not be mounted', error);
      }
    } finally {
      if (lifecycleId === this.lifecycleId) {
        this.mounting = false;
      }
    }
  }

  private async getWalletAuth(): Promise<WalletAuth | null> {
    const walletAddress = this.playerIdentity.getPlayer()?.walletAddress;
    const provider = getPhantomProvider();
    if (
      typeof walletAddress !== 'string' ||
      walletAddress === '' ||
      provider === null
    ) {
      return null;
    }

    let token: string | null = null;
    try {
      token = await this.fetchToken(walletAddress);
    } catch (error) {
      this.log.warn('Cherry token could not be minted', error);
    }
    return { provider, token, walletAddress };
  }

  private createSignHandler(auth: WalletAuth) {
    return async (message: Uint8Array): Promise<Uint8Array> => {
      const connectedAddress =
        auth.provider.publicKey?.toString() ||
        (await auth.provider.connect()).publicKey.toString();
      if (connectedAddress !== auth.walletAddress) {
        throw new Error('Connected wallet does not match the game session');
      }

      const result = await auth.provider.signMessage(message, 'utf8');
      const signature =
        result instanceof Uint8Array ? result : result.signature;
      if (signature.length !== 64) {
        throw new Error('Wallet returned an invalid signature');
      }
      return signature;
    };
  }

  private async handleWalletConnectRequested(chat: CherryEmbed): Promise<void> {
    if (chat !== this.chat) {
      return;
    }

    const playerWallet = this.playerIdentity.getPlayer()?.walletAddress;
    const provider = getPhantomProvider();
    if (
      typeof playerWallet !== 'string' ||
      playerWallet === '' ||
      provider === null
    ) {
      this.log.warn('Wallet login is required to send chat messages');
      return;
    }

    try {
      const connected = await provider.connect();
      const walletAddress = connected.publicKey.toString();
      if (walletAddress !== playerWallet) {
        throw new Error('Connected wallet does not match the game session');
      }
      const auth = {
        provider,
        token: await this.fetchToken(walletAddress),
        walletAddress,
      };
      if (chat !== this.chat) {
        return;
      }
      chat.onSignChallenge(this.createSignHandler(auth));
      chat.setToken(auth.token);
      chat.setWalletAddress(walletAddress);
    } catch (error) {
      this.log.warn('Cherry wallet connection failed', error);
    }
  }

  private async fetchToken(walletAddress: string): Promise<string> {
    const response = await apiFetchDirect('/api/cherry-embed-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    if (!response.ok) {
      throw new Error(`Cherry token request failed (${response.status})`);
    }
    const token = (await response.json())?.token;
    if (typeof token !== 'string' || token === '') {
      throw new Error('Cherry token response is invalid');
    }
    return token;
  }
}
