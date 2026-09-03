import { SceneNavigator } from '../core';
import { InputManager, MenuInputContext } from '../input';
import { apiFetch } from '../network/api';
import { GameSceneType } from '../scenes';
import {
  StakingClient,
  StakingLeaderboardRow,
  StakingSummary,
} from '../staking';
import { BoostStatus, TokenCatalogItem, TradingClient } from '../trading';
import {
  EventBoard,
  EventClient,
  EventLeaderboardRow,
  EventSummary,
  PhaseSummary,
} from '../events';
import {
  AirdropCampaign,
  AirdropClient,
  AirdropEligibility,
  DiscordVerification,
} from '../airdrops';
import { WIKI_CATEGORIES, WIKI_ENTRIES, WikiCategory } from '../wiki';
import { moveFocus } from './HeadquartersWebUi';
import { animateBackNavigation } from './navigationAnimation';

interface LedgerEntry {
  currency: string;
  amount: number;
  reason: string;
  createdAt: string;
}
interface TreasuryAccount {
  tokenBalance: number;
  solBalance: number;
  fuelBalance: number;
  inventory: Record<string, number>;
}
type PageScene =
  | GameSceneType.MainTreasury
  | GameSceneType.MainEvents
  | GameSceneType.MainStaking
  | GameSceneType.MainTrading
  | GameSceneType.MainBoost
  | GameSceneType.MainAirdrop
  | GameSceneType.MainWiki;
type TreasuryView = 'holdings' | 'history';
type StakingView = 'stats' | 'leaderboard';
type EventView = 'campaigns' | 'detail' | 'leaderboard';

const STAKE_STEP = 500;
const ITEM_ICONS: Record<string, string> = {
  shield: '/data/graphics/shop/owned/helmet.png',
  'base-defence': '/data/graphics/shop/owned/shovel.png',
  freeze: '/data/graphics/shop/owned/clock.png',
  speed: '/data/graphics/shop/owned/speed.png',
  upgrade: '/data/graphics/shop/owned/star.png',
  'zoom-out': '/data/graphics/shop/owned/zoomout.png',
  wipeout: '/data/graphics/shop/owned/grenade.png',
  'extra-life': '/data/graphics/shop/owned/life.png',
};
const WIKI_ART: Partial<Record<WikiCategory, Record<string, string>>> = {
  tanks: {
    vanguard: '/data/graphics/TANKS/player-tank-primary-star1.png',
    'vanguard-mk2': '/data/graphics/TANKS/player-tank-primary-star2.png',
    'vanguard-mk3': '/data/graphics/TANKS/player-tank-primary-star3.png',
    siegebreaker: '/data/graphics/TANKS/player-tank-primary-star4.png',
  },
  enemies: {
    scout: '/data/graphics/TANKS/enemy-basic.png',
    rapid: '/data/graphics/TANKS/enemy-fast.png',
    armored: '/data/graphics/TANKS/enemy-armor-default.png',
    heavy: '/data/graphics/TANKS/enemy-danger.png',
  },
  powerups: {
    shield: ITEM_ICONS.shield,
    'base-defence': ITEM_ICONS['base-defence'],
    freeze: ITEM_ICONS.freeze,
    speed: ITEM_ICONS.speed,
    upgrade: ITEM_ICONS.upgrade,
    'zoom-out': ITEM_ICONS['zoom-out'],
    wipeout: ITEM_ICONS.wipeout,
    'extra-life': ITEM_ICONS['extra-life'],
  },
  weapons: {
    cannon: '/data/graphics/shop/owned/gun.png',
    'twin-shot': '/data/graphics/shop/owned/gun.png',
    'ap-rounds': '/data/graphics/shop/owned/gun.png',
    'hull-plating': '/data/graphics/shop/owned/helmet.png',
  },
};

