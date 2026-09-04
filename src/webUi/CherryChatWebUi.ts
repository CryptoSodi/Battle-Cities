import { CherryEmbed } from '@cherrydotfun/chat-embed-sdk';
import { PlayerIdentity } from '../auth';
import { apiFetchDirect } from '../network/api';
import { getPhantomProvider, PhantomProvider } from '../wallet';

// Same public embed and community room as the Battle Cities main website.
const APP_ID = '148185d2-9181-4e2f-9e4d-47e5b5c12f2a';
const ROOM_ID = 'ffd51288-710c-4558-83dc-d5fe9b04451d';

export class CherryChatWebUi {
  private root: HTMLElement = null;
  private dialog: HTMLDialogElement = null;
  private launcher: HTMLButtonElement = null;
  private chat: CherryEmbed = null;
  private provider: PhantomProvider = null;
  private walletAddress = '';
  private abortController: AbortController = null;
  private generation = 0;
  private loading = false;
  private connecting = false;
  private suppressInputUntil = 0;

  public constructor(private readonly identity: PlayerIdentity) {}

  public mount(): void {
    const player = this.identity.getPlayer();
    if (this.root || player?.provider !== 'wallet' || !player.walletAddress)
      return;
    this.root = document.createElement('aside');
    this.root.className = 'game-cherry';
    this.root.innerHTML = `<button class="game-cherry__launcher" type="button" aria-label="Open community chat" aria-expanded="false" aria-controls="game-cherry-dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4zM8 8h8M8 12h5" /></svg><span>COMMUNITY CHAT</span></button>
      <dialog class="game-cherry__dialog" id="game-cherry-dialog" aria-labelledby="game-cherry-title"><header><h2 id="game-cherry-title">COMMUNITY CHAT</h2><button type="button" data-chat-close aria-label="Close community chat">CLOSE</button></header><div class="game-cherry__embed" data-chat-embed></div><footer><p data-chat-status role="status" aria-live="polite">Open the community channel to read and chat.</p><button type="button" data-chat-connect>CONNECT WALLET</button><button type="button" data-chat-retry hidden>RETRY</button></footer></dialog>`;
    document.body.appendChild(this.root);
    this.dialog = this.root.querySelector('dialog');
    this.launcher = this.root.querySelector('.game-cherry__launcher');
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    this.launcher.addEventListener('click', () => this.open(), { signal });
    this.root
      .querySelector('[data-chat-close]')
      .addEventListener('click', () => this.close(), { signal });
    this.root
      .querySelector('[data-chat-retry]')
      .addEventListener('click', () => void this.load(), { signal });
    this.root
      .querySelector('[data-chat-connect]')
      .addEventListener('click', () => void this.connectWallet(), { signal });
    this.dialog.addEventListener(
      'cancel',
      (event) => {
        event.preventDefault();
        this.close();
      },
      { signal },
    );
    // Host controls must not also feed Enter/Space/arrows into game navigation.
    this.root.addEventListener(
      'keydown',
      (event) => {
        if (this.dialog.open || event.key === 'Enter' || event.key === ' ')
          event.stopPropagation();
      },
      { signal },
    );
  }

  public unmount(): void {
    this.generation += 1;
    this.abortController?.abort();
    if (this.dialog?.open) this.dialog.close();
    this.chat?.destroy();
    this.root?.remove();
    this.root = null;
    this.dialog = null;
    this.launcher = null;
    this.chat = null;
    this.provider = null;
    this.walletAddress = '';
    this.loading = false;
    this.connecting = false;
  }

  public getLauncher(): HTMLButtonElement {
    return this.launcher;
  }

  public blocksMenuInput(): boolean {
    return (
      this.dialog?.open === true || performance.now() < this.suppressInputUntil
    );
  }

  private open(): void {
    if (this.dialog.open) return;
    this.suppressInputUntil = performance.now() + 200;
    this.dialog.showModal();
    this.launcher.setAttribute('aria-expanded', 'true');
    this.launcher.classList.add('is-active');
    this.root.querySelector<HTMLButtonElement>('[data-chat-close]').focus();
    if (this.chat === null) void this.load();
  }

  private close(): void {
    this.dialog.close();
    this.suppressInputUntil = performance.now() + 200;
    this.launcher.setAttribute('aria-expanded', 'false');
    this.launcher.classList.remove('is-active');
    this.launcher.focus({ preventScroll: true });
  }

