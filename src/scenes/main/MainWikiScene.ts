import { WIKI_CATEGORIES, WIKI_ENTRIES, WikiCategory } from '../../wiki';

import { PanelScene, UI } from './panelUi';

const ENTRIES_PER_PAGE = 4;

// Field Manual, shop-styled after the Mattle wiki: category tabs on top,
// card grid of entries with role/lore/effect/source detail lines.
export class MainWikiScene extends PanelScene {
  private categoryIndex = 0;
  private page = 0;

  protected getTitle(): string {
    return 'Field Manual';
  }

  protected getTitleIcon(): string {
    return 'ui.icon.book';
  }

  protected load(): void {
    // Static content — nothing async to fetch.
  }

  protected renderContent(): void {
    const x = this.pageX;
    const y = this.pageY;

    // Category tabs.
    const tabWidth = 232;
    WIKI_CATEGORIES.forEach((category, index) => {
      this.addButton(
        x + index * (tabWidth + 20),
        y,
        tabWidth,
        48,
        category.label,
        `tab-${category.id}`,
        () => {
          this.categoryIndex = index;
          this.page = 0;
          this.refresh(`tab-${category.id}`);
        },
        index === this.categoryIndex,
        'normal',
        22,
        true,
      );
    });

    const category = WIKI_CATEGORIES[this.categoryIndex];
    const entries = WIKI_ENTRIES[category.id as WikiCategory];
    const pageCount = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
    const page = Math.min(this.page, pageCount - 1);
    const visible = entries.slice(page * ENTRIES_PER_PAGE, (page + 1) * ENTRIES_PER_PAGE);

    // Entry cards, 2x2 grid.
    const cardWidth = Math.floor((UI.WIDTH - 24) / 2);
    const cardHeight = 200;
    visible.forEach((entry, index) => {
      const cardX = x + (index % 2) * (cardWidth + 24);
      const cardY = y + 76 + Math.floor(index / 2) * (cardHeight + 24);

      this.addPanel(cardX, cardY, cardWidth, cardHeight, UI.PANEL, UI.PANEL_LINE);
      this.addText(entry.name, cardX + 22, cardY + 16, UI.YELLOW, 28, '900', cardWidth - 44);
      this.addText(entry.role, cardX + 22, cardY + 54, UI.MUTED, 18, '800', cardWidth - 44);
      this.addText(entry.lore, cardX + 22, cardY + 88, UI.MUTED_LIGHT, 18, '700', cardWidth - 44);
      this.addText(entry.effect, cardX + 22, cardY + 122, UI.WHITE, 20, '800', cardWidth - 44);

      const footer = this.addPanel(cardX, cardY + cardHeight - 40, cardWidth, 40, UI.PANEL_ALT, null);
      footer.setZIndex(1);
      this.addText(
        `SOURCE: ${entry.source}`,
        cardX + 22,
        cardY + cardHeight - 30,
        UI.MUTED_LIGHT,
        16,
        '800',
        cardWidth - 44,
      ).setZIndex(2);
    });

    // Pager.
    if (pageCount > 1) {
      this.addButton(
        x + UI.WIDTH - 200,
        y + 76 + (cardHeight + 24) * 2 + 8,
        176,
        44,
        `PAGE ${page + 1}/${pageCount}`,
        'pager',
        () => {
          this.page = (this.page + 1) % pageCount;
          this.refresh('pager');
        },
      );
    }
  }
}
