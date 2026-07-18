import {
  EventBoard,
  EventClient,
  EventLeaderboardRow,
  EventSummary,
  PhaseSummary,
} from '../../events';

import { HeadquartersPanelScene, UI } from './panelUi';

enum View {
  Campaigns,
  Detail,
  Leaderboard,
}

export class MainEventsScene extends HeadquartersPanelScene {
  private eventClient = new EventClient();
  private view = View.Campaigns;
  private events: EventSummary[] = [];
  private phases: PhaseSummary[] = [];
  private detail: EventBoard = null;
  private detailRank: { rank: number; amount: number } = null;
  private leaderboard: EventLeaderboardRow[] = [];
  private isLoading = false;

  protected getSectionTitle(): string {
    return this.view === View.Campaigns
      ? 'Campaigns'
      : this.detail?.name ?? 'Campaigns';
  }

  protected getSectionIcon(): string {
    return 'ui.icon.medal';
  }

  protected getInitialFocusKey(): string {
    return this.getFirstContentKey();
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const firstKey = this.getFirstContentKey();
    if (direction > 0 && currentKey === 'back') {
      return firstKey;
    }
    if (direction < 0 && currentKey === firstKey) {
      return 'back';
    }
    if (
      direction < 0 &&
      this.view === View.Campaigns &&
      currentKey.startsWith('open-')
    ) {
      const index = this.events.findIndex(
        (event) => `open-${event.slug}` === currentKey,
      );
      if (index >= 0 && index < 2) {
        return 'back';
      }
    }
    return null;
  }

  protected load(): void {
    this.isLoading = true;
    Promise.all([
      this.eventClient.listEvents(),
      this.eventClient.listPhases(),
    ]).then(([events, phases]) => {
      this.events = events;
      this.phases = phases;
      this.isLoading = false;
      this.refresh();
    });
  }

  protected renderContent(): void {
    const mobile = this.isMobileLayout();
    const layout = this.renderHeadquartersFrame(mobile ? 1140 : 820);
    const { bodyX, bodyY, bodyWidth } = layout;

    if (this.isLoading) {
      this.renderMessage(bodyX, bodyY, bodyWidth, 'LOADING CAMPAIGNS...');
      return;
    }
    if (this.view === View.Detail && this.detail !== null) {
      this.renderDetail(bodyX, bodyY, bodyWidth, mobile);
      return;
    }
    if (this.view === View.Leaderboard) {
      this.renderLeaderboard(bodyX, bodyY, bodyWidth);
      return;
    }
    this.renderCampaigns(bodyX, bodyY, bodyWidth, mobile);
  }

