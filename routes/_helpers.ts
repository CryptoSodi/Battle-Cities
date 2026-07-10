declare const require: any;

const helperPlayerStore = require('../server/playerStore');
const helperSessionIdentity = require('../server/sessionIdentity');
const helperSessionStore = require('../server/sessionStore');

// Session-cookie -> player record, or null when not logged in. Shared by
// every authenticated endpoint.
export async function resolveSessionPlayer(request: Request): Promise<any> {
  const sessionId = helperSessionIdentity.resolveSession(
    request.headers.get('cookie') || '',
  );
  if (sessionId === null) {
    return null;
  }

  const session = await helperSessionStore.readSession(sessionId);
  if (session === null || session.playerId === null) {
    return null;
  }

  return helperPlayerStore.readPlayer(session.playerId);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (typeof origin !== 'string' || origin === '') {
    return false;
  }

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.battlecities.com') ||
      host === 'battlecities.com' ||
      host === 'www.battlecities.com' ||
      isPrivateIp(host)
    );
  } catch {
    return false;
  }
}

function isPrivateIp(host: string): boolean {
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function createCorsHeaders(request: Request, extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  const origin = request.headers.get('origin');

  if (isAllowedOrigin(origin)) {
    headers.set('access-control-allow-origin', origin);
  }

  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type, authorization');
  headers.set('vary', 'origin');

  return headers;
}

export function createJsonResponse(
  request: Request,
  body: any,
  status = 200,
  setCookie: string | null = null,
): Response {
  const headers = createCorsHeaders(request, {
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

export function createOptionsResponse(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(request),
  });
}
