// ============================================================
// Distribution Tests
//
// Validates eventual sync queue, engine hierarchy, offline
// convergence, and sync annotation semantics.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
  createInProcessAdapter,
  createConceptRegistry,
} from '../kernel/src/index.js';
import { ActionLog, DistributedSyncEngine } from '../implementations/typescript/framework/sync-engine.impl.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import type {
  ConceptHandler,
  ActionCompletion,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';

// ============================================================
// 1. Eventual Sync Queue
// ============================================================

describe('Stage 6 — Eventual Sync Queue', () => {
  function makeCompletion(
    concept: string,
    action: string,
    output: Record<string, unknown>,
    flow?: string,
  ): ActionCompletion {
    return {
      id: generateId(),
      concept,
      action,
      input: {},
      variant: 'ok',
      output,
      flow: flow || generateId(),
      timestamp: timestamp(),
    };
  }

  it('eventual syncs queue when target concept unavailable', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'server');

    // Register a Password concept but NOT ServerProfile
    const passwordHandler: ConceptHandler = {
      async set(input, storage) {
        return { variant: 'ok', user: input.user };
      },
    };
    registry.register(
      'urn:copf/Password',
      createInProcessAdapter(passwordHandler, createInMemoryStorage()),
    );

    // Register an eventual sync that targets ServerProfile (unavailable)
    const syncSource = `
      sync ReplicatePassword [eventual]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ServerProfile/replicate: [ user: ?u ]
      }
    `;
    const syncs = parseSyncFile(syncSource);
    engine.registerSync(syncs[0]);

    // Fire completion — should queue since ServerProfile unavailable
    const completion = makeCompletion(
      'urn:copf/Password', 'set', { user: 'u-1' },
    );
    const invocations = await engine.onCompletion(completion);

    // No invocations produced (queued instead)
    expect(invocations).toHaveLength(0);

    // Pending queue has one entry
    const pending = engine.getPendingQueue();
    expect(pending).toHaveLength(1);
    expect(pending[0].sync.name).toBe('ReplicatePassword');
    expect(pending[0].binding.u).toBe('u-1');
  });

  it('eventual syncs fire when target becomes available', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'server');

    // Register Password but not ServerProfile
    registry.register(
      'urn:copf/Password',
      createInProcessAdapter(
        { async set(i) { return { variant: 'ok', user: i.user }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync ReplicatePassword [eventual]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ServerProfile/replicate: [ user: ?u ]
      }
    `);
    engine.registerSync(syncs[0]);

    // Fire completion — queued
    const completion = makeCompletion(
      'urn:copf/Password', 'set', { user: 'u-1' },
    );
    await engine.onCompletion(completion);
    expect(engine.getPendingQueue()).toHaveLength(1);

    // Now make ServerProfile available
    const profileHandler: ConceptHandler = {
      async replicate(input, storage) {
        await storage.put('synced', input.user as string, { user: input.user });
        return { variant: 'ok' };
      },
    };
    registry.register(
      'urn:copf/ServerProfile',
      createInProcessAdapter(profileHandler, createInMemoryStorage()),
    );

    // Notify availability change
    const invocations = await engine.onAvailabilityChange(
      'urn:copf/ServerProfile', true,
    );

    // The queued sync should now fire
    expect(invocations.length).toBeGreaterThan(0);
    expect(invocations[0].concept).toBe('urn:copf/ServerProfile');
    expect(invocations[0].action).toBe('replicate');
    expect(invocations[0].input.user).toBe('u-1');

    // Queue should be empty now
    expect(engine.getPendingQueue()).toHaveLength(0);
  });

  it('eager syncs fire immediately when concepts available', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'server');

    registry.register(
      'urn:copf/Password',
      createInProcessAdapter(
        { async set(i) { return { variant: 'ok', user: i.user }; } },
        createInMemoryStorage(),
      ),
    );
    registry.register(
      'urn:copf/ActionLog',
      createInProcessAdapter(
        { async append(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync LogPassword [eager]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ActionLog/append: [ record: { type: "password-set"; user: ?u } ]
      }
    `);
    engine.registerSync(syncs[0]);

    const completion = makeCompletion(
      'urn:copf/Password', 'set', { user: 'u-1' },
    );
    const invocations = await engine.onCompletion(completion);

    // Eager sync fires immediately
    expect(invocations).toHaveLength(1);
    expect(invocations[0].concept).toBe('urn:copf/ActionLog');

    // Nothing queued
    expect(engine.getPendingQueue()).toHaveLength(0);
  });

  it('local syncs always execute on same runtime', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'ios');

    registry.register(
      'urn:copf/Profile',
      createInProcessAdapter(
        { async update(i) { return { variant: 'ok', profile: i.profile }; } },
        createInMemoryStorage(),
      ),
    );
    registry.register(
      'urn:copf/LocalCache',
      createInProcessAdapter(
        { async invalidate(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync InvalidateCache [local]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        LocalCache/invalidate: [ profile: ?p ]
      }
    `);
    engine.registerSync(syncs[0]);

    const completion = makeCompletion(
      'urn:copf/Profile', 'update', { profile: 'p-1' },
    );
    const invocations = await engine.onCompletion(completion);

    expect(invocations).toHaveLength(1);
    expect(invocations[0].concept).toBe('urn:copf/LocalCache');
    expect(invocations[0].action).toBe('invalidate');
  });

  it('idempotency: same sync does not fire twice for same completion', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'server');

    registry.register(
      'urn:copf/Password',
      createInProcessAdapter(
        { async set(i) { return { variant: 'ok', user: i.user }; } },
        createInMemoryStorage(),
      ),
    );
    registry.register(
      'urn:copf/ActionLog',
      createInProcessAdapter(
        { async append(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync LogPassword [eager]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ActionLog/append: [ record: { type: "password-set"; user: ?u } ]
      }
    `);
    engine.registerSync(syncs[0]);

    const completion = makeCompletion(
      'urn:copf/Password', 'set', { user: 'u-1' },
    );

    // First evaluation
    const invocations1 = await engine.onCompletion(completion);
    expect(invocations1).toHaveLength(1);

    // Second evaluation with same completion — provenance edge prevents firing
    const invocations2 = await engine.onCompletion(completion);
    expect(invocations2).toHaveLength(0);
  });
});

