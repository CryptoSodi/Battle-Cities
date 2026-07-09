import { GameObject } from '../../core';
import { GameUpdateArgs } from '../../game';
import { SceneMenu, SceneMenuTitle, SpriteText, TextMenuItem } from '../../gameObjects';
import * as config from '../../config';

import { GameScene } from '../GameScene';

// Shared skeleton for the infrastructure menu scenes (ranking, events,
// staking, trading, boost, wiki, airdrops): a title, an async-filled text
// board, and a bottom SceneMenu. Data loads are best-effort; subclasses call
// requestRender() whenever new data arrives and draw inside renderBoard().
export abstract class BoardScene extends GameScene {
  protected menu: SceneMenu;
  protected board: GameObject;
  protected isLoading = false;
  protected statusText = '';
  private title: SceneMenuTitle;
  private needsRender = false;

  protected abstract getTitle(): string;
  protected abstract createMenuItems(): TextMenuItem[];
  protected abstract renderBoard(): void;
  // First data load; called once from setup.
  protected abstract load(): void;

  protected setup(): void {
    this.title = new SceneMenuTitle(this.getTitle());
    this.root.add(this.title);

    this.board = new GameObject();
    this.board.size.copyFrom(this.root.size);
    this.root.add(this.board);

    this.menu = new SceneMenu();
    this.menu.position.addY(430);
    this.menu.setItems(this.createMenuItems());
    this.root.add(this.menu);

    this.load();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.needsRender) {
      this.needsRender = false;
      this.board.removeAllChildren();
      if (this.isLoading) {
        this.addLine('LOADING...', 120, config.COLOR_GRAY_LIGHT);
      } else {
        this.renderBoard();
      }
      if (this.statusText !== '') {
        this.addLine(this.statusText, 590, config.COLOR_YELLOW);
      }
    }

    super.update(updateArgs);
  }

  protected requestRender(): void {
    this.needsRender = true;
  }

  protected setStatus(text: string): void {
    this.statusText = text;
    this.requestRender();
  }

  protected addLine(text: string, y: number, color = config.COLOR_WHITE): void {
    const line = new SpriteText(text, { color });
    line.position.set(96, y);
    this.board.add(line);
  }

  protected handleBackSelected = (): void => {
    this.navigator.back();
  };
}
