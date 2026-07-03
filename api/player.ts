declare const require: any;

const playerStore = require('../server/playerStore');
const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');

export async function GET(request: Request): Promise<Response> {
  const sessionId = sessionIdentity.resolveSession(
    request.headers.get('cookie') || '',
  );

  if (sessionId === null) {
    return json({ authenticated: false });
  }

  const session = await sessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return json({ authenticated: false });
  }

  const player = await playerStore.readPlayer(session.playerId);
  if (player === null) {
    return json({ authenticated: false });
  }

  return json({
    authenticated: true,
    player: playerStore.toPublicPlayer(player),
  });
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
