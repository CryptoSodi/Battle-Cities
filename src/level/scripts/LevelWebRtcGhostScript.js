"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelWebRtcGhostScript = void 0;
const gameObjects_1 = require("../../gameObjects");
const webrtc_1 = require("../../network/webrtc");
const tank_1 = require("../../tank");
const LevelScript_1 = require("../LevelScript");
const SEND_INTERVAL_SECONDS = 1 / 20;
const MIRROR_SMOOTHING = 0.45;
class LevelWebRtcGhostScript extends LevelScript_1.LevelScript {
    constructor() {
        super(...arguments);
        this.sync = webrtc_1.WebRtcGhostSync.getInstance();
        this.ghosts = new Map();
        this.webRtcServerGhostEnabled = false;
        this.webRtcServerFireSeq = null;
        this.sendTimer = 0;
        this.localPlayerIndex = 0;
        this.localFireSeq = 0;
        this.observedTanks = new WeakSet();
        this.lastRemoteFireSeq = new Map();
        this.lastServerSnapshot = null;
        this.serverPathBulletsBefore = [];
        this.mirrorX = 0;
        this.mirrorY = 0;
        this.hasMirrorPosition = false;
    }
    setup(updateArgs) {
        if (updateArgs.webRtcMatch.isEnabled()) {
            this.localPlayerIndex = updateArgs.webRtcMatch.getLocalPlayerIndex();
            this.webRtcServerGhostEnabled = updateArgs.webRtcMatch.isServerGhostEnabled();
            return;
        }
        this.localPlayerIndex = updateArgs.magicBlockMovement.getLocalPlayerIndex();
        this.sync.configureFromLocation(this.localPlayerIndex);
        this.sync.start();
    }
    update(updateArgs) {
        if (this.webRtcServerGhostEnabled) {
            this.updateWebRtcServerGhost(updateArgs);
            return;
        }
        if (!this.sync.isEnabled()) {
            return;
        }
        this.updateSource(updateArgs.deltaTime);
    }
    updateWebRtcServerGhost(updateArgs) {
        const snapshot = updateArgs.webRtcMatch.getLocalServerTankSnapshot();
        if (snapshot === null) {
            this.webRtcServerFireSeq = null;
            this.removeGhost(this.localPlayerIndex);
            return;
        }
        const ghost = this.getGhost(snapshot.partyIndex);
        ghost.applySnapshot(snapshot.x, snapshot.y, snapshot.rotation, snapshot.moving ? gameObjects_1.TankState.Moving : gameObjects_1.TankState.Idle, snapshot.tier);
        if (this.webRtcServerFireSeq !== null &&
            snapshot.fireSeq > this.webRtcServerFireSeq) {
            ghost.spawnGhostFire(snapshot.fireX, snapshot.fireY, snapshot.fireRotation);
        }
        this.webRtcServerFireSeq = snapshot.fireSeq;
    }
    prepareRemoteTankForServerPath() {
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
    switchRemoteTankCommandPath() {
        if (!this.sync.isEnabled()) {
            return;
        }
        const remoteTank = this.world.getPlayerTanks()[1 - this.localPlayerIndex];
        if (remoteTank === null || remoteTank === undefined) {
            return;
        }
        const ghost = this.updateServerGhost(remoteTank);
        this.replaceServerBulletsWithGhostBullets(remoteTank, ghost);
        this.lastServerSnapshot = this.createSnapshot(remoteTank, remoteTank.partyIndex);
        this.updateMirrorTankFromWebRtc(remoteTank);
    }
    updateSource(deltaTime) {
        this.sendTimer += deltaTime;
        if (this.sendTimer < SEND_INTERVAL_SECONDS) {
            return;
        }
        this.sendTimer = 0;
        const tank = this.world.getPlayerTanks()[this.localPlayerIndex];
        this.observeLocalTank(tank);
        this.sync.sendSnapshot(this.createSnapshot(tank, this.localPlayerIndex));
    }
    updateMirrorTankFromWebRtc(remoteTank) {
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
    createSnapshot(tank, partyIndex) {
        if (tank === null || tank === undefined) {
            return {
                partyIndex,
                x: 0,
                y: 0,
                rotation: 0,
                state: gameObjects_1.TankState.Idle,
                tier: tank_1.TankTier.A,
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
    observeLocalTank(tank) {
        if (tank === null || tank === undefined || this.observedTanks.has(tank)) {
            return;
        }
        this.observedTanks.add(tank);
        tank.fired.addListener(() => {
            this.localFireSeq += 1;
            this.sync.sendSnapshot(this.createSnapshot(tank, this.localPlayerIndex));
        });
    }
    getGhost(partyIndex) {
        const existing = this.ghosts.get(partyIndex);
        if (existing !== undefined) {
            return existing;
        }
        const ghost = new gameObjects_1.GhostTank(partyIndex);
        this.ghosts.set(partyIndex, ghost);
        this.world.field.add(ghost);
        return ghost;
    }
    updateServerGhost(remoteTank) {
        const ghost = this.getGhost(remoteTank.partyIndex);
        ghost.applySnapshot(remoteTank.position.x, remoteTank.position.y, remoteTank.rotation, remoteTank.state, remoteTank.type.tier);
        return ghost;
    }
    replaceServerBulletsWithGhostBullets(remoteTank, ghost) {
        const serverBullets = remoteTank.bullets.filter((bullet) => {
            return !this.serverPathBulletsBefore.includes(bullet);
        });
        serverBullets.forEach((bullet) => {
            bullet.nullify();
            ghost.spawnGhostFire();
        });
        this.serverPathBulletsBefore = remoteTank.bullets.slice();
    }
    applySnapshotToTank(tank, snapshot, smooth) {
        let nextX = snapshot.x;
        let nextY = snapshot.y;
        if (smooth) {
            if (!this.hasMirrorPosition) {
                this.mirrorX = snapshot.x;
                this.mirrorY = snapshot.y;
                this.hasMirrorPosition = true;
            }
            else {
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
    spawnMirrorFire(remoteTank) {
        const bullet = remoteTank.fireFromNetwork(remoteTank.position.x, remoteTank.position.y, remoteTank.rotation);
        bullet?.setLocalDamageDisabled(true);
    }
    removeGhost(partyIndex) {
        const ghost = this.ghosts.get(partyIndex);
        if (ghost === undefined) {
            return;
        }
        ghost.removeSelf();
        this.ghosts.delete(partyIndex);
    }
}
exports.LevelWebRtcGhostScript = LevelWebRtcGhostScript;
