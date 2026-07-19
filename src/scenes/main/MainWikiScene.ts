import { WIKI_CATEGORIES, WIKI_ENTRIES, WikiCategory } from '../../wiki';

import { HeadquartersPanelScene, UI } from './panelUi';

const CARD_COLUMNS = 2;
const DESKTOP_VISIBLE_ROWS = 2;
const MOBILE_VISIBLE_ROWS = 4;

const ENTRY_ARTWORK: Record<WikiCategory, Record<string, string>> = {
  tanks: {
    vanguard: 'tank.player.primary.a.up.1',
    'vanguard-mk2': 'tank.player.primary.b.up.1',
    'vanguard-mk3': 'tank.player.primary.c.up.1',
    siegebreaker: 'tank.player.primary.d.up.1',
  },
  weapons: {
    cannon: 'bullet.up',
    'twin-shot': 'powerup.gun',
    'ap-rounds': 'bullet.up',
    'hull-plating': 'powerup.helmet',
  },
  powerups: {
    shield: 'powerup.helmet',
    'base-defence': 'powerup.shovel',
    freeze: 'powerup.clock',
    speed: 'powerup.speed',
    upgrade: 'powerup.star',
    'zoom-out': 'powerup.zoomout',
    wipeout: 'powerup.grenade',
    'extra-life': 'powerup.life',
  },
  enemies: {
    scout: 'tank.enemy.default.a.up.1',
    rapid: 'tank.enemy.default.b.up.1',
    armored: 'tank.enemy.default.c.up.1',
    heavy: 'tank.enemy.default.d.up.1',
  },
};

export class MainWikiScene extends HeadquartersPanelScene {
  private categoryIndex = 0;
  private readonly scrollRows: Record<WikiCategory, number> = {
    tanks: 0,
    weapons: 0,
    powerups: 0,
    enemies: 0,
  };

  protected getSectionTitle(): string {
    return 'Field Manual';
  }

  protected getSectionIcon(): string {
    return 'ui.icon.book';
  }

  protected getInitialFocusKey(): string {
    return `tab-${WIKI_CATEGORIES[this.categoryIndex].id}`;
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    const category = WIKI_CATEGORIES[this.categoryIndex];
    const categoryId = category.id as WikiCategory;
    const entries = WIKI_ENTRIES[categoryId];
    const selectedTab = `tab-${category.id}`;

    if (direction > 0 && currentKey === 'back') {
      return selectedTab;
    }
    if (direction < 0 && currentKey.startsWith('tab-')) {
      return 'back';
    }

    if (direction > 0 && currentKey.startsWith('tab-')) {
      const firstVisibleIndex = this.scrollRows[categoryId] * CARD_COLUMNS;
      const firstVisible = entries[firstVisibleIndex];
      return firstVisible === undefined
        ? null
        : this.getEntryKey(firstVisible.slug);
    }

    const currentIndex = entries.findIndex(
      (entry) => this.getEntryKey(entry.slug) === currentKey,
    );
    if (currentIndex < 0) {
      return null;
    }

    const currentRow = Math.floor(currentIndex / CARD_COLUMNS);
    const currentColumn = currentIndex % CARD_COLUMNS;
    const nextRow = currentRow + direction;
    const totalRows = Math.ceil(entries.length / CARD_COLUMNS);

    if (nextRow < 0) {
      return selectedTab;
    }
    if (nextRow >= totalRows) {
      return null;
    }

    const targetIndex = Math.min(
      entries.length - 1,
      nextRow * CARD_COLUMNS + currentColumn,
    );
    const targetKey = this.getEntryKey(entries[targetIndex].slug);
    const currentScrollRow = this.scrollRows[categoryId];
    const visibleRows = this.getVisibleRows();
    let nextScrollRow = currentScrollRow;

    if (nextRow < currentScrollRow) {
      nextScrollRow = nextRow;
    } else if (nextRow >= currentScrollRow + visibleRows) {
      nextScrollRow = nextRow - visibleRows + 1;
    }

    if (nextScrollRow !== currentScrollRow) {
      this.scrollRows[categoryId] = nextScrollRow;
      this.refresh(targetKey);
    }

    return targetKey;
  }

  protected load(): void {
    this.statusText = '';
  }

  protected handleTouchScroll(direction: number): boolean {
    if (!this.isMobileLayout()) {
      return false;
    }

    const categoryId = WIKI_CATEGORIES[this.categoryIndex].id as WikiCategory;
    const entries = WIKI_ENTRIES[categoryId];
    const totalRows = Math.ceil(entries.length / CARD_COLUMNS);
    const maxScrollRow = Math.max(0, totalRows - this.getVisibleRows());
    const nextScrollRow = Math.max(
      0,
      Math.min(this.scrollRows[categoryId] + direction, maxScrollRow),
    );
    if (nextScrollRow === this.scrollRows[categoryId]) {
      return false;
    }

    this.scrollRows[categoryId] = nextScrollRow;
    const firstVisible = entries[nextScrollRow * CARD_COLUMNS];
    this.refresh(
      firstVisible === undefined ? null : this.getEntryKey(firstVisible.slug),
    );
    return true;
  }

