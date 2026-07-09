import { TextMenuItem } from '../../gameObjects';
import { EventBoard, EventClient, EventLeaderboardRow, EventSummary, PhaseSummary } from '../../events';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

enum View {
  Campaigns,
  Detail,
  Leaderboard,
}

// Campaign hub (Milestone 3): phase reward cards, live/ended campaign cards,
// and per-event detail with quest progress, claims, and the event leaderboard.
export class MainEventsScene extends BoardScene {
  private eventClient = new EventClient();
  private view = View.Campaigns;
  private events: EventSummary[] = [];
  private phases: PhaseSummary[] = [];
  private selectedIndex = 0;
  private detail: EventBoard = null;
  private detailRank: { rank: number; amount: number } = null;
  private leaderboard: EventLeaderboardRow[] = [];

  private selectItem: TextMenuItem;
  private openItem: TextMenuItem;
  private claimItem: TextMenuItem;
  private boardItem: TextMenuItem;

  protected getTitle(): string {
    return 'CAMPAIGNS';
  }

  protected createMenuItems(): TextMenuItem[] {
    this.selectItem = new TextMenuItem('EVENT: -');
    this.selectItem.selected.addListener(this.handleSelectNext);

    this.openItem = new TextMenuItem('OPEN');
    this.openItem.selected.addListener(this.handleOpen);

    this.claimItem = new TextMenuItem('CLAIM REWARDS');
    this.claimItem.selected.addListener(this.handleClaim);

    this.boardItem = new TextMenuItem('LEADERBOARD');
    this.boardItem.selected.addListener(this.handleLeaderboard);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBack);

