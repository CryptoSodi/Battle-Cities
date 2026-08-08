"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagicBlockMovementSync = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const ephemeral_rollups_sdk_1 = require("@magicblock-labs/ephemeral-rollups-sdk");
const web3_js_1 = require("@solana/web3.js");
const buffer_1 = require("buffer");
const core_1 = require("../../core");
const game_1 = require("../../game");
const wallet_1 = require("../../wallet");
const local_1 = require("../local");
const TankMovementIdl_1 = require("./TankMovementIdl");
const MagicBlockMatchSync_1 = require("./MagicBlockMatchSync");
const PROGRAM_ID = new web3_js_1.PublicKey('Aaxx2EcXQA5My5isrPw35FWPGUve4jaiW8u3ER9c9tRu');
const BASE_RPC = 'https://rpc.magicblock.app/devnet';
const ROUTER_RPC = 'https://devnet-router.magicblock.app';
const SESSION_STORAGE_KEY = 'battlecity.magicblock.devnet.session';
const SESSION_TARGET_BALANCE = 0.05 * web3_js_1.LAMPORTS_PER_SOL;
const PIXELS_PER_TILE = 64;
const UNITS_PER_TILE = 1000;
const UNITS_PER_PIXEL = UNITS_PER_TILE / PIXELS_PER_TILE;
const MAX_MOVE_UNITS = 1000;
const SEND_INTERVAL_MS = 50;
const WATCH_FALLBACK_INTERVAL_MS = 1000;
const WATCH_INTERPOLATION_SPEED = 18;
var SyncState;
(function (SyncState) {
    SyncState[SyncState["Disabled"] = 0] = "Disabled";
    SyncState[SyncState["Idle"] = 1] = "Idle";
    SyncState[SyncState["Starting"] = 2] = "Starting";
    SyncState[SyncState["Ready"] = 3] = "Ready";
    SyncState[SyncState["Failed"] = 4] = "Failed";
})(SyncState || (SyncState = {}));
class MagicBlockMovementSync {
    constructor(playerIdentity) {
        this.playerIdentity = playerIdentity;
        this.log = new core_1.Logger('MagicBlock', core_1.Logger.Level.Info);
        this.baseConnection = new web3_js_1.Connection(BASE_RPC, 'confirmed');
        this.routerConnection = new ephemeral_rollups_sdk_1.ConnectionMagicRouter(ROUTER_RPC, 'confirmed');
        this.instructionCoder = new anchor_1.BorshInstructionCoder(TankMovementIdl_1.TANK_MOVEMENT_IDL);
        this.session = null;
        this.tankPda = null;
        this.erConnection = null;
        this.sequence = 0;
        this.lastLocalX = 0;
        this.lastLocalY = 0;
        this.lastSendAt = 0;
        this.sending = false;
        this.currentLevelNumber = 1;
        this.watchTarget = null;
        this.watchDisplayX = null;
        this.watchDisplayY = null;
        this.watchFetchAt = 0;
        this.watchFetching = false;
        this.watchSubscription = null;
        this.statusElement = null;
        this.fail = (error) => {
            this.state = SyncState.Failed;
            this.showConnectionError();
            this.log.error('Movement setup failed.', error);
        };
        this.handleMovementError = (error) => {
            this.sending = false;
            this.log.warn('Movement update failed; local gameplay continues.', error);
        };
        this.handleWatchError = (error) => {
            this.watchFetching = false;
            this.log.warn('Second-screen update failed; retrying.', error);
        };
        this.matchSync = new MagicBlockMatchSync_1.MagicBlockMatchSync();
        this.localServerMatchSync = new local_1.LocalServerMatchSync();
        const params = new URLSearchParams(window.location.search);
        this.watchTankPda = this.parseWatchTankPda(params.get('watch'));
        this.enabled =
            !this.matchSync.isEnabled() &&
                !this.localServerMatchSync.isEnabled() &&
                (params.get('magicblock') === '1' || this.watchTankPda !== null);
        this.state = this.enabled ? SyncState.Idle : SyncState.Disabled;
        if (this.enabled) {
            this.showStatus(this.watchTankPda === null
                ? 'MagicBlock waiting for match'
                : 'Second screen connecting...');
        }
    }
    update(tank, deltaTime = 1 / 60, levelNumber = 1) {
        if (tank === null ||
            tank === undefined ||
            this.state === SyncState.Disabled ||
            this.state === SyncState.Failed ||
            tank.partyIndex !== 0) {
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
        if (this.state !== SyncState.Ready ||
            this.sending ||
            Date.now() - this.lastSendAt < SEND_INTERVAL_MS) {
            return;
        }
        void this.sendSettledMovement(tank).catch(this.handleMovementError);
    }
    isEnabled() {
        return this.enabled;
    }
    isWatching() {
        return this.watchTankPda !== null;
    }
    isOnlineMatch() {
        return this.matchSync.isEnabled() || this.localServerMatchSync.isEnabled();
    }
    isObserverMatch() {
        return this.matchSync.isObserver();
    }
    isLocalServerMatch() {
        return this.localServerMatchSync.isEnabled();
    }
    isLocalServerMatchWaitingForStart() {
        return this.localServerMatchSync.isWaitingForStart();
    }
    getLocalPlayerIndex() {
        if (this.localServerMatchSync.isEnabled()) {
            return this.localServerMatchSync.getLocalPlayerIndex();
        }
        return this.matchSync.getLocalPlayerIndex();
    }
    isRemoteTank(partyIndex) {
        if (this.localServerMatchSync.isEnabled()) {
            return this.localServerMatchSync.isRemoteTank(partyIndex);
        }
        return this.matchSync.isRemoteTank(partyIndex);
    }
    recordLocalFire(tank) {
        if (this.matchSync.isObserver()) {
            return;
        }
        if (this.localServerMatchSync.isEnabled()) {
            this.localServerMatchSync.recordLocalFire();
            return;
        }
        this.matchSync.recordLocalFire(tank);
    }
    recordBoardCellDestroyed(centerX, centerY) {
        if (this.matchSync.isObserver()) {
            return;
        }
        if (this.localServerMatchSync.isEnabled()) {
            return;
        }
        this.matchSync.recordBoardCellDestroyed(centerX, centerY);
    }
    drainRemoteBoardMutations() {
        if (this.localServerMatchSync.isEnabled()) {
            return this.localServerMatchSync.drainRemoteBoardMutations();
        }
        return this.matchSync.drainRemoteBoardMutations();
    }
    drainLocalMatchEvents() {
        return this.localServerMatchSync.drainMatchEvents();
    }
    getLocalPowerup() {
        return this.localServerMatchSync.getPowerup();
    }
    setPlayerMirrorBulletsSuppressed(suppressed) {
        this.matchSync.setPlayerMirrorBulletsSuppressed(suppressed);
    }
    updateMatch(tanks, deltaTime, levelNumber, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, enemyTiers, enemyDrops, basePosition, terrainRegions) {
        if (this.localServerMatchSync.isEnabled()) {
            this.localServerMatchSync.update(tanks, deltaTime, levelNumber, fieldWidth, fieldHeight, enemySpawns, enemyTiers, enemyDrops, basePosition, terrainRegions);
            return;
        }
        this.matchSync.update(tanks, deltaTime, levelNumber, fieldWidth, fieldHeight, enemySpawns, enemySpeedClasses, basePosition, terrainRegions);
    }
    updateEnemies(tanks, playerTanks, basePosition, deltaTime) {
        if (this.localServerMatchSync.isEnabled()) {
            this.localServerMatchSync.applyEnemyState(tanks, deltaTime);
            return;
        }
        this.matchSync.applyEnemyState(tanks, playerTanks, basePosition, deltaTime);
    }
    getActiveEnemyIds() {
        if (this.localServerMatchSync.isEnabled()) {
            return this.localServerMatchSync.getActiveEnemyIds();
        }
        return this.matchSync.getActiveEnemyIds();
    }
    async start() {
        const provider = (0, wallet_1.getPhantomProvider)();
        if (provider === null) {
            throw new Error('Phantom is required for MagicBlock movement.');
        }
        const wallet = await provider.connect();
        const walletPublicKey = new web3_js_1.PublicKey(wallet.publicKey.toString());
        this.session = this.loadOrCreateSession();
        [this.tankPda] = await web3_js_1.PublicKey.findProgramAddress([buffer_1.Buffer.from('tank'), this.session.publicKey.toBuffer()], PROGRAM_ID);
        let accountInfo = await this.baseConnection.getAccountInfo(this.tankPda);
        if (accountInfo === null) {
            await this.fundSession(walletPublicKey);
            await this.initializeTank();
            accountInfo = await this.baseConnection.getAccountInfo(this.tankPda);
        }
        if (accountInfo?.owner.equals(PROGRAM_ID)) {
            await this.delegateTank();
        }
        else if (accountInfo !== null &&
            !accountInfo.owner.equals(ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID)) {
            throw new Error('Tank PDA has an unexpected owner.');
        }
        const delegation = await this.waitForDelegation();
        if (!delegation.fqdn) {
            throw new Error('MagicBlock router did not return an ER endpoint.');
        }
        this.erConnection = new web3_js_1.Connection(delegation.fqdn, 'confirmed');
        const tankState = await this.alignTankState(await this.fetchTankState(this.erConnection));
        this.sequence = tankState.sequence;
        this.state = SyncState.Ready;
        this.showShareControl(this.tankPda);
        this.log.info(`Movement ready on ${delegation.fqdn}; tank ${this.tankPda.toBase58()}`);
    }
    updateWatcher(tank, deltaTime) {
        if (this.state === SyncState.Idle) {
            this.state = SyncState.Starting;
            this.tankPda = this.watchTankPda;
            void this.startWatcher().catch(this.fail);
            return;
        }
        if (this.state !== SyncState.Ready || this.watchTarget === null) {
            return;
        }
        if (!this.watchFetching &&
            Date.now() - this.watchFetchAt >= WATCH_FALLBACK_INTERVAL_MS) {
            void this.refreshWatchTarget().catch(this.handleWatchError);
        }
        const targetX = this.fromChainUnits(this.watchTarget.x);
        const targetY = this.fromChainUnits(this.watchTarget.y);
        const alpha = 1 - Math.exp(-WATCH_INTERPOLATION_SPEED * deltaTime);
        const distance = this.watchDisplayX === null || this.watchDisplayY === null
            ? Infinity
            : Math.hypot(targetX - this.watchDisplayX, targetY - this.watchDisplayY);
        if (distance > PIXELS_PER_TILE * 4) {
            this.watchDisplayX = targetX;
            this.watchDisplayY = targetY;
        }
        else {
            this.watchDisplayX += (targetX - this.watchDisplayX) * alpha;
            this.watchDisplayY += (targetY - this.watchDisplayY) * alpha;
        }
        tank.position.set(this.watchDisplayX, this.watchDisplayY);
        tank.rotation = this.toGameRotation(this.watchTarget.direction);
        tank.updateMatrix(true);
        tank.collider.update();
    }
    async startWatcher() {
        const delegation = await this.waitForDelegation();
        if (!delegation.fqdn) {
            throw new Error('MagicBlock router did not return an ER endpoint.');
        }
        this.erConnection = new web3_js_1.Connection(delegation.fqdn, 'confirmed');
        this.watchTarget = await this.fetchTankState(this.erConnection);
        this.watchFetchAt = Date.now();
        this.watchSubscription = this.erConnection.onAccountChange(this.tankPda, (account) => {
            try {
                this.watchTarget = this.decodeTankState(account.data);
                this.watchFetchAt = Date.now();
            }
            catch (error) {
                this.handleWatchError(error);
            }
        }, 'confirmed');
        this.state = SyncState.Ready;
        this.showStatus('Second screen live');
        this.log.info(`Watching tank ${this.tankPda.toBase58()} on ${delegation.fqdn}`);
    }
    async refreshWatchTarget() {
        this.watchFetching = true;
        this.watchFetchAt = Date.now();
        try {
            this.watchTarget = await this.fetchTankState(this.erConnection);
        }
        finally {
            this.watchFetching = false;
        }
    }
    async alignTankState(initialState) {
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
    async fundSession(walletPublicKey) {
        const currentBalance = await this.baseConnection.getBalance(this.session.publicKey, 'confirmed');
        if (currentBalance >= SESSION_TARGET_BALANCE) {
            return;
        }
        const provider = (0, wallet_1.getPhantomProvider)();
        if (provider === null) {
            throw new Error('Phantom disconnected before session funding.');
        }
        const latest = await this.baseConnection.getLatestBlockhash('confirmed');
        const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: this.session.publicKey,
            lamports: SESSION_TARGET_BALANCE - currentBalance,
        }));
        transaction.feePayer = walletPublicKey;
        transaction.recentBlockhash = latest.blockhash;
        transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
        const signed = await provider.signTransaction(transaction);
        const signature = await this.baseConnection.sendRawTransaction(signed.serialize());
        await this.baseConnection.confirmTransaction({ signature, ...latest }, 'confirmed');
    }
    async initializeTank() {
        const data = this.instructionCoder.encode('initializeTank', {
            x: this.toChainUnits(this.lastLocalX),
            y: this.toChainUnits(this.lastLocalY),
        });
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: this.tankPda, isSigner: false, isWritable: true },
                {
                    pubkey: web3_js_1.SystemProgram.programId,
                    isSigner: false,
                    isWritable: false,
                },
            ],
            data,
        }), false);
    }
    async delegateTank() {
        const buffer = (0, ephemeral_rollups_sdk_1.delegateBufferPdaFromDelegatedAccountAndOwnerProgram)(this.tankPda, PROGRAM_ID);
        const delegationRecord = (0, ephemeral_rollups_sdk_1.delegationRecordPdaFromDelegatedAccount)(this.tankPda);
        const delegationMetadata = (0, ephemeral_rollups_sdk_1.delegationMetadataPdaFromDelegatedAccount)(this.tankPda);
        await this.sendWithSession(this.baseConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: true },
                { pubkey: buffer, isSigner: false, isWritable: true },
                { pubkey: delegationRecord, isSigner: false, isWritable: true },
                { pubkey: delegationMetadata, isSigner: false, isWritable: true },
                { pubkey: this.tankPda, isSigner: false, isWritable: true },
                { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
                {
                    pubkey: ephemeral_rollups_sdk_1.DELEGATION_PROGRAM_ID,
                    isSigner: false,
                    isWritable: false,
                },
                {
                    pubkey: web3_js_1.SystemProgram.programId,
                    isSigner: false,
                    isWritable: false,
                },
            ],
            data: this.instructionCoder.encode('delegateTank', {}),
        }), false);
    }
    async sendSettledMovement(tank) {
        const deltaX = tank.position.x - this.lastLocalX;
        const deltaY = tank.position.y - this.lastLocalY;
        if (Math.abs(deltaX) < 1 / UNITS_PER_PIXEL &&
            Math.abs(deltaY) < 1 / UNITS_PER_PIXEL) {
            return;
        }
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
        const axisDelta = horizontal ? deltaX : deltaY;
        const distance = Math.min(MAX_MOVE_UNITS, Math.max(1, Math.round(Math.abs(axisDelta) * UNITS_PER_PIXEL)));
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
        }
        else {
            this.lastLocalY += Math.sign(axisDelta) * consumedPixels;
        }
        this.sequence = nextSequence;
        this.sending = false;
    }
    async sendChainMovement(direction, distance, sequence) {
        await this.sendWithSession(this.erConnection, new web3_js_1.TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: this.session.publicKey, isSigner: true, isWritable: false },
                { pubkey: this.tankPda, isSigner: false, isWritable: true },
            ],
            data: this.instructionCoder.encode('moveTank', {
                direction: this.toAnchorDirection(direction),
                distance,
                sequence: new anchor_1.BN(sequence),
            }),
        }), true);
    }
    async sendWithSession(connection, instruction, skipPreflight) {
        const latest = await connection.getLatestBlockhash('confirmed');
        const transaction = new web3_js_1.Transaction().add(instruction);
        transaction.feePayer = this.session.publicKey;
        transaction.recentBlockhash = latest.blockhash;
        transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
        transaction.sign(this.session);
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight,
        });
        const confirmation = await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
        if (confirmation.value.err !== null) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        return signature;
    }
    async waitForDelegation() {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }
            const status = await this.getDelegationStatus();
            if (status.isDelegated) {
                return status;
            }
        }
        throw new Error('Timed out waiting for MagicBlock delegation.');
    }
    async getDelegationStatus() {
        return (await this.routerConnection.getDelegationStatus(this.tankPda));
    }
    async fetchTankState(connection) {
        const account = await connection.getAccountInfo(this.tankPda, 'confirmed');
        if (account === null) {
            throw new Error('Tank state is unavailable on the ER.');
        }
        return this.decodeTankState(account.data);
    }
    decodeTankState(data) {
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
    parseWatchTankPda(value) {
        if (value === null) {
            return null;
        }
        try {
            return new web3_js_1.PublicKey(value);
        }
        catch {
            this.log.warn('Ignoring invalid MagicBlock watch account.');
            return null;
        }
    }
    showShareControl(tankPda) {
        const url = new URL(window.location.href);
        url.searchParams.set('magicblock', '1');
        url.searchParams.set('watch', tankPda.toBase58());
        url.searchParams.set('level', this.currentLevelNumber.toString());
        const button = this.ensureStatusElement('button');
        button.type = 'button';
        button.textContent = 'Copy second-screen link';
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(url.toString());
                button.textContent = 'Link copied';
                window.setTimeout(() => {
                    button.textContent = 'Copy second-screen link';
                }, 2000);
            }
            catch {
                button.textContent = 'Copy failed - open DevTools';
            }
        };
        this.log.info(`Second-screen link: ${url.toString()}`);
    }
    showStatus(message) {
        const element = this.ensureStatusElement('div');
        element.textContent = message;
    }
    showConnectionError() {
        const button = this.ensureStatusElement('button');
        button.type = 'button';
        button.textContent = 'Connection failed - retry';
        button.onclick = () => window.location.reload();
    }
    ensureStatusElement(tagName) {
        if (this.statusElement !== null &&
            this.statusElement.tagName.toLowerCase() === tagName) {
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
    toGameRotation(direction) {
        switch (direction) {
            case 0:
                return game_1.Rotation.Up;
            case 1:
                return game_1.Rotation.Right;
            case 2:
                return game_1.Rotation.Down;
            case 3:
                return game_1.Rotation.Left;
            default:
                return game_1.Rotation.Up;
        }
    }
    fromChainUnits(value) {
        return value / UNITS_PER_PIXEL;
    }
    loadOrCreateSession() {
        const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored !== null) {
            try {
                return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
            }
            catch {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
        const session = web3_js_1.Keypair.generate();
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(Array.from(session.secretKey)));
        return session;
    }
    toAnchorDirection(direction) {
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
    toChainUnits(value) {
        return Math.round(value * UNITS_PER_PIXEL);
    }
}
exports.MagicBlockMovementSync = MagicBlockMovementSync;
