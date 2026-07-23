import { Rotation } from '../../game';
import { TankState } from '../../gameObjects';
import { TankTier } from '../../tank';

interface PeerConnection {
  on(eventName: string, callback: (event?: any) => void): void;
  close(): void;
  send(data: any): void;
  open?: boolean;
}

interface PeerInstance {
  on(eventName: string, callback: (event?: any) => void): void;
  connect?(peerId: string): PeerConnection;
  destroy?(): void;
  disconnected?: boolean;
  destroyed?: boolean;
}

interface PeerConstructor {
  new (id?: string): PeerInstance;
}

export interface WebRtcGhostTankSnapshot {
  partyIndex: number;
  x: number;
  y: number;
  rotation: Rotation;
  state: TankState;
  tier: TankTier;
  fireSeq: number;
  alive: boolean;
}

interface WebRtcGhostPacket {
  type: 'battlecity-ghost';
  seq: number;
  sentAt: number;
  senderPlayerIndex: number;
  tank: WebRtcGhostTankSnapshot;
}

const PEER_JS_URL = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.js';
const GHOST_PARAM = 'ghostMirror';
const GHOST_PARAM_LOWERCASE = 'ghostmirror';
const GHOST_PARAM_LEGACY_TYPO = 'ghosmirror';
const MATCH_PARAM = 'match';
const PEER_PREFIX = 'battlecity-ghost';
const BROADCAST_PREFIX = 'battlecity-ghost-channel';
const RECONNECT_MS = 1000;
const PEER_RESTART_MS = 1500;

