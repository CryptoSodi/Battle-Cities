import test from 'ava';

import { SceneNavigator } from '../core';
import { GameUpdateArgs } from '../game';

import { GameScene } from './GameScene';

const navigator: SceneNavigator = {
  back: () => undefined,
  clearAndPush: () => undefined,
  push: () => undefined,
  replace: () => undefined,
};

class SetupTestScene extends GameScene {
  public setupCount = 0;
  public updateCount = 0;

  protected setup(): void {
    this.setupCount += 1;
  }

  protected update(): void {
    this.updateCount += 1;
  }
}

test('ensureSetup initializes an overlay scene without running its update loop', (t) => {
  const scene = new SetupTestScene(navigator, {});
  const updateArgs = {} as GameUpdateArgs;

  scene.ensureSetup(updateArgs);
  scene.ensureSetup(updateArgs);

  t.truthy(scene.getRoot());
  t.is(scene.setupCount, 1);
  t.is(scene.updateCount, 0);

  scene.invokeUpdate(updateArgs);
  t.is(scene.setupCount, 1);
  t.is(scene.updateCount, 1);
});
