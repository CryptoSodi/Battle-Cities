import { WIKI_CATEGORIES, WIKI_ENTRIES, WikiCategory } from '../../wiki';

import { HeadquartersPanelScene, UI } from './panelUi';

const ENTRIES_PER_PAGE = 4;

export class MainWikiScene extends HeadquartersPanelScene {
  private categoryIndex = 0;
  private page = 0;

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
    const selectedTab = `tab-${WIKI_CATEGORIES[this.categoryIndex].id}`;
    if (direction > 0 && currentKey === 'back') {
      return selectedTab;
    }
    if (direction < 0 && currentKey.startsWith('tab-')) {
      return 'back';
    }
    if (direction < 0 && currentKey === 'pager') {
      return selectedTab;
    }
    return null;
  }

  protected load(): void {
    this.statusText = '';
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
          this.page = 0;
          this.refresh(`tab-${category.id}`);
        },
        index === this.categoryIndex,
        'normal',
        mobile ? this.scaleSize(20) : 21,
        true,
      );
    });

    const category = WIKI_CATEGORIES[this.categoryIndex];
    const entries = WIKI_ENTRIES[category.id as WikiCategory];
    const pageCount = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
    const page = Math.min(this.page, pageCount - 1);
    const visible = entries.slice(
      page * ENTRIES_PER_PAGE,
      (page + 1) * ENTRIES_PER_PAGE,
    );
    const headingY = bodyY + tabHeight + (mobile ? this.scaleSize(24) : 24);

    this.addSectionHeading(
      `${category.label}  ${page + 1}/${pageCount}`,
      bodyX,
      headingY,
      bodyWidth,
    );

    const cardGap = mobile ? this.scaleSize(14) : 18;
    const cardWidth = Math.floor((bodyWidth - cardGap) / 2);
    const cardHeight = mobile ? this.scaleSize(214) : 202;
    const gridY = headingY + (mobile ? this.scaleSize(58) : 60);

    visible.forEach((entry, index) => {
      const cardX = bodyX + (index % 2) * (cardWidth + cardGap);
      const cardY = gridY + Math.floor(index / 2) * (cardHeight + cardGap);
      const padding = mobile ? this.scaleSize(18) : 20;
      const footerHeight = mobile ? this.scaleSize(40) : 38;

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
        cardX + padding,
        cardY + (mobile ? this.scaleSize(56) : 52),
        UI.YELLOW,
        mobile ? this.scaleSize(17) : 18,
        '800',
        cardWidth - padding * 2,
        'center',
      );
      this.addText(
        entry.lore,
        cardX + padding,
        cardY + (mobile ? this.scaleSize(91) : 84),
        UI.MUTED_LIGHT,
        mobile ? this.scaleSize(16) : 17,
        '700',
        cardWidth - padding * 2,
        'center',
      );
      this.addText(
        entry.effect,
        cardX + padding,
        cardY + (mobile ? this.scaleSize(132) : 122),
        UI.WHITE,
        mobile ? this.scaleSize(17) : 18,
        '800',
        cardWidth - padding * 2,
        'center',
      );
      this.addPanel(
        cardX + 8,
        cardY + cardHeight - footerHeight - 8,
        cardWidth - 16,
        footerHeight,
        UI.PRICE,
        UI.PRICE_BORDER,
      );
      this.addText(
        `SOURCE: ${entry.source}`,
        cardX + 12,
        cardY + cardHeight - footerHeight + (mobile ? this.scaleSize(1) : 1),
        UI.PRICE_TEXT,
        mobile ? this.scaleSize(16) : 17,
        '800',
        cardWidth - 24,
        'center',
      );
    });

    if (pageCount > 1) {
      const pagerWidth = mobile ? this.scaleSize(220) : 220;
      const pagerY = gridY + cardHeight * 2 + cardGap + 12;
      this.addButton(
        bodyX + bodyWidth - pagerWidth,
        pagerY,
        pagerWidth,
        mobile ? this.scaleSize(46) : 46,
        `NEXT  ${page + 1}/${pageCount}`,
        'pager',
        () => {
          this.page = (this.page + 1) % pageCount;
          this.refresh('pager');
        },
        false,
        'purchase',
        mobile ? this.scaleSize(20) : 21,
      );
    }
  }
}