function createDevSignature(): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return Array.from(
    { length: 44 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

export class HeadquartersPagesWebUi {
  private readonly stakingClient = new StakingClient();
  private readonly tradingClient = new TradingClient();
  private readonly eventClient = new EventClient();
  private readonly airdropClient = new AirdropClient();
  private abortController: AbortController = null;
  private active = false;
  private buttons: HTMLButtonElement[] = [];
  private host: HTMLElement = null;
  private sceneType: PageScene = null;
  private loading = false;
  private error = '';
  private status = '';
  private requestId = 0;
  private lastFocus = '';
  private treasuryView: TreasuryView = 'holdings';
  private treasury: TreasuryAccount = null;
  private ledger: LedgerEntry[] = [];
  private staking: StakingSummary = null;
  private stakingRows: StakingLeaderboardRow[] = [];
  private stakingView: StakingView = 'stats';
  private tokens: TokenCatalogItem[] = [];
  private boosts: BoostStatus = null;
  private events: EventSummary[] = [];
  private phases: PhaseSummary[] = [];
  private eventView: EventView = 'campaigns';
  private eventDetail: EventBoard = null;
  private eventRank: { rank: number; amount: number } = null;
  private eventRows: EventLeaderboardRow[] = [];
  private campaigns: AirdropCampaign[] = [];
  private eligibility: AirdropEligibility = null;
  private discord: DiscordVerification = null;
  private wikiCategory: WikiCategory = 'tanks';

  public constructor(
    private readonly navigator: SceneNavigator,
    private readonly input: InputManager,
  ) {}
  public isActive(): boolean {
    return this.active;
  }

  public mount(sceneType: GameSceneType): void {
    if (this.active) return;
    const host = document.querySelector('[data-web-ui]');
    if (!(host instanceof HTMLElement))
      throw new Error('Headquarters page web UI host is missing.');
    this.active = true;
    this.sceneType = sceneType as PageScene;
    this.host = host;
    this.abortController = new AbortController();
    this.error = '';
    this.status = '';
    document.body.classList.add(
      'web-ui-active',
      'headquarters-page-web-active',
    );
    host.hidden = false;
    void this.load();
  }

  public unmount(): void {
    if (!this.active) return;
    this.active = false;
    this.requestId += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.buttons = [];
    this.host?.replaceChildren();
    if (this.host) this.host.hidden = true;
    this.host = null;
    this.sceneType = null;
    document.body.classList.remove(
      'web-ui-active',
      'headquarters-page-web-active',
    );
  }

  public update(): void {
    if (!this.active) return;
    const method = this.input.getActiveMethod();
    if (method.isDownAny(MenuInputContext.HorizontalPrev)) this.move(-1, 0);
    else if (method.isDownAny(MenuInputContext.HorizontalNext)) this.move(1, 0);
    else if (method.isDownAny(MenuInputContext.VerticalPrev)) this.move(0, -1);
    else if (method.isDownAny(MenuInputContext.VerticalNext)) this.move(0, 1);
    else if (method.isDownAny(MenuInputContext.Select)) this.focused()?.click();
  }

  private async load(): Promise<void> {
    const requestId = ++this.requestId;
    this.loading = true;
    this.error = '';
    this.render();
    try {
      if (this.sceneType === GameSceneType.MainTreasury) {
        const [treasury, ledger] = await Promise.all([
          this.fetchTreasury(),
          this.fetchLedger(),
        ]);
        if (requestId !== this.requestId) return;
        this.treasury = treasury;
        this.ledger = ledger;
      } else if (this.sceneType === GameSceneType.MainEvents) {
        [this.events, this.phases] = await Promise.all([
          this.eventClient.listEvents(),
          this.eventClient.listPhases(),
        ]);
      } else if (this.sceneType === GameSceneType.MainStaking) {
        [this.staking, this.stakingRows] = await Promise.all([
          this.stakingClient.getSummary(),
          this.stakingClient.getLeaderboard(),
        ]);
      } else if (this.sceneType === GameSceneType.MainTrading) {
        this.tokens = (await this.tradingClient.listTokens()).filter(
          (token) => token.group !== 'stable',
        );
      } else if (this.sceneType === GameSceneType.MainBoost) {
        this.boosts = await this.tradingClient.getBoostStatus();
      } else if (this.sceneType === GameSceneType.MainAirdrop) {
        const [campaigns, discord] = await Promise.all([
          this.airdropClient.listCampaigns(),
          this.airdropClient.getDiscordVerification(),
        ]);
        this.campaigns = campaigns;
        this.discord = discord;
        this.eligibility = campaigns[0]
          ? await this.airdropClient.getEligibility(campaigns[0].slug)
          : null;
      }
      if (requestId !== this.requestId) return;
    } catch {
      if (requestId !== this.requestId) return;
      this.error = 'THE COMMAND NETWORK DID NOT RESPOND';
    }
    this.loading = false;
    this.render();
  }

  private render(): void {
    if (!this.host) return;
    const content = this.loading
      ? this.loadingMarkup()
      : this.error
      ? this.errorMarkup()
      : this.renderPage();
    this.host.innerHTML = `<main class="hq-page-web" data-ui-page>${this.renderTabs()}<section class="hq-page-web__shell"><div class="hq-page-web__content">${content}</div><p class="hq-page-web__status" role="status" aria-live="polite">${this.escape(
      this.status,
    )}</p></section></main>`;
    this.bind();
  }

  private renderTabs(): string {
    let tabs: Array<[string, string, boolean]> = [];
    if (this.sceneType === GameSceneType.MainTreasury)
      tabs = [
        ['treasury-holdings', 'HOLDINGS', this.treasuryView === 'holdings'],
        ['treasury-history', 'HISTORY', this.treasuryView === 'history'],
      ];
    else if (this.sceneType === GameSceneType.MainStaking)
      tabs = [
        ['staking-stats', 'YOUR STATS', this.stakingView === 'stats'],
        [
          'staking-leaderboard',
          'LEADERBOARD',
          this.stakingView === 'leaderboard',
        ],
      ];
    else if (this.sceneType === GameSceneType.MainEvents)
      tabs = [
        ['events-campaigns', 'CAMPAIGNS', this.eventView === 'campaigns'],
        ['events-detail', 'EVENT', this.eventView === 'detail'],
        ['events-leaderboard', 'LEADERBOARD', this.eventView === 'leaderboard'],
      ];
    else if (this.sceneType === GameSceneType.MainWiki)
      tabs = WIKI_CATEGORIES.map((item) => [
        `wiki-${item.id}`,
        item.label,
        this.wikiCategory === item.id,
      ]);
    else tabs = [['page-title', this.title(), true]];
    return `<nav class="shop-web__tabs hq-page-web__tabs" data-ui-nav style="--ui-tab-count:${
      tabs.length
    }" aria-label="${this.escape(
      this.title(),
    )} views">${tabs
      .map(([key, label, active]) =>
        key === 'page-title'
          ? `<span data-ui-tab class="shop-web__tab is-active" aria-current="page">${this.escape(
              label,
            )}</span>`
          : `<button data-ui-tab class="shop-web__tab ${
              active ? 'is-active' : ''
            }" data-page-tab="${key}" aria-current="${
              active ? 'page' : 'false'
            }" type="button" ${
              this.sceneType === GameSceneType.MainEvents &&
              key !== 'events-campaigns' &&
              !this.eventDetail
                ? 'disabled'
                : ''
            }>${this.escape(label)}</button>`,
      )
      .join(
        '',
      )}<span class="hq-page-web__tab-spacer" data-ui-spacer aria-hidden="true"></span><button class="shop-web__back" data-ui-back data-page-back type="button">◀ BACK</button></nav>`;
  }

  private renderPage(): string {
    if (this.sceneType === GameSceneType.MainTreasury)
      return this.renderTreasury();
    if (this.sceneType === GameSceneType.MainEvents) return this.renderEvents();
    if (this.sceneType === GameSceneType.MainStaking)
      return this.renderStaking();
    if (this.sceneType === GameSceneType.MainTrading)
      return this.renderTrading();
    if (this.sceneType === GameSceneType.MainBoost) return this.renderBoosts();
    if (this.sceneType === GameSceneType.MainAirdrop)
      return this.renderAirdrop();
    return this.renderWiki();
  }

  private renderTreasury(): string {
    if (!this.treasury)
      return this.emptyMarkup(
        'LOGIN TO VIEW YOUR TREASURY',
        'Connect your account from the main menu, then retry.',
      );
    const stats = [
      [
        'BACT',
        this.treasury.tokenBalance,
        '/data/graphics/shop/icons/token-bact.png',
      ],
      ['SOL', this.treasury.solBalance, '/data/graphics/shop/icons/solana.png'],
      ['FUEL', this.treasury.fuelBalance, '/data/graphics/shop/icons/fuel.png'],
      [
        'ITEMS',
        Object.values(this.treasury.inventory || {}).reduce(
          (sum, value) => sum + value,
          0,
        ),
        '/data/graphics/shop/icons/kit.png',
      ],
    ];
    const summary = `<section class="hq-page-web__stats">${stats
      .map(([label, value, icon]) =>
        this.stat(String(label), String(value), String(icon)),
      )
      .join('')}</section>`;
    if (this.treasuryView === 'history') {
      return `${this.heading(
        'TREASURY',
        'BALANCES, ITEMS AND TRANSACTION HISTORY',
      )}${summary}${this.table(
        ['CURRENCY', 'AMOUNT', 'REASON', 'DATE'],
        this.ledger.map((entry) => [
          entry.currency,
          this.signed(entry.amount),
          entry.reason,
          entry.createdAt.slice(0, 10),
        ]),
        'NO TRANSACTIONS YET',
      )}`;
    }
    const owned = Object.entries(this.treasury.inventory || {}).filter(
      ([, count]) => count > 0,
    );
    return `${this.heading(
      'TREASURY',
      'BALANCES, ITEMS AND TRANSACTION HISTORY',
    )}${summary}<h2 class="hq-page-web__section-title">OWNED ITEMS</h2>${
      owned.length
        ? `<section class="hq-page-web__item-grid">${owned
            .map(
              ([id, count]) =>
                `<article class="hq-page-web__item"><img src="${ITEM_ICONS[
                  id
                ] ||
                  '/data/graphics/shop/icons/kit.png'}" alt=""><h3>${this.escape(
                  id.replace(/-/g, ' '),
                )}</h3><strong>${count}</strong></article>`,
            )
            .join('')}</section>`
        : this.emptyMarkup(
            'NO ITEMS OWNED',
            'Visit the Shop to equip your treasury.',
          )
    }`;
  }

  private renderEvents(): string {
    if (this.eventView === 'detail' && this.eventDetail) {
      const detail = this.eventDetail;
      return `${this.heading(
        detail.name,
        detail.description,
      )}<section class="hq-page-web__stats">${this.stat(
        'YOUR RANK',
        this.eventRank ? `#${this.eventRank.rank}` : 'UNRANKED',
      )}${this.stat(
        detail.currency.toUpperCase(),
        detail.currencyBalance,
      )}${this.stat(
        'PRIZE POOL',
        detail.prizePool,
      )}</section><h2 class="hq-page-web__section-title">QUESTS</h2><section class="hq-page-web__card-grid">${detail.quests
        .map(
          (quest) =>
            `<article class="hq-page-web__card ${
              quest.completed ? 'is-complete' : ''
            }"><h3>${this.escape(quest.name)}</h3><p>${this.escape(
              quest.description,
            )}</p><b>${quest.value}/${
              quest.target
            }</b><button data-quest="${this.escape(quest.id)}" type="button" ${
              !quest.completed || quest.claimedAt ? 'disabled' : ''
            }>${
              quest.claimedAt
                ? 'CLAIMED'
                : quest.completed
                ? 'CLAIM REWARD'
                : 'NOT READY'
            }</button></article>`,
        )
        .join('')}</section>`;
    }
    if (this.eventView === 'leaderboard')
      return `${this.heading(
        'EVENT LEADERBOARD',
        this.eventDetail?.name || 'CAMPAIGN RESULTS',
      )}${this.table(
        ['RANK', 'COMMANDER', 'SCORE'],
        this.eventRows.map((row) => [row.rank, row.displayName, row.amount]),
        'NO SCORES YET',
      )}`;
    return `${this.heading(
      'CAMPAIGNS',
      'EVENTS, OPERATIONS AND REWARDS',
    )}<h2 class="hq-page-web__section-title">PHASE REWARDS</h2>${
      this.phases.length
        ? `<section class="hq-page-web__stats">${this.phases
            .slice(0, 3)
            .map((phase) =>
              this.stat(phase.name, phase.rewardPool, '', phase.status),
            )
            .join('')}</section>`
        : this.emptyMarkup(
            'NO PHASES AVAILABLE',
            'Check again when the next operation begins.',
          )
    }<h2 class="hq-page-web__section-title">OPERATIONS</h2>${
      this.events.length
        ? `<section class="hq-page-web__card-grid">${this.events
            .map(
              (event) =>
                `<article class="hq-page-web__card"><span class="hq-page-web__badge">${
                  event.status
                }</span><h3>${this.escape(event.name)}</h3><p>${this.escape(
                  event.description,
                )}</p><b>${this.escape(
                  event.prizePool,
                )}</b><button data-event="${this.escape(
                  event.slug,
                )}" type="button">OPEN</button></article>`,
            )
            .join('')}</section>`
        : this.emptyMarkup(
            'NO CAMPAIGNS AVAILABLE',
            'Use Refresh to check the command network.',
            true,
          )
    }`;
  }

  private renderStaking(): string {
    if (!this.staking)
      return this.emptyMarkup(
        'LOGIN TO ACCESS STAKING',
        'Sign in before locking or claiming BACT.',
      );
    if (this.stakingView === 'leaderboard')
      return `${this.heading('STAKING', 'SP LEADERBOARD')}${this.table(
        ['RANK', 'COMMANDER', 'STAKE', 'TOTAL SP'],
        this.stakingRows.map((row) => [
          row.rank,
          row.displayName,
          row.staked,
          row.totalSp,
        ]),
        'NO STAKERS YET',
      )}`;
    const { epoch, community, me, unstakes } = this.staking;
    return `${this.heading(
      'STAKING',
      `EPOCH ${epoch.number} · DAY ${epoch.day}/${epoch.lengthDays}`,
    )}<section class="hq-page-web__stats">${this.stat(
      'YOUR STAKE',
      me.staked,
    )}${this.stat('LATEST SP', me.latestSp)}${this.stat(
      'TOTAL SP',
      me.totalSp,
    )}${this.stat(
      'EST. REWARD',
      me.estimatedReward,
    )}</section><section class="hq-page-web__action-row"><button data-stake-action="unstake" type="button">UNSTAKE ${STAKE_STEP}</button><button data-stake-action="stake" type="button">STAKE ${STAKE_STEP}</button></section><h2 class="hq-page-web__section-title">COMMUNITY</h2><section class="hq-page-web__stats">${this.stat(
      'LOCKED TOKENS',
      community.lockedTokens,
    )}${this.stat('REWARD POOL', epoch.rewardPool)}${this.stat(
      'PERK TIER',
      me.perkTier.level,
    )}</section><h2 class="hq-page-web__section-title">UNSTAKE POSITIONS</h2>${this.table(
      ['BACT', 'COOLDOWN', 'STATUS'],
      unstakes.map((item) => [
        item.amount,
        item.claimable ? 'COMPLETE' : item.claimableAt.slice(0, 10),
        item.claimable ? 'READY' : 'LOCKED',
      ]),
      'NO OPEN UNSTAKE POSITIONS',
    )}${
      unstakes.some((item) => item.claimable)
        ? '<div class="hq-page-web__action-row"><button data-stake-action="claim" type="button">CLAIM ALL</button></div>'
        : ''
    }`;
  }

  private renderTrading(): string {
    return `${this.heading(
      'TRADING',
      'RAYDIUM SWAPS AND 30-DAY MARKET BOOSTS',
    )}${
      this.tokens.length
        ? `<section class="hq-page-web__card-grid hq-page-web__card-grid--four">${this.tokens
            .map(
              (token) =>
                `<article class="hq-page-web__card"><span class="hq-page-web__badge">${this.escape(
                  token.group,
                )}</span><h3>${this.escape(token.symbol)}</h3><p>${this.escape(
                  token.name,
                )}<br>BOOSTS ${(
                  token.trait || 'armor'
                ).toUpperCase()}</p><button data-swap="${this.escape(
                  token.mint,
                )}" type="button">SWAP $100</button></article>`,
            )
            .join('')}</section>`
        : this.emptyMarkup(
            'CATALOG UNAVAILABLE',
            'Refresh to reload the Raydium token catalog.',
            true,
          )
    }`;
  }

  private renderBoosts(): string {
    if (
      !this.boosts?.authenticated ||
      !this.boosts.trading ||
      !this.boosts.staking
    )
      return this.emptyMarkup(
        'LOGIN TO VIEW YOUR BOOSTS',
        'Sign in to load trading and staking perks.',
      );
    const trading = this.boosts.trading;
    const staking = this.boosts.staking;
    const traits = Object.entries(trading.boosts);
    return `${this.heading(
      'BOOSTS',
      'ACTIVE TRAIT BOOSTS AND PERKS',
    )}<section class="hq-page-web__stats">${traits
      .map(([label, value]) =>
        this.stat(`${label.toUpperCase()} BOOST`, `+${value}%`),
      )
      .join(
        '',
      )}</section><h2 class="hq-page-web__section-title">30-DAY TRADING VOLUME · $${this.number(
      trading.totalVolumeUsd,
    )}</h2>${this.table(
      ['ASSET', 'TYPE', 'PERK', 'VOLUME'],
      trading.rows.map((row) => [
        row.symbol,
        row.group,
        row.trait === 'all' ? 'ALL STATS' : row.trait,
        `$${this.number(row.volumeUsd)}`,
      ]),
      'NO TRADES IN THE LAST 30 DAYS',
    )}<h2 class="hq-page-web__section-title">STAKING PERKS</h2><section class="hq-page-web__stats">${this.stat(
      'LEVEL',
      staking.tier.level,
    )}${this.stat('STAKED', staking.staked)}${this.stat(
      'NEXT TIER',
      staking.nextTier?.stake ?? 'MAX',
    )}</section>`;
  }

  private renderAirdrop(): string {
    const campaign = this.campaigns[0];
    if (!campaign)
      return this.emptyMarkup(
        'NO ACTIVE AIRDROP',
        'No campaign is available right now.',
        true,
      );
    const quest = (
      label: string,
      detail: string,
      action: string,
      key: string,
    ) =>
      `<article class="hq-page-web__card"><h3>${label}</h3><p>${detail}</p><button data-airdrop-quest="${key}" type="button">${action}</button></article>`;
    const eligibility = this.eligibility;
    const stats = eligibility
      ? eligibility.frozen
        ? [
            ['FROZEN WEIGHT', eligibility.weight],
            ['BACT ALLOCATION', eligibility.allocation || 0],
            ['CLAIM STATUS', eligibility.claimedAt ? 'CLAIMED' : 'READY'],
          ]
        : [
            ['TOTAL WEIGHT', eligibility.weight],
            ['GAME POINTS', eligibility.parts?.gamePoints || 0],
            ['STAKING SP', eligibility.parts?.stakingSp || 0],
            ['TRADING USD', eligibility.parts?.tradingUsd || 0],
          ]
      : [];
    return `${this.heading(
      'AIRDROP',
      `${campaign.name} · ${campaign.status.toUpperCase()}`,
    )}<section class="hq-page-web__card-grid">${quest(
      'X / TWITTER',
      '@BATTLECITIESHQ',
      'OPEN X',
      'x',
    )}${quest(
      'DISCORD',
      this.discord?.verified ? 'DISCORD VERIFIED' : 'AUTHORIZE TO VERIFY',
      this.discord?.verified ? 'VERIFIED' : 'VERIFY DISCORD',
      'discord',
    )}${quest(
      'INSTAGRAM',
      '@BATTLECITIESHQ',
      'OPEN INSTAGRAM',
      'instagram',
    )}</section><h2 class="hq-page-web__section-title">${
      eligibility?.frozen ? 'YOUR ALLOCATION' : 'YOUR AIRDROP WEIGHT'
    }</h2>${
      eligibility
        ? `<section class="hq-page-web__stats">${stats
            .map(([label, value]) => this.stat(String(label), String(value)))
            .join('')}</section>${
            eligibility.frozen &&
            !eligibility.claimedAt &&
            (eligibility.allocation || 0) > 0
              ? `<div class="hq-page-web__action-row"><button data-airdrop-claim="${this.escape(
                  campaign.slug,
                )}" type="button">CLAIM ${this.number(
                  eligibility.allocation || 0,
                )} BACT</button></div>`
              : ''
          }`
        : this.emptyMarkup(
            'SIGN IN TO VIEW ELIGIBILITY',
            'Use your account from the main menu to view allocation.',
          )
    }`;
  }

  private renderWiki(): string {
    const entries = WIKI_ENTRIES[this.wikiCategory];
    return `${this.heading(
      'FIELD MANUAL',
      'TANKS, WEAPONS, POWERUPS AND ENEMY INTELLIGENCE',
    )}<section class="hq-page-web__manual-grid">${entries
      .map((entry) => {
        const art = WIKI_ART[this.wikiCategory]?.[entry.slug];
        return `<article class="hq-page-web__manual-card"><h3>${this.escape(
          entry.name,
        )}</h3>${
          art?.includes('/TANKS/')
            ? `<i class="hq-page-web__tank-art" aria-hidden="true" style="background-image:url('${art}');--sheet-columns:${
                art.includes('enemy-armor-default') ? 8 : 4
              };--sheet-rows:${
                art.includes('enemy-armor-default') ? 1 : 13
              }"></i>`
            : art
            ? `<img src="${art}" alt="">`
            : ''
        }<div><b>${this.escape(entry.role)}</b><p>${this.escape(
          entry.lore,
        )}</p><strong>${this.escape(
          entry.effect,
        )}</strong></div><span>SOURCE: ${this.escape(
          entry.source,
        )}</span></article>`;
      })
      .join('')}</section>`;
  }

  private bind(): void {
    const signal = this.abortController.signal;
    this.buttons = Array.from(
      this.host.querySelectorAll('button:not(:disabled)'),
    );
    this.buttons.forEach((button) => {
      button.addEventListener(
        'pointerdown',
        () => button.focus({ preventScroll: true }),
        { signal },
      );
      button.addEventListener(
        'focus',
        () => {
          const key = this.key(button);
          if (!this.loading || key === this.lastFocus) this.lastFocus = key;
          this.buttons.forEach((candidate) =>
            candidate.classList.toggle('is-selected', candidate === button),
          );
        },
        { signal },
      );
    });
    this.host
      .querySelector('[data-page-back]')
      ?.addEventListener(
        'click',
        () => animateBackNavigation(this.host, this.navigator),
        { signal },
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-page-tab]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => this.selectTab(button.dataset.pageTab || ''),
          { signal },
        ),
      );
    this.host
      .querySelector('[data-page-retry]')
      ?.addEventListener('click', () => void this.load(), { signal });
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-event]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => void this.openEvent(button.dataset.event || ''),
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-quest]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => void this.claimQuest(button.dataset.quest || ''),
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-stake-action]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => void this.stakeAction(button.dataset.stakeAction || ''),
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-swap]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => void this.swap(button.dataset.swap || ''),
          { signal },
        ),
      );
    this.host
      .querySelectorAll<HTMLButtonElement>('[data-airdrop-quest]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => this.airdropQuest(button.dataset.airdropQuest || ''),
          { signal },
        ),
      );
    this.host
      .querySelector<HTMLButtonElement>('[data-airdrop-claim]')
      ?.addEventListener(
        'click',
        (event) =>
          void this.claimAirdrop(
            (event.currentTarget as HTMLButtonElement).dataset.airdropClaim ||
              '',
          ),
        { signal },
      );
    const preferred =
      this.buttons.find((button) => this.key(button) === this.lastFocus) ||
      this.buttons.find(
        (button) =>
          button.dataset.pageTab && button.classList.contains('is-active'),
      ) ||
      this.buttons.find((button) => button.dataset.pageBack === undefined) ||
      this.buttons[0];
    preferred?.focus({ preventScroll: true });
    preferred?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private selectTab(key: string): void {
    if (key === 'page-title') return;
    if (key.startsWith('treasury-'))
      this.treasuryView = key.endsWith('history') ? 'history' : 'holdings';
    else if (key.startsWith('staking-'))
      this.stakingView = key.endsWith('leaderboard') ? 'leaderboard' : 'stats';
    else if (key === 'events-campaigns') this.eventView = 'campaigns';
    else if (key === 'events-detail' && this.eventDetail)
      this.eventView = 'detail';
    else if (key === 'events-leaderboard' && this.eventDetail)
      void this.openEventLeaderboard();
    else if (key.startsWith('wiki-'))
      this.wikiCategory = key.slice(5) as WikiCategory;
    this.lastFocus = `tab:${key}`;
    this.render();
  }

  private async openEvent(slug: string): Promise<void> {
    this.loading = true;
    this.render();
    const detail = await this.eventClient.getEventDetail(slug);
    this.loading = false;
    if (!detail) {
      this.status = 'EVENT UNAVAILABLE';
      this.render();
      return;
    }
    this.eventDetail = detail.item;
    this.eventRank = detail.me;
    this.eventView = 'detail';
    this.lastFocus = 'tab:events-detail';
    this.render();
  }
  private async openEventLeaderboard(): Promise<void> {
    if (!this.eventDetail) return;
    this.loading = true;
    this.render();
    this.eventRows = await this.eventClient.getEventLeaderboard(
      this.eventDetail.slug,
    );
    this.loading = false;
    this.eventView = 'leaderboard';
    this.lastFocus = 'tab:events-leaderboard';
    this.render();
  }
  private async claimQuest(id: string): Promise<void> {
    const result = await this.eventClient.claimQuest(id);
    this.status = result.ok
      ? `CLAIMED ${result.quest?.name || 'REWARD'}`
      : (result.error || 'CLAIM FAILED').toUpperCase();
    if (result.ok && this.eventDetail)
      await this.openEvent(this.eventDetail.slug);
    else this.render();
  }
  private async stakeAction(action: string): Promise<void> {
    const result =
      action === 'stake'
        ? await this.stakingClient.stake(STAKE_STEP)
        : action === 'unstake'
        ? await this.stakingClient.unstake(STAKE_STEP)
        : await this.stakingClient.claimUnstaked();
    this.status = result.ok
      ? action === 'claim'
        ? `CLAIMED ${result.amount || 0} BACT`
        : `${action.toUpperCase()} SUCCESSFUL`
      : (result.error || 'FAILED').toUpperCase();
    if (result.ok) await this.load();
    else this.render();
  }
  private async swap(mint: string): Promise<void> {
    const result = await this.tradingClient.verifySwap({
      signature: createDevSignature(),
      fromMint: 'So11111111111111111111111111111111111111112',
      toMint: mint,
      volumeUsd: 100,
    });
    this.status = result.ok
      ? '$100 SWAP VERIFIED — BOOST UPDATED'
      : (result.error || 'SWAP FAILED').toUpperCase();
    this.render();
  }
  private airdropQuest(key: string): void {
    if (key === 'discord') {
      if (this.discord?.verified) {
        this.status = 'DISCORD ALREADY VERIFIED';
        this.render();
      } else this.airdropClient.startDiscordVerification();
      return;
    }
    const url =
      key === 'x'
        ? 'https://x.com/BattleCitiesHQ'
        : 'https://www.instagram.com/battlecitieshq';
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;
    else window.location.href = url;
  }
  private async claimAirdrop(slug: string): Promise<void> {
    const result = await this.airdropClient.claim(slug);
    this.status = result.ok
      ? `CLAIMED ${result.allocation || 0} BACT`
      : (result.error || 'CLAIM FAILED').toUpperCase();
    if (result.ok) await this.load();
    else this.render();
  }

  private heading(title: string, detail: string): string {
    return `<header class="hq-page-web__heading"><div><span class="operations-web__mark operations-web__mark--sprite operations-web__icon-${this.iconIndex()}" aria-hidden="true"></span><h1>${this.escape(
      title,
    )}</h1></div><p>${this.escape(detail)}</p></header>`;
  }
  private stat(
    label: string,
    value: string | number,
    icon = '',
    badge = '',
  ): string {
    return `<article class="hq-page-web__stat">${
      icon ? `<img src="${icon}" alt="">` : ''
    }<div><span>${this.escape(label)}</span><strong>${this.escape(
      String(value),
    )}</strong>${
      badge ? `<small>${this.escape(badge)}</small>` : ''
    }</div></article>`;
  }
  private table(
    headers: string[],
    rows: Array<Array<string | number>>,
    empty: string,
  ): string {
    return rows.length
      ? `<div class="hq-page-web__table" style="--hq-columns:${
          headers.length
        }"><div class="hq-page-web__table-head">${headers
          .map((header) => `<span>${this.escape(header)}</span>`)
          .join('')}</div>${rows
          .map(
            (row) =>
              `<div class="hq-page-web__table-row">${row
                .map((cell) => `<span>${this.escape(String(cell))}</span>`)
                .join('')}</div>`,
          )
          .join('')}</div>`
      : this.emptyMarkup(empty, 'There is nothing else to do here yet.');
  }
  private loadingMarkup(): string {
    return `${this.heading(
      this.title(),
      'LOADING COMMAND DATA',
    )}<section class="hq-page-web__skeletons" aria-label="Loading"><i></i><i></i><i></i><i></i></section>`;
  }
  private errorMarkup(): string {
    return this.emptyMarkup(
      this.error,
      'Try the request again in a moment.',
      true,
    );
  }
  private emptyMarkup(title: string, detail: string, retry = false): string {
    return `<section class="hq-page-web__empty"><h2>${this.escape(
      title,
    )}</h2><p>${this.escape(detail)}</p>${
      retry ? '<button data-page-retry type="button">REFRESH</button>' : ''
    }</section>`;
  }
  private title(): string {
    return this.sceneType === GameSceneType.MainTreasury
      ? 'TREASURY'
      : this.sceneType === GameSceneType.MainEvents
      ? 'CAMPAIGNS'
      : this.sceneType === GameSceneType.MainStaking
      ? 'STAKING'
      : this.sceneType === GameSceneType.MainTrading
      ? 'TRADING'
      : this.sceneType === GameSceneType.MainBoost
      ? 'BOOSTS'
      : this.sceneType === GameSceneType.MainAirdrop
      ? 'AIRDROP'
      : 'FIELD MANUAL';
  }
  private iconIndex(): number {
    return this.sceneType === GameSceneType.MainTreasury
      ? 4
      : this.sceneType === GameSceneType.MainEvents
      ? 1
      : this.sceneType === GameSceneType.MainStaking
      ? 2
      : this.sceneType === GameSceneType.MainTrading
      ? 7
      : this.sceneType === GameSceneType.MainBoost
      ? 3
      : this.sceneType === GameSceneType.MainAirdrop
      ? 6
      : 5;
  }
  private key(button: HTMLButtonElement): string {
    return button.dataset.pageTab
      ? `tab:${button.dataset.pageTab}`
      : button.dataset.pageBack !== undefined
      ? 'back'
      : button.dataset.event
      ? `event:${button.dataset.event}`
      : button.dataset.quest
      ? `quest:${button.dataset.quest}`
      : button.dataset.stakeAction
      ? `stake:${button.dataset.stakeAction}`
      : button.dataset.swap
      ? `swap:${button.dataset.swap}`
      : button.dataset.airdropQuest
      ? `airdrop:${button.dataset.airdropQuest}`
      : button.dataset.airdropClaim
      ? 'airdrop:claim'
      : button.dataset.pageRetry !== undefined
      ? 'retry'
      : button.textContent || '';
  }
  private focused(): HTMLButtonElement | null {
    return document.activeElement instanceof HTMLButtonElement &&
      this.buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
  }
  private move(x: number, y: number): void {
    const current = this.focused() || this.buttons[0];
    if (current) moveFocus(this.buttons, current, x, y);
  }
  private signed(value: number): string {
    return `${value > 0 ? '+' : ''}${this.number(value)}`;
  }
  private number(value: number): string {
    return Number(value || 0).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }
  private escape(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        }[character]),
    );
  }
  private async fetchTreasury(): Promise<TreasuryAccount> {
    try {
      const response = await apiFetch('/api/economy/account');
      if (!response.ok) return null;
      const body = await response.json();
      return body?.authenticated === true ? body.account : null;
    } catch {
      return null;
    }
  }
  private async fetchLedger(): Promise<LedgerEntry[]> {
    try {
      const response = await apiFetch('/api/economy/ledger');
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body?.entries) ? body.entries : [];
    } catch {
      return [];
    }
  }
}
