// ============================================================
// Schema Migration Tests
//
// Tests for:
// 1. Parser: @version(N) annotation parsing
// 2. Migration module: version checking, gated transport
// 3. Kernel: registerVersionedConcept, getMigrationStatus
// 4. End-to-end: version bump, block, migrate, resume
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createKernel,
  createInMemoryStorage,
  createInProcessAdapter,
  createConceptRegistry,
  parseConceptFile,
  checkMigrationNeeded,
  createMigrationGatedTransport,
  getStoredVersion,
  setStoredVersion,
} from '@copf/kernel';
import type { ConceptHandler, ConceptStorage, ActionInvocation } from '@copf/kernel';
import { generateId, timestamp } from '../kernel/src/types';

// --- Helper: create a simple handler with a migrate action ---

function createVersionedHandler(): ConceptHandler {
  return {
    async register(input: Record<string, unknown>, storage: ConceptStorage) {
      const user = input.user as string;
      await storage.put('users', user, { user, name: input.name });
      return { variant: 'ok', user };
    },

    async migrate(input: Record<string, unknown>, storage: ConceptStorage) {
      const fromVersion = input.fromVersion as number;
      const toVersion = input.toVersion as number;

      if (fromVersion < 0) {
        return { variant: 'error', message: 'Invalid fromVersion' };
      }

      // Simulate migration: count existing entries
      const entries = await storage.find('users');
      return { variant: 'ok', migratedEntries: entries.length };
    },

    async getUser(input: Record<string, unknown>, storage: ConceptStorage) {
      const user = await storage.get('users', input.user as string);
      if (!user) return { variant: 'notFound' };
      return { variant: 'ok', ...user };
    },
  };
}

// --- 1. Parser: @version(N) Annotation Tests ---

describe('Parser @version(N)', () => {
  it('parses @version annotation inside concept body', () => {
    const source = `
concept User [U] {
  @version(3)

  purpose { Manage user accounts. }

  state {
    users: set U
  }

  actions {
    action register(user: U, name: String) {
      -> ok(user: U)
    }
  }
}`;

    const ast = parseConceptFile(source);
    expect(ast.name).toBe('User');
    expect(ast.version).toBe(3);
    expect(ast.state).toHaveLength(1);
    expect(ast.actions).toHaveLength(1);
  });

  it('parses @version(1) as the minimum version', () => {
    const source = `
concept Simple {
  @version(1)
  state { items: set String }
  actions {
    action add(item: String) {
      -> ok()
    }
  }
}`;

    const ast = parseConceptFile(source);
    expect(ast.version).toBe(1);
  });

  it('parses concept without @version (unversioned)', () => {
    const source = `
concept Unversioned {
  state { data: String }
  actions {
    action get() {
      -> ok(data: String)
    }
  }
}`;

    const ast = parseConceptFile(source);
    expect(ast.version).toBeUndefined();
  });

  it('parses @version with large version number', () => {
    const source = `
concept Legacy {
  @version(42)
  state { count: Int }
  actions {
    action inc() {
      -> ok(count: Int)
    }
  }
}`;

    const ast = parseConceptFile(source);
    expect(ast.version).toBe(42);
  });

  it('throws on unknown annotation', () => {
    const source = `
concept Bad {
  @unknown(1)
  state { data: String }
  actions {
    action get() {
      -> ok(data: String)
    }
  }
}`;

    expect(() => parseConceptFile(source)).toThrow(/unknown annotation @unknown/);
  });

  it('parses @version before purpose section', () => {
    const source = `
concept WithPurpose {
  @version(5)
  purpose { Some purpose here. }
  state { x: Int }
  actions {
    action set(x: Int) {
      -> ok()
    }
  }
}`;

    const ast = parseConceptFile(source);
    expect(ast.version).toBe(5);
    expect(ast.purpose).toBe('Some purpose here');
  });
});

// --- 2. Migration Module Tests ---

