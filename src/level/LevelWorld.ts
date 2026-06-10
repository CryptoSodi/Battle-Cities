import { GameObject } from '../core';
import { Field, PlayerTank } from '../gameObjects';

export class LevelWorld {
  public sceneRoot: GameObject;
  public field: Field;
  private playerTanks: PlayerTank[] = [];

  constructor(sceneRoot: GameObject, fieldWidth: number, fieldHeight: number) {
    this.sceneRoot = sceneRoot;

    this.field = new Field(fieldWidth, fieldHeight);
  }

  public addPlayerTank(playerIndex: number, playerTank: PlayerTank): void {
    this.playerTanks[playerIndex] = playerTank;
    this.field.add(playerTank);
  }

  public removePlayerTank(playerIndex: number): void {
    const playerTank = this.playerTanks[playerIndex];

    if (playerTank === null || playerTank === undefined) {
      return;
    }

    playerTank.removeSelf();

    this.playerTanks[playerIndex] = null;
  }

  public getPlayerTanks(): PlayerTank[] {
    return this.playerTanks;
  }
}
