import { Subject } from '../../core';

import { DebugMenu, DebugMenuOptions } from '../DebugMenu';

export class DebugLevelEnemyMenu extends DebugMenu {
  public movementToggleRequest = new Subject<boolean>();
  private movementStopped = false;
  private movementButton: HTMLButtonElement;

  constructor(options: DebugMenuOptions = {}) {
    super('Level Enemy', options);

    this.movementButton = this.appendButton(
      'Stop enemy movement',
      this.handleMovementToggle,
    );
    this.movementButton.setAttribute('aria-pressed', 'false');
    this.movementButton.style.minHeight = '40px';
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
}
