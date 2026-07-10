export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost';
  }

  if (isLocalDevelopmentHost(window.location.hostname.toLowerCase())) {
    return 'https://www.battlecities.com';
  }

  return window.location.origin;
}

function isLocalDevelopmentHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function getApiUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
  });
}