  private async load(): Promise<void> {
    if (this.loading || this.root === null) return;
    const generation = this.generation;
    this.loading = true;
    this.chat?.destroy();
    this.provider = null;
    this.walletAddress = '';
    this.setStatus('LOADING COMMUNITY CHANNEL...');
    this.launcher.classList.remove('is-authenticated');
    this.root.querySelector<HTMLButtonElement>(
      '[data-chat-connect]',
    ).hidden = false;
    this.root.querySelector<HTMLButtonElement>(
      '[data-chat-retry]',
    ).hidden = true;
    const chat = new CherryEmbed({
      appId: APP_ID,
      roomId: ROOM_ID,
      embedUrl: 'https://embed.cherry.fun',
      container: this.root.querySelector<HTMLElement>('[data-chat-embed]'),
      position: 'inline',
      mode: 'single',
      theme: {
        mode: 'dark',
        primaryColor: '#FFB30F',
        backgroundColor: '#06090B',
      },
      signChallengeHandler: (message): Promise<Uint8Array> =>
        this.signChallenge(message, generation),
    });
    this.chat = chat;
    chat.on('walletConnectRequested', () => {
      if (this.generation === generation && this.dialog?.open)
        void this.connectWallet();
    });
    chat.on('authStateChange', (authenticated) => {
      if (this.generation !== generation || this.chat !== chat) return;
      // Never inherit another game account's previously restored iframe login.
      if (authenticated && !this.walletAddress) {
        chat.signOut();
        return;
      }
      this.launcher.classList.toggle('is-authenticated', authenticated);
      this.root.querySelector<HTMLButtonElement>(
        '[data-chat-connect]',
      ).hidden = authenticated;
      this.setStatus(
        authenticated
          ? 'WALLET CONNECTED'
          : 'Connect your game wallet to join the conversation.',
      );
    });
    try {
      await chat.mount();
      if (this.generation !== generation || this.chat !== chat) return;
      this.setStatus('Connect your game wallet to join the conversation.');
    } catch {
      if (this.generation !== generation || this.chat !== chat) return;
      chat.destroy();
      this.chat = null;
      this.setStatus(
        'Chat could not load. Check your connection or the CHERRY allowed origins.',
        true,
      );
      this.root.querySelector<HTMLButtonElement>(
        '[data-chat-retry]',
      ).hidden = false;
    } finally {
      if (this.generation === generation) this.loading = false;
    }
  }

  private async connectWallet(): Promise<void> {
    if (this.connecting || !this.dialog?.open || !this.chat?.isReady) return;
    const player = this.identity.getPlayer();
    if (player?.provider !== 'wallet' || !player.walletAddress) {
      this.setStatus(
        'Sign in to the game with your wallet to post in chat. Your current login has not changed.',
        true,
      );
      return;
    }
    const provider = getPhantomProvider();
    if (provider === null) {
      this.setStatus(
        'Open Phantom or use the Android wallet adapter to connect.',
        true,
      );
      return;
    }
    const generation = this.generation;
    const chat = this.chat;
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-chat-connect]',
    );
    this.connecting = true;
    button.disabled = true;
    this.setStatus('CONNECTING GAME WALLET...');
    try {
      const connection = await provider.connect();
      if (
        this.generation !== generation ||
        this.chat !== chat ||
        !this.dialog?.open
      )
        return;
      const address = connection.publicKey.toString();
      if (address !== player.walletAddress)
        throw new Error(
          'Choose the same wallet you used to sign in to the game.',
        );
      const response = await apiFetchDirect('/api/cherry-embed-token', {
        method: 'POST',
        cache: 'no-store',
        signal: this.abortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Your game wallet session expired or does not match. Sign in again to join chat.'
            : 'Chat authentication is unavailable. Try connecting again shortly.',
        );
      }
      const result = await response.json();
      if (typeof result.token !== 'string' || !result.token)
        throw new Error('Chat returned an invalid session.');
      if (
        this.generation !== generation ||
        this.chat !== chat ||
        !this.dialog?.open
      )
        return;
      this.provider = provider;
      this.walletAddress = address;
      chat.setWalletAddress(address);
      chat.setToken(result.token);
      this.setStatus('Confirm the CHERRY sign-in message in your wallet.');
    } catch (error) {
      if (this.generation === generation && this.chat === chat) {
        this.setStatus(
          error instanceof Error ? error.message : 'Could not connect chat.',
          true,
        );
      }
    } finally {
      if (this.generation === generation) {
        this.connecting = false;
        button.disabled = false;
      }
    }
  }

  private async signChallenge(
    message: Uint8Array,
    generation: number,
  ): Promise<Uint8Array> {
    if (
      generation !== this.generation ||
      !this.dialog?.open ||
      !this.provider ||
      this.identity.getPlayer()?.walletAddress !== this.walletAddress
    ) {
      throw new Error(
        'Connect your game wallet while chat is open before signing.',
      );
    }
    let signed: Uint8Array | { signature: Uint8Array };
    try {
      signed = await this.provider.signMessage(message, 'utf8');
    } catch (error) {
      if (generation === this.generation && this.dialog?.open)
        this.setStatus(
          'Wallet sign-in was not completed. Connect again to retry.',
          true,
        );
      throw error;
    }
    if (generation !== this.generation || !this.dialog?.open)
      throw new Error('Chat was closed.');
    const signature = signed instanceof Uint8Array ? signed : signed.signature;
    if (!(signature instanceof Uint8Array) || signature.length !== 64)
      throw new Error('Invalid wallet signature.');
    return signature;
  }

  private setStatus(message: string, error = false): void {
    const status = this.root?.querySelector<HTMLElement>('[data-chat-status]');
    if (status) {
      status.textContent = message;
      status.classList.toggle('is-error', error);
    }
  }
}