describe('Migration Module', () => {
  describe('getStoredVersion / setStoredVersion', () => {
    it('returns undefined for fresh storage', async () => {
      const storage = createInMemoryStorage();
      const version = await getStoredVersion(storage);
      expect(version).toBeUndefined();
    });

    it('reads back a stored version', async () => {
      const storage = createInMemoryStorage();
      await setStoredVersion(storage, 3);
      const version = await getStoredVersion(storage);
      expect(version).toBe(3);
    });

    it('overwrites a stored version', async () => {
      const storage = createInMemoryStorage();
      await setStoredVersion(storage, 1);
      await setStoredVersion(storage, 5);
      const version = await getStoredVersion(storage);
      expect(version).toBe(5);
    });
  });

  describe('checkMigrationNeeded', () => {
    it('returns null for unversioned concept', async () => {
      const storage = createInMemoryStorage();
      const result = await checkMigrationNeeded(undefined, storage);
      expect(result).toBeNull();
    });

    it('initializes fresh storage and returns null', async () => {
      const storage = createInMemoryStorage();
      const result = await checkMigrationNeeded(3, storage);
      expect(result).toBeNull();
      // Should have set the version
      const stored = await getStoredVersion(storage);
      expect(stored).toBe(3);
    });

    it('returns null when stored version matches spec', async () => {
      const storage = createInMemoryStorage();
      await setStoredVersion(storage, 3);
      const result = await checkMigrationNeeded(3, storage);
      expect(result).toBeNull();
    });

    it('returns null when stored version exceeds spec', async () => {
      const storage = createInMemoryStorage();
      await setStoredVersion(storage, 5);
      const result = await checkMigrationNeeded(3, storage);
      expect(result).toBeNull();
    });

    it('returns migration info when stored version is lower', async () => {
      const storage = createInMemoryStorage();
      await setStoredVersion(storage, 1);
      const result = await checkMigrationNeeded(3, storage);
      expect(result).not.toBeNull();
      expect(result!.currentVersion).toBe(1);
      expect(result!.requiredVersion).toBe(3);
    });
  });

  describe('createMigrationGatedTransport', () => {
    let handler: ConceptHandler;
    let storage: ConceptStorage;

    beforeEach(() => {
      handler = createVersionedHandler();
      storage = createInMemoryStorage();
    });

    it('blocks non-migrate actions with needsMigration', async () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      const invocation: ActionInvocation = {
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'register',
        input: { user: 'u-1', name: 'alice' },
        flow: generateId(),
        timestamp: timestamp(),
      };

      const result = await gated.invoke(invocation);
      expect(result.variant).toBe('needsMigration');
      expect(result.output.currentVersion).toBe(1);
      expect(result.output.requiredVersion).toBe(3);
    });

    it('allows migrate action through', async () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      const invocation: ActionInvocation = {
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'migrate',
        input: { fromVersion: 1, toVersion: 3 },
        flow: generateId(),
        timestamp: timestamp(),
      };

      const result = await gated.invoke(invocation);
      expect(result.variant).toBe('ok');
    });

    it('lifts gate after successful migration', async () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      // First: migrate
      const migrateInvocation: ActionInvocation = {
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'migrate',
        input: { fromVersion: 1, toVersion: 3 },
        flow: generateId(),
        timestamp: timestamp(),
      };
      await gated.invoke(migrateInvocation);

      // Now: regular action should work
      const registerInvocation: ActionInvocation = {
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'register',
        input: { user: 'u-1', name: 'alice' },
        flow: generateId(),
        timestamp: timestamp(),
      };

      const result = await gated.invoke(registerInvocation);
      expect(result.variant).toBe('ok');
      expect(result.output.user).toBe('u-1');
    });

    it('updates stored version after successful migration', async () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      await gated.invoke({
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'migrate',
        input: { fromVersion: 1, toVersion: 3 },
        flow: generateId(),
        timestamp: timestamp(),
      });

      const stored = await getStoredVersion(storage);
      expect(stored).toBe(3);
    });

    it('keeps gate active if migration returns non-ok variant', async () => {
      // Handler returns error for negative fromVersion
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, -1, 3);

      await gated.invoke({
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'migrate',
        input: { fromVersion: -1, toVersion: 3 },
        flow: generateId(),
        timestamp: timestamp(),
      });

      // Gate should still be active
      expect(gated.isMigrationRequired()).toBe(true);

      const result = await gated.invoke({
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'register',
        input: { user: 'u-1', name: 'alice' },
        flow: generateId(),
        timestamp: timestamp(),
      });

      expect(result.variant).toBe('needsMigration');
    });

    it('reports migration status via isMigrationRequired()', async () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      expect(gated.isMigrationRequired()).toBe(true);

      await gated.invoke({
        id: generateId(),
        concept: 'urn:copf/User',
        action: 'migrate',
        input: { fromVersion: 1, toVersion: 3 },
        flow: generateId(),
        timestamp: timestamp(),
      });

      expect(gated.isMigrationRequired()).toBe(false);
    });

    it('reports version info via getVersionInfo()', () => {
      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      const info = gated.getVersionInfo();
      expect(info.current).toBe(1);
      expect(info.required).toBe(3);
    });

    it('allows queries even during migration-required state', async () => {
      // Pre-populate some data
      await storage.put('users', 'u-1', { user: 'u-1', name: 'alice' });

      const inner = createInProcessAdapter(handler, storage);
      const gated = createMigrationGatedTransport(inner, storage, 1, 3);

      // Query should work even when gated
      const results = await gated.query({ relation: 'users' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('alice');
    });
  });
});

// --- 3. Kernel Integration Tests ---

