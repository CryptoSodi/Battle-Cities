import * as config from '../../config';

import { GameSceneType } from '../GameSceneType';

import { PanelScene, UI } from './panelUi';

const MOBILE_WIDTH = 744;

interface HeadquartersEntry {
  key: string;
  label: string;
  detail: string;
  iconId?: string;
  iconText?: string;
  sceneType: GameSceneType;
}

const HEADQUARTERS_ENTRIES: HeadquartersEntry[] = [
  {
    key: 'treasury',
    label: 'TREASURY',
    detail: 'BALANCES, ITEMS AND HISTORY',
    iconId: 'ui.icon.vault',
    sceneType: GameSceneType.MainTreasury,
  },
  {
    key: 'campaigns',
    label: 'CAMPAIGNS',
    detail: 'EVENTS, OPERATIONS AND REWARDS',
    iconId: 'ui.icon.medal',
    sceneType: GameSceneType.MainEvents,
  },
  {
    key: 'staking',
    label: 'STAKING',
    detail: 'LOCK BACT, EARN SP AND PERKS',
    iconId: 'ui.icon.lock',
    sceneType: GameSceneType.MainStaking,
  },
  {
    key: 'trading',
    label: 'TRADING',
    detail: 'RAYDIUM SWAPS AND MARKET BOOSTS',
    iconId: 'ui.icon.swap',
    sceneType: GameSceneType.MainTrading,
  },
  {
    key: 'boost',
    label: 'BOOSTS',
    detail: 'ACTIVE TRAIT BOOSTS AND PERKS',
    iconId: 'ui.icon.badge.boost',
    sceneType: GameSceneType.MainBoost,
  },
  {
    key: 'airdrop',
    label: 'AIRDROP',
    detail: 'TRACK BACT ALLOCATION AND CLAIM STATUS',
    iconId: 'ui.icon.chute',
    sceneType: GameSceneType.MainAirdrop,
  },
  {
    key: 'manual',
    label: 'FIELD MANUAL',
    detail: 'TANKS, WEAPONS, POWERUPS AND ENEMY INTELLIGENCE',
    iconId: 'ui.icon.book',
    sceneType: GameSceneType.MainWiki,
  },
];

export class MainMoreScene extends PanelScene {
  protected getTitle(): string {
    return '';
  }

  protected getContentWidth(): number {
    return config.isMobileTouchViewport() ? MOBILE_WIDTH : UI.WIDTH;
  }

  protected getPageTop(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(76) : 96;
  }

  protected getInitialFocusKey(): string {
    return 'hub-treasury';
  }

  protected getBackButtonY(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(8) : 44;
  }

  protected getBackButtonWidth(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(152) : 140;
  }

  protected getBackButtonRightInset(): number {
    return config.isMobileTouchViewport() ? 0 : 12;
  }

  protected getBackButtonHeight(): number {
    return config.isMobileTouchViewport() ? this.mobileSize(60) : 48;
  }

  protected getPreferredVerticalNavigationKey(
    currentKey: string,
    direction: number,
  ): string {
    if (direction > 0 && currentKey === 'back') {
      return 'hub-treasury';
    }
    if (
      direction < 0 &&
      (currentKey === 'hub-treasury' ||
        currentKey === 'hub-campaigns' ||
        currentKey === 'hub-staking')
    ) {
      return 'back';
    }
    return null;
  }

  protected load(): void {
    this.statusText = '';
  }

  protected renderContent(): void {
    const mobile = config.isMobileTouchViewport();
    const x = this.pageX;
    const y = this.pageY;
    const width = this.getContentWidth();

    this.renderHeader(x, mobile ? this.mobileSize(8) : y - 57, mobile);
    this.renderShell(x, y, width, mobile);
    this.renderOverview(x, y, width, mobile);
    this.renderOperations(x, y, width, mobile);
  }

  private mobileSize(value: number): number {
    return Math.round((value * this.getContentWidth()) / MOBILE_WIDTH);
  }

  private renderHeader(x: number, y: number, mobile: boolean): void {
    const width = mobile ? this.mobileSize(420) : 440;
    const height = mobile ? this.mobileSize(60) : 58;
    const headerX = x + (mobile ? 0 : 12);
    const iconSize = mobile ? this.mobileSize(42) : 42;

    this.addPanel(headerX, y, width, height, UI.YELLOW, UI.YELLOW_LIGHT);
    this.addIcon(
      'ui.icon.vault',
      headerX + (mobile ? this.mobileSize(22) : 22),
      y + Math.floor((height - iconSize) / 2),
      iconSize,
    );
    this.addText(
      'HEADQUARTERS',
      headerX + (mobile ? this.mobileSize(76) : 76),
      y + (mobile ? this.mobileSize(17) : 15),
      UI.WHITE,
      mobile ? this.mobileSize(29) : 30,
      '900',
      width - (mobile ? this.mobileSize(94) : 94),
      'center',
    );
  }

  private renderShell(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const sideInset = mobile ? 0 : 8;
    const bottomInset = mobile ? this.mobileSize(12) : 18;
    const shell = this.addPanel(
      x - sideInset,
      y,
      width + sideInset * 2,
      Math.max(
        mobile ? this.mobileSize(590) : 590,
        this.root.size.height - y - bottomInset,
      ),
      UI.PANEL,
      UI.PANEL_LINE,
    );
    shell.setZIndex(-2);

    const accent = this.addPanel(
      x - sideInset + (mobile ? this.mobileSize(6) : 6),
      y + (mobile ? this.mobileSize(5) : 5),
      width + sideInset * 2 - (mobile ? this.mobileSize(12) : 12),
      mobile ? this.mobileSize(3) : 3,
      UI.YELLOW,
      null,
    );
    accent.setZIndex(-1);
  }

