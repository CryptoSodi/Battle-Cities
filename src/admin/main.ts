/* eslint-disable @typescript-eslint/no-use-before-define */

import { getApiUrl } from '../network/api';
import { AdminClient, AdminRequestError } from './AdminClient';

const client = new AdminClient();
let tournaments: any[] = [];
let payoutTournament: any = null;
let matchOffset = 0;
let playerOffset = 0;

void initialize();

async function initialize(): Promise<void> {
  requireElement<HTMLAnchorElement>('[data-admin-login-link]').href = getApiUrl(
    '/api/auth/google/start?returnTo=/admin/',
  );
  bindEvents();
  try {
    const session = await client.getSession();
    showApp(session.admin);
    await loadOverview();
  } catch (error) {
    requireElement('[data-admin-loading]').setAttribute('hidden', '');
    if (error instanceof AdminRequestError && error.status === 403) {
      show('[data-admin-forbidden]');
    } else if (error instanceof AdminRequestError && error.status === 401) {
      show('[data-admin-login]');
    } else {
      show('[data-admin-login]');
      message('Admin API is unavailable. Check the API deployment.', true);
    }
  }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((tab) => {
    tab.addEventListener('click', () => void selectTab(tab.dataset.adminTab || 'overview'));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-admin-refresh]').forEach((button) => {
    button.addEventListener('click', () => void loadSection(button.dataset.adminRefresh || 'overview'));
  });
  requireElement<HTMLSelectElement>('[data-match-status]').addEventListener('change', () => void loadMatches());
  requireElement<HTMLSelectElement>('[data-match-category]').addEventListener('change', () => void loadMatches());
  requireElement<HTMLFormElement>('[data-player-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    void loadPlayers();
  });
  document.querySelectorAll<HTMLInputElement>('[data-player-from], [data-player-to]').forEach((input) => {
    input.addEventListener('change', () => void loadPlayers());
  });
  const playerDateClear = document.querySelector<HTMLButtonElement>('[data-player-date-clear]');
  if (playerDateClear !== null) {
    playerDateClear.addEventListener('click', () => {
      requireElement<HTMLInputElement>('[data-player-from]').value = '';
      requireElement<HTMLInputElement>('[data-player-to]').value = '';
      void loadPlayers();
    });
  }
  requireElement<HTMLButtonElement>('[data-tournament-new]').addEventListener('click', () => openTournamentForm());
  requireElement<HTMLButtonElement>('[data-tournament-cancel]').addEventListener('click', closeTournamentForm);
  requireElement<HTMLFormElement>('[data-tournament-form]').addEventListener('submit', (event) => void saveTournament(event));
  requireElement<HTMLInputElement>('[data-tournament-name]').addEventListener('input', fillSlugForNewTournament);
  requireElement<HTMLButtonElement>('[data-payout-submit]').addEventListener('click', () => void distributePrizes());
  document.querySelectorAll<HTMLButtonElement>('[data-admin-logout], [data-admin-forbidden-logout]').forEach((button) => {
    button.addEventListener('click', () => void logout());
  });
}

function showApp(admin: any): void {
  hide('[data-admin-loading]');
  setText('[data-admin-email]', admin.email);
  show('[data-admin-app]');
}

async function selectTab(name: string): Promise<void> {
  document.querySelectorAll<HTMLElement>('[data-admin-section]').forEach((section) => {
    const active = section.dataset.adminSection === name;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.adminTab === name);
  });
  await loadSection(name);
}

async function loadSection(name: string): Promise<void> {
  if (name === 'matches') await loadMatches();
  else if (name === 'replays') await loadReplays();
  else if (name === 'players') await loadPlayers();
  else if (name === 'tournaments') await loadTournaments();
  else await loadOverview();
}

let replayOffset = 0;

async function loadReplays(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) replayOffset = 0;
    const result = await client.getReplays(replayOffset);
    const body = requireElement('[data-replay-rows]');
    body.replaceChildren(...result.items.map(replayRow));
    if (result.items.length === 0) body.append(emptyRow(8, 'No single-player recordings found'));
    renderPagination('[data-replay-pagination]', {
      offset: replayOffset,
      limit: Number(result.limit),
      total: Number(result.total),
      onPrev: () => { replayOffset = Math.max(0, replayOffset - Number(result.limit)); void loadReplays(false); },
      onNext: () => { replayOffset += Number(result.limit); void loadReplays(false); },
    });
  });
}

