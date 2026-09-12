// Browser fixture: real UI/controllers, local data, no wallet or purchase calls.
import { MainMenuWebUi } from '../../src/webUi/MainMenuWebUi';
import { HeadquartersWebUi } from '../../src/webUi/HeadquartersWebUi';
import { HeadquartersPagesWebUi } from '../../src/webUi/HeadquartersPagesWebUi';
import { RankingWebUi } from '../../src/webUi/RankingWebUi';
import { SocialsWebUi } from '../../src/webUi/SocialsWebUi';
import { ShopWebUi } from '../../src/webUi/ShopWebUi';
import { SettingsWebUi } from '../../src/webUi/SettingsWebUi';
import { TankSelectWebUi } from '../../src/webUi/TankSelectWebUi';
import { PlayerProfileWebUi } from '../../src/webUi/PlayerProfileWebUi';
import { ResultsWebUi } from '../../src/webUi/ResultsWebUi';
import { GameSceneType } from '../../src/scenes/GameSceneType';
import { GameStorage } from '../../src/game/GameStorage';
import { installMonitorStyles } from '../../src/webUi/monitorStyles';
import { isDesktopConsole } from '../../src/webUi/webUiHost';
const storage = new GameStorage('monitor-test');
const input: any = { getActiveMethod: () => ({ isDownAny: () => false }), getNativeAndroidGamepad: () => ({getDeviceProfile: () => null}) };
const identity: any = { getPlayer: () => ({ displayName: 'TEST PLAYER', provider: 'google' }), getDisplayName: () => 'TEST PLAYER' };
const history: GameSceneType[] = [GameSceneType.MainMenu];
const navigator: any = { push(type) { history.push(type); show(type); }, back() { if (history.length > 1) history.pop(); show(history[history.length - 1]); } };
const home = new MainMenuWebUi({ inputManager: input, isDev: false, navigator,
  notificationClient: {} as any, playerIdentity: identity,
  pointsHighscoreManager: { getOverallMaxPoints: () => 33700 } as any,
  session: { primaryPlayer: { getLastGamePoints: () => 0 } } as any });
for (const method of ['refreshHudProgression', 'loadPresence', 'loadEvents', 'loadHomeRewards', 'refreshRunBoosts', 'prepareNotificationPrompt'])
  (home as any)[method] = async () => {};
const pages = {
  [GameSceneType.MainMore]: new HeadquartersWebUi(navigator, input),
  [GameSceneType.MainRanking]: new RankingWebUi(navigator, input),
  [GameSceneType.MainSocials]: new SocialsWebUi(navigator, input),
  [GameSceneType.MainShop]: new ShopWebUi({gameStorage: storage, navigator, inputManager: input, isBattleSetup: () => false, getBattleFuelCost: () => 1, startBattle: async () => {}}),
  [GameSceneType.SettingsMenu]: new SettingsWebUi(navigator, input, { isGlobalMuted: () => false } as any, storage, identity),
  [GameSceneType.MainTankSelect]: new TankSelectWebUi(storage, navigator, input, () => ({})),
  [GameSceneType.MainPlayerProfile]: new PlayerProfileWebUi(navigator, input, () => 'ply-test'),
  [GameSceneType.LevelScore]: new ResultsWebUi({ inputManager: input, getController: () => ({
    advanceResultsFromWebUi: () => {}, continueFromWebUi: () => navigator.push(GameSceneType.MainMenu), shareResultsFromWebUi: async () => {},
    getResultsWebUiState: () => ({battleTime:'02:10',defeated:20,enemyTotal:20,highscore:33700,mvp:'TEST PLAYER',players:[{bonus:500,isPrimary:true,kills:[8,6,4,2],name:'TEST PLAYER',rank:1,totalKills:20,totalPoints:5200}],result:'clear',stage:1,status:'STAGE CLEAR',timer:'',totalKills:20}),
  }) }),
};
const quarters = new HeadquartersPagesWebUi(navigator, input);
let active: any;
function show(type: GameSceneType) {
  active?.unmount();
  if (isDesktopConsole()) {
    home.mount();
    home.setMonitorPage(type === GameSceneType.MainMenu ? null : type);
  } else {
    home.unmount();
    if (type === GameSceneType.MainMenu) home.mount();
  }
  if (type === GameSceneType.MainMenu) { active = null; return; }
  active = pages[type] || quarters;
  active.mount(type);
  if (type === GameSceneType.LevelScore) active.update(0);
}
installMonitorStyles();
show(GameSceneType.MainMenu);
(window as any).monitorTest = { show: (name: string) => navigator.push(GameSceneType[name]), home, pages, quarters };
