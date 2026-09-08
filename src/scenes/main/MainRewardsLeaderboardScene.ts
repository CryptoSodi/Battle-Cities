import { MainRankingScene } from './MainRankingScene';

// The HTML rewards screen owns presentation. Reusing the native ranking scene
// preserves the canvas fallback and scene transition behavior on unsupported
// web views.
export class MainRewardsLeaderboardScene extends MainRankingScene {}
