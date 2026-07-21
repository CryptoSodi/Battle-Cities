import { Transaction } from '@solana/web3.js';

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

export function getPhantomProvider(): PhantomProvider | null {
  const phantomWindow = window as PhantomWindow;
  const provider = phantomWindow.phantom?.solana || phantomWindow.solana;

  return provider?.isPhantom === true ? provider : null;
}
