declare const require: any;

import { createJsonResponse, createOptionsResponse } from './_helpers';

const signalStore = require('../server/webrtcSignalStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

export async function POST(
  request: Request,
  matchId: string,
  playerIndex: string,
  kind: string,
): Promise<Response> {
  if (!isValidRoute(matchId, playerIndex, kind)) {
    return createJsonResponse(request, { ok: false, error: 'Invalid signal route' }, 400);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(request, { ok: false, error: 'Invalid JSON' }, 400);
  }

  try {
    const result = await signalStore.publishSignal(
      matchId,
      playerIndex,
      kind,
      body?.code,
    );
    return createJsonResponse(
      request,
      { ok: true, id: result.id, createdAt: result.createdAt },
      201,
    );
  } catch (error) {
    return createJsonResponse(
      request,
      { ok: false, error: (error as Error).message },
      400,
    );
  }
}

export async function GET(
  request: Request,
  matchId: string,
  playerIndex: string,
  kind: string,
): Promise<Response> {
  if (!isValidRoute(matchId, playerIndex, kind)) {
    return createJsonResponse(request, { ok: false, error: 'Invalid signal route' }, 400);
  }

  const url = new URL(request.url);
  const signal = await signalStore.readSignal(
    matchId,
    playerIndex,
    kind,
    Number(url.searchParams.get('after') || '0'),
  );

  return createJsonResponse(request, { ok: true, signal });
}

function isValidRoute(matchId: string, playerIndex: string, kind: string): boolean {
  return (
    signalStore.isValidMatchId(matchId) &&
    signalStore.isValidPlayerIndex(playerIndex) &&
    signalStore.isValidSignalKind(kind)
  );
}
