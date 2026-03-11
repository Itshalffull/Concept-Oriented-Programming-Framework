import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSeeded, getKernel } from '../clef-base/lib/kernel.js';

describe('clef-base auth to ui-app transport sync', () => {
  beforeEach(async () => {
    const kernel = getKernel();
    await ensureSeeded();
    await kernel.invokeConcept('urn:clef/Transport', 'configure', {
      transport: 'clef-base-transport',
      kind: 'rest',
      baseUrl: '/api/invoke',
    });
    await kernel.invokeConcept('urn:clef/Transport', 'clearAuth', {
      transport: 'clef-base-transport',
    });
  });

  it('copies a created session token into the ui-app transport auth state', async () => {
    const kernel = getKernel();
    const sessionId = `test-session-${Date.now()}`;

    const result = await kernel.invokeConcept('urn:clef/Session', 'create', {
      session: sessionId,
      userId: 'admin',
      device: 'browser',
    });

    expect(result.variant).toBe('ok');

    const transports = await kernel.queryConcept('urn:clef/Transport', 'transport');
    const record = transports.find((entry) => entry._key === 'clef-base-transport');
    expect(record).toBeDefined();
    expect(record?.auth).toBe(result.token);
  });

  it('clears transport auth when a session is destroyed', async () => {
    const kernel = getKernel();
    const sessionId = `test-session-destroy-${Date.now()}`;

    const created = await kernel.invokeConcept('urn:clef/Session', 'create', {
      session: sessionId,
      userId: 'admin',
      device: 'browser',
    });
    expect(created.variant).toBe('ok');

    await kernel.invokeConcept('urn:clef/Session', 'destroy', {
      session: sessionId,
    });

    const transports = await kernel.queryConcept('urn:clef/Transport', 'transport');
    const record = transports.find((entry) => entry._key === 'clef-base-transport');
    expect(record?.auth).toBe('');
  });
});
