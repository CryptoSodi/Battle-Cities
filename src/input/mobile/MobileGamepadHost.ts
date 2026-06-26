interface RemoteGamepadButton {
  pressed: boolean;
  touched: boolean;
  value: number;
}

export interface RemoteGamepad {
  axes: number[];
  buttons: RemoteGamepadButton[];
  connected: boolean;
  index: number;
  timestamp: number;
}

interface PeerConnection {
  on(eventName: string, callback: (event?: any) => void): void;
  close(): void;
  send(data: any): void;
  peerConnection?: RTCPeerConnection;
}

interface PeerInstance {
  on(eventName: string, callback: (event?: any) => void): void;
  connect?(peerId: string): PeerConnection;
}

interface PeerConstructor {
  new (id?: string): PeerInstance;
}

const PEER_JS_URL = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.js';
const QR_CODE_URL = 'https://unpkg.com/qrcode@1.5.1/build/qrcode.js';
const MOBILE_GAMEPAD_PATH = '/mobile-gamepad/';
const MOBILE_GAMEPAD_VERSION = '2026-06-26-large-controller';
const ROOM_CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

function getRoomCodeLetter(): string {
  const index = Math.floor(Math.random() * ROOM_CODE_LETTERS.length);
  return ROOM_CODE_LETTERS.charAt(index);
}

function loadScript(src: string, globalName: string): Promise<any> {
  const existingGlobal = window[globalName];
  if (existingGlobal !== undefined) {
    return Promise.resolve(existingGlobal);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = () => resolve(window[globalName]);
    script.onerror = reject;
    script.src = src;
    document.body.appendChild(script);
  });
}

async function createPeerId(roomCode: string): Promise<string> {
  const bytes = new TextEncoder().encode(roomCode);
  const hash = await crypto.subtle.digest('SHA-1', bytes);

  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export class MobileGamepadHost {
  private started = false;
  private startPromise: Promise<void> = null;
  private roomCode = '';
  private playerUrl = '';
  private gamepads: RemoteGamepad[] = [];
  private lastTimestamp = 0;

  public start(): Promise<void> {
    if (this.startPromise !== null) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal();

    return this.startPromise;
  }

  public isStarted(): boolean {
    return this.started;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getPlayerUrl(): string {
    return this.playerUrl;
  }

  public getGamepad(index: number): RemoteGamepad {
    return this.gamepads[index] || null;
  }

  public async createQrElement(): Promise<HTMLElement> {
    await this.start();

    const container = document.createElement('div');
    container.className = 'mobile-gamepad-qr';

    const title = document.createElement('div');
    title.className = 'mobile-gamepad-qr__title';
    title.textContent = 'PHONE CONTROLLER';

    const image = document.createElement('img');
    image.className = 'mobile-gamepad-qr__image';
    image.alt = 'Scan to connect phone controller';

    const code = document.createElement('div');
    code.className = 'mobile-gamepad-qr__code';
    code.textContent = this.roomCode;

    const QRCode = await loadScript(QR_CODE_URL, 'QRCode');
    image.src = await QRCode.toDataURL(this.playerUrl);

    container.appendChild(title);
    container.appendChild(image);
    container.appendChild(code);

    return container;
  }

  private async startInternal(): Promise<void> {
    if (!window.isSecureContext) {
      throw new Error('Mobile controller requires HTTPS or localhost.');
    }

    this.roomCode = Array.from({ length: 4 }, getRoomCodeLetter).join('');

    const playerUrl = new URL(MOBILE_GAMEPAD_PATH, window.location.href);
    playerUrl.searchParams.set('v', MOBILE_GAMEPAD_VERSION);
    playerUrl.searchParams.set('rc', this.roomCode);
    playerUrl.hash = `?rc=${this.roomCode}`;
    this.playerUrl = playerUrl.toString();

    const peerId = await createPeerId(this.roomCode);
    const Peer = (await loadScript(PEER_JS_URL, 'Peer')) as PeerConstructor;
    const peer = new Peer(peerId);

    peer.on('error', (event) => {
      // Keep the game usable if the phone-controller service is unavailable.
      console.error(event);
    });

    peer.on('connection', (connection: PeerConnection) => {
      this.handleConnection(connection);
    });

    this.started = true;
  }

  private handleConnection(connection: PeerConnection): void {
    connection.on('error', (event) => {
      console.error(event);
    });

    connection.on('open', () => {
      connection.on('data', (data) => {
        if (data?.type !== 'gamepads') {
          return;
        }

        if (data.timestamp <= this.lastTimestamp) {
          return;
        }

        this.lastTimestamp = data.timestamp;
        this.gamepads = data.gamepads || [];
      });

      connection.peerConnection?.addEventListener(
        'connectionstatechange',
        () => {
          if (connection.peerConnection.connectionState === 'disconnected') {
            connection.close();
          }
        },
      );
    });

    connection.on('close', () => {
      this.gamepads.forEach((gamepad) => {
        gamepad.connected = false;
      });
    });
  }
}
