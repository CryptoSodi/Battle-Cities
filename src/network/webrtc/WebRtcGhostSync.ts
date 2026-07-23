import { Rotation } from '../../game';
import { TankState } from '../../gameObjects';
import { TankTier } from '../../tank';

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

interface SignalCode {
  type: 'battlecity-ghost-signal';
  version: 1;
  room: string;
  signalSessionId: string;
  createdAt: number;
  fromPlayerIndex: number;
  description: RTCSessionDescriptionInit;
}

export type WebRtcGhostSignalKind = 'offer' | 'answer';

export interface WebRtcGhostSignalTransport {
  publishSignal(code: string, kind: WebRtcGhostSignalKind): Promise<void>;
  subscribe(
    callback: (code: string, kind: WebRtcGhostSignalKind) => void,
  ): () => void;
}

interface GhostMirrorConsoleApi {
  createOfferCode(): Promise<string>;
  pasteOfferCode(code: string): Promise<string>;
  pasteAnswerCode(code: string): Promise<void>;
  close(): void;
  status(): {
    enabled: boolean;
    room: string;
    localPlayerIndex: number;
    connected: boolean;
    channelState: string;
  };
}

declare global {
  interface Window {
    battleCityGhostMirror?: GhostMirrorConsoleApi;
  }
}

const GHOST_PARAM = 'ghostMirror';
const GHOST_PARAM_LOWERCASE = 'ghostmirror';
const GHOST_PARAM_LEGACY_TYPO = 'ghosmirror';
const MATCH_PARAM = 'match';
const BROADCAST_PREFIX = 'battlecity-ghost-channel';
const DATA_CHANNEL_LABEL = 'battlecity-ghost';
const RECONNECT_DELAY_MS = 1500;

function log(message: string, data?: any): void {
  if (data === undefined) {
    console.log(`[webrtc-ghost] ${message}`);
    return;
  }

  console.log(`[webrtc-ghost] ${message}`, data);
}

function normalizeRoom(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function isEnabledValue(value: string): boolean {
  return value === '' || value === '1' || value === 'true';
}

function encodeSignalCode(signal: SignalCode): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(signal))));
}

function decodeSignalCode(code: string): SignalCode {
  const signal = JSON.parse(
    decodeURIComponent(escape(atob(code.trim()))),
  ) as SignalCode;

  if (
    signal?.type !== 'battlecity-ghost-signal' ||
    signal.version !== 1 ||
    signal.description === undefined
  ) {
    throw new Error('Invalid ghost mirror signal code.');
  }

  return signal;
}

function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
}

