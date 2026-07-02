const COOKIE_NAME = 'battlecity_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function resolveSession(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[COOKIE_NAME];

  return isValidSessionId(sessionId) ? sessionId : null;
}

function createSessionCookie(sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    'HttpOnly',
    secure,
  ]
    .filter(Boolean)
    .join('; ');
}

function createClearedSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
    secure,
  ]
    .filter(Boolean)
    .join('; ');
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (typeof cookieHeader !== 'string' || cookieHeader === '') {
    return cookies;
  }

  cookieHeader.split(';').forEach((part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
  });

  return cookies;
}

function isValidSessionId(value) {
  return typeof value === 'string' && /^sess-[a-z0-9-]+$/i.test(value);
}

module.exports = {
  COOKIE_NAME,
  createClearedSessionCookie,
  createSessionCookie,
  resolveSession,
};
