import { Subject } from '../../core';

import { DebugMenu, DebugMenuOptions } from '../DebugMenu';

export class DebugLevelEnemyMenu extends DebugMenu {
  public movementToggleRequest = new Subject<boolean>();
  public playerMirrorBulletsToggleRequest = new Subject<boolean>();
  private movementStopped = false;
  private playerMirrorBulletsHidden = false;
  private movementButton: HTMLButtonElement;
  private playerMirrorBulletsButton: HTMLButtonElement;

  constructor(options: DebugMenuOptions = {}) {
    super('Level Enemy', options);

    this.movementButton = this.appendButton(
      'Stop enemy movement',
      this.handleMovementToggle,
    );
    this.movementButton.setAttribute('aria-pressed', 'false');
    this.movementButton.style.minHeight = '40px';

    this.playerMirrorBulletsButton = this.appendButton(
      'Hide player mirror bullets',
      this.handlePlayerMirrorBulletsToggle,
    );
    this.playerMirrorBulletsButton.setAttribute('aria-pressed', 'false');
    this.playerMirrorBulletsButton.style.minHeight = '40px';
  }

  private handleMovementToggle = (): void => {
    this.movementStopped = !this.movementStopped;
    this.movementButton.textContent = this.movementStopped
      ? 'Resume enemy movement'
      : 'Stop enemy movement';
    this.movementButton.setAttribute(
      'aria-pressed',
      String(this.movementStopped),
    );
    this.movementToggleRequest.notify(this.movementStopped);
  };

  private handlePlayerMirrorBulletsToggle = (): void => {
    this.playerMirrorBulletsHidden = !this.playerMirrorBulletsHidden;
    this.playerMirrorBulletsButton.textContent = this.playerMirrorBulletsHidden
      ? 'Show player mirror bullets'
      : 'Hide player mirror bullets';
    this.playerMirrorBulletsButton.setAttribute(
      'aria-pressed',
      String(this.playerMirrorBulletsHidden),
    );
    this.playerMirrorBulletsToggleRequest.notify(this.playerMirrorBulletsHidden);
  };
}
