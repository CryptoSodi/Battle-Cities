"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiFetch = exports.getApiUrl = exports.getApiBaseUrl = void 0;
function getApiBaseUrl() {
    const configuredBaseUrl = String(process.env.BATTLECITY_API_BASE_URL || '').trim();
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
exports.getApiBaseUrl = getApiBaseUrl;
function getApiUrl(path) {
    return new URL(path, getApiBaseUrl()).toString();
}
exports.getApiUrl = getApiUrl;
function apiFetch(path, init = {}) {
    const headers = new Headers(init.headers);
    const target = readHeadlessTarget();
    if (target !== null) {
        headers.set('X-BattleCities-Headless', target);
    }
    return fetch(getApiUrl(path), {
        credentials: 'include',
        ...init,
        headers,
    });
}
exports.apiFetch = apiFetch;
function readHeadlessTarget() {
    if (typeof window === 'undefined') {
        return null;
    }
    const target = new URLSearchParams(window.location.search)
        .get('headless')
        ?.trim()
        .toLowerCase();
    return target === 'worker' || target === 'bom1' || target === 'usa'
        ? target
        : null;
}
