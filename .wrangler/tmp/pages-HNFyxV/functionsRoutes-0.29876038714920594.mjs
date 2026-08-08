import { onRequestGet as __player_profile__playerId__js_onRequestGet } from "C:\\repos\\BattleCity\\functions\\player-profile\\[playerId].js"

export const routes = [
    {
      routePath: "/player-profile/:playerId",
      mountPath: "/player-profile",
      method: "GET",
      middlewares: [],
      modules: [__player_profile__playerId__js_onRequestGet],
    },
  ]