import { describe, it, expect } from 'vitest';
import { SyncEngine, ActionLog } from '../handlers/ts/framework/engine';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';
import { createInMemoryStorage } from '../runtime/adapters/storage';
import { createConceptRegistry, createInProcessAdapter } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../handlers/ts/framework/sync-engine.handler';
import { readFileSync } from 'fs';
import type { ConceptHandler } from '../runtime/types';

describe('ViewResolver end-to-end sync chain', () => {
  it('dispatches ViewResolver/resolve through PluginRegistry to KernelViewResolver to ContentNode/list', async () => {
    const registry = createConceptRegistry();
    const { handler: syncEngine, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(syncEngine, log, registry);

    // Track all invocations for debugging
    const invocations: string[] = [];

    // --- Register minimal concept handlers ---

    // ViewResolver
    const viewResolverStorage = createInMemoryStorage();
    const viewResolverHandler: ConceptHandler = {
      async register(input, storage) {
        await storage.put('provider', input.resolver_type as string, {
          resolver_type: input.resolver_type,
          provider_name: input.provider,
        });
        return { variant: 'ok', resolver_type: input.resolver_type };
      },
      async resolve(input, storage) {
        invocations.push('ViewResolver/resolve');
        const resolverType = 'kernel';
        const provider = await storage.get('provider', resolverType);
        if (!provider) return { variant: 'no_provider', resolver_type: resolverType };
        return {
          variant: 'ok',
          view: input.view,
          data_source: input.data_source,
          filters: input.filters || '[]',
          resolver_type: resolverType,
        };
      },
    };
    kernel.registerConcept('urn:clef/ViewResolver', viewResolverHandler, viewResolverStorage);

    // PluginRegistry
    const pluginStorage = createInMemoryStorage();
    const pluginHandler: ConceptHandler = {
      async register(input, storage) {
        invocations.push('PluginRegistry/register');
        const category = (input.category ?? input.type ?? '') as string;
        const providerId = (input.provider_id ?? input.name ?? '') as string;
        const handler = (input.handler ?? '') as string;
        const key = `${category}:${providerId}`;
        await storage.put('pluginregistry', key, {
          id: key, category, provider_id: providerId, handler,
          type: category, name: providerId,
        });
        return { variant: 'ok', plugin: key };
      },
    };
    kernel.registerConcept('urn:clef/PluginRegistry', pluginHandler, pluginStorage);

    // KernelViewResolver
    const kernelVRStorage = createInMemoryStorage();
    const kernelVRHandler: ConceptHandler = {
      async register(_input, storage) {
        invocations.push('KernelViewResolver/register');
        await storage.put('kernel-view-resolver', '__registered', { value: true });
        return { variant: 'ok', provider_name: 'kernel' };
      },
      async resolve(input) {
        invocations.push('KernelViewResolver/resolve');
        const ds = JSON.parse(input.data_source as string);
        return {
          variant: 'ok',
          view: input.view,
          target_concept: `urn:clef/${ds.concept}`,
          target_action: ds.action,
          filters: input.filters || '[]',
        };
      },
    };
    kernel.registerConcept('urn:clef/KernelViewResolver', kernelVRHandler, kernelVRStorage);

    // ContentNode (simple list)
    const contentStorage = createInMemoryStorage();
    const contentHandler: ConceptHandler = {
      async list() {
        invocations.push('ContentNode/list');
        return {
          variant: 'ok',
          items: JSON.stringify([{ id: '1', name: 'Test' }, { id: '2', name: 'Test2' }]),
        };
      },
    };
    kernel.registerConcept('urn:clef/ContentNode', contentHandler, contentStorage);

    // Relation (track view items)
    const relationStorage = createInMemoryStorage();
    const relationHandler: ConceptHandler = {
      async trackViewItems(input) {
        invocations.push(`Relation/trackViewItems(view=${input.view})`);
        return { variant: 'ok' };
      },
    };
    kernel.registerConcept('urn:clef/Relation', relationHandler, relationStorage);

    // --- Load syncs ---
    const syncFiles = [
      'clef-base/suites/view-resolver/syncs/kernel-view-resolver-registration.sync',
      'clef-base/suites/view-resolver/syncs/view-resolver-dispatches-to-provider.sync',
      'clef-base/suites/view-resolver/syncs/kernel-resolver-fetches-data.sync',
      'clef-base/suites/view-resolver/syncs/view-resolve-tracks-items.sync',
    ];
    for (const file of syncFiles) {
      const src = readFileSync(file, 'utf-8');
      const syncs = parseSyncFile(src);
      for (const sync of syncs) {
        kernel.registerSync(sync);
      }
    }

    // --- Step 1: Register providers ---
    await kernel.invokeConcept('urn:clef/ViewResolver', 'register', {
      resolver_type: 'kernel',
      provider: 'urn:clef/KernelViewResolver',
    });

    // Register KernelViewResolver (this should fire the registration sync → PluginRegistry/register)
    const regResult = await kernel.invokeConcept('urn:clef/KernelViewResolver', 'register', {});
    console.log('KernelViewResolver/register result:', regResult);
    expect(regResult.variant).toBe('ok');

    // Check the flow log to see what happened
    const flowLog = kernel.getFlowLog(regResult.flowId as string);
    console.log('Registration flow log:', flowLog.map(r => `${r.type} ${r.concept}/${r.action} -> ${r.variant}`));

    // Check: did the registration sync fire PluginRegistry/register?
    console.log('After registration, invocations:', invocations);
    expect(invocations).toContain('PluginRegistry/register');

    // Verify PluginRegistry has the entry
    const pluginEntries = await pluginStorage.find('pluginregistry', { provider_id: 'kernel' });
    console.log('PluginRegistry entries:', pluginEntries);
    expect(pluginEntries.length).toBeGreaterThan(0);

    // --- Step 2: Invoke ViewResolver/resolve ---
    invocations.length = 0;
    const result = await kernel.invokeConcept('urn:clef/ViewResolver', 'resolve', {
      view: 'all-content',
      data_source: '{"concept":"ContentNode","action":"list"}',
      filters: '[]',
      context: '{"resolver_type":"kernel"}',
    });

    console.log('ViewResolver/resolve result:', result);
    console.log('After resolve, invocations:', invocations);

    // The sync chain should have triggered:
    // 1. ViewResolver/resolve -> ok
    // 2. ViewResolverDispatchesToProvider sync -> PluginRegistry query -> KernelViewResolver/resolve
    // 3. KernelResolverFetchesData sync -> ContentNode/list
    // 4. ViewResolveTracksItems sync -> Relation/trackViewItems
    expect(invocations).toContain('ViewResolver/resolve');
    expect(invocations).toContain('KernelViewResolver/resolve');
    expect(invocations).toContain('ContentNode/list');
    expect(invocations).toContain('Relation/trackViewItems(view=all-content)');
  });
});
