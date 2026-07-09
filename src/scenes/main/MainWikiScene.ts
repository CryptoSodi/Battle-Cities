import { TextMenuItem } from '../../gameObjects';
import { WIKI_CATEGORIES, WIKI_ENTRIES, WikiCategory } from '../../wiki';
import * as config from '../../config';

import { BoardScene } from './BoardScene';

const ENTRIES_PER_PAGE = 3;

// In-game knowledge base (Milestone 5.5): Our Tanks, Weapons & Modules,
// Powerups, Enemy Tanks — our lore, card-detail layout.
export class MainWikiScene extends BoardScene {
  private categoryIndex = 0;
  private page = 0;
  private tabItem: TextMenuItem;
  private pageItem: TextMenuItem;

  protected getTitle(): string {
    return 'FIELD MANUAL';
  }

  protected createMenuItems(): TextMenuItem[] {
    this.tabItem = new TextMenuItem(`TAB: ${WIKI_CATEGORIES[0].label}`);
    this.tabItem.selected.addListener(this.handleNextCategory);

    this.pageItem = new TextMenuItem('PAGE 1');
    this.pageItem.selected.addListener(this.handleNextPage);

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(this.handleBackSelected);

    return [this.tabItem, this.pageItem, backItem];
  }

  protected load(): void {
    // Static content — nothing async to fetch.
    this.requestRender();
  }

  protected renderBoard(): void {
    const category = this.getCategory();
    const entries = WIKI_ENTRIES[category.id];
    const pageCount = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
    const page = Math.min(this.page, pageCount - 1);
    const visible = entries.slice(
      page * ENTRIES_PER_PAGE,
      (page + 1) * ENTRIES_PER_PAGE,
    );

    visible.forEach((entry, index) => {
      const y = 120 + index * 150;
      this.addLine(entry.name, y, config.COLOR_YELLOW);
      this.addLine(entry.role, y + 30, config.COLOR_GRAY_LIGHT);
      this.addLine(entry.lore, y + 60, config.COLOR_GRAY_LIGHT);
      this.addLine(entry.effect, y + 90);
      this.addLine(`SOURCE: ${entry.source}`, y + 120, config.COLOR_GRAY_LIGHT);
    });
  }

  private getCategory(): { id: WikiCategory; label: string } {
    return WIKI_CATEGORIES[this.categoryIndex];
  }

  private handleNextCategory = (): void => {
    this.categoryIndex = (this.categoryIndex + 1) % WIKI_CATEGORIES.length;
    this.page = 0;
    this.tabItem.setText(`TAB: ${this.getCategory().label}`);
    this.pageItem.setText('PAGE 1');
    this.requestRender();
  };

  private handleNextPage = (): void => {
    const entries = WIKI_ENTRIES[this.getCategory().id];
    const pageCount = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
    this.page = (this.page + 1) % pageCount;
    this.pageItem.setText(`PAGE ${this.page + 1}`);
    this.requestRender();
  };
}
