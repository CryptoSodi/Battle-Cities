import { GhostTank, PlayerTank, TankState } from '../../gameObjects';
import { GameUpdateArgs } from '../../game';
import { WebRtcGhostSync, WebRtcGhostTankSnapshot } from '../../network/webrtc';
import { TankTier } from '../../tank';

import { LevelScript } from '../LevelScript';

const SEND_INTERVAL_SECONDS = 1 / 20;
const MIRROR_SMOOTHING = 0.45;

export class LevelWebRtcGhostScript extends LevelScript {
  private sync = WebRtcGhostSync.getInstance();
  private ghosts = new Map<number, GhostTank>();
  private webRtcServerGhostEnabled = false;
  private webRtcServerFireSeq: number = null;
  private sendTimer = 0;
  private localPlayerIndex = 0;
  private localFireSeq = 0;
  private observedTanks = new WeakSet<PlayerTank>();
  private lastRemoteFireSeq = new Map<number, number>();
  private lastServerSnapshot: WebRtcGhostTankSnapshot = null;
  private serverPathBulletsBefore: unknown[] = [];
  private mirrorX = 0;
  private mirrorY = 0;
  private hasMirrorPosition = false;

  protected setup(updateArgs: GameUpdateArgs): void {
    if (updateArgs.webRtcMatch.isEnabled()) {
      this.localPlayerIndex = updateArgs.webRtcMatch.getLocalPlayerIndex();
      this.webRtcServerGhostEnabled = updateArgs.webRtcMatch.isServerGhostEnabled();
      return;
    }

    this.localPlayerIndex = updateArgs.magicBlockMovement.getLocalPlayerIndex();
    this.sync.configureFromLocation(this.localPlayerIndex);
    this.sync.start();
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.webRtcServerGhostEnabled) {
      this.updateWebRtcServerGhost(updateArgs);
      return;
    }

    if (!this.sync.isEnabled()) {
      return;
    }

    this.updateSource(updateArgs.deltaTime);
  }

  private updateWebRtcServerGhost(updateArgs: GameUpdateArgs): void {
    const snapshot = updateArgs.webRtcMatch.getLocalServerTankSnapshot();
    if (snapshot === null) {
      this.webRtcServerFireSeq = null;
      this.removeGhost(this.localPlayerIndex);
      return;
    }

    const ghost = this.getGhost(snapshot.partyIndex);
    ghost.applySnapshot(
      snapshot.x,
      snapshot.y,
      snapshot.rotation,
      snapshot.moving ? TankState.Moving : TankState.Idle,
      snapshot.tier,
    );

    if (
      this.webRtcServerFireSeq !== null &&
      snapshot.fireSeq > this.webRtcServerFireSeq
    ) {
      ghost.spawnGhostFire(
        snapshot.fireX,
        snapshot.fireY,
        snapshot.fireRotation,
      );
    }
    this.webRtcServerFireSeq = snapshot.fireSeq;
  }

  public prepareRemoteTankForServerPath(): void {
    if (!this.sync.isEnabled() || this.lastServerSnapshot === null) {
      return;
    }

    const remoteTank = this.world.getPlayerTanks()[1 - this.localPlayerIndex];
    if (remoteTank === null || remoteTank === undefined) {
      return;
    }

    this.serverPathBulletsBefore = remoteTank.bullets.slice();
    this.applySnapshotToTank(remoteTank, this.lastServerSnapshot, false);
  }

  public switchRemoteTankCommandPath(): void {
    if (!this.sync.isEnabled()) {
      return;
    }

    const remoteTank = this.world.getPlayerTanks()[1 - this.localPlayerIndex];
    if (remoteTank === null || remoteTank === undefined) {
      return;
    }

    const ghost = this.updateServerGhost(remoteTank);
    this.replaceServerBulletsWithGhostBullets(remoteTank, ghost);
    this.lastServerSnapshot = this.createSnapshot(
      remoteTank,
      remoteTank.partyIndex,
    );
    this.updateMirrorTankFromWebRtc(remoteTank);
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

  private updateMirrorTankFromWebRtc(remoteTank: PlayerTank): void {
    const snapshot = this.sync.getLatestSnapshot();

    if (snapshot === null) {
      return;
    }
    if (!snapshot.alive) {
      return;
    }

    this.applySnapshotToTank(remoteTank, snapshot, true);

    const lastFireSeq = this.lastRemoteFireSeq.get(snapshot.partyIndex) || 0;
    if (snapshot.fireSeq > lastFireSeq) {
      this.lastRemoteFireSeq.set(snapshot.partyIndex, snapshot.fireSeq);
      this.spawnMirrorFire(remoteTank);
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

  private updateServerGhost(remoteTank: PlayerTank): GhostTank {
    const ghost = this.getGhost(remoteTank.partyIndex);
    ghost.applySnapshot(
      remoteTank.position.x,
      remoteTank.position.y,
      remoteTank.rotation,
      remoteTank.state,
      remoteTank.type.tier,
    );

    return ghost;
  }

  private replaceServerBulletsWithGhostBullets(
    remoteTank: PlayerTank,
    ghost: GhostTank,
  ): void {
    const serverBullets = remoteTank.bullets.filter((bullet) => {
      return !this.serverPathBulletsBefore.includes(bullet);
    });

    serverBullets.forEach((bullet) => {
      bullet.nullify();
      ghost.spawnGhostFire();
    });
    this.serverPathBulletsBefore = remoteTank.bullets.slice();
  }

  private applySnapshotToTank(
    tank: PlayerTank,
    snapshot: WebRtcGhostTankSnapshot,
    smooth: boolean,
  ): void {
    let nextX = snapshot.x;
    let nextY = snapshot.y;

    if (smooth) {
      if (!this.hasMirrorPosition) {
        this.mirrorX = snapshot.x;
        this.mirrorY = snapshot.y;
        this.hasMirrorPosition = true;
      } else {
        this.mirrorX += (snapshot.x - this.mirrorX) * MIRROR_SMOOTHING;
        this.mirrorY += (snapshot.y - this.mirrorY) * MIRROR_SMOOTHING;
      }
      nextX = this.mirrorX;
      nextY = this.mirrorY;
    }

    tank.position.set(nextX, nextY);
    tank.rotation = snapshot.rotation;
    tank.state = snapshot.state;
    if (tank.type.tier !== snapshot.tier) {
      tank.upgrade(snapshot.tier, false);
    }
    tank.updateMatrix(true);
    tank.collider.update();
    tank.setNeedsPaint();
  }

  private spawnMirrorFire(remoteTank: PlayerTank): void {
    const bullet = remoteTank.fireFromNetwork(
      remoteTank.position.x,
      remoteTank.position.y,
      remoteTank.rotation,
    );
    bullet?.setLocalDamageDisabled(true);
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
