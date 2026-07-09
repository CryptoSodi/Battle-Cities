import { EventBoard, EventClient, EventLeaderboardRow, EventSummary, PhaseSummary } from '../../events';

import { PanelScene, UI } from './panelUi';

enum View {
  Campaigns,
  Detail,
  Leaderboard,
}

// Campaign hub, shop-styled after the Mattle reference: phase reward cards,
// live/ended campaign cards with OPEN buttons, event detail with a your-rank
// bar, reward tracks, quest cards with per-card CLAIM buttons, and the event
// leaderboard table.
export class MainEventsScene extends PanelScene {
  private eventClient = new EventClient();
  private view = View.Campaigns;
  private events: EventSummary[] = [];
  private phases: PhaseSummary[] = [];
  private detail: EventBoard = null;
  private detailRank: { rank: number; amount: number } = null;
  private leaderboard: EventLeaderboardRow[] = [];
  private isLoading = false;

  protected getTitle(): string {
    return this.view === View.Campaigns ? 'Campaigns' : this.detail?.name ?? 'Campaigns';
  }

  protected load(): void {
    this.isLoading = true;

    Promise.all([this.eventClient.listEvents(), this.eventClient.listPhases()]).then(
      ([events, phases]) => {
        this.events = events;
        this.phases = phases;
        this.isLoading = false;
        this.refresh();
      },
    );
  }

  protected renderContent(): void {
    if (this.isLoading) {
      this.addText('LOADING...', this.pageX + 16, this.pageY + 40, UI.MUTED_LIGHT, 26, '800', 400);
      return;
    }

    if (this.view === View.Detail && this.detail !== null) {
      this.renderDetail();
      return;
    }
    if (this.view === View.Leaderboard) {
      this.renderLeaderboard();
      return;
    }
    this.renderCampaigns();
  }

  // ---------- campaigns list ----------

  private renderCampaigns(): void {
    const x = this.pageX;
    const y = this.pageY;

    this.addText('PHASE REWARDS', x + 4, y - 4, UI.MUTED, 24, '800', 400);
    if (this.phases.length === 0) {
      this.addText('NO PHASES AVAILABLE', x + 4, y + 40, UI.MUTED_LIGHT, 22, '700', 400);
    }
    this.phases.slice(0, 3).forEach((phase, index) => {
      const cardX = x + index * 412;
      this.addPanel(cardX, y + 36, 390, 110, UI.PANEL, phase.status === 'live' ? UI.YELLOW_DARK : UI.PANEL_LINE);
      this.addText(phase.name, cardX + 20, y + 52, UI.YELLOW, 26, '900', 240);
      this.addStatusBadge(cardX + 390 - 96, y + 50, phase.status);
      this.addText(
        `${phase.startsAt.slice(0, 10)} - ${phase.endsAt.slice(0, 10)}`,
        cardX + 20,
        y + 88,
        UI.MUTED_LIGHT,
        18,
        '700',
        350,
      );
      this.addText(`PRIZE POOL ${phase.rewardPool}`, cardX + 20, y + 114, UI.WHITE, 20, '800', 350);
    });

    this.addText('CAMPAIGNS', x + 4, y + 186, UI.MUTED, 24, '800', 400);
    if (this.events.length === 0) {
      this.addText('NO CAMPAIGNS AVAILABLE', x + 4, y + 230, UI.MUTED_LIGHT, 22, '700', 500);
      return;
    }

    this.events.slice(0, 4).forEach((event, index) => {
      const cardY = y + 226 + index * 128;
      const live = event.status === 'live';
      this.addPanel(x, cardY, UI.WIDTH, 112, UI.PANEL, live ? UI.YELLOW_DARK : UI.PANEL_LINE);
      this.addText(event.name, x + 24, cardY + 16, live ? UI.YELLOW : UI.WHITE, 28, '900', 620);
      this.addStatusBadge(x + 24 + 640, cardY + 18, event.status);
      this.addText(
        `${event.startsAt.slice(0, 10)} - ${event.endsAt.slice(0, 10)}   PRIZE POOL ${event.prizePool}`,
        x + 24,
        cardY + 62,
        UI.MUTED_LIGHT,
        20,
        '700',
        720,
      );
      this.addButton(x + UI.WIDTH - 176, cardY + 30, 150, 52, 'OPEN', `open-${event.slug}`, () => {
        this.openEvent(event);
      }, live);
    });
  }