async function loadOverview(): Promise<void> {
  await guarded(async () => {
    const { overview } = await client.getOverview();
    const metrics = [
      ['Registered players', overview.players],
      ['All matches', overview.matches],
      ['Active matches', overview.activeMatches],
      ['Completed matches', overview.completedMatches],
      ['Active tournaments', overview.activeTournaments],
      ['Pending payouts', overview.pendingPayouts],
    ];
    const root = requireElement('[data-admin-metrics]');
    root.replaceChildren(
      ...metrics.map(([label, value]) =>
        metric(
          String(label),
          Number(value),
          METRIC_ROUTES.get(String(label)) ?? null,
        ),
      ),
    );
  });
}

const METRIC_ROUTES = new Map<string, { tab: string; statusFilter?: string }>([
  ['Registered players', { tab: 'players' }],
  ['All matches', { tab: 'matches', statusFilter: '' }],
  ['Active matches', { tab: 'matches', statusFilter: 'active' }],
  ['Completed matches', { tab: 'matches', statusFilter: 'completed' }],
]);

function applyMatchFilter(statusFilter: string): void {
  requireElement<HTMLSelectElement>('[data-match-status]').value = statusFilter;
  requireElement<HTMLSelectElement>('[data-match-category]').value = '';
}

async function openMatchObserver(match: any): Promise<void> {
  const url = new URL(`${window.location.origin}/`);
  url.searchParams.set('observer', '1');
  url.searchParams.set('match', match.id);
  if (match.headlessTarget) {
    url.searchParams.set('headless', match.headlessTarget);
  }
  if (match.status === 'completed' || match.status === 'closed') {
    // Replay a finished match from its archived frames instead of a live
    // websocket. The observer fetches frames by match id using the ticket.
    try {
      const result = await client.spectate(match.id);
      if (result?.mode === 'archive') {
        url.searchParams.set('mode', 'archive');
        url.searchParams.set('observerId', result.observerId);
        url.searchParams.set('ticket', result.ticket);
        window.open(url.toString(), '_blank', 'noopener');
        return;
      }
      if (result?.websocketUrl) {
        url.searchParams.set('mode', 'websocket');
        url.searchParams.set('observerId', result.observerId);
        url.searchParams.set('websocketUrl', result.websocketUrl);
        window.open(url.toString(), '_blank', 'noopener');
        return;
      }
    } catch (error) {
      console.warn('[admin] finished-match replay unavailable', error);
    }
    url.searchParams.set('mode', 'webrtc');
    window.open(url.toString(), '_blank', 'noopener');
    return;
  }
  if (match.headlessTarget === undefined || match.headlessTarget === 'usa') {
    url.searchParams.set('mode', 'webrtc');
    window.open(url.toString(), '_blank', 'noopener');
    return;
  }
  try {
    const result = await client.spectate(match.id);
    if (result?.websocketUrl) {
      url.searchParams.set('mode', 'websocket');
      url.searchParams.set('observerId', result.observerId);
      url.searchParams.set('websocketUrl', result.websocketUrl);
      window.open(url.toString(), '_blank', 'noopener');
      return;
    }
  } catch (error) {
    console.warn('[admin] websocket spectator unavailable, falling back to replay', error);
  }
  url.searchParams.set('mode', 'webrtc');
  window.open(url.toString(), '_blank', 'noopener');
}

