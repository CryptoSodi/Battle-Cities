import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

import {
  WebRtcGhostSignalKind,
  WebRtcGhostSignalTransport,
} from '../webrtc';

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);
const SIGNAL_CHUNK_SIZE = 500;
const POLL_INTERVAL_MS = 1000;

interface SignalChunkMemo {
  type: 'battlecity-ghost-signal-chunk';
  version: 1;
  room: string;
  kind: WebRtcGhostSignalKind;
  signalId: string;
  fromPlayerIndex: number;
  chunkIndex: number;
  chunkCount: number;
  data: string;
}

type SignalCallback = (
  code: string,
  kind: WebRtcGhostSignalKind,
) => void;

interface PendingSignalChunks {
  kind: WebRtcGhostSignalKind;
  chunkCount: number;
  chunks: string[];
}

export class MagicBlockGhostSignalTransport
  implements WebRtcGhostSignalTransport {
  private readonly callbacks = new Set<SignalCallback>();
  private readonly seenSignatures = new Set<string>();
  private readonly pendingSignals = new Map<string, PendingSignalChunks>();
  private pollTimer: number = null;
  private polling = false;

  constructor(
    private readonly connection: Connection,
    private readonly session: Keypair,
    private readonly remoteAuthority: PublicKey,
    private readonly room: string,
    private readonly localPlayerIndex: number,
  ) {}

  public subscribe(callback: SignalCallback): () => void {
    this.callbacks.add(callback);
    this.startPolling();

    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.stopPolling();
      }
    };
  }

  public async publishSignal(
    code: string,
    kind: WebRtcGhostSignalKind,
  ): Promise<void> {
    const signalId = this.createSignalId(kind);
    const chunks = this.chunkString(code);

    for (let index = 0; index < chunks.length; index += 1) {
      await this.sendMemo({
        type: 'battlecity-ghost-signal-chunk',
        version: 1,
        room: this.room,
        kind,
        signalId,
        fromPlayerIndex: this.localPlayerIndex,
        chunkIndex: index,
        chunkCount: chunks.length,
        data: chunks[index],
      });
    }
  }

  private startPolling(): void {
    if (this.pollTimer !== null) {
      return;
    }

    this.pollRemoteSignals();
    this.pollTimer = window.setInterval(() => {
      this.pollRemoteSignals();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) {
      return;
    }

    window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollRemoteSignals(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.remoteAuthority,
        { limit: 40 },
        'confirmed',
      );
      for (const item of signatures.reverse()) {
        if (this.seenSignatures.has(item.signature)) {
          continue;
        }
        this.seenSignatures.add(item.signature);
        await this.readSignalTransaction(item.signature);
      }
    } catch (error) {
      console.warn('[webrtc-ghost] MagicBlock signal poll failed', error);
    } finally {
      this.polling = false;
    }
  }

  private async readSignalTransaction(signature: string): Promise<void> {
    const transaction = await this.connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    const instructions = transaction?.transaction.message.instructions ?? [];

    instructions.forEach((instruction) => {
      const parsed = (instruction as any).parsed;
      const memo =
        typeof parsed === 'string'
          ? parsed
          : typeof parsed?.info === 'string'
            ? parsed.info
            : null;
      if (memo === null) {
        return;
      }

      this.acceptMemo(memo);
    });
  }

  private acceptMemo(memoText: string): void {
    let memo: SignalChunkMemo;
    try {
      memo = JSON.parse(memoText) as SignalChunkMemo;
    } catch {
      return;
    }

    if (
      memo?.type !== 'battlecity-ghost-signal-chunk' ||
      memo.version !== 1 ||
      memo.room !== this.room ||
      memo.fromPlayerIndex === this.localPlayerIndex ||
      memo.chunkIndex < 0 ||
      memo.chunkIndex >= memo.chunkCount
    ) {
      return;
    }

    const pending =
      this.pendingSignals.get(memo.signalId) ??
      {
        kind: memo.kind,
        chunkCount: memo.chunkCount,
        chunks: Array.from({ length: memo.chunkCount }, () => ''),
      };
    pending.chunks[memo.chunkIndex] = memo.data;
    this.pendingSignals.set(memo.signalId, pending);

    if (pending.chunks.some((chunk) => chunk === '')) {
      return;
    }

    this.pendingSignals.delete(memo.signalId);
    const code = pending.chunks.join('');
    this.callbacks.forEach((callback) => callback(code, pending.kind));
  }

  private async sendMemo(memo: SignalChunkMemo): Promise<void> {
    const latest = await this.connection.getLatestBlockhash('processed');
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [{ pubkey: this.session.publicKey, isSigner: true, isWritable: false }],
        data: Buffer.from(JSON.stringify(memo), 'utf8'),
      }),
    );

    transaction.feePayer = this.session.publicKey;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.sign(this.session);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: true },
    );
    await this.connection.confirmTransaction(
      { signature, ...latest },
      'processed',
    );
  }

  private chunkString(value: string): string[] {
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += SIGNAL_CHUNK_SIZE) {
      chunks.push(value.slice(index, index + SIGNAL_CHUNK_SIZE));
    }
    return chunks.length === 0 ? [''] : chunks;
  }

  private createSignalId(kind: WebRtcGhostSignalKind): string {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return `${this.room}-${this.localPlayerIndex}-${kind}-${Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }
}
