// Conduit Web3 Integration — Wallet Auth + IPFS Articles Test

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { generateChallenge } from '../examples/conduit/web3/wallet-auth.js';
import { listContracts } from '../examples/conduit/web3/deploy-contracts.js';

describe('Conduit Web3 — Wallet Authentication', () => {
  it('generates unique challenge messages', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const c1 = generateChallenge(address);
    const c2 = generateChallenge(address);

    expect(c1).toContain(address);
    expect(c1).toContain('Sign this message');
    // Challenges should be unique (different nonces)
    expect(c1).not.toBe(c2);
  });

  it('challenge includes timestamp', () => {
    const challenge = generateChallenge('0xabc');
    expect(challenge).toContain('Timestamp:');
  });
});

describe('Conduit Web3 — Solidity Contract Management', () => {
  it('lists available contracts (empty before generation)', () => {
    const contracts = listContracts();
    // Before running generate-all.ts, the generated/solidity dir may not exist
    expect(Array.isArray(contracts)).toBe(true);
  });
});

describe('Conduit Web3 — File Structure', () => {
  const web3Dir = resolve(__dirname, '..', 'examples', 'conduit', 'web3');

  const files = [
    'wallet-auth.ts',
    'ipfs-articles.ts',
    'deploy-contracts.ts',
    'hardhat.config.ts',
  ];

  for (const file of files) {
    it(`${file} exists`, () => {
      expect(existsSync(resolve(web3Dir, file))).toBe(true);
    });
  }
});