async function loadMatches(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) matchOffset = 0;
    const status = requireElement<HTMLSelectElement>('[data-match-status]').value;
    const category = requireElement<HTMLSelectElement>('[data-match-category]').value;
    const result = await client.getMatches(status, category, matchOffset);
    const body = requireElement('[data-match-rows]');
    body.replaceChildren(...result.items.map(matchRow));
    if (result.items.length === 0 && matchOffset === 0) {
      body.append(emptyRow(7, 'No matches found'));
    } else if (result.items.length === 0 && matchOffset > 0) {
      matchOffset = Math.max(0, matchOffset - result.limit);
      return void loadMatches(false);
    }
    renderPagination('[data-match-pagination]', {
      offset: matchOffset,
      limit: Number(result.limit),
      total: Number(result.total),
      onPrev: () => {
        matchOffset = Math.max(0, matchOffset - Number(result.limit));
        void loadMatches(false);
      },
      onNext: () => {
        matchOffset += Number(result.limit);
        void loadMatches(false);
      },
    });
  });
}

async function loadPlayers(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) playerOffset = 0;
    const query = requireElement<HTMLInputElement>('[data-player-query]').value.trim();
    const lastSeenFrom = requireElement<HTMLInputElement>('[data-player-from]').value;
    const lastSeenTo = requireElement<HTMLInputElement>('[data-player-to]').value;
    const result = await client.getPlayers(query, lastSeenFrom, lastSeenTo, playerOffset);
    const body = requireElement('[data-player-rows]');
    body.replaceChildren(...result.items.map(playerRow));
    if (result.items.length === 0 && playerOffset === 0) {
      body.append(emptyRow(6, 'No players found'));
    } else if (result.items.length === 0 && playerOffset > 0) {
      playerOffset = Math.max(0, playerOffset - Number(result.limit));
      return void loadPlayers(false);
    }
    renderPagination('[data-player-pagination]', {
      offset: playerOffset,
      limit: Number(result.limit),
      total: Number(result.total),
      onPrev: () => {
        playerOffset = Math.max(0, playerOffset - Number(result.limit));
        void loadPlayers(false);
      },
      onNext: () => {
        playerOffset += Number(result.limit);
        void loadPlayers(false);
      },
    });
  });
}

function renderPagination(
  rootSelector: string,
  config: {
    offset: number;
    limit: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  },
): void {
  const container = requireElement(rootSelector);
  const page = Math.floor(config.offset / config.limit) + 1;
  const pages = Math.max(1, Math.ceil(config.total / config.limit));
  const nav = document.createElement('div');
  nav.className = 'admin-pagination';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'admin-button admin-button--secondary';
  prev.textContent = 'Previous';
  prev.disabled = config.offset <= 0;
  prev.addEventListener('click', config.onPrev);

  const label = document.createElement('span');
  label.textContent = `Page ${page} of ${pages} · ${config.total} total`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'admin-button admin-button--secondary';
  next.textContent = 'Next';
  next.disabled = config.offset + config.limit >= Math.max(1, config.total);
  next.addEventListener('click', config.onNext);

  container.replaceChildren(prev, label, next);
}

async function loadTournaments(): Promise<void> {
  await guarded(async () => {
    const result = await client.getTournaments();
    tournaments = result.items;
    const root = requireElement('[data-tournament-list]');
    root.replaceChildren(...tournaments.map(tournamentButton));
    if (tournaments.length === 0) root.append(textBlock('No tournaments configured.'));
  });
}

function matchRow(match: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.append(
    tableCell(match.id, formatDateTime(match.createdAt)),
    tableCell(match.category, match.eventId || 'Direct queue'),
    statusCell(match.status),
    tableCell(
      match.players.map((player: any) => `P${Number(player.playerSlot) + 1}: ${player.displayName}`).join('\n') || 'Waiting',
      match.players.map((player: any) => player.score == null ? '' : `Score ${formatNumber(player.score)}`).filter(Boolean).join(' · '),
    ),
    statusCell(match.broadcasterStatus || 'not started'),
    tableCell(formatDateTime(match.createdAt), `Stage ${match.currentStage}`),
    replayCell(match),
  );
  return row;
}

function replayRow(replay: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.append(
    tableCell(replay.id),
    tableCell(replay.guestId),
    statusCell(replay.gameResult),
    tableCell(formatNumber(replay.score), `${formatNumber(replay.kills)} kills`),
    tableCell(String(replay.levelNumber)),
    tableCell(`${formatNumber(replay.durationTicks)} ticks`),
    tableCell(formatDateTime(replay.createdAt)),
    singlePlayerReplayCell(replay),
  );
  return row;
}

