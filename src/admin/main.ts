/* eslint-disable @typescript-eslint/no-use-before-define */

import { getPhantomProvider } from '../wallet/PhantomProvider';
import { AdminClient, AdminRequestError } from './AdminClient';

const client = new AdminClient();
let matchOffset = 0;
let playerOffset = 0;
let xOffset = 0;

void initialize();

async function initialize(): Promise<void> {
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

async function loginWallet(): Promise<void> {
  const button = requireElement<HTMLButtonElement>('[data-admin-wallet-login]');
  button.disabled = true;
  try {
    const wallet = getPhantomProvider();
    if (wallet === null) throw new Error('Open this page in a Solana wallet browser or install Phantom.');
    const connected = await wallet.connect();
    const address = connected.publicKey.toString();
    const challenge = await client.getWalletChallenge(address);
    const signed = await wallet.signMessage(new TextEncoder().encode(challenge.message), 'utf8');
    const bytes = signed instanceof Uint8Array ? signed : signed.signature;
    const signature = window.btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
    await client.loginWallet(address, challenge, signature);
    const session = await client.getSession();
    hide('[data-admin-login]');
    hide('[data-admin-forbidden]');
    showApp(session.admin);
    await loadOverview();
  } catch (error) {
    message(error instanceof Error ? error.message : 'Wallet login failed.', true);
  } finally {
    button.disabled = false;
  }
}

function bindEvents(): void {
  requireElement<HTMLButtonElement>('[data-admin-wallet-login]').addEventListener('click', () => void loginWallet());
  document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]').forEach((tab) => {
    tab.addEventListener('click', () => void selectTab(tab.dataset.adminTab || 'overview'));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-admin-refresh]').forEach((button) => {
    button.addEventListener('click', () => void loadSection(button.dataset.adminRefresh || 'overview'));
  });
  requireElement<HTMLSelectElement>('[data-match-status]').addEventListener('change', () => void loadMatches());
  requireElement<HTMLFormElement>('[data-player-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    void loadPlayers();
  });
  requireElement<HTMLFormElement>('[data-notification-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    void sendNotification();
  });
  requireElement<HTMLSelectElement>('[data-notification-audience]').addEventListener('change', renderNotificationAudience);
  requireElement<HTMLSelectElement>('[data-notification-player-id]').addEventListener('change', renderNotificationAudience);
  requireElement<HTMLSelectElement>('[data-notification-route]').addEventListener('change', renderNotificationDestination);
  requireElement<HTMLFormElement>('[data-x-repost-task-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    void saveXRepostTask();
  });
  requireElement<HTMLFormElement>('[data-x-comment-task-form]').addEventListener('submit', (event) => { event.preventDefault(); void saveXCommentTask(); });
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
  requireElement<HTMLButtonElement>('[data-live-users-toggle]').addEventListener('click', () => void toggleLiveUsers());
  document.querySelectorAll<HTMLButtonElement>('[data-admin-logout], [data-admin-forbidden-logout]').forEach((button) => {
    button.addEventListener('click', () => void logout());
  });
}

function showApp(admin: any): void {
  hide('[data-admin-loading]');
  setText('[data-admin-wallet]', admin.walletAddress);
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
  else if (name === 'notifications') await loadNotifications();
  else if (name === 'x') await loadX();
  else await loadOverview();
}

async function loadNotifications(): Promise<void> {
  await guarded(async () => {
    const [result, players] = await Promise.all([
      client.getNotificationStatus(),
      client.getPlayers('', '', '', 0),
    ]);
    const configured = result.configured === true;
    setText('[data-notification-device-count]', formatNumber(Number(result.enabledDevices || 0)));
    setText('[data-notification-config]', configured ? 'Ready' : 'Not configured');
    requireElement('[data-notification-config]').classList.toggle('admin-status--ready', configured);
    populateNotificationPlayers(players.items || []);
    renderNotificationAudience();
    renderNotificationDestination();
  });
}

function renderNotificationDestination(): void {
  const route = requireElement<HTMLSelectElement>('[data-notification-route]').value;
  const externalWrap = requireElement<HTMLElement>('[data-notification-external-wrap]');
  const externalUrl = requireElement<HTMLInputElement>('[data-notification-external-url]');
  const isExternal = route === 'external';
  externalWrap.hidden = !isExternal;
  externalUrl.required = isExternal;
}

function populateNotificationPlayers(players: any[]): void {
  const select = requireElement<HTMLSelectElement>('[data-notification-player-id]');
  const selectedPlayerId = select.value;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a player';
  const options = players.map((player) => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = `${player.displayName} (${player.provider})`;
    return option;
  });
  select.replaceChildren(placeholder, ...options);
  select.value = selectedPlayerId;
}

