import { SceneRouter } from '../core';

import {
  EditorEnemyScene,
  EditorControlsScene,
  EditorMapScene,
  EditorMenuScene,
} from './editor';
import {
  LevelControlsScene,
  LevelLoadScene,
  LevelSelectionScene,
  LevelPlayScene,
  LevelScoreScene,
} from './level';
import {
  MainAboutScene,
  MainAirdropScene,
  MainBoostScene,
  MainEventsScene,
  MainGameOverScene,
  MainHighscoreScene,
  MainMenuScene,
  MainMoreScene,
  MainRankingScene,
  MainReplayScene,
  MainShopScene,
  MainStakingScene,
  MainTradingScene,
  MainTreasuryScene,
  MainVictoryScene,
  MainWikiScene,
} from './main';
import { ModesCustomScene, ModesMenuScene } from './modes';
import {
  SettingsAudioScene,
  SettingsInterfaceScene,
  SettingsKeybindingScene,
  SettingsMenuScene,
} from './settings';
import { SandboxTransformScene } from './sandbox';

import { GameScene } from './GameScene';
import { GameSceneType } from './GameSceneType';

// Composition root for game scenes
export class GameSceneRouter extends SceneRouter<GameScene> {
  public constructor() {
    super();

    this.register(GameSceneType.EditorEnemy, EditorEnemyScene);
    this.register(GameSceneType.EditorControls, EditorControlsScene);
    this.register(GameSceneType.EditorMap, EditorMapScene);
    this.register(GameSceneType.EditorMenu, EditorMenuScene);
    this.register(GameSceneType.MainAbout, MainAboutScene);
    this.register(GameSceneType.MainAirdrop, MainAirdropScene);
    this.register(GameSceneType.MainBoost, MainBoostScene);
    this.register(GameSceneType.MainEvents, MainEventsScene);
    this.register(GameSceneType.MainGameOver, MainGameOverScene);
    this.register(GameSceneType.MainHighscore, MainHighscoreScene);
    this.register(GameSceneType.MainMenu, MainMenuScene);
    this.register(GameSceneType.MainMore, MainMoreScene);
    this.register(GameSceneType.MainRanking, MainRankingScene);
    this.register(GameSceneType.MainReplay, MainReplayScene);
    this.register(GameSceneType.MainShop, MainShopScene);
    this.register(GameSceneType.MainStaking, MainStakingScene);
    this.register(GameSceneType.MainTrading, MainTradingScene);
    this.register(GameSceneType.MainTreasury, MainTreasuryScene);
    this.register(GameSceneType.MainVictory, MainVictoryScene);
    this.register(GameSceneType.MainWiki, MainWikiScene);
    this.register(GameSceneType.ModesMenu, ModesMenuScene);
    this.register(GameSceneType.ModesCustom, ModesCustomScene);
    this.register(GameSceneType.LevelControls, LevelControlsScene);
    this.register(GameSceneType.LevelLoad, LevelLoadScene);
    this.register(GameSceneType.LevelSelection, LevelSelectionScene);
    this.register(GameSceneType.LevelScore, LevelScoreScene);
    this.register(GameSceneType.LevelPlay, LevelPlayScene);
    this.register(GameSceneType.SettingsAudio, SettingsAudioScene);
    this.register(GameSceneType.SettingsInterface, SettingsInterfaceScene);
    this.register(GameSceneType.SettingsMenu, SettingsMenuScene);
    this.register(GameSceneType.SettingsKeybinding, SettingsKeybindingScene);
    this.register(GameSceneType.SandboxTransform, SandboxTransformScene);
  }
}
