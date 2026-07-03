import { GameUpdateArgs, GameStorage } from '../../game';
import { SceneMenu, SceneMenuTitle, TextMenuItem } from '../../gameObjects';
import { MapConfig, MapLoader } from '../../map';
import {
  listReplaySummaries,
  loadReplayRecord,
  SavedReplaySummary,
} from '../../replay';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

const MAX_VISIBLE_REPLAYS = 8;

export class MainReplayScene extends GameScene {
  private title: SceneMenuTitle;
  private menu: SceneMenu;
  private gameStorage: GameStorage;
  private mapLoader: MapLoader;
  private replaySummaries: SavedReplaySummary[] = [];
  private pageIndex = 0;
  private isLoadingReplay = false;

  protected setup({ gameStorage, mapLoader }: GameUpdateArgs): void {
    this.gameStorage = gameStorage;
    this.mapLoader = mapLoader;

    this.title = new SceneMenuTitle('REPLAYS');
    this.root.add(this.title);

    this.menu = new SceneMenu();
    this.root.add(this.menu);
    this.renderLoading();
    this.loadReplayList();
  }

  private async loadReplayList(): Promise<void> {
    this.replaySummaries = (await listReplaySummaries(this.gameStorage)).sort(
      (a, b) => this.getReplayTimestamp(b) - this.getReplayTimestamp(a),
    );
    this.pageIndex = 0;
    this.renderReplayList();
  }

  private renderLoading(): void {
    const loadingItem = new TextMenuItem('LOADING');
    loadingItem.setFocusable(false);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    this.menu.setItems([loadingItem, backItem]);
  }

  private renderReplayList(): void {
    const pageCount = Math.max(
      1,
      Math.ceil(this.replaySummaries.length / MAX_VISIBLE_REPLAYS),
    );
    this.pageIndex = Math.max(0, Math.min(this.pageIndex, pageCount - 1));
    const pageStart = this.pageIndex * MAX_VISIBLE_REPLAYS;
    const items = this.replaySummaries
      .slice(pageStart, pageStart + MAX_VISIBLE_REPLAYS)
      .map((summary, index) => {
        const item = new TextMenuItem(
          this.getReplayLabel(summary, pageStart + index),
        );
        item.selected.addListener(() => {
          this.handleReplaySelected(summary);
        });
        return item;
      });

    if (items.length === 0) {
      const emptyItem = new TextMenuItem('NO REPLAYS');
      emptyItem.setFocusable(false);
      items.push(emptyItem);
    }

    if (pageCount > 1) {
      const pageItem = new TextMenuItem(
        `PAGE ${this.pageIndex + 1} OF ${pageCount}`,
      );
      pageItem.setFocusable(false);
      items.push(pageItem);

      const prevItem = new TextMenuItem('PREV');
      prevItem.selected.addListener(this.handlePreviousPageSelected);
      items.push(prevItem);

      const nextItem = new TextMenuItem('NEXT');
      nextItem.selected.addListener(this.handleNextPageSelected);
      items.push(nextItem);
    }

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);
    items.push(backItem);

    this.menu.setItems(items);
  }

  private async handleReplaySelected(
    summary: SavedReplaySummary,
  ): Promise<void> {
    if (this.isLoadingReplay) {
      return;
    }

    this.isLoadingReplay = true;
    this.renderStatus('LOADING');

    const replay = await loadReplayRecord(this.gameStorage, summary.id);
    if (replay === null) {
      // eslint-disable-next-line no-console
      console.warn('Could not load selected replay.');
      this.isLoadingReplay = false;
      this.renderStatus('LOAD FAILED');
      return;
    }

    const handleLoaded = (mapConfig: MapConfig): void => {
      this.mapLoader.error.removeListener(handleError);
      this.navigator.push(GameSceneType.LevelPlay, { mapConfig, replay });
    };
    const handleError = (): void => {
      this.mapLoader.loaded.removeListener(handleLoaded);
      this.isLoadingReplay = false;
      // eslint-disable-next-line no-console
      console.warn(
        `Could not load level ${replay.levelNumber} for the recorded replay.`,
      );
      this.renderStatus('MAP FAILED');
    };

    this.mapLoader.loaded.addListenerOnce(handleLoaded);
    this.mapLoader.error.addListenerOnce(handleError);
    this.mapLoader.loadAsync(replay.levelNumber);
  }

  private handleBackSelected = (): void => {
    this.navigator.back();
  };

  private handlePreviousPageSelected = (): void => {
    const pageCount = Math.max(
      1,
      Math.ceil(this.replaySummaries.length / MAX_VISIBLE_REPLAYS),
    );
    this.pageIndex = this.pageIndex === 0 ? pageCount - 1 : this.pageIndex - 1;
    this.renderReplayList();
  };

  private handleNextPageSelected = (): void => {
    const pageCount = Math.max(
      1,
      Math.ceil(this.replaySummaries.length / MAX_VISIBLE_REPLAYS),
    );
    this.pageIndex = this.pageIndex + 1 >= pageCount ? 0 : this.pageIndex + 1;
    this.renderReplayList();
  };

  private getReplayLabel(summary: SavedReplaySummary, index: number): string {
    const slot = (index + 1).toString().padStart(2, '0');
    const level = summary.levelNumber.toString().padStart(2, '0');
    const savedAt = this.getSavedAtLabel(summary.createdAt);

    return `REC ${slot} ${savedAt} L${level}`;
  }

  private renderStatus(text: string): void {
    const statusItem = new TextMenuItem(text);
    statusItem.setFocusable(false);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    this.menu.setItems([statusItem, backItem]);
  }

  private getSavedAtLabel(createdAt: string): string {
    if (createdAt === '') {
      return 'LOCAL';
    }

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return 'SAVED';
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    return `${month}${day} ${hour}${minute}`;
  }

  private getReplayTimestamp(summary: SavedReplaySummary): number {
    const timestamp = new Date(summary.createdAt).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}