  private renderOverview(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? this.mobileSize(18) : 24;
    const panelY = y + (mobile ? this.mobileSize(22) : 22);
    const panelHeight = mobile ? this.mobileSize(92) : 82;
    const innerX = x + inset;
    const innerWidth = width - inset * 2;

    this.addPanel(
      innerX,
      panelY,
      innerWidth,
      panelHeight,
      UI.PAGE,
      UI.YELLOW_DARK,
    );
    this.addText(
      'COMMAND CENTER',
      innerX + (mobile ? this.mobileSize(22) : 24),
      panelY + (mobile ? this.mobileSize(16) : 14),
      UI.GREEN,
      mobile ? this.mobileSize(22) : 23,
      '900',
      innerWidth - (mobile ? this.mobileSize(44) : 48),
    );
    this.addText(
      'MANAGE YOUR ASSETS, OPERATIONS, REWARDS AND BATTLE INTELLIGENCE.',
      innerX + (mobile ? this.mobileSize(22) : 24),
      panelY + (mobile ? this.mobileSize(51) : 45),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(17) : 18,
      '700',
      innerWidth - (mobile ? this.mobileSize(44) : 48),
    );
  }

  private renderOperations(
    x: number,
    y: number,
    width: number,
    mobile: boolean,
  ): void {
    const inset = mobile ? this.mobileSize(18) : 24;
    const innerX = x + inset;
    const innerWidth = width - inset * 2;
    const headingY = y + (mobile ? this.mobileSize(136) : 126);

    this.addText(
      'OPERATIONS',
      innerX,
      headingY,
      UI.WHITE,
      mobile ? this.mobileSize(26) : 28,
      '900',
      innerWidth,
    );
    this.addPanel(
      innerX,
      headingY + (mobile ? this.mobileSize(40) : 42),
      innerWidth,
      mobile ? this.mobileSize(2) : 2,
      UI.PANEL_LINE,
      null,
    );

    const gridY = headingY + (mobile ? this.mobileSize(58) : 60);
    const columns = 3;
    const gap = mobile ? this.mobileSize(12) : 16;
    const rowGap = mobile ? this.mobileSize(12) : 16;
    const cardHeight = mobile ? this.mobileSize(162) : 156;
    const cardWidth = Math.floor((innerWidth - gap * (columns - 1)) / columns);

    HEADQUARTERS_ENTRIES.forEach((entry, index) => {
      const isManual = entry.key === 'manual';
      const row = Math.floor(index / columns);
      const column = index % columns;
      const cardX = innerX + column * (cardWidth + gap);
      const cardY = gridY + row * (cardHeight + rowGap);
      const renderedWidth = isManual ? cardWidth * 2 + gap : cardWidth;

      this.renderOperationCard(
        entry,
        cardX,
        cardY,
        renderedWidth,
        cardHeight,
        mobile,
      );
    });
  }

  private renderOperationCard(
    entry: HeadquartersEntry,
    x: number,
    y: number,
    width: number,
    height: number,
    mobile: boolean,
  ): void {
    const padding = mobile ? this.mobileSize(14) : 16;
    const iconSize = mobile ? this.mobileSize(44) : 44;
    const actionHeight = mobile ? this.mobileSize(42) : 42;
    const actionInset = mobile ? this.mobileSize(8) : 8;

    this.addPanel(x, y, width, height, UI.CARD, UI.YELLOW_DARK);
    this.addText(
      entry.label,
      x + padding,
      y + (mobile ? this.mobileSize(14) : 14),
      UI.GREEN,
      mobile ? this.mobileSize(23) : 24,
      '900',
      width - padding * 2,
      'center',
    );
    const iconX = x + Math.floor((width - iconSize) / 2);
    const iconY = y + (mobile ? this.mobileSize(42) : 42);
    if (entry.iconId !== undefined) {
      this.addIcon(entry.iconId, iconX, iconY, iconSize);
    } else {
      this.addPanel(
        iconX,
        iconY,
        iconSize,
        iconSize,
        UI.PANEL_ALT,
        UI.PANEL_LINE,
      );
      this.addText(
        entry.iconText || '@',
        iconX,
        iconY + (mobile ? this.mobileSize(8) : 7),
        UI.YELLOW,
        mobile ? this.mobileSize(27) : 28,
        '900',
        iconSize,
        'center',
      );
    }
    this.addText(
      entry.detail,
      x + padding,
      y + (mobile ? this.mobileSize(92) : 91),
      UI.MUTED_LIGHT,
      mobile ? this.mobileSize(15) : 16,
      '700',
      width - padding * 2,
      'center',
    );
    this.addButton(
      x + actionInset,
      y + height - actionHeight - actionInset,
      width - actionInset * 2,
      actionHeight,
      'OPEN',
      `hub-${entry.key}`,
      () => this.navigator.push(entry.sceneType),
      false,
      'purchase',
      mobile ? this.mobileSize(20) : 21,
    );
  }
}