describe('Kernel registerVersionedConcept', () => {
  it('registers versioned concept without migration on fresh storage', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    const status = await kernel.registerVersionedConcept(
      'urn:copf/User',
      handler,
      3,
    );

    // Fresh storage → version set, no migration needed
    expect(status).toBeNull();
  });

  it('versioned concept works normally after fresh registration', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    await kernel.registerVersionedConcept('urn:copf/User', handler, 3);

    const result = await kernel.invokeConcept('urn:copf/User', 'register', {
      user: 'u-1',
      name: 'alice',
    });

    expect(result.variant).toBe('ok');
    expect(result.user).toBe('u-1');
  });

  it('returns null for unversioned concept', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    const status = await kernel.registerVersionedConcept(
      'urn:copf/User',
      handler,
      undefined,
    );

    expect(status).toBeNull();
  });

  it('getMigrationStatus returns versioned concept info', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    await kernel.registerVersionedConcept('urn:copf/User', handler, 3);
    await kernel.registerVersionedConcept('urn:copf/Item', handler, 1);

    const statuses = kernel.getMigrationStatus();
    expect(statuses).toHaveLength(2);

    const userStatus = statuses.find(s => s.uri === 'urn:copf/User');
    expect(userStatus).toBeDefined();
    expect(userStatus!.currentVersion).toBe(3);
    expect(userStatus!.requiredVersion).toBe(3);
    expect(userStatus!.migrationRequired).toBe(false);
  });

  it('getMigrationStatus excludes unversioned concepts', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    await kernel.registerVersionedConcept('urn:copf/User', handler, 3);
    await kernel.registerVersionedConcept('urn:copf/Other', handler, undefined);

    const statuses = kernel.getMigrationStatus();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].uri).toBe('urn:copf/User');
  });
});

// --- 4. End-to-End Migration Scenario ---

describe('End-to-End Migration', () => {
  it('blocks actions on version mismatch, resumes after migration', async () => {
    const handler = createVersionedHandler();
    const storage = createInMemoryStorage();

    // Simulate existing deployment at version 1
    await setStoredVersion(storage, 1);

    // Spec now requires version 3
    const specVersion = 3;
    const needed = await checkMigrationNeeded(specVersion, storage);
    expect(needed).not.toBeNull();
    expect(needed!.currentVersion).toBe(1);
    expect(needed!.requiredVersion).toBe(3);

    // Create gated transport
    const inner = createInProcessAdapter(handler, storage);
    const gated = createMigrationGatedTransport(
      inner,
      storage,
      needed!.currentVersion,
      needed!.requiredVersion,
    );

    // Step 1: Regular action is blocked
    const blocked = await gated.invoke({
      id: generateId(),
      concept: 'urn:copf/User',
      action: 'register',
      input: { user: 'u-1', name: 'alice' },
      flow: generateId(),
      timestamp: timestamp(),
    });
    expect(blocked.variant).toBe('needsMigration');

    // Step 2: Run migration
    const migrateResult = await gated.invoke({
      id: generateId(),
      concept: 'urn:copf/User',
      action: 'migrate',
      input: { fromVersion: 1, toVersion: 3 },
      flow: generateId(),
      timestamp: timestamp(),
    });
    expect(migrateResult.variant).toBe('ok');

    // Step 3: Regular action now works
    const resumed = await gated.invoke({
      id: generateId(),
      concept: 'urn:copf/User',
      action: 'register',
      input: { user: 'u-1', name: 'alice' },
      flow: generateId(),
      timestamp: timestamp(),
    });
    expect(resumed.variant).toBe('ok');
    expect(resumed.output.user).toBe('u-1');

    // Step 4: Stored version is updated
    const storedVersion = await getStoredVersion(storage);
    expect(storedVersion).toBe(3);
  });

  it('handles concept with migrate action in full kernel flow', async () => {
    const kernel = createKernel();
    const handler = createVersionedHandler();

    // Register as versioned (fresh storage → no migration)
    await kernel.registerVersionedConcept('urn:copf/User', handler, 2);

    // Register sync that fires on register
    kernel.registerSync({
      name: 'LogRegister',
      when: [{
        concept: 'urn:copf/User',
        action: 'register',
        inputFields: [{ name: 'user', match: { type: 'variable', name: 'u' } }],
        outputFields: [],
      }],
      where: [],
      then: [],
    });

    // Should work normally
    const result = await kernel.invokeConcept('urn:copf/User', 'register', {
      user: 'u-1',
      name: 'alice',
    });
    expect(result.variant).toBe('ok');
  });

  it('migration gated transport works within sync flow', async () => {
    const handler = createVersionedHandler();
    const storage = createInMemoryStorage();

    // Setup: version mismatch
    await setStoredVersion(storage, 1);
    const inner = createInProcessAdapter(handler, storage);
    const gated = createMigrationGatedTransport(inner, storage, 1, 2);

    // Register in a registry
    const registry = createConceptRegistry();
    registry.register('urn:copf/User', gated);

    // Resolve and invoke — should get needsMigration
    const transport = registry.resolve('urn:copf/User')!;
    const result = await transport.invoke({
      id: generateId(),
      concept: 'urn:copf/User',
      action: 'register',
      input: { user: 'u-1', name: 'alice' },
      flow: generateId(),
      timestamp: timestamp(),
    });

    expect(result.variant).toBe('needsMigration');
    expect(result.output.currentVersion).toBe(1);
    expect(result.output.requiredVersion).toBe(2);
  });
});
