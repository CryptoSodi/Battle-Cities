import { GhostTank, PlayerTank, TankState } from '../../gameObjects';
import { GameUpdateArgs } from '../../game';
import { WebRtcGhostSync, WebRtcGhostTankSnapshot } from '../../network/webrtc';
import { TankTier } from '../../tank';

import { LevelScript } from '../LevelScript';

const SEND_INTERVAL_SECONDS = 1 / 20;

export class LevelWebRtcGhostScript extends LevelScript {
  private sync = WebRtcGhostSync.getInstance();
  private ghosts = new Map<number, GhostTank>();
  private sendTimer = 0;
  private localPlayerIndex = 0;
  private localFireSeq = 0;
  private observedTanks = new WeakSet<PlayerTank>();
  private lastRemoteFireSeq = new Map<number, number>();

  protected setup(updateArgs: GameUpdateArgs): void {
    this.localPlayerIndex = updateArgs.magicBlockMovement.getLocalPlayerIndex();
    this.sync.configureFromLocation(this.localPlayerIndex);
    this.sync.start();
  }

  protected update({ deltaTime }: { deltaTime: number }): void {
    if (!this.sync.isEnabled()) {
      return;
    }

    this.updateSource(deltaTime);
    this.updateMirror();
  }

  private updateSource(deltaTime: number): void {
    this.sendTimer += deltaTime;
    if (this.sendTimer < SEND_INTERVAL_SECONDS) {
      return;
    }
    this.sendTimer = 0;

    const tank = this.world.getPlayerTanks()[this.localPlayerIndex];
    this.observeLocalTank(tank);

    this.sync.sendSnapshot(this.createSnapshot(tank, this.localPlayerIndex));
  }

  private updateMirror(): void {
    const snapshot = this.sync.getLatestSnapshot();

    if (snapshot === null) {
      return;
    }
    if (!snapshot.alive) {
      this.removeGhost(snapshot.partyIndex);
      return;
    }

    const ghost = this.getGhost(snapshot.partyIndex);
    ghost.applySnapshot(
      snapshot.x,
      snapshot.y,
      snapshot.rotation,
      snapshot.state,
      snapshot.tier,
    );

    const lastFireSeq = this.lastRemoteFireSeq.get(snapshot.partyIndex) || 0;
    if (snapshot.fireSeq > lastFireSeq) {
      this.lastRemoteFireSeq.set(snapshot.partyIndex, snapshot.fireSeq);
      ghost.spawnGhostFire();
    }
  }

  private createSnapshot(
    tank: PlayerTank,
    partyIndex: number,
  ): WebRtcGhostTankSnapshot {
    if (tank === null || tank === undefined) {
      return {
        partyIndex,
        x: 0,
        y: 0,
        rotation: 0,
        state: TankState.Idle,
        tier: TankTier.A,
        fireSeq: this.localFireSeq,
        alive: false,
      };
    }

    return {
      partyIndex,
      x: tank.position.x,
      y: tank.position.y,
      rotation: tank.rotation,
      state: tank.state,
      tier: tank.type.tier,
      fireSeq: this.localFireSeq,
      alive: true,
    };
  }

  private observeLocalTank(tank: PlayerTank): void {
    if (tank === null || tank === undefined || this.observedTanks.has(tank)) {
      return;
    }

    this.observedTanks.add(tank);
    tank.fired.addListener(() => {
      this.localFireSeq += 1;
      this.sync.sendSnapshot(this.createSnapshot(tank, this.localPlayerIndex));
    });
  }

  private getGhost(partyIndex: number): GhostTank {
    const existing = this.ghosts.get(partyIndex);
    if (existing !== undefined) {
      return existing;
    }

    const ghost = new GhostTank(partyIndex);
    this.ghosts.set(partyIndex, ghost);
    this.world.field.add(ghost);

    return ghost;
  }

  private removeGhost(partyIndex: number): void {
    const ghost = this.ghosts.get(partyIndex);
    if (ghost === undefined) {
      return;
    }

    ghost.removeSelf();
    this.ghosts.delete(partyIndex);
  }
}