// ============================================================
// 2. Engine Hierarchy
// ============================================================

describe('Stage 6 — Engine Hierarchy', () => {
  it('downstream engine forwards completions upstream', async () => {
    const serverLog = new ActionLog();
    const serverRegistry = createConceptRegistry();
    const serverEngine = new DistributedSyncEngine(serverLog, serverRegistry, 'server');

    const iosLog = new ActionLog();
    const iosRegistry = createConceptRegistry();
    const iosEngine = new DistributedSyncEngine(iosLog, iosRegistry, 'ios');

    // Set up hierarchy: ios → server
    iosEngine.setUpstream(serverEngine);

    // Track forwarded completions
    const forwardedCompletions: ActionCompletion[] = [];
    iosEngine.addCompletionForwarder(async (completion) => {
      forwardedCompletions.push(completion);
      // In production, this would be sent via HTTP/WS to the server engine
      await serverEngine.onCompletion(completion);
    });

    // Register concepts on ios runtime
    iosRegistry.register(
      'urn:copf/Profile',
      createInProcessAdapter(
        { async update(i) { return { variant: 'ok', profile: i.profile }; } },
        createInMemoryStorage(),
      ),
    );

    // Register a local sync on ios
    const localSyncs = parseSyncFile(`
      sync LocalCacheUpdate [local]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        Profile/update: [ profile: ?p ]
      }
    `);
    // Don't actually register this to avoid infinite loop; just test forwarding

    // Fire a completion on ios
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Profile',
      action: 'update',
      input: { profile: 'p-1' },
      variant: 'ok',
      output: { profile: 'p-1' },
      flow: generateId(),
      timestamp: timestamp(),
    };

    await iosEngine.onCompletion(completion);

    // Completion was forwarded to server
    expect(forwardedCompletions).toHaveLength(1);
    expect(forwardedCompletions[0].concept).toBe('urn:copf/Profile');
    expect(forwardedCompletions[0].output.profile).toBe('p-1');
  });

  it('downstream engine evaluates local syncs independently', async () => {
    const iosLog = new ActionLog();
    const iosRegistry = createConceptRegistry();
    const iosEngine = new DistributedSyncEngine(iosLog, iosRegistry, 'ios');

    iosRegistry.register(
      'urn:copf/Profile',
      createInProcessAdapter(
        { async update(i) { return { variant: 'ok', profile: i.profile }; } },
        createInMemoryStorage(),
      ),
    );
    iosRegistry.register(
      'urn:copf/LocalCache',
      createInProcessAdapter(
        { async invalidate(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync InvalidateLocalCache [local]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        LocalCache/invalidate: [ profile: ?p ]
      }
    `);
    iosEngine.registerSync(syncs[0]);

    // No upstream set — simulates offline

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Profile',
      action: 'update',
      input: {},
      variant: 'ok',
      output: { profile: 'p-1' },
      flow: generateId(),
      timestamp: timestamp(),
    };

    const invocations = await iosEngine.onCompletion(completion);

    // Local sync fires even without upstream
    expect(invocations).toHaveLength(1);
    expect(invocations[0].concept).toBe('urn:copf/LocalCache');
  });

  it('downstream queues eventual syncs when upstream unavailable', async () => {
    const iosLog = new ActionLog();
    const iosRegistry = createConceptRegistry();
    const iosEngine = new DistributedSyncEngine(iosLog, iosRegistry, 'ios');

    iosRegistry.register(
      'urn:copf/Profile',
      createInProcessAdapter(
        { async update(i) { return { variant: 'ok', profile: i.profile }; } },
        createInMemoryStorage(),
      ),
    );
    // ServerProfile NOT registered (simulates offline)

    const syncs = parseSyncFile(`
      sync ReplicateProfile [eventual]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        ServerProfile/replicate: [ profile: ?p ]
      }
    `);
    iosEngine.registerSync(syncs[0]);

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Profile',
      action: 'update',
      input: {},
      variant: 'ok',
      output: { profile: 'p-1' },
      flow: generateId(),
      timestamp: timestamp(),
    };

    const invocations = await iosEngine.onCompletion(completion);

    // No invocations (queued instead)
    expect(invocations).toHaveLength(0);
    expect(iosEngine.getPendingQueue()).toHaveLength(1);

    // Simulate coming back online
    iosRegistry.register(
      'urn:copf/ServerProfile',
      createInProcessAdapter(
        { async replicate(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const retried = await iosEngine.onAvailabilityChange(
      'urn:copf/ServerProfile', true,
    );

    expect(retried.length).toBeGreaterThan(0);
    expect(iosEngine.getPendingQueue()).toHaveLength(0);
  });
});

// ============================================================
// 3. Offline-Capable Sync with Eventual Convergence
// ============================================================

describe('Stage 6 — Offline Convergence', () => {
  it('full offline-to-online cycle', async () => {
    // Simulate: ios device goes offline, makes local changes,
    // comes back online, eventual syncs fire

    const iosLog = new ActionLog();
    const iosRegistry = createConceptRegistry();
    const iosEngine = new DistributedSyncEngine(iosLog, iosRegistry, 'ios');

    // Local profile concept on ios
    const profileStorage = createInMemoryStorage();
    const profileHandler: ConceptHandler = {
      async update(input, storage) {
        await storage.put('profiles', input.profile as string, {
          profile: input.profile,
          name: input.name,
        });
        return { variant: 'ok', profile: input.profile };
      },
    };
    iosRegistry.register(
      'urn:copf/Profile',
      createInProcessAdapter(profileHandler, profileStorage),
    );

    // Local cache concept (always available on ios)
    const cacheStorage = createInMemoryStorage();
    iosRegistry.register(
      'urn:copf/LocalCache',
      createInProcessAdapter(
        {
          async refresh(input, storage) {
            await storage.put('cache', input.profile as string, { refreshed: true });
            return { variant: 'ok' };
          },
        },
        cacheStorage,
      ),
    );

    // ServerProfile NOT available (offline)

    // Register syncs
    const localSync = parseSyncFile(`
      sync RefreshLocalCache [local]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        LocalCache/refresh: [ profile: ?p ]
      }
    `);
    const eventualSync = parseSyncFile(`
      sync SyncToServer [eventual]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        ServerProfile/replicate: [ profile: ?p ]
      }
    `);
    iosEngine.registerSync(localSync[0]);
    iosEngine.registerSync(eventualSync[0]);

    // --- OFFLINE PHASE ---

    // User updates profile while offline
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Profile',
      action: 'update',
      input: { profile: 'p-1', name: 'Alice Updated' },
      variant: 'ok',
      output: { profile: 'p-1' },
      flow: generateId(),
      timestamp: timestamp(),
    };

    const invocations = await iosEngine.onCompletion(completion);

    // Local sync fires (cache refresh)
    const localInvocations = invocations.filter(
      i => i.concept === 'urn:copf/LocalCache',
    );
    expect(localInvocations).toHaveLength(1);

    // Eventual sync queued (server unavailable)
    expect(iosEngine.getPendingQueue()).toHaveLength(1);
    expect(iosEngine.getPendingQueue()[0].sync.name).toBe('SyncToServer');

    // --- ONLINE PHASE ---

    // Server comes back online
    const serverProfileStorage = createInMemoryStorage();
    iosRegistry.register(
      'urn:copf/ServerProfile',
      createInProcessAdapter(
        {
          async replicate(input, storage) {
            await storage.put('replicated', input.profile as string, {
              profile: input.profile,
            });
            return { variant: 'ok' };
          },
        },
        serverProfileStorage,
      ),
    );

    const retriedInvocations = await iosEngine.onAvailabilityChange(
      'urn:copf/ServerProfile', true,
    );

    // Eventual sync fires
    expect(retriedInvocations.length).toBeGreaterThan(0);
    expect(retriedInvocations[0].concept).toBe('urn:copf/ServerProfile');
    expect(retriedInvocations[0].action).toBe('replicate');

    // Queue is empty
    expect(iosEngine.getPendingQueue()).toHaveLength(0);
  });

  it('multiple offline changes converge on reconnect', async () => {
    const iosLog = new ActionLog();
    const iosRegistry = createConceptRegistry();
    const iosEngine = new DistributedSyncEngine(iosLog, iosRegistry, 'ios');

    iosRegistry.register(
      'urn:copf/Profile',
      createInProcessAdapter(
        { async update(i) { return { variant: 'ok', profile: i.profile }; } },
        createInMemoryStorage(),
      ),
    );

    const syncs = parseSyncFile(`
      sync SyncToServer [eventual]
      when {
        Profile/update: [] => [ profile: ?p ]
      }
      then {
        ServerProfile/replicate: [ profile: ?p ]
      }
    `);
    iosEngine.registerSync(syncs[0]);

    // Multiple updates while offline
    for (let i = 1; i <= 3; i++) {
      const completion: ActionCompletion = {
        id: generateId(),
        concept: 'urn:copf/Profile',
        action: 'update',
        input: {},
        variant: 'ok',
        output: { profile: `p-${i}` },
        flow: generateId(),
        timestamp: timestamp(),
      };
      await iosEngine.onCompletion(completion);
    }

    expect(iosEngine.getPendingQueue()).toHaveLength(3);

    // Come online
    iosRegistry.register(
      'urn:copf/ServerProfile',
      createInProcessAdapter(
        { async replicate(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );

    const invocations = await iosEngine.onAvailabilityChange(
      'urn:copf/ServerProfile', true,
    );

    // All three pending syncs fire
    expect(invocations).toHaveLength(3);
    const profiles = invocations.map(i => i.input.profile);
    expect(profiles).toContain('p-1');
    expect(profiles).toContain('p-2');
    expect(profiles).toContain('p-3');

    expect(iosEngine.getPendingQueue()).toHaveLength(0);
  });

  it('availability listener is notified', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry);

    const notifications: { uri: string; available: boolean }[] = [];
    engine.onAvailability((uri, available) => {
      notifications.push({ uri, available });
    });

    await engine.onAvailabilityChange('urn:copf/Profile', true);
    await engine.onAvailabilityChange('urn:copf/Profile', false);

    expect(notifications).toHaveLength(2);
    expect(notifications[0]).toEqual({ uri: 'urn:copf/Profile', available: true });
    expect(notifications[1]).toEqual({ uri: 'urn:copf/Profile', available: false });
  });
});

// ============================================================
// 4. Sync Annotation Semantics
// ============================================================

describe('Stage 6 — Sync Annotations', () => {
  it('parser correctly identifies sync annotations', () => {
    const source = `
      sync Eager [eager]
      when { A/x: [] => [] }
      then { B/y: [] }

      sync Eventual [eventual]
      when { A/x: [] => [] }
      then { B/y: [] }

      sync Local [local]
      when { A/x: [] => [] }
      then { B/y: [] }

      sync Idempotent [idempotent]
      when { A/x: [] => [] }
      then { B/y: [] }

      sync Multi [eventual] [idempotent]
      when { A/x: [] => [] }
      then { B/y: [] }
    `;
    const syncs = parseSyncFile(source);

    expect(syncs).toHaveLength(5);
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[1].annotations).toContain('eventual');
    expect(syncs[2].annotations).toContain('local');
    expect(syncs[3].annotations).toContain('idempotent');
    expect(syncs[4].annotations).toContain('eventual');
    expect(syncs[4].annotations).toContain('idempotent');
  });

  it('DistributedSyncEngine respects annotation semantics', async () => {
    const log = new ActionLog();
    const registry = createConceptRegistry();
    const engine = new DistributedSyncEngine(log, registry, 'server');

    // Register source concept only, not target
    registry.register(
      'urn:copf/Source',
      createInProcessAdapter(
        { async act(i) { return { variant: 'ok', id: i.id }; } },
        createInMemoryStorage(),
      ),
    );

    // Register three syncs with different annotations
    const eagerSync = parseSyncFile(`
      sync EagerSync [eager]
      when { Source/act: [] => [ id: ?id ] }
      then { Target/process: [ id: ?id ] }
    `);
    const eventualSync = parseSyncFile(`
      sync EventualSync [eventual]
      when { Source/act: [] => [ id: ?id ] }
      then { Target/process: [ id: ?id ] }
    `);
    const localSync = parseSyncFile(`
      sync LocalSync [local]
      when { Source/act: [] => [ id: ?id ] }
      then { LocalTarget/process: [ id: ?id ] }
    `);

    engine.registerSync(eagerSync[0]);
    engine.registerSync(eventualSync[0]);

    // Register local target
    registry.register(
      'urn:copf/LocalTarget',
      createInProcessAdapter(
        { async process(i) { return { variant: 'ok' }; } },
        createInMemoryStorage(),
      ),
    );
    engine.registerSync(localSync[0]);

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Source',
      action: 'act',
      input: {},
      variant: 'ok',
      output: { id: 'test-1' },
      flow: generateId(),
      timestamp: timestamp(),
    };

    const invocations = await engine.onCompletion(completion);

    // Eager sync tries to fire but Target not available — produces no invocations
    // (eager syncs with unavailable targets silently fail in current impl)
    // Eventual sync is queued
    // Local sync fires

    const localInvocations = invocations.filter(
      i => i.concept === 'urn:copf/LocalTarget',
    );
    expect(localInvocations).toHaveLength(1);

    // Eventual sync should be queued
    expect(engine.getPendingQueue()).toHaveLength(1);
    expect(engine.getPendingQueue()[0].sync.name).toBe('EventualSync');
  });
});
