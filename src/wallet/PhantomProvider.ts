import { Transaction } from '@solana/web3.js';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (
    message: Uint8Array,
    display?: string,
  ) => Promise<{ signature: Uint8Array } | Uint8Array>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

type PhantomWindow = Window & {
  phantom?: { solana?: PhantomProvider };
  solana?: PhantomProvider;
};

interface NativeSolanaMobileWallet {
  connect: () => Promise<{ publicKey: string }>;
  signMessage: (options: {
    messageBase64: string;
  }) => Promise<{ signatureBase64: string }>;
  signTransaction: (options: {
    transactionBase64: string;
  }) => Promise<{ transactionBase64: string }>;
}

const nativeWallet = registerPlugin<NativeSolanaMobileWallet>(
  'SolanaMobileWallet',
);
let nativeProvider: PhantomProvider | null = null;

function getNativeSolanaProvider(): PhantomProvider | null {
  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  if (!isAndroidNative) {
    return null;
  }

  if (nativeProvider !== null) {
    return nativeProvider;
  }

  nativeProvider = {
    isPhantom: true,
    connect: async () => {
      const result = await nativeWallet.connect();
      const publicKey = toPublicKey(result.publicKey);
      nativeProvider.publicKey = publicKey;
      return { publicKey };
    },
    signMessage: async (message: Uint8Array) => {
      const result = await nativeWallet.signMessage({
        messageBase64: toBase64(message),
      });
      return { signature: fromBase64(result.signatureBase64) };
    },
    signTransaction: async (transaction: Transaction) => {
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const result = await nativeWallet.signTransaction({
        transactionBase64: toBase64(serialized),
      });
      return Transaction.from(fromBase64(result.transactionBase64));
    },
  };

  return nativeProvider;
}

function toPublicKey(value: string): { toString: () => string } {
  return { toString: () => value };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function getPhantomProvider(): PhantomProvider | null {
  const native = getNativeSolanaProvider();
  if (native !== null) {
    return native;
  }

  const phantomWindow = window as PhantomWindow;
  const provider = phantomWindow.phantom?.solana || phantomWindow.solana;

  return provider?.isPhantom === true ? provider : null;
}