    return [this.selectItem, this.openItem, this.claimItem, this.boardItem, backItem];
  }

  protected load(): void {
    this.isLoading = true;
    this.requestRender();

    Promise.all([this.eventClient.listEvents(), this.eventClient.listPhases()]).then(
      ([events, phases]) => {
        this.events = events;
        this.phases = phases;
        this.isLoading = false;
        this.updateSelectLabel();
        this.requestRender();
      },
    );
  }

  protected renderBoard(): void {
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

  private renderCampaigns(): void {
    this.addLine('PHASE REWARDS', 120, config.COLOR_YELLOW);
    if (this.phases.length === 0) {
      this.addLine('NO PHASES AVAILABLE', 152, config.COLOR_GRAY_LIGHT);
    }
    this.phases.slice(0, 2).forEach((phase, index) => {
      this.addLine(
        `${phase.name}  ${phase.status.toUpperCase()}  POOL ${phase.rewardPool}`,
        152 + index * 32,
      );
    });

    this.addLine('CAMPAIGNS', 240, config.COLOR_YELLOW);
    if (this.events.length === 0) {
      this.addLine('NO CAMPAIGNS AVAILABLE', 272, config.COLOR_GRAY_LIGHT);
      return;
    }
    this.events.slice(0, 6).forEach((event, index) => {
      const marker = index === this.selectedIndex ? '>' : ' ';
      const color =
        event.status === 'live' ? config.COLOR_WHITE : config.COLOR_GRAY_LIGHT;
      this.addLine(
        `${marker}${event.name}  ${event.status.toUpperCase()}`,
        272 + index * 32,
        color,
      );
    });
  }

  private renderDetail(): void {
    const event = this.detail;
    this.addLine(event.name, 120, config.COLOR_YELLOW);
    this.addLine(`PRIZE POOL ${event.prizePool}`, 152);
    this.addLine(
      `${event.currency.toUpperCase()}: ${event.currencyBalance}` +
        (this.detailRank !== null ? `  RANK #${this.detailRank.rank}` : ''),
      184,
    );

    this.addLine('OPERATIONS', 232, config.COLOR_YELLOW);
    event.quests.forEach((quest, index) => {
      const y = 264 + index * 32;
      let suffix = `${quest.value}/${quest.target}`;
      let color = config.COLOR_WHITE;
      if (quest.claimedAt !== null) {
        suffix = 'CLAIMED';
        color = config.COLOR_GRAY_LIGHT;
      } else if (quest.completed) {
        suffix = 'READY!';
        color = config.COLOR_YELLOW;
      }
      this.addLine(`${quest.name}  ${suffix}`, y, color);
    });

    this.addLine('REWARD TRACKS', 420, config.COLOR_YELLOW);
    event.rewardTracks.forEach((track, index) => {
      const reached = event.currencyBalance >= track.threshold;
      this.addLine(
        `${track.threshold} ${event.currency.toUpperCase()} - ${track.label}` +
          (reached ? ' *' : ''),
        452 + index * 32,
        reached ? config.COLOR_YELLOW : config.COLOR_GRAY_LIGHT,
      );
    });
  }

  private renderLeaderboard(): void {
    this.addLine('EVENT LEADERBOARD', 120, config.COLOR_YELLOW);
    if (this.leaderboard.length === 0) {
      this.addLine('NO SCORES YET', 160, config.COLOR_GRAY_LIGHT);
      return;
    }
    this.leaderboard.slice(0, 10).forEach((row, index) => {
      const color = row.rank <= 3 ? config.COLOR_YELLOW : config.COLOR_WHITE;
      this.addLine(
        `${`${row.rank}`.padStart(2, ' ')}. ${row.displayName
          .toUpperCase()
          .slice(0, 14)
          .padEnd(15, ' ')}${`${row.amount}`.padStart(6, ' ')}`,
        160 + index * 32,
        color,
      );
    });
  }

  private updateSelectLabel(): void {
    const event = this.events[this.selectedIndex];
    this.selectItem.setText(`EVENT: ${event === undefined ? '-' : event.name.slice(0, 18)}`);
  }

  private handleSelectNext = (): void => {
    if (this.events.length === 0) {
      return;
    }
    this.selectedIndex = (this.selectedIndex + 1) % this.events.length;
    this.view = View.Campaigns;
    this.updateSelectLabel();
    this.requestRender();
  };

  private handleOpen = (): void => {
    const event = this.events[this.selectedIndex];
    if (event === undefined) {
      return;
    }

    this.isLoading = true;
    this.view = View.Detail;
    this.requestRender();

    this.eventClient.getEventDetail(event.slug).then((detail) => {
      this.isLoading = false;
      this.detail = detail === null ? null : detail.item;
      this.detailRank = detail === null ? null : detail.me;
      if (detail === null) {
        this.setStatus('EVENT UNAVAILABLE');
        this.view = View.Campaigns;
      }
      this.requestRender();
    });
  };

  // Claims the first completed, unclaimed quest of the open event.
  private handleClaim = (): void => {
    if (this.detail === null) {
      this.setStatus('OPEN AN EVENT FIRST');
      return;
    }

    const ready = this.detail.quests.find(
      (quest) => quest.completed && quest.claimedAt === null,
    );
    if (ready === undefined) {
      this.setStatus('NOTHING TO CLAIM');
      return;
    }

    this.eventClient.claimQuest(ready.id).then((result) => {
      if (!result.ok) {
        this.setStatus((result.error || 'CLAIM FAILED').toUpperCase());
        return;
      }
      this.setStatus(`CLAIMED ${result.quest.name}`);
      this.handleOpen(); // reload detail with fresh balances
    });
  };

  private handleLeaderboard = (): void => {
    const event = this.events[this.selectedIndex];
    if (event === undefined) {
      return;
    }

    this.isLoading = true;
    this.view = View.Leaderboard;
    this.requestRender();

    this.eventClient.getEventLeaderboard(event.slug).then((rows) => {
      this.isLoading = false;
      this.leaderboard = rows;
      this.requestRender();
    });
  };

  private handleBack = (): void => {
    if (this.view !== View.Campaigns) {
      this.view = View.Campaigns;
      this.statusText = '';
      this.requestRender();
      return;
    }
    this.handleBackSelected();
  };
}