  protected renderContent(): void {
    const layout = this.renderHeadquartersFrame(760);
    const { mobile, bodyX, bodyY, bodyWidth } = layout;
    const gap = mobile ? this.scaleSize(10) : 14;
    const tabHeight = mobile ? this.scaleSize(52) : 50;
    const tabWidth = Math.floor((bodyWidth - gap * 3) / 4);

    WIKI_CATEGORIES.forEach((category, index) => {
      this.addButton(
        bodyX + index * (tabWidth + gap),
        bodyY,
        tabWidth,
        tabHeight,
        category.label,
        `tab-${category.id}`,
        () => {
          this.categoryIndex = index;
          this.refresh(`tab-${category.id}`);
        },
        index === this.categoryIndex,
        'normal',
        mobile ? this.scaleSize(20) : 21,
        true,
      );
    });

    const category = WIKI_CATEGORIES[this.categoryIndex];
    const categoryId = category.id as WikiCategory;
    const entries = WIKI_ENTRIES[categoryId];
    const visibleRows = mobile ? MOBILE_VISIBLE_ROWS : DESKTOP_VISIBLE_ROWS;
    const totalRows = Math.ceil(entries.length / CARD_COLUMNS);
    const maxScrollRow = Math.max(0, totalRows - visibleRows);
    const scrollRow = Math.min(this.scrollRows[categoryId], maxScrollRow);
    this.scrollRows[categoryId] = scrollRow;
    const firstVisibleIndex = scrollRow * CARD_COLUMNS;
    const visible = entries.slice(
      firstVisibleIndex,
      firstVisibleIndex + CARD_COLUMNS * visibleRows,
    );
    const lastVisibleIndex = Math.min(
      entries.length,
      firstVisibleIndex + visible.length,
    );
    const headingY = bodyY + tabHeight + (mobile ? this.scaleSize(24) : 24);

    this.addSectionHeading(
      `${category.label}  ${firstVisibleIndex + 1}-${lastVisibleIndex}/${
        entries.length
      }`,
      bodyX,
      headingY,
      bodyWidth,
    );

    const cardGap = mobile ? this.scaleSize(14) : 18;
    const cardWidth = Math.floor((bodyWidth - cardGap) / 2);
    const cardHeight = mobile ? this.scaleSize(230) : 218;
    const gridY = headingY + (mobile ? this.scaleSize(58) : 60);

    visible.forEach((entry, index) => {
      const cardX = bodyX + (index % 2) * (cardWidth + cardGap);
      const cardY = gridY + Math.floor(index / 2) * (cardHeight + cardGap);
      const padding = mobile ? this.scaleSize(18) : 20;
      const footerHeight = mobile ? this.scaleSize(40) : 38;
      const artworkId = ENTRY_ARTWORK[category.id][entry.slug];
      const artworkSize = mobile ? this.scaleSize(92) : 88;
      const detailsX = cardX + padding + artworkSize + this.scaleSize(14);
      const detailsWidth =
        cardWidth - padding * 2 - artworkSize - this.scaleSize(14);

      this.addPanel(
        cardX,
        cardY,
        cardWidth,
        cardHeight,
        UI.CARD,
        UI.YELLOW_DARK,
      );
      this.addPanel(
        cardX + (mobile ? this.scaleSize(5) : 5),
        cardY + (mobile ? this.scaleSize(5) : 5),
        cardWidth - (mobile ? this.scaleSize(10) : 10),
        mobile ? this.scaleSize(2) : 2,
        UI.PANEL_LINE,
        null,
      );
      this.addText(
        entry.name,
        cardX + padding,
        cardY + (mobile ? this.scaleSize(18) : 16),
        UI.GREEN,
        mobile ? this.scaleSize(25) : 26,
        '900',
        cardWidth - padding * 2,
        'center',
      );
      this.addText(
        entry.role,
        detailsX,
        cardY + (mobile ? this.scaleSize(59) : 56),
        UI.YELLOW,
        mobile ? this.scaleSize(17) : 18,
        '800',
        detailsWidth,
      );
      if (artworkId !== undefined) {
        this.addIcon(
          artworkId,
          cardX + padding,
          cardY + (mobile ? this.scaleSize(58) : 55),
          artworkSize,
        );
      }
      this.addText(
        entry.lore,
        detailsX,
        cardY + (mobile ? this.scaleSize(91) : 87),
        UI.MUTED_LIGHT,
        mobile ? this.scaleSize(16) : 17,
        '700',
        detailsWidth,
      );
      this.addText(
        entry.effect,
        detailsX,
        cardY + (mobile ? this.scaleSize(139) : 132),
        UI.WHITE,
        mobile ? this.scaleSize(17) : 18,
        '800',
        detailsWidth,
      );
      this.addButton(
        cardX + 8,
        cardY + cardHeight - footerHeight - 8,
        cardWidth - 16,
        footerHeight,
        `SOURCE: ${entry.source}`,
        this.getEntryKey(entry.slug),
        () => undefined,
        false,
        'purchase',
        mobile ? this.scaleSize(16) : 17,
        true,
      );
    });
  }

  private getEntryKey(slug: string): string {
    return `entry-${slug}`;
  }

  private getVisibleRows(): number {
    return this.isMobileLayout() ? MOBILE_VISIBLE_ROWS : DESKTOP_VISIBLE_ROWS;
  }
}