function log(message: string, data?: any): void {
  if (data === undefined) {
    console.log(`[webrtc-ghost] ${message}`);
    return;
  }

  console.log(`[webrtc-ghost] ${message}`, data);
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

function normalizeRoom(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function isEnabledValue(value: string): boolean {
  return value === '' || value === '1' || value === 'true';
}

function getPeerId(room: string, playerIndex: number): string {
  return `${PEER_PREFIX}-${room}-player-${playerIndex}`;
}

export class WebRtcGhostSync {
  private static instance: WebRtcGhostSync = null;

  private enabled = false;
  private room = '';
  private localPlayerIndex = 0;
  private Peer: PeerConstructor = null;
  private peer: PeerInstance = null;
  private localPeerId = '';
  private remotePeerId = '';
  private connected = false;
  private startPromise: Promise<void> = null;
  private connections: PeerConnection[] = [];
  private broadcastChannel: BroadcastChannel = null;
  private latestSnapshot: WebRtcGhostTankSnapshot = null;
  private seq = 0;
  private lastReceivedSeq = 0;
  private lastSendLogAt = 0;
  private lastReceiveLogAt = 0;
  private reconnectTimer: number = null;
  private peerRestartTimer: number = null;

  public static getInstance(): WebRtcGhostSync {
    if (WebRtcGhostSync.instance === null) {
      WebRtcGhostSync.instance = new WebRtcGhostSync();
    }

    return WebRtcGhostSync.instance;
  }

  public configureFromLocation(
    localPlayerIndex: number,
    location = window.location,
  ): void {
    const params = new URLSearchParams(location.search);
    const flagValue =
      params.get(GHOST_PARAM) ??
      params.get(GHOST_PARAM_LOWERCASE) ??
      params.get(GHOST_PARAM_LEGACY_TYPO);
    const matchRoom = normalizeRoom(params.get(MATCH_PARAM) || '');

    this.enabled =
      flagValue !== null &&
      isEnabledValue(normalizeRoom(flagValue)) &&
      matchRoom !== '';
    this.room = this.enabled ? matchRoom : '';
    this.localPlayerIndex = localPlayerIndex;
    this.configureBroadcastChannel();
  }

  public isEnabled(): boolean {
    return this.enabled && this.room !== '';
  }

  public start(): void {
    if (!this.isEnabled()) {
      return;
    }
    if (this.startPromise !== null) {
      return;
    }

    this.startPromise = this.startInternal().catch((error) => {
      log('start failed', error);
      console.error(error);
    });
  }

  public sendSnapshot(tank: WebRtcGhostTankSnapshot): void {
    if (!this.isEnabled()) {
      return;
    }

    this.start();
    if (this.connections.length === 0) {
      return;
    }

    const packet: WebRtcGhostPacket = {
      type: 'battlecity-ghost',
      seq: ++this.seq,
      sentAt: Date.now(),
      senderPlayerIndex: this.localPlayerIndex,
      tank,
    };

    this.broadcastChannel?.postMessage(packet);

    const now = Date.now();
    if (now - this.lastSendLogAt > 1000) {
      this.lastSendLogAt = now;
      log('snapshot sent', {
        player: tank.partyIndex,
        seq: packet.seq,
        peerConnections: this.connections.length,
        openPeerConnections: this.connections.filter(
          (connection) => connection.open === true,
        ).length,
      });
    }

    this.connections = this.connections.filter((connection) => {
      if (connection.open !== true) {
        return true;
      }
      try {
        connection.send(packet);
        return true;
      } catch {
        return false;
      }
    });
  }

  public getLatestSnapshot(): WebRtcGhostTankSnapshot {
    if (!this.isEnabled()) {
      return null;
    }

    return this.latestSnapshot;
  }

  private async startInternal(): Promise<void> {
    this.localPeerId = getPeerId(this.room, this.localPlayerIndex);
    this.remotePeerId = getPeerId(this.room, 1 - this.localPlayerIndex);
    this.Peer = (await loadScript(PEER_JS_URL, 'Peer')) as PeerConstructor;

    this.createPeer();
  }

  private createPeer(): void {
    if (!this.isEnabled() || this.Peer === null) {
      return;
    }

    this.closeConnections();
    this.connected = false;
    this.peer = new this.Peer(this.localPeerId);

    this.peer.on('open', () => {
      log('open', {
        room: this.room,
        localPlayerIndex: this.localPlayerIndex,
        localPeerId: this.localPeerId,
        remotePeerId: this.remotePeerId,
      });
      this.connectToRemote();
    });

    this.peer.on('connection', (connection: PeerConnection) => {
      this.handleConnection(connection);
    });

    this.peer.on('error', (event) => {
      log('peer error', event);
      console.error(event);
      if (event?.type === 'peer-unavailable') {
        this.scheduleReconnect();
      } else {
        this.schedulePeerRestart();
      }
    });

    this.peer.on('disconnected', () => {
      log('peer disconnected');
      this.schedulePeerRestart();
    });
  }

  private connectToRemote(): void {
    if (this.peer === null || this.connected) {
      return;
    }
    if (this.peer.destroyed === true || this.peer.disconnected === true) {
      this.schedulePeerRestart();
      return;
    }

    try {
      const connection = this.peer.connect(this.remotePeerId);
      this.handleConnection(connection);
    } catch (error) {
      log('connect failed', error);
      this.schedulePeerRestart();
    }
  }

  private handleConnection(connection: PeerConnection): void {
    if (this.connections.includes(connection)) {
      return;
    }

    this.connections.push(connection);

    connection.on('open', () => {
      this.connected = true;
      this.clearReconnect();
      log('connected', {
        room: this.room,
        localPlayerIndex: this.localPlayerIndex,
      });
    });

    connection.on('data', (data) => {
      if (data?.type !== 'battlecity-ghost') {
        return;
      }
      this.acceptPacket(data);
    });

    connection.on('close', () => {
      this.connections = this.connections.filter((item) => item !== connection);
      this.connected = this.connections.some((item) => item.open === true);
      if (!this.connected) {
        this.scheduleReconnect();
      }
    });

    connection.on('error', () => {
      this.connections = this.connections.filter((item) => item !== connection);
      this.connected = this.connections.some((item) => item.open === true);
      if (!this.connected) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) {
        if (this.peer?.destroyed === true || this.peer?.disconnected === true) {
          this.schedulePeerRestart();
        } else {
          this.connectToRemote();
        }
      }
    }, RECONNECT_MS);
  }

  private schedulePeerRestart(): void {
    if (this.peerRestartTimer !== null) {
      return;
    }

    this.closeConnections();
    this.clearReconnect();

    this.peerRestartTimer = window.setTimeout(() => {
      this.peerRestartTimer = null;
      if (!this.connected) {
        this.peer?.destroy?.();
        this.createPeer();
      }
    }, PEER_RESTART_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private closeConnections(): void {
    this.connections.forEach((connection) => {
      try {
        connection.close();
      } catch {
        return;
      }
    });
    this.connections = [];
    this.connected = false;
  }

  private configureBroadcastChannel(): void {
    this.broadcastChannel?.close();
    this.broadcastChannel = null;

    if (!this.isEnabled() || window.BroadcastChannel === undefined) {
      return;
    }

    this.broadcastChannel = new BroadcastChannel(
      `${BROADCAST_PREFIX}-${this.room}`,
    );
    this.broadcastChannel.onmessage = (event): void => {
      this.acceptPacket(event.data);
    };
    log('local tab fallback active', {
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
    });
  }

  private acceptPacket(data: any): void {
    if (data?.type !== 'battlecity-ghost') {
      return;
    }
    if (data.senderPlayerIndex === this.localPlayerIndex) {
      return;
    }
    if (data.tank?.partyIndex === this.localPlayerIndex) {
      return;
    }
    if (typeof data.seq !== 'number' || data.seq <= this.lastReceivedSeq) {
      return;
    }

    this.lastReceivedSeq = data.seq;
    this.latestSnapshot = data.tank;

    const now = Date.now();
    if (now - this.lastReceiveLogAt > 1000) {
      this.lastReceiveLogAt = now;
      log('snapshot received', {
        player: data.tank.partyIndex,
        seq: data.seq,
      });
    }
  }
}
