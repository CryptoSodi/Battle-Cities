/* eslint-disable @typescript-eslint/no-use-before-define */

import { getApiUrl } from '../network/api';

type PublicRank = {
  rank: number | null;
  totalPoints: number;
  matches: number;
};

type PublicMatch = {
  id: string;
  mode: 'single' | 'multi';
  levelNumber: number;
  score: number;
  gamePoints: number;
  won: boolean;
  createdAt: string;
};

type PublicProfile = {
  id: string;
  provider: 'guest' | 'wallet' | 'google';
  displayName: string;
  walletAddress: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  highscores: { primary: number; secondary: number };
  stats: {
    allTime: PublicRank;
    currentSeason: PublicRank & { id: string; name: string };
  };
  recentMatches: PublicMatch[];
};

const loading = requireElement<HTMLElement>('[data-profile-loading]');
const errorPanel = requireElement<HTMLElement>('[data-profile-error]');
const content = requireElement<HTMLElement>('[data-profile-content]');

void loadProfile();

async function loadProfile(): Promise<void> {
  const playerId = readPlayerId();
  if (playerId === null) {
    showError(
      'Invalid player profile',
      'The profile address does not contain a valid player ID.',
    );
    return;
  }

  try {
    const response = await fetch(
      getApiUrl(`/api/players/${encodeURIComponent(playerId)}/profile`),
      { credentials: 'include' },
    );
    if (response.status === 404) {
      showError(
        'Player not found',
        'No Battle Cities player exists for this profile address.',
      );
      return;
    }
    if (!response.ok) {
      throw new Error(`Profile request failed (${response.status})`);
    }
    const body = (await response.json()) as { item?: PublicProfile };
    if (body.item === undefined) {
      throw new Error('Profile response is incomplete');
    }
    renderProfile(body.item);
  } catch (error) {
    console.error('[player-profile] load failed', error);
    showError(
      'Combat record unavailable',
      'The profile service could not be reached. Please try again shortly.',
    );
  }
}

function renderProfile(profile: PublicProfile): void {
  setText('[data-profile-name]', profile.displayName || 'Player');
  setText('[data-profile-id]', profile.walletAddress || profile.id);
  setText('[data-profile-provider]', providerLabel(profile.provider));
  setText('[data-profile-joined]', formatDate(profile.joinedAt));
  setText('[data-season-rank]', formatRank(profile.stats.currentSeason.rank));
  setText(
    '[data-season-name]',
    profile.stats.currentSeason.name || 'Current season',
  );
  setText(
    '[data-total-points]',
    formatNumber(profile.stats.allTime.totalPoints),
  );
  setText('[data-total-matches]', formatNumber(profile.stats.allTime.matches));
  setText('[data-best-score]', formatNumber(profile.highscores.primary));
  setText(
    '[data-match-count]',
    `${profile.recentMatches.length} ${
      profile.recentMatches.length === 1 ? 'record' : 'records'
    }`,
  );

  const fallback = requireElement<HTMLElement>(
    '[data-profile-avatar-fallback]',
  );
  fallback.textContent = initials(profile.displayName);
  const avatar = requireElement<HTMLImageElement>(
    '[data-profile-avatar-image]',
  );
  const avatarUrl = safeImageUrl(profile.avatarUrl);
  if (avatarUrl !== null) {
    avatar.src = avatarUrl;
    avatar.alt = `${profile.displayName} profile image`;
    avatar.hidden = false;
    fallback.hidden = true;
  }

  renderHistory(profile.recentMatches);
  const copyButton = requireElement<HTMLButtonElement>('[data-profile-copy]');
  copyButton.addEventListener('click', () => void copyProfileLink(copyButton));

  loading.hidden = true;
  content.hidden = false;
}

function renderHistory(matches: PublicMatch[]): void {
  const history = requireElement<HTMLElement>('[data-profile-history]');
  const empty = requireElement<HTMLElement>('[data-profile-empty]');
  if (matches.length === 0) {
    empty.hidden = false;
    return;
  }

  matches.forEach((match) => {
    const row = document.createElement('article');
    row.className = `profile-match${match.won ? ' profile-match--won' : ''}`;
    row.append(
      matchCell(
        'Result',
        match.won ? 'Victory' : 'Defeat',
        'profile-match__result',
      ),
      matchCell('Score', formatNumber(match.score)),
      matchCell('Level', String(match.levelNumber)),
      matchCell('Played', formatDate(match.createdAt)),
    );
    history.append(row);
  });
}

function matchCell(label: string, value: string, className = ''): HTMLElement {
  const cell = document.createElement('div');
  const labelElement = document.createElement('span');
  labelElement.className = 'profile-match__label';
  labelElement.textContent = label;
  const valueElement = document.createElement('span');
  valueElement.className = `profile-match__value${
    className === '' ? '' : ` ${className}`
  }`;
  valueElement.textContent = value;
  cell.append(labelElement, valueElement);
  return cell;
}

async function copyProfileLink(button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    button.textContent = 'Link copied';
    window.setTimeout(() => {
      button.textContent = 'Copy profile link';
    }, 1800);
  } catch {
    button.textContent = 'Copy unavailable';
  }
}

function showError(title: string, copy: string): void {
  setText('[data-profile-error-title]', title);
  setText('[data-profile-error-copy]', copy);
  loading.hidden = true;
  errorPanel.hidden = false;
}

function readPlayerId(): string | null {
  const match = window.location.pathname.match(
    /^\/player-profile\/(ply-[a-z0-9-]+)\/?$/i,
  );
  return match === null ? null : match[1];
}

function safeImageUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function providerLabel(provider: PublicProfile['provider']): string {
  if (provider === 'google') return 'Google player';
  if (provider === 'wallet') return 'Wallet player';
  return 'Guest player';
}

function initials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BC';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatRank(rank: number | null): string {
  return rank === null ? 'Unranked' : `#${formatNumber(rank)}`;
}

function formatNumber(value: number): string {
  return Math.max(0, Number(value) || 0).toLocaleString('en-US');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat('en', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function setText(selector: string, value: string): void {
  requireElement<HTMLElement>(selector).textContent = value;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing profile element: ${selector}`);
  }
  return element;
}