  // ---------- event detail ----------

  private renderDetail(): void {
    const x = this.pageX;
    const y = this.pageY;
    const event = this.detail;

    this.addText(
      `${event.startsAt.slice(0, 10)} - ${event.endsAt.slice(0, 10)}   PRIZE POOL ${event.prizePool}`,
      x + 18,
      y - 96,
      UI.MUTED_LIGHT,
      20,
      '800',
      700,
    );

    // Your-rank bar with leaderboard action (reference: top event bar).
    this.addPanel(x, y - 8, UI.WIDTH, 56, UI.PANEL_ALT, UI.YELLOW_DARK);
    const rankText =
      this.detailRank === null ? 'UNRANKED' : `#${this.detailRank.rank}`;
    this.addText(
      `YOUR RANK IN EVENT LEADERBOARD  ${rankText}`,
      x + 24,
      y + 6,
      UI.WHITE,
      22,
      '800',
      620,
    );
    this.addText(
      `${event.currency.toUpperCase()}: ${event.currencyBalance}`,
      x + 660,
      y + 6,
      UI.YELLOW,
      22,
      '900',
      220,
    );
    this.addButton(x + UI.WIDTH - 260, y - 2, 236, 44, 'VIEW LEADERBOARD', 'view-board', () => {
      this.openLeaderboard();
    });

    // Reward tracks row.
    this.addText('REWARD TRACKS', x + 4, y + 76, UI.MUTED, 22, '800', 300);
    event.rewardTracks.forEach((track, index) => {
      const cardX = x + index * 300;
      const reached = event.currencyBalance >= track.threshold;
      this.addPanel(cardX, y + 112, 280, 76, reached ? UI.CARD : UI.PANEL, reached ? UI.YELLOW : UI.PANEL_LINE);
      this.addText(
        `${track.threshold} ${event.currency.toUpperCase()}`,
        cardX + 16,
        y + 122,
        reached ? UI.YELLOW : UI.MUTED_LIGHT,
        22,
        '900',
        240,
      );
      this.addText(track.label, cardX + 16, y + 152, UI.WHITE, 18, '800', 240);
    });

    // Quest cards grid (2 columns), each with its own CLAIM state button.
    this.addText('OPERATIONS', x + 4, y + 216, UI.MUTED, 22, '800', 300);
    const cardWidth = Math.floor((UI.WIDTH - 24) / 2);
    event.quests.forEach((quest, index) => {
      const cardX = x + (index % 2) * (cardWidth + 24);
      const cardY = y + 252 + Math.floor(index / 2) * 128;
      const ready = quest.completed && quest.claimedAt === null;

      this.addPanel(cardX, cardY, cardWidth, 112, UI.PANEL, ready ? UI.YELLOW : UI.PANEL_LINE);
      this.addText(quest.name, cardX + 20, cardY + 12, UI.WHITE, 24, '900', cardWidth - 220);
      this.addText(quest.description, cardX + 20, cardY + 46, UI.MUTED_LIGHT, 18, '700', cardWidth - 220);
      this.addText(
        `${Math.min(quest.value, quest.target)}/${quest.target}   ${this.formatReward(quest.reward, event.currency)}`,
        cardX + 20,
        cardY + 76,
        ready ? UI.YELLOW : UI.MUTED,
        20,
        '800',
        cardWidth - 220,
      );

      if (quest.claimedAt !== null) {
        this.addText('CLAIMED', cardX + cardWidth - 160, cardY + 42, UI.MUTED, 22, '900', 140, 'center');
      } else {
        this.addButton(
          cardX + cardWidth - 170,
          cardY + 32,
          150,
          48,
          'CLAIM',
          `claim-${quest.id}`,
          () => {
            this.claimQuest(quest.id);
          },
          ready,
        );
      }
    });
  }