function createSignalSessionId(room: string, playerIndex: number): string {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  return `${room}-${playerIndex}-${Date.now()}-${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function waitForIceGatheringComplete(
  peerConnection: RTCPeerConnection,
): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const listener = (): void => {
      if (peerConnection.iceGatheringState !== 'complete') {
        return;
      }

      peerConnection.removeEventListener('icegatheringstatechange', listener);
      resolve();
    };

    peerConnection.addEventListener('icegatheringstatechange', listener);
  });
}

export class WebRtcGhostSync {
  private static instance: WebRtcGhostSync = null;

  private enabled = false;
  private room = '';
  private localPlayerIndex = 0;
  private connected = false;
  private startPromise: Promise<void> = null;
  private peerConnection: RTCPeerConnection = null;
  private dataChannel: RTCDataChannel = null;
  private broadcastChannel: BroadcastChannel = null;
  private latestSnapshot: WebRtcGhostTankSnapshot = null;
  private seq = 0;
  private lastReceivedSeq = 0;
  private lastSendLogAt = 0;
  private lastReceiveLogAt = 0;
  private signalTransport: WebRtcGhostSignalTransport = null;
  private unsubscribeSignalTransport: (() => void) = null;
  private activeOfferSessionId = '';
  private acceptedAnswerSessionId = '';
  private readonly answeredOfferSessionIds = new Set<string>();
  private reconnectTimer: number = null;
  private publishingOffer = false;

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
    this.configureConsoleApi();
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
    const packet: WebRtcGhostPacket = {
      type: 'battlecity-ghost',
      seq: ++this.seq,
      sentAt: Date.now(),
      senderPlayerIndex: this.localPlayerIndex,
      tank,
    };

    this.broadcastChannel?.postMessage(packet);

    if (
      this.dataChannel === null ||
      this.dataChannel.readyState !== 'open'
    ) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSendLogAt > 1000) {
      this.lastSendLogAt = now;
      log('snapshot sent', {
        player: tank.partyIndex,
        seq: packet.seq,
        channelState: this.dataChannel.readyState,
      });
    }

    this.dataChannel.send(JSON.stringify(packet));
  }

  public getLatestSnapshot(): WebRtcGhostTankSnapshot {
    if (!this.isEnabled()) {
      return null;
    }

    return this.latestSnapshot;
  }

  public setSignalTransport(transport: WebRtcGhostSignalTransport): void {
    this.unsubscribeSignalTransport?.();
    this.signalTransport = transport;
    this.unsubscribeSignalTransport = transport.subscribe((code, kind) => {
      this.handleTransportSignal(code, kind);
    });
    this.startTransportSignaling();
  }

  public async createOfferCode(): Promise<string> {
    this.assertEnabled();
    this.activeOfferSessionId = createSignalSessionId(
      this.room,
      this.localPlayerIndex,
    );
    this.acceptedAnswerSessionId = '';
    this.resetPeerConnection();

    const peerConnection = this.ensurePeerConnection();
    const dataChannel = peerConnection.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    this.attachDataChannel(dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection);

    const code = this.createSignalCode(
      peerConnection.localDescription,
      this.activeOfferSessionId,
    );
    log('offer code created', {
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      signalSessionId: this.activeOfferSessionId,
    });

    return code;
  }

  public async pasteOfferCode(code: string): Promise<string> {
    this.assertEnabled();
    const signal = decodeSignalCode(code);
    this.validateSignal(signal, 'offer');
    this.resetPeerConnection();

    const peerConnection = this.ensurePeerConnection();
    await peerConnection.setRemoteDescription(signal.description);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await waitForIceGatheringComplete(peerConnection);

    const answerCode = this.createSignalCode(
      peerConnection.localDescription,
      signal.signalSessionId,
    );
    log('answer code created', {
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      remotePlayerIndex: signal.fromPlayerIndex,
      signalSessionId: signal.signalSessionId,
    });

    return answerCode;
  }

  public async pasteAnswerCode(code: string): Promise<void> {
    this.assertEnabled();
    const signal = decodeSignalCode(code);
    this.validateSignal(signal, 'answer');

    if (this.peerConnection === null) {
      throw new Error('Create an offer code before pasting an answer code.');
    }
    if (signal.signalSessionId !== this.activeOfferSessionId) {
      throw new Error('Answer code does not match the active offer.');
    }

    await this.peerConnection.setRemoteDescription(signal.description);
    log('answer code accepted', {
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      remotePlayerIndex: signal.fromPlayerIndex,
      signalSessionId: signal.signalSessionId,
    });
  }

  private async startInternal(): Promise<void> {
    this.configureConsoleApi();
    log('manual signaling ready', {
      room: this.room,
      localPlayerIndex: this.localPlayerIndex,
      api: 'window.battleCityGhostMirror',
    });
    this.startTransportSignaling();
  }

  private startTransportSignaling(): void {
    if (
      !this.isEnabled() ||
      this.signalTransport === null
    ) {
      return;
    }

    if (this.localPlayerIndex !== 0) {
      log('waiting for MagicBlock offer');
      return;
    }

    this.startOfferCycle('initial');
  }

  private async handleTransportSignal(
    code: string,
    kind: WebRtcGhostSignalKind,
  ): Promise<void> {
    try {
      const signal = decodeSignalCode(code);
      if (kind === 'offer') {
        if (
          this.localPlayerIndex !== 1 ||
          signal.description.type !== 'offer' ||
          this.answeredOfferSessionIds.has(signal.signalSessionId)
        ) {
          return;
        }
        const answer = await this.pasteOfferCode(code);
        await this.publishTransportSignal(answer, 'answer');
        this.answeredOfferSessionIds.add(signal.signalSessionId);
        return;
      }

      if (
        this.localPlayerIndex !== 0 ||
        signal.description.type !== 'answer' ||
        signal.signalSessionId !== this.activeOfferSessionId ||
        signal.signalSessionId === this.acceptedAnswerSessionId ||
        this.peerConnection === null
      ) {
        return;
      }
      await this.pasteAnswerCode(code);
      this.acceptedAnswerSessionId = signal.signalSessionId;
    } catch (error) {
      log('MagicBlock signal handling failed', error);
    }
  }

  private async publishTransportSignal(
    code: string,
    kind: WebRtcGhostSignalKind,
  ): Promise<void> {
    if (this.signalTransport === null) {
      return;
    }

    await this.signalTransport.publishSignal(code, kind);
    log(`MagicBlock ${kind} published`);
  }

  private startOfferCycle(reason: string): void {
    if (
      this.localPlayerIndex !== 0 ||
      this.signalTransport === null ||
      this.publishingOffer
    ) {
      return;
    }

    this.publishingOffer = true;
    this.clearReconnectTimer();
    this.createOfferCode()
      .then((code) => this.publishTransportSignal(code, 'offer'))
      .then(() => {
        log('MagicBlock offer cycle started', {
          reason,
          signalSessionId: this.activeOfferSessionId,
        });
      })
      .catch((error) => {
        log('MagicBlock offer cycle failed', error);
        this.scheduleReconnect();
      })
      .finally(() => {
        this.publishingOffer = false;
      });
  }

  private scheduleReconnect(): void {
    if (
      this.localPlayerIndex !== 0 ||
      this.signalTransport === null ||
      this.reconnectTimer !== null
    ) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) {
        this.startOfferCycle('reconnect');
      }
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private ensurePeerConnection(): RTCPeerConnection {
    if (this.peerConnection !== null) {
      return this.peerConnection;
    }

    const peerConnection = createPeerConnection();
    this.peerConnection = peerConnection;

    peerConnection.ondatachannel = (event): void => {
      this.attachDataChannel(event.channel);
    };

    peerConnection.onconnectionstatechange = (): void => {
      this.connected = peerConnection.connectionState === 'connected';
      log('peer connection state', {
        state: peerConnection.connectionState,
        iceState: peerConnection.iceConnectionState,
      });
      if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        this.connected = false;
        this.scheduleReconnect();
      }
    };

    peerConnection.oniceconnectionstatechange = (): void => {
      this.connected = peerConnection.iceConnectionState === 'connected';
      log('ice connection state', {
        state: peerConnection.iceConnectionState,
      });
      if (
        peerConnection.iceConnectionState === 'failed' ||
        peerConnection.iceConnectionState === 'disconnected'
      ) {
        this.connected = false;
        this.scheduleReconnect();
      }
    };

    return peerConnection;
  }

  private attachDataChannel(dataChannel: RTCDataChannel): void {
    this.dataChannel = dataChannel;

    dataChannel.onopen = (): void => {
      this.connected = true;
      this.clearReconnectTimer();
      log('data channel open', {
        room: this.room,
        localPlayerIndex: this.localPlayerIndex,
      });
    };

    dataChannel.onmessage = (event): void => {
      try {
        this.acceptPacket(JSON.parse(event.data));
      } catch (error) {
        log('data channel packet parse failed', error);
      }
    };

    dataChannel.onclose = (): void => {
      this.connected = false;
      log('data channel closed');
      this.scheduleReconnect();
    };

    dataChannel.onerror = (event): void => {
      log('data channel error', event);
      this.scheduleReconnect();
    };
  }

  private createSignalCode(
    description: RTCSessionDescription | RTCSessionDescriptionInit,
    signalSessionId: string,
  ): string {
    if (description === null || description === undefined) {
      throw new Error('Missing local WebRTC description.');
    }

    return encodeSignalCode({
      type: 'battlecity-ghost-signal',
      version: 1,
      room: this.room,
      signalSessionId,
      createdAt: Date.now(),
      fromPlayerIndex: this.localPlayerIndex,
      description: {
        type: description.type,
        sdp: description.sdp,
      },
    });
  }

  private validateSignal(signal: SignalCode, expectedType: RTCSdpType): void {
    if (signal.room !== this.room) {
      throw new Error(
        `Signal code is for room ${signal.room}, current room is ${this.room}.`,
      );
    }
    if (signal.fromPlayerIndex === this.localPlayerIndex) {
      throw new Error('Signal code was created by this same player.');
    }
    if (signal.description.type !== expectedType) {
      throw new Error(
        `Expected ${expectedType} code, got ${signal.description.type}.`,
      );
    }
    if (
      typeof signal.signalSessionId !== 'string' ||
      signal.signalSessionId === ''
    ) {
      throw new Error('Signal code is missing signalSessionId.');
    }
  }

  private resetPeerConnection(): void {
    this.clearReconnectTimer();
    if (this.dataChannel !== null) {
      this.dataChannel.onopen = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onerror = null;
      this.dataChannel.close();
    }
    if (this.peerConnection !== null) {
      this.peerConnection.ondatachannel = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.connected = false;
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error('Ghost mirror is not enabled. Add ghostMirror=1.');
    }
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

  private configureConsoleApi(): void {
    if (!this.isEnabled()) {
      if (window.battleCityGhostMirror !== undefined) {
        delete window.battleCityGhostMirror;
      }
      return;
    }

    window.battleCityGhostMirror = {
      createOfferCode: () => this.createOfferCode(),
      pasteOfferCode: (code: string) => this.pasteOfferCode(code),
      pasteAnswerCode: (code: string) => this.pasteAnswerCode(code),
      close: () => this.resetPeerConnection(),
      status: () => ({
        enabled: this.isEnabled(),
        room: this.room,
        localPlayerIndex: this.localPlayerIndex,
        connected: this.connected,
        channelState: this.dataChannel?.readyState ?? 'none',
      }),
    };
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
