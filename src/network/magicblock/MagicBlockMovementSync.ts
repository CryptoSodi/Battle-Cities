import { BN, BorshInstructionCoder } from '@coral-xyz/anchor';
import {
  ConnectionMagicRouter,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationMetadataPdaFromDelegatedAccount,
  delegationRecordPdaFromDelegatedAccount,
  DELEGATION_PROGRAM_ID,
} from '@magicblock-labs/ephemeral-rollups-sdk';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

import { PlayerIdentity } from '../../auth';
import { Logger } from '../../core';
import { EnemyTank, PlayerTank } from '../../gameObjects';
import { Rotation } from '../../game';
import { getPhantomProvider } from '../../wallet';
import { TerrainRegionConfig } from '../../terrain';
import { LocalServerMatchSync } from '../local';

import { TANK_MOVEMENT_IDL } from './TankMovementIdl';
import { MagicBlockMatchSync } from './MagicBlockMatchSync';
import { BoardMutation } from './MagicBlockMatchSync';

const PROGRAM_ID = new PublicKey(
  'Aaxx2EcXQA5My5isrPw35FWPGUve4jaiW8u3ER9c9tRu',
);
const BASE_RPC = 'https://rpc.magicblock.app/devnet';
const ROUTER_RPC = 'https://devnet-router.magicblock.app';
const SESSION_STORAGE_KEY = 'battlecity.magicblock.devnet.session';
const SESSION_TARGET_BALANCE = 0.05 * LAMPORTS_PER_SOL;
const PIXELS_PER_TILE = 64;
const UNITS_PER_TILE = 1000;
const UNITS_PER_PIXEL = UNITS_PER_TILE / PIXELS_PER_TILE;
const MAX_MOVE_UNITS = 1000;
const SEND_INTERVAL_MS = 50;
const WATCH_FALLBACK_INTERVAL_MS = 1000;
const WATCH_INTERPOLATION_SPEED = 18;

enum SyncState {
  Disabled,
  Idle,
  Starting,
  Ready,
  Failed,
}

interface DelegationStatus {
  isDelegated: boolean;
  fqdn?: string;
}

interface TankAccountState {
  x: number;
  y: number;
  direction: number;
  sequence: number;
}

export class MagicBlockMovementSync {
  private readonly log = new Logger('MagicBlock', Logger.Level.Info);
  private readonly baseConnection = new Connection(BASE_RPC, 'confirmed');
  private readonly routerConnection = new ConnectionMagicRouter(
    ROUTER_RPC,
    'confirmed',
  );
  private readonly instructionCoder = new BorshInstructionCoder(
    TANK_MOVEMENT_IDL,
  );
  private readonly watchTankPda: PublicKey | null;
  private readonly enabled: boolean;
  private state: SyncState;
  private session: Keypair = null;
  private tankPda: PublicKey = null;
  private erConnection: Connection = null;
  private sequence = 0;
  private lastLocalX = 0;
  private lastLocalY = 0;
  private lastSendAt = 0;
  private sending = false;
  private currentLevelNumber = 1;
  private watchTarget: TankAccountState = null;
  private watchDisplayX: number = null;
  private watchDisplayY: number = null;
  private watchFetchAt = 0;
  private watchFetching = false;
  private watchSubscription: number = null;
  private statusElement: HTMLElement = null;
  private readonly matchSync: MagicBlockMatchSync;
  private readonly localServerMatchSync: LocalServerMatchSync;

  constructor(private readonly playerIdentity: PlayerIdentity) {
    this.matchSync = new MagicBlockMatchSync();
    this.localServerMatchSync = new LocalServerMatchSync();
    const params = new URLSearchParams(window.location.search);
    this.watchTankPda = this.parseWatchTankPda(params.get('watch'));
    this.enabled =
      !this.matchSync.isEnabled() &&
      !this.localServerMatchSync.isEnabled() &&
      (params.get('magicblock') === '1' || this.watchTankPda !== null);
    this.state = this.enabled ? SyncState.Idle : SyncState.Disabled;
    if (this.enabled) {
      this.showStatus(
        this.watchTankPda === null
          ? 'MagicBlock waiting for match'
          : 'Second screen connecting...',
      );
    }
  }

