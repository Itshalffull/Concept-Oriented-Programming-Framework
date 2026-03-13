import { describe, it, expect } from 'vitest';
import { bootKernel } from '../handlers/ts/framework/kernel-boot.handler';
import { createInMemoryStorage } from '../runtime/adapters/storage';
import { viewResolverHandler } from '../handlers/ts/view-resolver.handler';
import { kernelViewResolverHandler, resetKernelViewResolver } from '../handlers/ts/kernel-view-resolver.handler';
import { pluginRegistryHandler } from '../handlers/ts/app/plugin-registry.handler';
import { relationHandler } from '../handlers/ts/app/relation.handler';
import { referenceHandler } from '../handlers/ts/app/reference.handler';
import { backlinkHandler } from '../handlers/ts/app/backlink.handler';
import type { ConceptHandler } from '../runtime/types';

describe('View resolver → Relation sync chain — live through engine', () => {
  it('ViewResolver/resolve dispatches through syncs and creates view-item relations', async () => {
    resetKernelViewResolver();

    const viewResolverStorage = createInMemoryStorage();
    const pluginStorage = createInMemoryStorage();
    const kernelVRStorage = createInMemoryStorage();
    const contentStorage = createInMemoryStorage();
    const relationStorage = createInMemoryStorage();
    const referenceStorage = createInMemoryStorage();
    const backlinkStorage = createInMemoryStorage();

    // Minimal ContentNode handler that returns known items
    const contentNodeHandler: ConceptHandler = {
      async list() {
        return {
          variant: 'ok',
          items: JSON.stringify([
            { id: 'node-1', title: 'First Article' },
            { id: 'node-2', title: 'Second Article' },
            { id: 'node-3', title: 'Third Article' },
          ]),
        };
      },
    };

    const { kernel } = bootKernel({
      concepts: [
        { uri: 'urn:clef/ViewResolver', handler: viewResolverHandler, storage: viewResolverStorage },
        { uri: 'urn:clef/PluginRegistry', handler: pluginRegistryHandler, storage: pluginStorage },
        { uri: 'urn:clef/KernelViewResolver', handler: kernelViewResolverHandler, storage: kernelVRStorage },
        { uri: 'urn:clef/ContentNode', handler: contentNodeHandler, storage: contentStorage },
        { uri: 'urn:clef/Relation', handler: relationHandler, storage: relationStorage },
        { uri: 'urn:clef/Reference', handler: referenceHandler, storage: referenceStorage },
        { uri: 'urn:clef/Backlink', handler: backlinkHandler, storage: backlinkStorage },
      ],
      syncFiles: [
        'clef-base/suites/view-resolver/syncs/kernel-view-resolver-registration.sync',
        'clef-base/suites/view-resolver/syncs/view-resolver-dispatches-to-provider.sync',
        'clef-base/suites/view-resolver/syncs/kernel-resolver-fetches-data.sync',
        'clef-base/suites/view-resolver/syncs/view-resolve-tracks-items.sync',
      ],
    });

    // Step 1: Register KernelViewResolver as a provider
    // (fires registration sync → PluginRegistry/register)
    await kernel.invokeConcept('urn:clef/ViewResolver', 'register', {
      resolver_type: 'kernel',
      provider: 'urn:clef/KernelViewResolver',
    });
    const regResult = await kernel.invokeConcept('urn:clef/KernelViewResolver', 'register', {});
    expect(regResult.variant).toBe('ok');

    // Step 2: Resolve a view — this triggers the full sync chain:
    //   ViewResolver/resolve → ok
    //   → ViewResolverDispatchesToProvider sync → KernelViewResolver/resolve → ok
    //   → KernelResolverFetchesData sync → ContentNode/list → ok
    //   → ViewResolveTracksItems sync → Relation/trackViewItems
    const resolveResult = await kernel.invokeConcept('urn:clef/ViewResolver', 'resolve', {
      view: 'all-content',
      data_source: '{"concept":"ContentNode","action":"list"}',
      filters: '[]',
      context: '{"resolver_type":"kernel"}',
    });
    expect(resolveResult.variant).toBe('ok');

    // Step 3: Check the flow log — every step should be present
    const flowId = resolveResult.flowId as string;
    const flowLog = kernel.getFlowLog(flowId);
    const actions = flowLog.map(r => `${r.concept}/${r.action}→${r.variant}`);

    expect(actions).toContain('urn:clef/ViewResolver/resolve→ok');
    expect(actions).toContain('urn:clef/KernelViewResolver/resolve→ok');
    expect(actions).toContain('urn:clef/ContentNode/list→ok');
    expect(actions).toContain('urn:clef/Relation/trackViewItems→ok');

    // Step 4: Verify Relation storage has view-item links
    const viewItemRelation = await relationStorage.get('relation', 'view-item');
    expect(viewItemRelation).toBeTruthy();

    const links = JSON.parse(viewItemRelation!.links as string) as Array<{ source: string; target: unknown }>;
    expect(links).toHaveLength(3);
    expect(links.every(l => l.source === 'all-content')).toBe(true);

    // trackViewItems receives the raw items JSON from ContentNode/list,
    // so targets are the serialized item objects passed through the sync chain
    const targetIds = links.map(l =>
      typeof l.target === 'object' && l.target !== null ? (l.target as Record<string, unknown>).id : l.target,
    );
    expect(targetIds).toContain('node-1');
    expect(targetIds).toContain('node-2');
    expect(targetIds).toContain('node-3');
  });
});
