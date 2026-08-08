/* eslint-disable @typescript-eslint/no-use-before-define */

import {
  PlayerProfileClient,
  PlayerProfileRequestError,
  PublicMatch,
  PublicProfile,
} from './PlayerProfileClient';

const loading = requireElement<HTMLElement>('[data-profile-loading]');
const errorPanel = requireElement<HTMLElement>('[data-profile-error]');
const content = requireElement<HTMLElement>('[data-profile-content]');
const profileClient = new PlayerProfileClient();
const previousPageButton = requireElement<HTMLButtonElement>(
  '[data-profile-previous]',
);
const nextPageButton = requireElement<HTMLButtonElement>('[data-profile-next]');

let playerId: string | null = null;
let currentPage = 1;
let totalPages = 1;
let isLoadingPage = false;

previousPageButton.addEventListener('click', () =>
  void loadProfilePage(currentPage - 1),
);
nextPageButton.addEventListener('click', () =>
  void loadProfilePage(currentPage + 1),
);

void loadProfile();

async function loadProfile(): Promise<void> {
  playerId = readPlayerId();
  if (playerId === null) {
    showError(
      'Invalid player profile',
      'The profile address does not contain a valid player ID.',
    );
    return;
  }

  await loadProfilePage(1, true);
}

async function loadProfilePage(
  page: number,
  isInitialLoad = false,
): Promise<void> {
  if (playerId === null || isLoadingPage) {
    return;
  }

  const requestedPage = Math.max(1, Math.min(totalPages, Math.floor(page)));
  isLoadingPage = true;
  setPaginationBusy(true);

  try {
    renderProfile(await profileClient.getProfile(playerId, requestedPage));
  } catch (error) {
    console.error('[player-profile] load failed', error);
    if (
      isInitialLoad &&
      error instanceof PlayerProfileRequestError &&
      error.status === 404
    ) {
      showError(
        'Player not found',
        'No Battle Cities player exists for this profile address.',
      );
    } else if (isInitialLoad) {
      showError(
        'Combat record unavailable',
        'The profile service could not be reached. Please try again shortly.',
      );
    }
  } finally {
    isLoadingPage = false;
    setPaginationBusy(false);
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
    `${profile.recentMatchesPage.total} ${
      profile.recentMatchesPage.total === 1 ? 'record' : 'records'
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
  renderPagination(profile.recentMatchesPage);
  const copyButton = requireElement<HTMLButtonElement>('[data-profile-copy]');
  copyButton.onclick = () => void copyProfileLink(copyButton);

  loading.hidden = true;
  content.hidden = false;
}

function renderHistory(matches: PublicMatch[]): void {
  const history = requireElement<HTMLElement>('[data-profile-history]');
  const empty = requireElement<HTMLElement>('[data-profile-empty]');
  history.replaceChildren();
  empty.hidden = matches.length !== 0;
  if (matches.length === 0) {
    return;
  }

  matches.forEach((match) => {
    const row = document.createElement('tr');
    row.className = match.won ? 'profile-match--won' : '';
    row.append(
      matchCell(match.won ? 'Victory' : 'Defeat', 'profile-match__result'),
      matchCell(formatNumber(match.score)),
      matchCell(String(match.levelNumber)),
      matchCell(formatDate(match.createdAt)),
      replayCell(match),
    );
    history.append(row);
  });
}

function renderPagination(page: PublicProfile['recentMatchesPage']): void {
  currentPage = page.page;
  totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  const pagination = requireElement<HTMLElement>('[data-profile-pagination]');
  pagination.hidden = totalPages <= 1;
  setText(
    '[data-profile-page-status]',
    `Page ${currentPage} of ${totalPages}`,
  );
  setPaginationBusy(false);
}

function setPaginationBusy(isBusy: boolean): void {
  previousPageButton.disabled = isBusy || currentPage <= 1;
  nextPageButton.disabled = isBusy || currentPage >= totalPages;
}

function replayCell(match: PublicMatch): HTMLTableCellElement {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-button admin-button--replay';
  button.textContent = 'Watch';
  button.disabled = !match.replayAvailable;
  button.title = match.replayAvailable
    ? 'Watch this recorded match'
    : 'No replay was saved for this match';
  button.addEventListener('click', () => openReplay(match));
  cell.append(button);
  return cell;
}

function openReplay(match: PublicMatch): void {
  const playerId = readPlayerId();
  if (playerId === null || !match.replayAvailable) return;
  const url = new URL('/', window.location.origin);
  url.searchParams.set('profileReplayPlayer', playerId);
  url.searchParams.set('profileReplayMatch', match.id);
  window.open(url.toString(), '_blank', 'noopener');
}

function matchCell(value: string, className = ''): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = value;
  return cell;
}

async function copyProfileLink(button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    button.textContent = 'Link copied';
    window.setTimeout(() => {
      button.textContent = 'Share profile';
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
  const queryPlayerId = new URLSearchParams(window.location.search).get(
    'playerId',
  );
  if (queryPlayerId !== null && /^ply-[a-z0-9-]+$/i.test(queryPlayerId)) {
    return queryPlayerId;
  }

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
