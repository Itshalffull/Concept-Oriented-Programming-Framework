// ============================================================
// Registry Tests
//
// Validates the Registry concept handler — concept registration,
// deregistration, duplicate detection, and heartbeat.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';

// ============================================================
// Registry Concept
// ============================================================

describe('Registry Concept', () => {
  it('registers and queries concepts', async () => {
    const storage = createInMemoryStorage();

    const result = await registryHandler.register({
      uri: 'urn:app/Password',
      transport: { type: 'in-process' },
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.concept).toBeTruthy();
  });

  it('rejects duplicate URI registration', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/User',
      transport: { type: 'in-process' },
    }, storage);

    const dup = await registryHandler.register({
      uri: 'urn:app/User',
      transport: { type: 'in-process' },
    }, storage);

    expect(dup.variant).toBe('error');
    expect(dup.message).toContain('already registered');
  });

  it('heartbeat returns availability', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/Echo',
      transport: { type: 'in-process' },
    }, storage);

    const hb = await registryHandler.heartbeat({ uri: 'urn:app/Echo' }, storage);
    expect(hb.variant).toBe('ok');
    expect(hb.available).toBe(true);

    const unknown = await registryHandler.heartbeat({ uri: 'urn:app/Unknown' }, storage);
    expect(unknown.variant).toBe('ok');
    expect(unknown.available).toBe(false);
  });

  it('deregisters concepts', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/JWT',
      transport: { type: 'in-process' },
    }, storage);

    const dereg = await registryHandler.deregister({ uri: 'urn:app/JWT' }, storage);
    expect(dereg.variant).toBe('ok');

    // Should be able to re-register
    const reReg = await registryHandler.register({
      uri: 'urn:app/JWT',
      transport: { type: 'in-process' },
    }, storage);
    expect(reReg.variant).toBe('ok');
  });
});
