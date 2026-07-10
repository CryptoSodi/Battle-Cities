declare const require: any;

import { createJsonResponse, createOptionsResponse } from './_helpers';

const playerStore = require('../server/playerStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');

export function OPTIONS(request: Request): Response {
  return createOptionsResponse(request);
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = sessionIdentity.resolveSession(
    request.headers.get('cookie') || '',
  );

  if (sessionId === null) {
    return json(request, { authenticated: false });
  }

  const session = await sessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return json(request, { authenticated: false });
  }

  const player = await playerStore.readPlayer(session.playerId);
  if (player === null) {
    return json(request, { authenticated: false });
  }

  return json(request, {
    authenticated: true,
    player: playerStore.toPublicPlayer(player),
  });
}

function json(request: Request, body: any, status = 200): Response {
  return createJsonResponse(request, body, status);
}
