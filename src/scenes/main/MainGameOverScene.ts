import { Timer } from '../../core';
import { AudioManager, GameUpdateArgs } from '../../game';
import { GameOverHeading } from '../../gameObjects';
import { MenuInputContext } from '../../input';
import { clearMultiplayerRuntime } from '../../network/multiplayerRuntime';

import { GameScene } from '../GameScene';
import { GameSceneType } from '../GameSceneType';

const SCENE_DURATION = 3;

export class MainGameOverScene extends GameScene {
  private heading = new GameOverHeading();
  private timer = new Timer(SCENE_DURATION);
  private audioManager: AudioManager;

  protected setup({ audioManager, webRtcMatch }: GameUpdateArgs): void {
    this.audioManager = audioManager;
    clearMultiplayerRuntime();
    webRtcMatch.deactivatePlayerRuntime();

    this.timer.done.addListener(this.handleDone);

    this.heading.origin.set(0.5, 0.5);
    this.heading.setCenter(this.root.getSelfCenter());
    this.heading.position.addY(-32);
    this.root.add(this.heading);

    this.audioManager.play('game-over');
    void webRtcMatch.completeAuthoritativeMatch().catch((error) => {
      console.error('[multiplayer] result submission failed', error);
    });
  }

  protected update(updateArgs: GameUpdateArgs): void {
    const { inputManager } = updateArgs;

    const inputMethod = inputManager.getActiveMethod();

    if (inputMethod.isDownAny(MenuInputContext.Skip)) {
      this.finish();
      return;
    }

    super.update(updateArgs);

    this.timer.update(updateArgs.deltaTime);
  }

  private handleDone = (): void => {
    this.finish();
  };

  private finish(): void {
    this.audioManager.stopAll();
    this.navigator.clearAndPush(GameSceneType.MainHighscore);
  }
}