function singlePlayerReplayCell(replay: any): HTMLTableCellElement {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-button admin-button--replay';
  button.textContent = 'Replay';
  button.title = 'Open this saved single-player recording';
  button.addEventListener('click', () => void guarded(() => openSinglePlayerReplay(replay, button)));
  cell.append(button);
  return cell;
}

async function openSinglePlayerReplay(summary: any, button: HTMLButtonElement): Promise<void> {
  // Open synchronously so browser popup protection cannot block the replay.
  const viewer = window.open('about:blank', '_blank');
  if (viewer === null) {
    message('Allow popups to open this replay.', true);
    return;
  }

  button.disabled = true;
  try {
    const result = await client.getReplay(summary.id);
    if (result?.item?.replay === undefined || typeof result.item.replay !== 'object') {
      throw new Error('This recording has no playable replay data.');
    }
    viewer.location.replace(`/?adminReplay=${encodeURIComponent(summary.id)}`);
  } catch (error) {
    viewer.close();
    throw error;
  } finally {
    button.disabled = false;
  }
}

function replayCell(match: any): HTMLTableCellElement {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  if (match.status === 'waiting') {
    button.className = 'admin-button admin-button--replay admin-button--disabled';
    button.disabled = true;
    button.textContent = 'Waiting';
    button.title = 'Match has not started yet';
  } else if (['ready', 'live', 'transition'].includes(match.status)) {
    button.className = 'admin-button admin-button--replay admin-button--watch';
    button.textContent =
      match.status === 'live' || match.status === 'transition'
        ? 'Watch live'
        : 'Watch';
    button.title = 'Open the observer to watch this live match';
    button.addEventListener('click', () => void openMatchObserver(match));
  } else {
    button.className = 'admin-button admin-button--replay';
    button.textContent = 'Replay';
    button.title = 'Replay the completed match';
    button.addEventListener('click', () => void openMatchObserver(match));
  }
  cell.append(button);
  return cell;
}

function playerRow(player: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  const profile = document.createElement('a');
  profile.href = `/player-profile/${encodeURIComponent(player.id)}`;
  profile.textContent = player.displayName;
  const identity = document.createElement('td');
  identity.append(profile, subtext(player.email || player.id));
  row.append(
    identity,
    tableCell(player.provider),
    tableCell(`${formatNumber(player.tokenBalance)} BACT`, `${formatNumber(player.fuelBalance)} fuel · ${Number(player.solBalance).toLocaleString()} SOL`),
    tableCell(formatNumber(player.matchesPlayed), `${formatNumber(player.matchesCompleted)} completed`),
    tableCell(formatNumber(player.bestMultiplayerScore)),
    tableCell(formatDateTime(player.lastSeenAt)),
  );
  return row;
}

function tournamentButton(tournament: any): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'admin-tournament';
  button.type = 'button';
  const name = document.createElement('strong');
  name.textContent = tournament.name;
  const meta = document.createElement('span');
  meta.textContent = `${tournament.effectiveStatus.toUpperCase()} · ${formatDateTime(tournament.startsAt)} · ${formatNumber(tournament.prizePool)} ${currencyLabel(tournament.prizeCurrency)}`;
  button.append(name, meta);
  button.addEventListener('click', () => void selectTournament(tournament));
  return button;
}

async function selectTournament(tournament: any): Promise<void> {
  openTournamentForm(tournament);
  await guarded(async () => {
    const result = await client.getTournamentLeaderboard(tournament.id);
    payoutTournament = result.tournament;
    renderPayout(result.tournament, result.rows, result.distributions);
  });
}

