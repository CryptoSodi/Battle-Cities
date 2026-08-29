import { GameScene } from '../GameScene';

// Main-menu presentation now lives in semantic HTML. This route remains in
// the scene stack so existing push/back/replace behavior continues to work
// while non-gameplay screens are migrated one at a time.
export class MainMenuScene extends GameScene {
  protected setup(): void {
    // The HTML controller is mounted by src/main.ts for this scene type.
  }
}
