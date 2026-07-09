import { SceneMenu, SceneMenuTitle, TextMenuItem } from '../../gameObjects';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

// Hub for the economy/meta screens (the plan's "More" nav group), so the
// main menu stays a tank menu and not a nav bar.
export class MainMoreScene extends GameScene {
  protected setup(): void {
    this.root.add(new SceneMenuTitle('HEADQUARTERS'));

    const entries: [string, GameSceneType][] = [
      ['CAMPAIGNS', GameSceneType.MainEvents],
      ['STAKING', GameSceneType.MainStaking],
      ['TRADING', GameSceneType.MainTrading],
      ['BOOST', GameSceneType.MainBoost],
      ['AIRDROP', GameSceneType.MainAirdrop],
      ['FIELD MANUAL', GameSceneType.MainWiki],
    ];

    const items = entries.map(([label, sceneType]) => {
      const item = new TextMenuItem(label);
      item.selected.addListener(() => {
        this.navigator.push(sceneType);
      });
      return item;
    });

    const backItem = new TextMenuItem('BACK');
    backItem.selected.addListener(() => {
      this.navigator.back();
    });
    items.push(backItem);

    const menu = new SceneMenu();
    menu.setItems(items);
    this.root.add(menu);
  }
}