function openTournamentForm(tournament: any = null): void {
  const form = requireElement<HTMLFormElement>('[data-tournament-form]');
  form.hidden = false;
  setText('[data-tournament-form-title]', tournament === null ? 'Create tournament' : 'Edit tournament');
  setValue('[data-tournament-id]', tournament?.id || '');
  setValue('[data-tournament-name]', tournament?.name || '');
  setValue('[data-tournament-slug]', tournament?.slug || '');
  setValue('[data-tournament-description]', tournament?.description || '');
  setValue('[data-tournament-start]', toLocalDateValue(tournament?.startsAt || new Date(Date.now() + 3600000).toISOString()));
  setValue('[data-tournament-end]', toLocalDateValue(tournament?.endsAt || new Date(Date.now() + 86400000).toISOString()));
  setValue('[data-tournament-status]', tournament?.status || 'draft');
  setValue('[data-tournament-level]', String(tournament?.levelNumber || 1));
  setValue('[data-tournament-fuel]', String(tournament?.entryFuelCost ?? 1));
  setValue('[data-tournament-currency]', tournament?.prizeCurrency || 'token');
  setValue('[data-tournament-pool]', String(tournament?.prizePool || 0));
  if (tournament === null) {
    payoutTournament = null;
    hide('[data-tournament-payout]');
  }
}

function closeTournamentForm(): void {
  hide('[data-tournament-form]');
}

function fillSlugForNewTournament(): void {
  if (requireElement<HTMLInputElement>('[data-tournament-id]').value !== '') return;
  const name = requireElement<HTMLInputElement>('[data-tournament-name]').value;
  setValue('[data-tournament-slug]', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
}

async function saveTournament(event: Event): Promise<void> {
  event.preventDefault();
  const id = value('[data-tournament-id]') || null;
  const payload = {
    name: value('[data-tournament-name]'),
    slug: value('[data-tournament-slug]'),
    description: value('[data-tournament-description]'),
    startsAt: new Date(value('[data-tournament-start]')).toISOString(),
    endsAt: new Date(value('[data-tournament-end]')).toISOString(),
    status: value('[data-tournament-status]'),
    levelNumber: Number(value('[data-tournament-level]')),
    entryFuelCost: Number(value('[data-tournament-fuel]')),
    prizeCurrency: value('[data-tournament-currency]'),
    prizePool: Number(value('[data-tournament-pool]')),
  };
  await guarded(async () => {
    const result = await client.saveTournament(payload, id);
    message(id === null ? 'Tournament created.' : 'Tournament updated.');
    await loadTournaments();
    await selectTournament(result.tournament);
  });
}

function renderPayout(tournament: any, rows: any[], distributions: any[]): void {
  show('[data-tournament-payout]');
  setText('[data-payout-title]', `${tournament.name} leaderboard`);
  setText('[data-payout-budget]', `Pool: ${formatNumber(tournament.prizePool)} ${currencyLabel(tournament.prizeCurrency)}`);
  const body = requireElement('[data-payout-rows]');
  const paid = new Map(distributions.map((entry: any) => [entry.playerId, entry.amount]));
  body.replaceChildren(...rows.map((row) => payoutRow(row, Number(paid.get(row.playerId) || 0), distributions.length > 0)));
  if (rows.length === 0) body.append(emptyRow(4, 'No accepted tournament scores yet'));
  const submit = requireElement<HTMLButtonElement>('[data-payout-submit]');
  submit.disabled = tournament.effectiveStatus !== 'ended' || rows.length === 0 || distributions.length > 0;
  submit.textContent = distributions.length > 0 ? 'Prizes distributed' : 'Distribute prizes';
  updatePayoutTotal();
}

function payoutRow(row: any, amount: number, disabled: boolean): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.value = String(amount);
  input.disabled = disabled;
  input.className = 'admin-prize-input';
  input.dataset.prizePlayer = row.playerId;
  input.dataset.prizeRank = String(row.rank);
  input.addEventListener('input', updatePayoutTotal);
  const amountCell = document.createElement('td');
  amountCell.append(input);
  tr.append(tableCell(`#${row.rank}`), tableCell(row.displayName, row.playerId), tableCell(formatNumber(row.score), `${row.matchesPlayed} matches`), amountCell);
  return tr;
}

function updatePayoutTotal(): void {
  const total = Array.from(document.querySelectorAll<HTMLInputElement>('[data-prize-player]'))
    .reduce((sum, input) => sum + Math.max(0, Number(input.value) || 0), 0);
  const currency = payoutTournament === null ? '' : ` ${currencyLabel(payoutTournament.prizeCurrency)}`;
  setText('[data-payout-total]', `Allocated: ${formatNumber(total)}${currency}`);
}

