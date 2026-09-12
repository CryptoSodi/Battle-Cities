/** Reuse the shipped console skins, scoped to the desktop monitor only.
 * CSSOM keeps media groups/selectors intact; container units replace viewport
 * units so hardware layouts respond to the screen, not the surrounding page.
 */
export function installMonitorStyles(): void {
  if (document.getElementById('web-monitor-console-skin')) return;
  const sources = /\/(psg1-screens|psg1-quarters|psg1-tank-select|psg1-results|psg1-player-profile|psg1-backgrounds)\.css(?:\?|$)/;
  const scope = 'html body.web-ui-active [data-web-ui] [data-monitor-page]';
  const units = (value: string): string => value.replace(/([\d.]+)(d?vw|d?vh)\b/g,
    (_, number, unit) => `${number}${unit.endsWith('w') ? 'cqw' : 'cqh'}`);
  const serialize = (rules: CSSRuleList): string => Array.from(rules).map(rule => {
    if (rule instanceof CSSStyleRule) {
      if (!rule.selectorText.includes("html[data-ui-device=")) return '';
      const selector = rule.selectorText.replace(
        /html\[data-ui-device=['"]psg1['"]\](?:\s+body\.web-ui-active)?(?:\s+\[data-web-ui\])?/g,
        scope,
      );
      return `${selector}{${units(rule.style.cssText)}}`;
    }
    if (rule instanceof CSSMediaRule) {
      const query = rule.conditionText;
      const container = /(?:min|max)-(?:width|height)/.test(query);
      return `@${container ? 'container monitor' : 'media'} ${query}{${serialize(rule.cssRules)}}`;
    }
    return '';
  }).join('\n');
  const style = document.createElement('style');
  style.id = 'web-monitor-console-skin';
  style.textContent = Array.from(document.styleSheets)
    .filter(sheet => sheet.href && sources.test(sheet.href))
    .map(sheet => serialize(sheet.cssRules)).join('\n');
  // Geometry overrides load after the shared skin.
  document.querySelector('link[href*="web-monitor.css"]')?.before(style);
}
