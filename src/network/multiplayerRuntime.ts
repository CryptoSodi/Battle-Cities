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
  }
}

function isMultiplayerRuntime(value: any): value is MultiplayerRuntimeConfig {
  return (
    value?.protocolVersion === 1 &&
    value?.mode === 'webrtc' &&
    value?.role === 'player' &&
    typeof value.matchId === 'string' &&
    /^match-[0-9a-z-]+$/i.test(value.matchId) &&
    (value.playerSlot === 0 || value.playerSlot === 1) &&
    Number.isInteger(value.level) &&
    value.level >= 1 &&
    typeof value.signalingBaseUrl === 'string' &&
    /^https?:\/\//.test(value.signalingBaseUrl) &&
    typeof value.joinToken === 'string' &&
    value.joinToken.length >= 32
  );
}