  public update(
    tank: PlayerTank | null | undefined,
    deltaTime = 1 / 60,
    levelNumber = 1,
  ): void {
    if (
      tank === null ||
      tank === undefined ||
      this.state === SyncState.Disabled ||
      this.state === SyncState.Failed ||
      tank.partyIndex !== 0
    ) {
      return;
    }

    if (this.watchTankPda !== null) {
      this.updateWatcher(tank, deltaTime);
      return;
    }

    this.currentLevelNumber = levelNumber;

    if (this.playerIdentity.getPlayer()?.provider !== 'wallet') {
      return;
    }

    if (this.state === SyncState.Idle) {
      this.state = SyncState.Starting;
      this.lastLocalX = tank.position.x;
      this.lastLocalY = tank.position.y;
      void this.start().catch(this.fail);
      return;
    }

    if (
      this.state !== SyncState.Ready ||
      this.sending ||
      Date.now() - this.lastSendAt < SEND_INTERVAL_MS
    ) {
      return;
    }

    void this.sendSettledMovement(tank).catch(this.handleMovementError);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isWatching(): boolean {
    return this.watchTankPda !== null;
  }

  public isOnlineMatch(): boolean {
    return this.matchSync.isEnabled() || this.localServerMatchSync.isEnabled();
  }

  public isObserverMatch(): boolean {
    return this.matchSync.isObserver();
  }

  public isLocalServerMatch(): boolean {
    return this.localServerMatchSync.isEnabled();
  }

  public isLocalServerMatchWaitingForStart(): boolean {
    return this.localServerMatchSync.isWaitingForStart();
  }

  public getLocalPlayerIndex(): number {
    if (this.localServerMatchSync.isEnabled()) {
      return this.localServerMatchSync.getLocalPlayerIndex();
    }
    return this.matchSync.getLocalPlayerIndex();
  }

  public isRemoteTank(partyIndex: number): boolean {
    if (this.localServerMatchSync.isEnabled()) {
      return this.localServerMatchSync.isRemoteTank(partyIndex);
    }
    return this.matchSync.isRemoteTank(partyIndex);
  }

  public recordLocalFire(tank: PlayerTank): void {
    if (this.matchSync.isObserver()) {
      return;
    }
    if (this.localServerMatchSync.isEnabled()) {
      this.localServerMatchSync.recordLocalFire();
      return;
    }
    this.matchSync.recordLocalFire(tank);
  }

  public recordBoardCellDestroyed(centerX: number, centerY: number): void {
    if (this.matchSync.isObserver()) {
      return;
    }
    if (this.localServerMatchSync.isEnabled()) {
      return;
    }
    this.matchSync.recordBoardCellDestroyed(centerX, centerY);
  }

  public drainRemoteBoardMutations(): BoardMutation[] {
    if (this.localServerMatchSync.isEnabled()) {
      return this.localServerMatchSync.drainRemoteBoardMutations();
    }
    return this.matchSync.drainRemoteBoardMutations();
  }

  public drainLocalMatchEvents() {
    return this.localServerMatchSync.drainMatchEvents();
  }

  public getLocalPowerup() {
    return this.localServerMatchSync.getPowerup();
  }

  public setPlayerMirrorBulletsSuppressed(suppressed: boolean): void {
    this.matchSync.setPlayerMirrorBulletsSuppressed(suppressed);
  }

  public updateMatch(
    tanks: PlayerTank[],
    deltaTime: number,
    levelNumber: number,
    fieldWidth: number,
    fieldHeight: number,
    enemySpawns: { x: number; y: number }[],
    enemySpeedClasses: number[],
    enemyTiers: number[],
    enemyDrops: boolean[],
    basePosition: { x: number; y: number },
    terrainRegions: TerrainRegionConfig[],
  ): void {
    if (this.localServerMatchSync.isEnabled()) {
      this.localServerMatchSync.update(
        tanks,
        deltaTime,
        levelNumber,
        fieldWidth,
        fieldHeight,
        enemySpawns,
        enemyTiers,
        enemyDrops,
        basePosition,
        terrainRegions,
      );
      return;
    }
    this.matchSync.update(
      tanks,
      deltaTime,
      levelNumber,
      fieldWidth,
      fieldHeight,
      enemySpawns,
      enemySpeedClasses,
      basePosition,
      terrainRegions,
    );
  }

  public updateEnemies(
    tanks: EnemyTank[],
    playerTanks: PlayerTank[],
    basePosition: { x: number; y: number },
    deltaTime: number,
  ): void {
    if (this.localServerMatchSync.isEnabled()) {
      this.localServerMatchSync.applyEnemyState(tanks, deltaTime);
      return;
    }
    this.matchSync.applyEnemyState(tanks, playerTanks, basePosition, deltaTime);
  }

  public getActiveEnemyIds(): number[] {
    if (this.localServerMatchSync.isEnabled()) {
      return this.localServerMatchSync.getActiveEnemyIds();
    }
    return this.matchSync.getActiveEnemyIds();
  }

  private async start(): Promise<void> {
    const provider = getPhantomProvider();
    if (provider === null) {
      throw new Error('Phantom is required for MagicBlock movement.');
    }

    const wallet = await provider.connect();
    const walletPublicKey = new PublicKey(wallet.publicKey.toString());
    this.session = this.loadOrCreateSession();
    [this.tankPda] = await PublicKey.findProgramAddress(
      [Buffer.from('tank'), this.session.publicKey.toBuffer()],
      PROGRAM_ID,
    );

    let accountInfo = await this.baseConnection.getAccountInfo(this.tankPda);
    if (accountInfo === null) {
      await this.fundSession(walletPublicKey);
      await this.initializeTank();
      accountInfo = await this.baseConnection.getAccountInfo(this.tankPda);
    }

    if (accountInfo?.owner.equals(PROGRAM_ID)) {
      await this.delegateTank();
    } else if (
      accountInfo !== null &&
      !accountInfo.owner.equals(DELEGATION_PROGRAM_ID)
    ) {
      throw new Error('Tank PDA has an unexpected owner.');
    }

    const delegation = await this.waitForDelegation();
    if (!delegation.fqdn) {
      throw new Error('MagicBlock router did not return an ER endpoint.');
    }

    this.erConnection = new Connection(delegation.fqdn, 'confirmed');
    const tankState = await this.alignTankState(
      await this.fetchTankState(this.erConnection),
    );
    this.sequence = tankState.sequence;
    this.state = SyncState.Ready;
    this.showShareControl(this.tankPda);
    this.log.info(
      `Movement ready on ${delegation.fqdn}; tank ${this.tankPda.toBase58()}`,
    );
  }

  private updateWatcher(tank: PlayerTank, deltaTime: number): void {
    if (this.state === SyncState.Idle) {
      this.state = SyncState.Starting;
      this.tankPda = this.watchTankPda;
      void this.startWatcher().catch(this.fail);
      return;
    }

    if (this.state !== SyncState.Ready || this.watchTarget === null) {
      return;
    }

    if (
      !this.watchFetching &&
      Date.now() - this.watchFetchAt >= WATCH_FALLBACK_INTERVAL_MS
    ) {
      void this.refreshWatchTarget().catch(this.handleWatchError);
    }

    const targetX = this.fromChainUnits(this.watchTarget.x);
    const targetY = this.fromChainUnits(this.watchTarget.y);
    const alpha = 1 - Math.exp(-WATCH_INTERPOLATION_SPEED * deltaTime);
    const distance =
      this.watchDisplayX === null || this.watchDisplayY === null
        ? Infinity
        : Math.hypot(
            targetX - this.watchDisplayX,
            targetY - this.watchDisplayY,
          );

    if (distance > PIXELS_PER_TILE * 4) {
      this.watchDisplayX = targetX;
      this.watchDisplayY = targetY;
    } else {
      this.watchDisplayX += (targetX - this.watchDisplayX) * alpha;
      this.watchDisplayY += (targetY - this.watchDisplayY) * alpha;
    }
    tank.position.set(this.watchDisplayX, this.watchDisplayY);
    tank.rotation = this.toGameRotation(this.watchTarget.direction);
    tank.updateMatrix(true);
    tank.collider.update();
  }

  private async startWatcher(): Promise<void> {
    const delegation = await this.waitForDelegation();
    if (!delegation.fqdn) {
      throw new Error('MagicBlock router did not return an ER endpoint.');
    }

    this.erConnection = new Connection(delegation.fqdn, 'confirmed');
    this.watchTarget = await this.fetchTankState(this.erConnection);
    this.watchFetchAt = Date.now();
    this.watchSubscription = this.erConnection.onAccountChange(
      this.tankPda,
      (account) => {
        try {
          this.watchTarget = this.decodeTankState(account.data);
          this.watchFetchAt = Date.now();
        } catch (error) {
          this.handleWatchError(error as Error);
        }
      },
      'confirmed',
    );
    this.state = SyncState.Ready;
    this.showStatus('Second screen live');
    this.log.info(
      `Watching tank ${this.tankPda.toBase58()} on ${delegation.fqdn}`,
    );
  }

  private async refreshWatchTarget(): Promise<void> {
    this.watchFetching = true;
    this.watchFetchAt = Date.now();
    try {
      this.watchTarget = await this.fetchTankState(this.erConnection);
    } finally {
      this.watchFetching = false;
    }
  }

  private async alignTankState(
    initialState: TankAccountState,
  ): Promise<TankAccountState> {
    const state = { ...initialState };
    const targetX = this.toChainUnits(this.lastLocalX);
    const targetY = this.toChainUnits(this.lastLocalY);

    while (state.x !== targetX) {
      const delta = targetX - state.x;
      const distance = Math.min(MAX_MOVE_UNITS, Math.abs(delta));
      const direction = delta > 0 ? 1 : 3;
      state.sequence += 1;
      await this.sendChainMovement(direction, distance, state.sequence);
      state.x += Math.sign(delta) * distance;
      state.direction = direction;
    }

    while (state.y !== targetY) {
      const delta = targetY - state.y;
      const distance = Math.min(MAX_MOVE_UNITS, Math.abs(delta));
      const direction = delta > 0 ? 2 : 0;
      state.sequence += 1;
      await this.sendChainMovement(direction, distance, state.sequence);
      state.y += Math.sign(delta) * distance;
      state.direction = direction;
    }

    return state;
  }

  private async fundSession(walletPublicKey: PublicKey): Promise<void> {
    const currentBalance = await this.baseConnection.getBalance(
      this.session.publicKey,
      'confirmed',
    );
    if (currentBalance >= SESSION_TARGET_BALANCE) {
      return;
    }

    const provider = getPhantomProvider();
    if (provider === null) {
      throw new Error('Phantom disconnected before session funding.');
    }
    const latest = await this.baseConnection.getLatestBlockhash('confirmed');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: this.session.publicKey,
        lamports: SESSION_TARGET_BALANCE - currentBalance,
      }),
    );
    transaction.feePayer = walletPublicKey;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;

    const signed = await provider.signTransaction(transaction);
    const signature = await this.baseConnection.sendRawTransaction(
      signed.serialize(),
    );
    await this.baseConnection.confirmTransaction(
      { signature, ...latest },
      'confirmed',
    );
  }

  private async initializeTank(): Promise<void> {
    const data = this.instructionCoder.encode('initializeTank', {
      x: this.toChainUnits(this.lastLocalX),
      y: this.toChainUnits(this.lastLocalY),
    });

    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.tankPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data,
      }),
      false,
    );
  }

  private async delegateTank(): Promise<void> {
    const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
      this.tankPda,
      PROGRAM_ID,
    );
    const delegationRecord = delegationRecordPdaFromDelegatedAccount(
      this.tankPda,
    );
    const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(
      this.tankPda,
    );

    await this.sendWithSession(
      this.baseConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
          { pubkey: buffer, isSigner: false, isWritable: true },
          { pubkey: delegationRecord, isSigner: false, isWritable: true },
          { pubkey: delegationMetadata, isSigner: false, isWritable: true },
          { pubkey: this.tankPda, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: DELEGATION_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: this.instructionCoder.encode('delegateTank', {}),
      }),
      false,
    );
  }

  private async sendSettledMovement(tank: PlayerTank): Promise<void> {
    const deltaX = tank.position.x - this.lastLocalX;
    const deltaY = tank.position.y - this.lastLocalY;
    if (
      Math.abs(deltaX) < 1 / UNITS_PER_PIXEL &&
      Math.abs(deltaY) < 1 / UNITS_PER_PIXEL
    ) {
      return;
    }

    const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
    const axisDelta = horizontal ? deltaX : deltaY;
    const distance = Math.min(
      MAX_MOVE_UNITS,
      Math.max(1, Math.round(Math.abs(axisDelta) * UNITS_PER_PIXEL)),
    );
    const direction = horizontal
      ? axisDelta > 0
        ? 1
        : 3
      : axisDelta > 0
      ? 2
      : 0;
    const nextSequence = this.sequence + 1;
    this.sending = true;
    this.lastSendAt = Date.now();
    await this.sendChainMovement(direction, distance, nextSequence);

    const consumedPixels = distance / UNITS_PER_PIXEL;
    if (horizontal) {
      this.lastLocalX += Math.sign(axisDelta) * consumedPixels;
    } else {
      this.lastLocalY += Math.sign(axisDelta) * consumedPixels;
    }
    this.sequence = nextSequence;
    this.sending = false;
  }

  private async sendChainMovement(
    direction: number,
    distance: number,
    sequence: number,
  ): Promise<void> {
    await this.sendWithSession(
      this.erConnection,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
          { pubkey: this.tankPda, isSigner: false, isWritable: true },
        ],
        data: this.instructionCoder.encode('moveTank', {
          direction: this.toAnchorDirection(direction),
          distance,
          sequence: new BN(sequence),
        }),
      }),
      true,
    );
  }

  private async sendWithSession(
    connection: Connection,
    instruction: TransactionInstruction,
    skipPreflight: boolean,
  ): Promise<string> {
    const latest = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.session.publicKey;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.sign(this.session);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight,
      },
    );
    const confirmation = await connection.confirmTransaction(
      { signature, ...latest },
      'confirmed',
    );
    if (confirmation.value.err !== null) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      );
    }
    return signature;
  }

  private async waitForDelegation(): Promise<DelegationStatus> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (attempt > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
      }
      const status = await this.getDelegationStatus();
      if (status.isDelegated) {
        return status;
      }
    }
    throw new Error('Timed out waiting for MagicBlock delegation.');
  }

  private async getDelegationStatus(): Promise<DelegationStatus> {
    return (await this.routerConnection.getDelegationStatus(
      this.tankPda,
    )) as DelegationStatus;
  }

  private async fetchTankState(
    connection: Connection,
  ): Promise<TankAccountState> {
    const account = await connection.getAccountInfo(this.tankPda, 'confirmed');
    if (account === null) {
      throw new Error('Tank state is unavailable on the ER.');
    }
    return this.decodeTankState(account.data);
  }

  private decodeTankState(data: Buffer): TankAccountState {
    if (data.length < 58) {
      throw new Error('Tank state returned invalid account data.');
    }
    return {
      x: data.readInt32LE(40),
      y: data.readInt32LE(44),
      direction: data.readUInt8(48),
      sequence: data.readUInt32LE(49) + data.readUInt32LE(53) * 0x100000000,
    };
  }

  private parseWatchTankPda(value: string | null): PublicKey | null {
    if (value === null) {
      return null;
    }
    try {
      return new PublicKey(value);
    } catch {
      this.log.warn('Ignoring invalid MagicBlock watch account.');
      return null;
    }
  }

  private showShareControl(tankPda: PublicKey): void {
    const url = new URL(window.location.href);
    url.searchParams.set('magicblock', '1');
    url.searchParams.set('watch', tankPda.toBase58());
    url.searchParams.set('level', this.currentLevelNumber.toString());
    const button = this.ensureStatusElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.textContent = 'Copy second-screen link';
    button.onclick = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(url.toString());
        button.textContent = 'Link copied';
        window.setTimeout(() => {
          button.textContent = 'Copy second-screen link';
        }, 2000);
      } catch {
        button.textContent = 'Copy failed - open DevTools';
      }
    };
    this.log.info(`Second-screen link: ${url.toString()}`);
  }

  private showStatus(message: string): void {
    const element = this.ensureStatusElement('div');
    element.textContent = message;
  }

  private showConnectionError(): void {
    const button = this.ensureStatusElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.textContent = 'Connection failed - retry';
    button.onclick = (): void => window.location.reload();
  }

  private ensureStatusElement(tagName: 'button' | 'div'): HTMLElement {
    if (
      this.statusElement !== null &&
      this.statusElement.tagName.toLowerCase() === tagName
    ) {
      return this.statusElement;
    }
    this.statusElement?.remove();
    const element = document.createElement(tagName);
    element.className = 'magicblock-second-screen';
    element.setAttribute('aria-live', 'polite');
    Object.assign(element.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '1000',
      minHeight: '44px',
      padding: '10px 14px',
      border: '2px solid var(--mb-accent, #55e6c1)',
      borderRadius: '6px',
      background: 'var(--mb-panel, #09131f)',
      color: 'var(--mb-text, #ffffff)',
      font: '600 14px system-ui, sans-serif',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
    });
    if (tagName === 'button') {
      element.style.cursor = 'pointer';
      element.addEventListener('focus', () => {
        element.style.boxShadow =
          '0 0 0 3px var(--mb-focus, #ffffff), 0 6px 24px rgba(0, 0, 0, 0.35)';
      });
      element.addEventListener('blur', () => {
        element.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.35)';
      });
    }
    document.body.appendChild(element);
    this.statusElement = element;
    return element;
  }

  private toGameRotation(direction: number): Rotation {
    switch (direction) {
      case 0:
        return Rotation.Up;
      case 1:
        return Rotation.Right;
      case 2:
        return Rotation.Down;
      case 3:
        return Rotation.Left;
      default:
        return Rotation.Up;
    }
  }

  private fromChainUnits(value: number): number {
    return value / UNITS_PER_PIXEL;
  }

  private loadOrCreateSession(): Keypair {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored !== null) {
      try {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    const session = Keypair.generate();
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(Array.from(session.secretKey)),
    );
    return session;
  }

  private toAnchorDirection(direction: number): object {
    switch (direction) {
      case 0:
        return { up: {} };
      case 1:
        return { right: {} };
      case 2:
        return { down: {} };
      case 3:
        return { left: {} };
      default:
        throw new Error(`Unsupported tank direction: ${direction}`);
    }
  }

  private toChainUnits(value: number): number {
    return Math.round(value * UNITS_PER_PIXEL);
  }

  private fail = (error: Error): void => {
    this.state = SyncState.Failed;
    this.showConnectionError();
    this.log.error('Movement setup failed.', error);
  };

  private handleMovementError = (error: Error): void => {
    this.sending = false;
    this.log.warn('Movement update failed; local gameplay continues.', error);
  };

  private handleWatchError = (error: Error): void => {
    this.watchFetching = false;
    this.log.warn('Second-screen update failed; retrying.', error);
  };
}
