// Conduit Example App — Web3 Wallet Authentication
// Alternative login via Ethereum wallet using the Web3 kit's Wallet concept
// and the wallet-auth sync.

import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { walletHandler } from '../../../handlers/ts/repertoire/web3/wallet.handler.js';
import { jwtHandler } from '../../../handlers/ts/app/jwt.handler.js';
import { userHandler } from '../../../handlers/ts/app/user.handler.js';
import type { ConceptStorage } from '../../../kernel/src/types.js';

export interface WalletAuthResult {
  variant: 'ok' | 'error';
  token?: string;
  address?: string;
  message?: string;
}

/**
 * Authenticate a user via Ethereum wallet signature.
 * Flow: connect wallet → sign challenge → verify signature → generate JWT
 */
export async function walletLogin(
  address: string,
  signature: string,
  message: string,
): Promise<WalletAuthResult> {
  const walletStorage = createInMemoryStorage();
  const userStorage = createInMemoryStorage();
  const jwtStorage = createInMemoryStorage();

  // Step 1: Verify the wallet signature
  const verifyResult = await walletHandler.verify(
    { address, signature, message },
    walletStorage,
  );

  if (verifyResult.variant !== 'ok') {
    return { variant: 'error', message: 'Invalid wallet signature' };
  }

  // Step 2: Look up or create user by wallet address
  const userId = `wallet:${address.toLowerCase()}`;
  const existingUser = await userStorage.get('user', userId);

  if (!existingUser) {
    // Auto-register wallet user
    const registerResult = await userHandler.register(
      { user: userId, name: address.slice(0, 8), email: `${address.toLowerCase()}@wallet.eth` },
      userStorage,
    );

    if (registerResult.variant !== 'ok') {
      return { variant: 'error', message: 'Failed to create wallet user' };
    }
  }

  // Step 3: Generate JWT for the wallet user
  const tokenResult = await jwtHandler.generate(
    { user: userId },
    jwtStorage,
  );

  if (tokenResult.variant !== 'ok') {
    return { variant: 'error', message: 'Failed to generate token' };
  }

  return {
    variant: 'ok',
    token: tokenResult.token as string,
    address,
  };
}

/**
 * Generate a challenge message for wallet signing.
 */
export function generateChallenge(address: string): string {
  const nonce = Math.random().toString(36).substring(2);
  const timestamp = new Date().toISOString();
  return `Sign this message to log in to Conduit:\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
}