function renderNotificationAudience(): void {
  const audience = requireElement<HTMLSelectElement>('[data-notification-audience]').value;
  const playerWrap = requireElement<HTMLElement>('[data-notification-player-wrap]');
  const playerSelect = requireElement<HTMLSelectElement>('[data-notification-player-id]');
  const count = requireElement('[data-notification-device-count]').textContent || '0';
  const isPlayer = audience === 'player';
  playerWrap.hidden = !isPlayer;
  setText('[data-notification-summary-title]', isPlayer ? 'One player' : 'All enabled devices');
  setText(
    '[data-notification-summary-copy]',
    isPlayer
      ? (playerSelect.selectedOptions[0]?.textContent === 'Select a player'
        ? 'Select a player before sending.'
        : `The send confirmation will target ${playerSelect.selectedOptions[0]?.textContent || 'the selected player'}.`)
      : `${count} enabled Android device(s) will receive this message.`,
  );
}

async function sendNotification(): Promise<void> {
  const audience = requireElement<HTMLSelectElement>('[data-notification-audience]').value as 'all' | 'player';
  const playerSelect = requireElement<HTMLSelectElement>('[data-notification-player-id]');
  const playerId = playerSelect.value.trim();
  const title = requireElement<HTMLInputElement>('[data-notification-title]').value.trim();
  const notificationMessage = requireElement<HTMLTextAreaElement>('[data-notification-message]').value.trim();
  const type = requireElement<HTMLSelectElement>('[data-notification-type]').value;
  const route = requireElement<HTMLSelectElement>('[data-notification-route]').value;
  const externalUrl = requireElement<HTMLInputElement>('[data-notification-external-url]').value.trim();
  const imageUrl = requireElement<HTMLInputElement>('[data-notification-image-url]').value.trim();
  const actionLabel = requireElement<HTMLInputElement>('[data-notification-action-label]').value.trim();
  const deviceCount = requireElement('[data-notification-device-count]').textContent || '0';
  if (audience === 'player' && playerId === '') {
    message('Enter a player ID before sending.', true);
    return;
  }
  const target = audience === 'player'
    ? (playerSelect.selectedOptions[0]?.textContent || 'the selected player')
    : `${deviceCount} enabled Android device(s)`;
  if (!window.confirm(`Send this notification to ${target}?`)) return;
  await guarded(async () => {
    const result = await client.sendNotification({
      audience, playerId, title, message: notificationMessage, type, route,
      externalUrl, imageUrl, actionLabel,
    });
    message(`Notification sent to ${result.sent} of ${result.devices} device(s).${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
  });
}

async function loadX(): Promise<void> {
  await Promise.all([loadXConnections(), loadXRepostTasks(), loadXCommentTasks()]);
}

async function loadXConnections(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) xOffset = 0;
    const result = await client.getXConnections(xOffset);
    const body = requireElement('[data-x-rows]');
    body.replaceChildren(...result.items.map(xConnectionRow));
    if (result.items.length === 0) body.append(emptyRow(5, 'No X accounts connected.'));
    renderPagination('[data-x-pagination]', {
      offset: xOffset,
      limit: Number(result.limit),
      total: Number(result.total),
      onPrev: () => { xOffset = Math.max(0, xOffset - Number(result.limit)); void loadXConnections(false); },
      onNext: () => { xOffset += Number(result.limit); void loadXConnections(false); },
    });
  });
}

async function loadXRepostTasks(): Promise<void> {
  const status = requireElement<HTMLElement>('[data-x-repost-task-status]');
  const result = await client.getXRepostTasks();
  const active = (result.items || []).find((task: any) => task.active);
  status.textContent = active
    ? `Active: ${active.postUrl} · ${active.rewardFuel} Fuel · ${formatDateTime(active.createdAt)}`
    : 'No active repost task.';
}
async function loadXCommentTasks(): Promise<void> { const status=requireElement<HTMLElement>('[data-x-comment-task-status]'); const result=await client.getXCommentTasks(); const active=(result.items||[]).find((task:any)=>task.active); status.textContent=active?`Active: ${active.postUrl} · ${active.rewardFuel} Fuel · ${formatDateTime(active.createdAt)}`:'No active comment task.'; }
async function saveXCommentTask(): Promise<void> { const input=requireElement<HTMLInputElement>('[data-x-comment-post]'); const button=requireElement<HTMLButtonElement>('[data-x-comment-task-form] button[type="submit"]'); if(!input.value.trim())return; button.disabled=true; try{const result=await client.createXCommentTask(input.value.trim()); input.value=''; message(`Comment task activated for ${result.task.postUrl}.`); await loadXCommentTasks();}catch(error){message(error instanceof Error?error.message:'Could not activate comment task.',true);}finally{button.disabled=false;} }

async function saveXRepostTask(): Promise<void> {
  const input = requireElement<HTMLInputElement>('[data-x-repost-post]');
  const button = requireElement<HTMLButtonElement>('[data-x-repost-task-form] button[type="submit"]');
  const post = input.value.trim();
  if (post === '') return;
  button.disabled = true;
  try {
    const result = await client.createXRepostTask(post);
    input.value = '';
    message(`Repost task activated for ${result.task.postUrl}.`);
    await loadXRepostTasks();
  } catch (error) {
    message(error instanceof Error ? error.message : 'Could not activate repost task.', true);
  } finally {
    button.disabled = false;
  }
}

let replayOffset = 0;

async function loadReplays(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) replayOffset = 0;
    const result = await client.getReplays(replayOffset);
    const body = requireElement('[data-replay-rows]');
    body.replaceChildren(...result.items.map(replayRow));
    if (result.items.length === 0) body.append(emptyRow(8, 'No single-player sessions found'));
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
    const [{ overview }, setting] = await Promise.all([
      client.getOverview(),
      client.getLiveUsersSetting(),
    ]);
    const metrics = [
      ['Registered players', overview.players],
      ['All matches', overview.matches],
      ['Pending reviews', overview.pendingMatches],
      ['Accepted matches', overview.acceptedMatches],
      ['Rejected matches', overview.rejectedMatches],
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
    renderLiveUsersSetting(setting.enabled === true);
  });
}

function renderLiveUsersSetting(enabled: boolean): void {
  setText(
    '[data-live-users-status]',
    enabled
      ? 'Visible on the main site. Counts refresh every 30 seconds.'
      : 'Hidden on the main site. Presence collection remains active.',
  );
  const button = requireElement<HTMLButtonElement>('[data-live-users-toggle]');
  button.textContent = enabled ? 'Turn off' : 'Turn on';
  button.className = enabled
    ? 'admin-button admin-button--danger'
    : 'admin-button admin-button--primary';
  button.dataset.enabled = String(enabled);
}

async function toggleLiveUsers(): Promise<void> {
  const button = requireElement<HTMLButtonElement>('[data-live-users-toggle]');
  const enabled = button.dataset.enabled !== 'true';
  button.disabled = true;
  try {
    const result = await client.setLiveUsersEnabled(enabled);
    renderLiveUsersSetting(result.enabled === true);
    message(result.enabled ? 'Live users counter enabled.' : 'Live users counter hidden.');
  } catch (error) {
    message(error instanceof Error ? error.message : 'Could not update live users.', true);
  } finally {
    button.disabled = false;
  }
}

const METRIC_ROUTES = new Map<string, { tab: string; statusFilter?: string }>([
  ['Registered players', { tab: 'players' }],
  ['All matches', { tab: 'matches', statusFilter: '' }],
  ['Pending reviews', { tab: 'matches', statusFilter: 'pending' }],
  ['Accepted matches', { tab: 'matches', statusFilter: 'accepted' }],
  ['Rejected matches', { tab: 'matches', statusFilter: 'rejected' }],
]);

function applyMatchFilter(statusFilter: string): void {
  requireElement<HTMLSelectElement>('[data-match-status]').value = statusFilter;
}

async function loadMatches(resetPage = true): Promise<void> {
  await guarded(async () => {
    if (resetPage) matchOffset = 0;
    const status = requireElement<HTMLSelectElement>('[data-match-status]').value;
    const result = await client.getMatches(status, matchOffset);
    const body = requireElement('[data-match-rows]');
    body.replaceChildren(...result.items.map(matchRow));
    if (result.items.length === 0 && matchOffset === 0) {
      body.append(emptyRow(9, 'No matches found'));
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
      body.append(emptyRow(8, 'No players found'));
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

function matchRow(match: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  const replay = match.replayId
    ? singlePlayerReplayCell([{ id: match.replayId, levelNumber: match.levelNumber }])
    : tableCell('Unavailable');
  row.append(
    tableCell(match.id, formatDateTime(match.createdAt)),
    tableCell(match.displayName, match.walletAddress || match.playerId),
    tableCell(match.seasonId),
    statusCell(match.won ? 'win' : 'loss'),
    tableCell(formatNumber(match.levelNumber)),
    tableCell(formatNumber(match.score)),
    tableCell(formatNumber(match.gamePoints)),
    statusCell(match.validationStatus), replay,
  );
  return row;
}

function replayRow(replay: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.append(
    tableCell(replay.id, `${formatNumber(replay.stageCount)} stages`),
    playerCell(replay),
    statusCell(replay.gameResult),
    tableCell(formatNumber(replay.score), replay.status === 'active' ? 'Run active' : 'Run complete'),
    tableCell(formatNumber(replay.stageCount), replay.stages.map((stage: any) => `Stage ${stage.levelNumber}`).join(' Â· ')),
    tableCell(`${formatNumber(replay.durationTicks)} ticks`),
    tableCell(formatDateTime(replay.savedAt)),
    singlePlayerReplayCell(replay.stages),
  );
  return row;
}

function playerCell(replay: any): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (replay.playerDisplayName) {
    const link = document.createElement('a');
    link.href = `/player-profile/index.html?playerId=${encodeURIComponent(replay.playerId)}`;
    link.className = 'admin-player-link';
    link.textContent = replay.playerDisplayName;
    cell.append(link, document.createElement('br'));
  }
  const subtext = document.createElement('span');
  subtext.className = 'admin-subtext';
  subtext.textContent = replay.guestId;
  cell.append(subtext);
  return cell;
}

function singlePlayerReplayCell(stages: any[]): HTMLTableCellElement {
  const cell = document.createElement('td');
  stages.forEach((stage) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-button admin-button--replay';
    button.textContent = `Stage ${stage.levelNumber}`;
    button.title = 'Open this saved stage recording';
    button.addEventListener('click', () => void guarded(() => openSinglePlayerReplay(stage, button)));
    cell.append(button);
  });
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

function playerRow(player: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  const profile = document.createElement('a');
  profile.href = `/player-profile/index.html?playerId=${encodeURIComponent(player.id)}`;
  profile.textContent = player.displayName;
  const identity = document.createElement('td');
  identity.append(profile, subtext(player.walletAddress || player.id));
  row.append(
    identity,
    tableCell(player.provider),
    tableCell(`${formatNumber(player.tokenBalance)} BACT`, `${formatNumber(player.fuelBalance)} fuel · ${Number(player.solBalance).toLocaleString()} SOL`),
    tableCell(formatNumber(player.matchesPlayed), `${formatNumber(player.matchesCompleted)} accepted`),
    tableCell(formatNumber(player.bestScore)),
    xConnectionCell(player),
    notificationCell(player),
    tableCell(formatDateTime(player.lastSeenAt)),
  );
  return row;
}

function notificationCell(player: any): HTMLTableCellElement {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-button admin-button--secondary admin-button--replay';
  button.textContent = 'Send test push';
  button.title = 'Send a test push notification to this player’s registered Android devices';
  button.addEventListener('click', () => void sendTestNotification(player, button));
  cell.append(button);
  return cell;
}

async function sendTestNotification(player: any, button: HTMLButtonElement): Promise<void> {
  if (!window.confirm(`Send a test notification to ${player.displayName}?`)) return;
  button.disabled = true;
  try {
    const result = await client.sendTestNotification(player.id);
    message(`Test push sent to ${result.sent} of ${result.devices} registered device(s).`);
  } catch (error) {
    message(error instanceof Error ? error.message : 'Unable to send the test push.', true);
  } finally {
    button.disabled = false;
  }
}

function xConnectionCell(player: any): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (!player.xUsername) {
    cell.append(subtext('Not connected'));
    return cell;
  }

  cell.append(
    document.createTextNode(`@${player.xUsername}`),
    subtext(player.xFollowsBattleCities ? 'Following Battle Cities' : 'Not following'),
  );
  const disconnect = document.createElement('button');
  disconnect.type = 'button';
  disconnect.className = 'admin-button admin-button--danger admin-button--replay';
  disconnect.textContent = 'Disconnect X';
  disconnect.title = 'Remove this player’s X connection without changing rewards';
  disconnect.addEventListener('click', () => void disconnectPlayerX(player, disconnect));
  cell.append(disconnect);
  return cell;
}

function xConnectionRow(player: any): HTMLTableRowElement {
  const row = document.createElement('tr');
  const action = document.createElement('td');
  const disconnect = document.createElement('button');
  disconnect.type = 'button';
  disconnect.className = 'admin-button admin-button--danger admin-button--replay';
  disconnect.textContent = 'Disconnect X';
  disconnect.title = 'Remove this player’s X connection without changing earned rewards';
  disconnect.addEventListener('click', () => void disconnectPlayerX(player, disconnect));
  action.append(disconnect);
  row.append(
    tableCell(player.displayName, player.id),
    tableCell(`@${player.xUsername}`),
    tableCell(player.xFollowsBattleCities ? 'Following Battle Cities' : 'Not following'),
    tableCell(formatDateTime(player.lastSeenAt)),
    action,
  );
  return row;
}

async function disconnectPlayerX(player: any, button: HTMLButtonElement): Promise<void> {
  if (!window.confirm(`Disconnect @${player.xUsername} from ${player.displayName}? The 5 Fuel follow reward remains claimed.`)) {
    return;
  }
  button.disabled = true;
  try {
    const result = await client.disconnectX(player.id);
    message(result.disconnected ? 'X connection removed.' : 'No X connection was found.');
    await Promise.all([loadPlayers(false), loadXConnections(false)]);
  } catch (error) {
    message(error instanceof Error ? error.message : 'Could not disconnect X.', true);
    button.disabled = false;
  }
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
