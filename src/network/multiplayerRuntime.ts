import type { MultiplayerRuntimeConfig } from '@battlecities/shared';

export const MULTIPLAYER_RUNTIME_STORAGE_KEY =
  'battlecities.multiplayer.runtime';

export function readMultiplayerRuntime(): MultiplayerRuntimeConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(MULTIPLAYER_RUNTIME_STORAGE_KEY) || 'null',
    );
    return isMultiplayerRuntime(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeMultiplayerRuntime(
  runtime: MultiplayerRuntimeConfig,
): void {
  window.sessionStorage.setItem(
    MULTIPLAYER_RUNTIME_STORAGE_KEY,
    JSON.stringify(runtime),
  );
}

export function clearMultiplayerRuntime(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(MULTIPLAYER_RUNTIME_STORAGE_KEY);
    clearWebRtcMatchUrl();
  }
}

export function clearPlayerRuntimeOnReload(): void {
  if (typeof window === 'undefined' || !isPageReload()) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const hasStoredPlayerRuntime =
    window.sessionStorage.getItem(MULTIPLAYER_RUNTIME_STORAGE_KEY) !== null;
  const isDirectWebRtcPlayer =
    params.get('mode') === 'webrtc' &&
    params.get('broadcaster') !== '1' &&
    params.get('observer') !== '1';
  if (hasStoredPlayerRuntime || isDirectWebRtcPlayer) {
    clearMultiplayerRuntime();
  }
}

function isPageReload(): boolean {
  const navigation = window.performance
    .getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation !== undefined) {
    return navigation.type === 'reload';
  }
  const legacyPerformance = window.performance as Performance & {
    navigation?: { type: number };
  };
  return legacyPerformance.navigation?.type === 1;
}

function clearWebRtcMatchUrl(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('mode') !== 'webrtc') {
    return;
  }
  [
    'mode',
    'match',
    'host',
    'join',
    'player',
    'broadcaster',
    'headless',
    'observer',
    'observerId',
    'serviceToken',
    'debugNoEnemyShooting',
    'webrtcNoEnemyShooting',
  ].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function isMultiplayerRuntime(value: any): value is MultiplayerRuntimeConfig {
  return (
    value?.protocolVersion === 1 &&
    value?.mode === 'webrtc' &&
    value?.role === 'player' &&
    typeof value.matchId === 'string' &&
    /^match-[0-9a-z-]+$/i.test(value.matchId) &&
    (value.playerSlot === 0 || value.playerSlot === 1) &&
    ['a', 'b', 'c', 'd'].includes(value.tankTier) &&
    Number.isInteger(value.level) &&
    value.level >= 1 &&
    typeof value.signalingBaseUrl === 'string' &&
    /^https?:\/\//.test(value.signalingBaseUrl) &&
    typeof value.joinToken === 'string' &&
    value.joinToken.length >= 32
  );
}
