export type WebRtcSignalKind = 'offer' | 'answer';

export interface WebRtcSignalRecord {
  id: number;
  matchId: string;
  playerIndex: number;
  kind: WebRtcSignalKind;
  code: string;
  createdAt: string;
}

export interface WebRtcSignalPublishRequest {
  code: string;
}

export interface WebRtcSignalPublishResponse {
  ok: boolean;
  id?: number;
  createdAt?: string;
  error?: string;
}

export interface WebRtcSignalReadResponse {
  ok: boolean;
  signal: WebRtcSignalRecord | null;
  error?: string;
}

export interface WebRtcObserverRegistrationRequest {
  observerId: string;
}

export interface WebRtcObserverListResponse {
  ok: boolean;
  observers: string[];
  error?: string;
}

export interface WebRtcSignalTransport {
  publishSignal(code: string, kind: WebRtcSignalKind): Promise<void>;
  subscribe(
    callback: (code: string, kind: WebRtcSignalKind) => void,
  ): () => void;
}
