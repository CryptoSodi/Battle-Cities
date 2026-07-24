import { createJsonResponse, createOptionsResponse } from './_helpers';

const WEBRTC_SIGNAL_TTL_MS = 5 * 60 * 1000;
const WEBRTC_SIGNAL_MAX_BYTES = 256 * 1024;

type SignalKind = 'offer' | 'answer';

interface WebRtcSignal {
  id: number;
  matchId: string;
  playerIndex: number;
  kind: SignalKind;
  code: string;
  createdAt: number;
}

interface WebRtcSignalStore {
  nextId: number;
  signals: Map<string, WebRtcSignal>;
}

declare global {
  // eslint-disable-next-line no-var
  var battleCityWebRtcSignals: WebRtcSignalStore | undefined;
}

function getStore(): WebRtcSignalStore {
  if (globalThis.battleCityWebRtcSignals === undefined) {
    globalThis.battleCityWebRtcSignals = {
      nextId: 1,
      signals: new Map(),
    };
  }

  return globalThis.battleCityWebRtcSignals;
}

function signalKey(matchId: string, playerIndex: string, kind: SignalKind): string {
  return `${matchId}:${playerIndex}:${kind}`;
}

function cleanupSignals(now = Date.now()): void {
  const store = getStore();
  store.signals.forEach((signal, key) => {
    if (now - signal.createdAt > WEBRTC_SIGNAL_TTL_MS) {
      store.signals.delete(key);
    }
  });
}

function isValidMatchId(value: string): boolean {
  return /^[0-9A-Za-z_-]{1,64}$/.test(value);
}

function isValidPlayerIndex(value: string): boolean {
  return value === '0' || value === '1';
}

function isValidSignalKind(value: string): value is SignalKind {
  return value === 'offer' || value === 'answer';
}

function isValidRoute(
  request: Request,
  matchId: string,
  playerIndex: string,
  kind: string,
): kind is SignalKind {
  if (
    isValidMatchId(matchId) &&
    isValidPlayerIndex(playerIndex) &&
    isValidSignalKind(kind)
  ) {
    return true;
  }

  return false;
}

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

export async function POST(
  request: Request,
  matchId: string,
  playerIndex: string,
  kind: string,
): Promise<Response> {
  if (!isValidRoute(request, matchId, playerIndex, kind)) {
    return createJsonResponse(request, { ok: false, error: 'Invalid signal route' }, 400);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(request, { ok: false, error: 'Invalid JSON' }, 400);
  }

  if (
    typeof body?.code !== 'string' ||
    body.code.length === 0 ||
    Buffer.byteLength(body.code, 'utf8') > WEBRTC_SIGNAL_MAX_BYTES
  ) {
    return createJsonResponse(request, { ok: false, error: 'Invalid signal code' }, 400);
  }

  cleanupSignals();
  const store = getStore();
  const createdAt = Date.now();
  const signal: WebRtcSignal = {
    id: store.nextId,
    matchId,
    playerIndex: Number(playerIndex),
    kind,
    code: body.code,
    createdAt,
  };
  store.nextId += 1;
  store.signals.set(signalKey(matchId, playerIndex, kind), signal);

  return createJsonResponse(request, { ok: true, id: signal.id, createdAt }, 201);
}

export function GET(
  request: Request,
  matchId: string,
  playerIndex: string,
  kind: string,
): Response {
  if (!isValidRoute(request, matchId, playerIndex, kind)) {
    return createJsonResponse(request, { ok: false, error: 'Invalid signal route' }, 400);
  }

  cleanupSignals();
  const url = new URL(request.url);
  const after = Number(url.searchParams.get('after') || '0');
  const signal = getStore().signals.get(signalKey(matchId, playerIndex, kind));

  if (signal === undefined || signal.id <= after) {
    return createJsonResponse(request, { ok: true, signal: null });
  }

  return createJsonResponse(request, {
    ok: true,
    signal: {
      id: signal.id,
      matchId: signal.matchId,
      playerIndex: signal.playerIndex,
      kind: signal.kind,
      code: signal.code,
      createdAt: signal.createdAt,
    },
  });
}
