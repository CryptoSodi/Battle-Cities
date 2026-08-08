export function onRequestGet(context) {
  const profileUrl = new URL(context.request.url);
  profileUrl.pathname = "/player-profile/";
  return context.env.ASSETS.fetch(profileUrl);
}