  // ---------- event leaderboard ----------

  private renderLeaderboard(): void {
    const x = this.pageX;
    const y = this.pageY;
    const currency = this.detail?.currency ?? 'medals';

    this.addText(
      'COMPLETE OPERATIONS. COLLECT MEDALS. CLIMB THE RANKS.',
      x + 18,
      y - 96,
      UI.MUTED_LIGHT,
      20,
      '800',
      760,
    );

    this.addButton(x + UI.WIDTH - 220, y - 8, 196, 48, 'BACK TO EVENT', 'back-event', () => {
      this.view = View.Detail;
      this.refresh('view-board');
    });

    this.addTableHeader(x, y + 56, UI.WIDTH, [
      { label: 'RANK', offset: 24, width: 100 },
      { label: 'WALLET', offset: 140, width: 400 },
      { label: currency.toUpperCase(), offset: UI.WIDTH - 264, width: 240, align: 'right' },
    ]);

    if (this.leaderboard.length === 0) {
      this.addText('NO SCORES YET', x + 24, y + 128, UI.MUTED_LIGHT, 24, '800', 400);
      return;
    }

    this.leaderboard.slice(0, 10).forEach((row, index) => {
      const rowY = y + 112 + index * 46;
      if (index % 2 === 1) {
        this.addPanel(x, rowY - 8, UI.WIDTH, 44, '#0f0e0a', null);
      }
      const rankColor = row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      this.addText(`${row.rank}`, x + 24, rowY, rankColor, 24, '900', 100);
      this.addText(row.displayName.toUpperCase().slice(0, 24), x + 140, rowY, UI.WHITE, 22, '800', 440);
      this.addText(`${row.amount}`, x + UI.WIDTH - 264, rowY, UI.YELLOW, 24, '900', 240, 'right');
    });
  }

  // ---------- helpers/actions ----------

  private addStatusBadge(x: number, y: number, status: string): void {
    const live = status === 'live';
    this.addPanel(x, y, 78, 30, live ? UI.YELLOW : UI.PANEL_ALT, live ? null : UI.PANEL_LINE);
    this.addText(
      status.toUpperCase(),
      x,
      y + 5,
      live ? UI.BLACK : UI.MUTED_LIGHT,
      16,
      '900',
      78,
      'center',
    );
  }

  private formatReward(reward: Record<string, number>, currency: string): string {
    const parts: string[] = [];
    Object.keys(reward || {}).forEach((key) => {
      if (reward[key] > 0) {
        parts.push(`+${reward[key]} ${key === currency ? currency.toUpperCase() : key.toUpperCase()}`);
      }
    });
    return parts.join('  ');
  }

  private openEvent(event: EventSummary): void {
    this.isLoading = true;
    this.view = View.Detail;
    this.refresh();

    this.eventClient.getEventDetail(event.slug).then((detail) => {
      this.isLoading = false;
      this.detail = detail === null ? null : detail.item;
      this.detailRank = detail === null ? null : detail.me;
      if (detail === null) {
        this.setStatus('EVENT UNAVAILABLE');
        this.view = View.Campaigns;
      }
      this.refresh();
    });
  }

  private openLeaderboard(): void {
    if (this.detail === null) {
      return;
    }

    this.isLoading = true;
    this.view = View.Leaderboard;
    this.refresh();

    this.eventClient.getEventLeaderboard(this.detail.slug).then((rows) => {
      this.isLoading = false;
      this.leaderboard = rows;
      this.refresh();
    });
  }

  private claimQuest(questId: string): void {
    this.eventClient.claimQuest(questId).then((result) => {
      if (!result.ok) {
        this.setStatus((result.error || 'CLAIM FAILED').toUpperCase());
        return;
      }
      this.setStatus(`CLAIMED ${result.quest.name}`);
      if (this.detail !== null) {
        this.openEvent(this.detail);
      }
    });
  }
}