async function distributePrizes(): Promise<void> {
  if (payoutTournament === null) return;
  const allocations = Array.from(document.querySelectorAll<HTMLInputElement>('[data-prize-player]'))
    .map((input) => ({ playerId: input.dataset.prizePlayer, rank: Number(input.dataset.prizeRank), amount: Number(input.value) }))
    .filter((entry) => Number.isSafeInteger(entry.amount) && entry.amount > 0);
  const total = allocations.reduce((sum, entry) => sum + entry.amount, 0);
  if (allocations.length === 0) {
    message('Enter at least one prize allocation.', true);
    return;
  }
  if (total > payoutTournament.prizePool) {
    message('Prize allocations exceed the configured pool.', true);
    return;
  }
  if (!window.confirm(`Distribute ${formatNumber(total)} ${currencyLabel(payoutTournament.prizeCurrency)} to ${allocations.length} players? This cannot be undone.`)) return;
  await guarded(async () => {
    const result = await client.distributePrizes(payoutTournament.id, allocations);
    message(result.alreadyDistributed ? 'Prizes were already distributed; no duplicate payment was made.' : 'Tournament prizes distributed successfully.');
    await selectTournament(result.tournament);
    await loadOverview();
  });
}

async function logout(): Promise<void> {
  await client.logout();
  window.location.assign('/admin/');
}

async function guarded(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error('[admin] operation failed', error);
    message(error instanceof Error ? error.message : 'Admin operation failed', true);
  }
}

function metric(
  label: string,
  value: number,
  route: { tab: string; statusFilter?: string } | null = null,
): HTMLElement {
  const item = document.createElement('article');
  item.className = route === null ? 'admin-metric' : 'admin-metric admin-metric--link';
  const caption = document.createElement('span');
  caption.textContent = label;
  const number = document.createElement('strong');
  number.textContent = formatNumber(value);
  item.append(caption, number);
  if (route !== null) {
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.title = `Open the ${route.tab} list`;
    const navigate = (): void => {
      if (route.statusFilter !== undefined) {
        applyMatchFilter(route.statusFilter);
      }
      void selectTab(route.tab);
    };
    item.addEventListener('click', navigate);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate();
      }
    });
  }
  return item;
}

function tableCell(primary: string, secondary = ''): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.append(document.createTextNode(primary));
  if (secondary !== '') cell.append(subtext(secondary));
  return cell;
}

function statusCell(value: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `admin-status admin-status--${value.replace(/[^a-z]/g, '')}`;
  badge.textContent = value;
  cell.append(badge);
  return cell;
}

function subtext(value: string): HTMLElement {
  const text = document.createElement('span');
  text.className = 'admin-subtext';
  text.textContent = value;
  return text;
}

function emptyRow(columns: number, text: string): HTMLTableRowElement {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columns;
  cell.className = 'admin-empty';
  cell.textContent = text;
  row.append(cell);
  return row;
}

function textBlock(text: string): HTMLElement {
  const item = document.createElement('p');
  item.className = 'admin-empty';
  item.textContent = text;
  return item;
}

function message(text: string, isError = false): void {
  const element = requireElement('[data-admin-message]');
  element.textContent = text;
  element.classList.toggle('is-error', isError);
  element.removeAttribute('hidden');
  window.setTimeout(() => element.setAttribute('hidden', ''), 5000);
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDateTime(value: string | null): string {
  if (value === null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toLocalDateValue(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function currencyLabel(currency: string): string {
  return currency === 'fuel' ? 'FUEL' : 'BACT';
}

function value(selector: string): string {
  return requireElement<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector).value;
}

function setValue(selector: string, valueToSet: string): void {
  requireElement<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector).value = valueToSet;
}

function setText(selector: string, valueToSet: string): void {
  requireElement(selector).textContent = valueToSet;
}

function show(selector: string): void {
  requireElement(selector).removeAttribute('hidden');
}

function hide(selector: string): void {
  requireElement(selector).setAttribute('hidden', '');
}

function requireElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing admin element: ${selector}`);
  return element;
}
