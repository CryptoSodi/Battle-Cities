declare const require: any;

const sessionIdentity = require('../server/sessionIdentity');
const sessionStore = require('../server/sessionStore');
const walletAuth = require('../server/walletAuth');

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

  if (body?.provider !== 'guest' && body?.provider !== 'wallet') {
    return json({ error: 'Unsupported login provider' }, 400);
  }

  if (
    body.provider === 'wallet' &&
    !(await walletAuth.verifyChallenge({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
      message: body.message,
      signature: body.signature,
    }))
  ) {
    return json({ error: 'Invalid wallet signature' }, 401);
  }

  const session =
    body.provider === 'wallet'
      ? await sessionStore.createWalletSession(body.walletAddress)
      : await sessionStore.createGuestSession();

  return json(
    sessionStore.toPublicSession(session),
    201,
    sessionIdentity.createSessionCookie(session.id),
  );
}

export async function PUT(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!walletAuth.isValidWalletAddress(body?.walletAddress)) {
    return json({ error: 'Invalid wallet address' }, 400);
  }

  const challenge = await walletAuth.createChallenge(body.walletAddress);

  return json(challenge, 201);
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
