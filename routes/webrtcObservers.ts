declare const require: any;

import { createJsonResponse, createOptionsResponse } from './_helpers';

const signalStore = require('../server/webrtcSignalStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

export async function GET(
  request: Request,
  matchId: string,
): Promise<Response> {
  if (!signalStore.isValidMatchId(matchId)) {
    return createJsonResponse(
      request,
      { ok: false, error: 'Invalid observer route' },
      400,
    );
  }

  const observers = await signalStore.listObservers(matchId);
  return createJsonResponse(request, { ok: true, observers });
}

export async function POST(
  request: Request,
  matchId: string,
): Promise<Response> {
  if (!signalStore.isValidMatchId(matchId)) {
    return createJsonResponse(
      request,
      { ok: false, error: 'Invalid observer route' },
      400,
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(
      request,
      { ok: false, error: 'Invalid JSON' },
      400,
    );
  }

  if (!signalStore.isValidObserverId(body?.observerId)) {
    return createJsonResponse(
      request,
      { ok: false, error: 'Invalid observer ID' },
      400,
    );
  }

  try {
    await signalStore.registerObserver(matchId, body.observerId);
    return createJsonResponse(request, { ok: true }, 201);
  } catch (error) {
    const message = (error as Error).message;
    return createJsonResponse(
      request,
      { ok: false, error: message },
      message === 'Observer limit reached' ? 409 : 400,
    );
  }
}
