export function getApiBaseUrl(): string {
  const configuredBaseUrl = String(
    process.env.BATTLECITY_API_BASE_URL || '',
  ).trim();
  if (configuredBaseUrl !== '') {
    return configuredBaseUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3001';
  }

  // Preserve same-origin behavior until each deployment explicitly opts into
  // the standalone API. Production sets this to api.battlecities.com through
  // BATTLECITY_API_BASE_URL at build time.
  return window.location.origin;
}

export function getApiUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

export function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
  });
}
