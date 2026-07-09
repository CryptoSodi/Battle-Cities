export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost';
  }

  const host = window.location.hostname.toLowerCase();
  if (
    host === 'battlecities.com' ||
    host === 'www.battlecities.com' ||
    host.endsWith('.battlecities.com')
  ) {
    return 'https://api.battlecities.com';
  }

  return window.location.origin;
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