  private renderCampaigns(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    this.addSectionHeading('Phase Rewards', x, y, width);
    const phaseY = y + this.scaleSize(58);
    const phaseGap = this.scaleSize(12);
    const phaseWidth = Math.floor((width - phaseGap * 2) / 3);
    const phaseHeight = this.scaleSize(122);

    if (this.phases.length === 0) {
      this.renderEmptyRow(x, phaseY, width, 'NO PHASES AVAILABLE');
    } else {
      this.phases.slice(0, 3).forEach((phase, index) => {
        const cardX = x + index * (phaseWidth + phaseGap);
        const live = phase.status === 'live';
        this.addPanel(
          cardX,
          phaseY,
          phaseWidth,
          phaseHeight,
          UI.CARD,
          live ? UI.YELLOW_DARK : UI.PANEL_LINE,
        );
        this.addText(
          phase.name,
          cardX + this.scaleSize(14),
          phaseY + this.scaleSize(13),
          live ? UI.GREEN : UI.YELLOW,
          this.scaleSize(20),
          '900',
          phaseWidth - this.scaleSize(98),
        );
        this.addStatusBadge(
          cardX + phaseWidth - this.scaleSize(82),
          phaseY + this.scaleSize(12),
          phase.status,
        );
        this.addText(
          `${phase.startsAt.slice(0, 10)} - ${phase.endsAt.slice(0, 10)}`,
          cardX + this.scaleSize(14),
          phaseY + this.scaleSize(52),
          UI.MUTED_LIGHT,
          this.scaleSize(15),
          '700',
          phaseWidth - this.scaleSize(28),
        );
        this.addText(
          `POOL  ${phase.rewardPool}`,
          cardX + this.scaleSize(14),
          phaseY + this.scaleSize(84),
          UI.WHITE,
          this.scaleSize(18),
          '800',
          phaseWidth - this.scaleSize(28),
        );
      });
    }

    const campaignsY = phaseY + phaseHeight + this.scaleSize(24);
    this.addSectionHeading('Operations', x, campaignsY, width);
    const gridY = campaignsY + this.scaleSize(58);
    if (this.events.length === 0) {
      this.renderEmptyRow(x, gridY, width, 'NO CAMPAIGNS AVAILABLE');
      return;
    }

    const columns = 2;
    const gap = mobile ? this.scaleSize(14) : 16;
    const cardWidth = Math.floor((width - gap) / columns);
    const cardHeight = mobile ? this.scaleSize(178) : 172;
    this.events.slice(0, 4).forEach((event, index) => {
      const cardX = x + (index % columns) * (cardWidth + gap);
      const cardY = gridY + Math.floor(index / columns) * (cardHeight + gap);
      const live = event.status === 'live';
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        live ? UI.YELLOW_DARK : UI.PANEL_LINE,
      );
      this.addText(
        event.name,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(15),
        live ? UI.GREEN : UI.YELLOW,
        this.scaleSize(24),
        '900',
        cardWidth - this.scaleSize(116),
      );
      this.addStatusBadge(
        cardX + cardWidth - this.scaleSize(88),
        cardY + this.scaleSize(14),
        event.status,
      );
      this.addText(
        `${event.startsAt.slice(0, 10)} - ${event.endsAt.slice(0, 10)}`,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(58),
        UI.MUTED_LIGHT,
        this.scaleSize(17),
        '700',
        cardWidth - this.scaleSize(32),
      );
      this.addText(
        `PRIZE POOL  ${event.prizePool}`,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(91),
        UI.WHITE,
        this.scaleSize(19),
        '800',
        cardWidth - this.scaleSize(32),
      );
      this.addButton(
        cardX + this.scaleSize(8),
        cardY + cardHeight - this.scaleSize(52),
        cardWidth - this.scaleSize(16),
        this.scaleSize(44),
        'OPEN',
        `open-${event.slug}`,
        () => this.openEvent(event),
        false,
        'purchase',
        this.scaleSize(20),
      );
    });
  }

  private renderDetail(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const event = this.detail;
    const overviewHeight = this.scaleSize(98);
    this.addPanel(x, y, width, overviewHeight, UI.PAGE, UI.YELLOW_DARK);
    const rankText =
      this.detailRank === null ? 'UNRANKED' : `#${this.detailRank.rank}`;
    this.addText(
      'YOUR EVENT RANK',
      x + this.scaleSize(18),
      y + this.scaleSize(14),
      UI.MUTED,
      this.scaleSize(17),
      '800',
      this.scaleSize(210),
    );
    this.addText(
      rankText,
      x + this.scaleSize(18),
      y + this.scaleSize(44),
      UI.GREEN,
      this.scaleSize(28),
      '900',
      this.scaleSize(210),
    );
    this.addText(
      `${event.currency.toUpperCase()}  ${event.currencyBalance}`,
      x + this.scaleSize(250),
      y + this.scaleSize(39),
      UI.YELLOW,
      this.scaleSize(24),
      '900',
      this.scaleSize(250),
    );
    const actionWidth = this.scaleSize(190);
    this.addButton(
      x + width - actionWidth * 2 - this.scaleSize(12),
      y + this.scaleSize(25),
      actionWidth,
      this.scaleSize(48),
      'CAMPAIGNS',
      'back-campaigns',
      () => {
        this.view = View.Campaigns;
        this.refresh();
      },
      false,
      'normal',
      this.scaleSize(19),
    );
    this.addButton(
      x + width - actionWidth,
      y + this.scaleSize(25),
      actionWidth,
      this.scaleSize(48),
      'LEADERBOARD',
      'view-board',
      () => this.openLeaderboard(),
      false,
      'normal',
      this.scaleSize(19),
    );

    const rewardsY = y + overviewHeight + this.scaleSize(24);
    this.addSectionHeading('Reward Tracks', x, rewardsY, width);
    const trackY = rewardsY + this.scaleSize(58);
    const trackGap = this.scaleSize(10);
    const trackCount = Math.max(1, Math.min(4, event.rewardTracks.length));
    const trackWidth = Math.floor(
      (width - trackGap * (trackCount - 1)) / trackCount,
    );
    event.rewardTracks.slice(0, 4).forEach((track, index) => {
      const cardX = x + index * (trackWidth + trackGap);
      const reached = event.currencyBalance >= track.threshold;
      this.addPanel(
        cardX,
        trackY,
        trackWidth,
        this.scaleSize(96),
        reached ? UI.GREEN_PANEL : UI.CARD,
        reached ? UI.PRICE_BORDER : UI.PANEL_LINE,
      );
      this.addText(
        `${track.threshold} ${event.currency.toUpperCase()}`,
        cardX + this.scaleSize(10),
        trackY + this.scaleSize(15),
        reached ? UI.GREEN : UI.YELLOW,
        this.scaleSize(19),
        '900',
        trackWidth - this.scaleSize(20),
        'center',
      );
      this.addText(
        track.label,
        cardX + this.scaleSize(10),
        trackY + this.scaleSize(52),
        UI.WHITE,
        this.scaleSize(17),
        '800',
        trackWidth - this.scaleSize(20),
        'center',
      );
    });

    const operationsY = trackY + this.scaleSize(96 + 24);
    this.addSectionHeading('Campaign Quests', x, operationsY, width);
    const gridY = operationsY + this.scaleSize(58);
    const columns = 2;
    const gap = mobile ? this.scaleSize(14) : 16;
    const cardWidth = Math.floor((width - gap) / columns);
    const cardHeight = this.scaleSize(168);
    event.quests.forEach((quest, index) => {
      const cardX = x + (index % columns) * (cardWidth + gap);
      const cardY = gridY + Math.floor(index / columns) * (cardHeight + gap);
      const ready = quest.completed && quest.claimedAt === null;
      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        ready ? UI.YELLOW_DARK : UI.PANEL_LINE,
      );
      this.addText(
        quest.name,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(14),
        ready ? UI.GREEN : UI.YELLOW,
        this.scaleSize(22),
        '900',
        cardWidth - this.scaleSize(32),
      );
      this.addText(
        quest.description,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(52),
        UI.MUTED_LIGHT,
        this.scaleSize(17),
        '700',
        cardWidth - this.scaleSize(32),
      );
      this.addText(
        `${Math.min(quest.value, quest.target)}/${
          quest.target
        }   ${this.formatReward(quest.reward, event.currency)}`,
        cardX + this.scaleSize(16),
        cardY + this.scaleSize(87),
        ready ? UI.GREEN : UI.MUTED,
        this.scaleSize(18),
        '800',
        cardWidth - this.scaleSize(32),
      );
      if (quest.claimedAt !== null) {
        this.addPanel(
          cardX + this.scaleSize(8),
          cardY + cardHeight - this.scaleSize(52),
          cardWidth - this.scaleSize(16),
          this.scaleSize(44),
          UI.PANEL_ALT,
          UI.PANEL_LINE,
        );
        this.addText(
          'CLAIMED',
          cardX + this.scaleSize(8),
          cardY + cardHeight - this.scaleSize(42),
          UI.MUTED,
          this.scaleSize(20),
          '900',
          cardWidth - this.scaleSize(16),
          'center',
        );
      } else {
        this.addButton(
          cardX + this.scaleSize(8),
          cardY + cardHeight - this.scaleSize(52),
          cardWidth - this.scaleSize(16),
          this.scaleSize(44),
          ready ? 'CLAIM REWARD' : 'NOT READY',
          `claim-${quest.id}`,
          () => this.claimQuest(quest.id),
          false,
          'purchase',
          this.scaleSize(20),
        );
      }
    });
  }

  private renderLeaderboard(x: number, y: number, width: number): void {
    const currency = this.detail?.currency ?? 'medals';
    this.addSectionHeading('Event Leaderboard', x, y, width);
    this.addButton(
      x + width - this.scaleSize(210),
      y - this.scaleSize(4),
      this.scaleSize(210),
      this.scaleSize(46),
      'BACK TO EVENT',
      'back-event',
      () => {
        this.view = View.Detail;
        this.refresh('view-board');
      },
      false,
      'normal',
      this.scaleSize(19),
    );
    const tableY = y + this.scaleSize(58);
    this.addTableHeader(x, tableY, width, [
      { label: 'RANK', offset: 18, width: 92 },
      {
        label: 'COMMANDER',
        offset: Math.round(width * 0.18),
        width: Math.round(width * 0.5),
      },
      {
        label: currency.toUpperCase(),
        offset: width - 190,
        width: 172,
        align: 'right',
      },
    ]);
    if (this.leaderboard.length === 0) {
      this.renderEmptyRow(
        x,
        tableY + this.scaleSize(54),
        width,
        'NO SCORES YET',
      );
      return;
    }
    this.leaderboard.slice(0, 10).forEach((row, index) => {
      const rowY = tableY + this.scaleSize(54 + index * 52);
      this.addPanel(
        x,
        rowY,
        width,
        this.scaleSize(48),
        index % 2 === 0 ? UI.PAGE : UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      const rankColor =
        row.rank === 1 ? UI.GREEN : row.rank <= 3 ? UI.YELLOW : UI.WHITE;
      this.addText(
        `${row.rank}`,
        x + 18,
        rowY + 11,
        rankColor,
        this.scaleSize(21),
        '900',
        92,
      );
      this.addText(
        row.displayName.toUpperCase().slice(0, 24),
        x + Math.round(width * 0.18),
        rowY + 12,
        UI.WHITE,
        this.scaleSize(19),
        '800',
        Math.round(width * 0.5),
      );
      this.addText(
        `${row.amount}`,
        x + width - 190,
        rowY + 11,
        UI.YELLOW,
        this.scaleSize(21),
        '900',
        172,
        'right',
      );
    });
  }

  private getFirstContentKey(): string {
    if (this.view === View.Detail) {
      return 'back-campaigns';
    }
    if (this.view === View.Leaderboard) {
      return 'back-event';
    }
    return this.events.length > 0 ? `open-${this.events[0].slug}` : 'back';
  }

  private renderMessage(
    x: number,
    y: number,
    width: number,
    text: string,
  ): void {
    this.addPanel(x, y, width, this.scaleSize(128), UI.PAGE, UI.PANEL_LINE);
    this.addText(
      text,
      x,
      y + this.scaleSize(48),
      UI.MUTED_LIGHT,
      this.scaleSize(24),
      '800',
      width,
      'center',
    );
  }

  private renderEmptyRow(
    x: number,
    y: number,
    width: number,
    text: string,
  ): void {
    this.addPanel(x, y, width, this.scaleSize(86), UI.PAGE, UI.PANEL_LINE);
    this.addText(
      text,
      x,
      y + this.scaleSize(29),
      UI.MUTED_LIGHT,
      this.scaleSize(21),
      '800',
      width,
      'center',
    );
  }

  private addStatusBadge(x: number, y: number, status: string): void {
    const live = status === 'live';
    const width = this.scaleSize(70);
    this.addPanel(
      x,
      y,
      width,
      this.scaleSize(28),
      live ? UI.GREEN_PANEL : UI.PANEL_ALT,
      live ? UI.PRICE_BORDER : UI.PANEL_LINE,
    );
    this.addText(
      status.toUpperCase(),
      x,
      y + this.scaleSize(5),
      live ? UI.GREEN : UI.MUTED_LIGHT,
      this.scaleSize(15),
      '900',
      width,
      'center',
    );
  }

  private formatReward(
    reward: Record<string, number>,
    currency: string,
  ): string {
    const parts: string[] = [];
    Object.keys(reward || {}).forEach((key) => {
      if (reward[key] > 0) {
        parts.push(
          `+${reward[key]} ${
            key === currency ? currency.toUpperCase() : key.toUpperCase()
          }`,
        );
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
