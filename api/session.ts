declare const require: any;

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
  if (session === null) {
    return json(
      { authenticated: false },
      200,
      sessionIdentity.createClearedSessionCookie(),
    );
  }

  return json(sessionStore.toPublicSession(session));
}

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (body?.provider !== 'guest') {
    return json({ error: 'Unsupported login provider' }, 400);
  }

  const session = await sessionStore.createGuestSession();

  return json(
    sessionStore.toPublicSession(session),
    201,
    sessionIdentity.createSessionCookie(session.id),
  );
}

function json(body: any, status = 200, setCookie: string | null = null): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });
  if (setCookie !== null) {
    headers.set('set-cookie', setCookie);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
