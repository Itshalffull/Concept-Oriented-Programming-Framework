// SolidityGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { solidityGenHandler } from './handler.js';
import type { SolidityGenStorage } from './types.js';

const createTestStorage = (): SolidityGenStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): SolidityGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = solidityGenHandler;

const validManifest = {
  name: 'token-transfer',
  operations: [
    {
      name: 'transfer',
      input: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'number' },
      ],
      output: [
        { variant: 'ok', fields: [{ name: 'txHash', type: 'string' }] },
      ],
    },
    {
      name: 'balance-of',
      input: [{ name: 'account', type: 'address' }],
      output: [{ variant: 'ok', fields: [{ name: 'balance', type: 'number' }] }],
    },
  ],
};

describe('SolidityGen handler', () => {
  describe('register', () => {
    it('should return generator registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('solidity-gen');
        expect(result.right.inputKind).toBe('concept-ast');
        expect(result.right.outputKind).toBe('solidity');
        expect(result.right.capabilities).toContain('contracts');
      }
    });
  });

  describe('generate', () => {
    it('should generate interface and implementation contracts', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'token-transfer-spec', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBe(2);
          const interfaceFile = result.right.files.find(f => f.path.includes('ITokenTransfer'));
          const implFile = result.right.files.find(f => f.path.includes('TokenTransfer.sol'));
          expect(interfaceFile).toBeDefined();
          expect(implFile).toBeDefined();
        }
      }
    });

    it('should include SPDX license and pragma in generated contracts', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'license-spec', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        for (const file of result.right.files) {
          expect(file.content).toContain('SPDX-License-Identifier: MIT');
          expect(file.content).toContain('pragma solidity ^0.8.0');
        }
      }
    });

    it('should map types correctly to Solidity types', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'type-mapper',
        operations: [
          {
            name: 'test-types',
            input: [
              { name: 'addr', type: 'address' },
              { name: 'count', type: 'number' },
              { name: 'label', type: 'string' },
              { name: 'flag', type: 'boolean' },
              { name: 'data', type: 'bytes' },
            ],
            output: [],
          },
        ],
      };
      const result = await handler.generate(
        { spec: 'type-spec', manifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const iface = result.right.files.find(f => f.path.includes('ITypeMapper'));
        expect(iface).toBeDefined();
        expect(iface!.content).toContain('address');
        expect(iface!.content).toContain('uint256');
        expect(iface!.content).toContain('bool');
        expect(iface!.content).toContain('bytes');
      }
    });

    it('should generate event declarations for each operation', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'event-spec', manifest: validManifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const iface = result.right.files.find(f => f.path.includes('ITokenTransfer'));
        expect(iface!.content).toContain('event TransferExecuted');
        expect(iface!.content).toContain('event BalanceOfExecuted');
      }
    });

    it('should return error for invalid manifest', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'bad-spec', manifest: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for manifest missing name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { spec: 'no-name', manifest: { operations: [] } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist generation record in storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { spec: 'persist-spec', manifest: validManifest },
        storage,
      )();
      const record = await storage.get('generated', 'persist-spec');
      expect(record).not.toBeNull();
      expect(record!['language']).toBe('solidity');
    });
  });
});
