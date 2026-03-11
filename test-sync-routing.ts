// Minimal test: does the RouteToVercel sync actually fire?
// And does the PropagateVercelDeployUrl sync update Runtime state?
import { createConceptRegistry } from './runtime/adapters/transport.js';
import { createSelfHostedKernel } from './runtime/self-hosted.js';
import { createSyncEngineHandler } from './handlers/ts/framework/sync-engine.handler.js';
import { parseSyncFile } from './handlers/ts/framework/sync-parser.handler.js';
import { runtimeHandler } from './handlers/ts/deploy/runtime.handler.js';
import { readFileSync } from 'fs';
import type { ConceptHandler } from './runtime/types.js';

// Create a mock VercelRuntime that logs when called
const mockVercelRuntime: ConceptHandler = {
  async provision(input, storage) {
    console.log('  >>> VercelRuntime/provision CALLED with:', JSON.stringify(input));
    return { variant: 'ok', project: 'proj-123', projectId: 'proj-123', endpoint: 'https://test.vercel.app' };
  },
  async deploy(input, storage) {
    console.log('  >>> VercelRuntime/deploy CALLED with:', JSON.stringify(input));
    return { variant: 'ok', project: input.project, deploymentId: 'dpl-456', deploymentUrl: 'https://test-abc123.vercel.app' };
  },
};

async function main() {
  const registry = createConceptRegistry();
  const { handler: syncEngine, engine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/Runtime', runtimeHandler);
  kernel.registerConcept('urn:clef/VercelRuntime', mockVercelRuntime);

  // Load ALL routing syncs (including propagation)
  const syncFiles = [
    'repertoire/concepts/deployment/syncs/routing/route-to-vercel.sync',
    'repertoire/concepts/deployment/syncs/routing/route-deploy-to-vercel.sync',
    'repertoire/concepts/deployment/syncs/routing/propagate-vercel-deploy-url.sync',
    'repertoire/concepts/deployment/syncs/routing/propagate-vercel-provision-endpoint.sync',
  ];

  for (const syncFile of syncFiles) {
    const source = readFileSync(syncFile, 'utf-8');
    const syncs = parseSyncFile(source);
    for (const s of syncs) {
      console.log(`Registered sync: ${s.name}`);
      kernel.registerSync(s);
    }
  }

  // Check sync index
  const syncIndex = engine.getSyncIndex();
  console.log('\nSync index:');
  for (const [key, syncs] of syncIndex.entries()) {
    console.log(`  ${key}: ${[...syncs].map(s => s.name).join(', ')}`);
  }

  // Step 1: Provision
  console.log('\n=== Step 1: Runtime/provision ===');
  const provResult = await kernel.invokeConcept(
    'urn:clef/Runtime', 'provision',
    { concept: 'test-app', runtimeType: 'vercel', framework: 'nextjs', config: '{}' },
  );
  console.log('Provision result:', JSON.stringify(provResult));

  // Check if provision endpoint was propagated
  console.log('\n=== Step 1b: Check Runtime endpoint after provision ===');
  const provEndpoint = await kernel.invokeConcept(
    'urn:clef/Runtime', 'getEndpoint',
    { instance: provResult.instance },
  );
  console.log('Runtime endpoint after provision:', JSON.stringify(provEndpoint));

  // Step 2: Deploy
  console.log('\n=== Step 2: Runtime/deploy ===');
  const deployResult = await kernel.invokeConcept(
    'urn:clef/Runtime', 'deploy',
    { instance: provResult.instance, artifact: '/app', version: 'v1', runtimeType: 'vercel', sourceDirectory: '/app' },
  );
  console.log('Deploy result:', JSON.stringify(deployResult));

  // Step 3: Check if deploy URL was propagated back to Runtime
  console.log('\n=== Step 3: Check Runtime endpoint after deploy ===');
  const deployEndpoint = await kernel.invokeConcept(
    'urn:clef/Runtime', 'getEndpoint',
    { instance: provResult.instance },
  );
  console.log('Runtime endpoint after deploy:', JSON.stringify(deployEndpoint));

  // Verify
  const expectedUrl = 'https://test-abc123.vercel.app';
  if (deployEndpoint.endpoint === expectedUrl) {
    console.log('\n✓ SUCCESS: Vercel deployment URL propagated back to Runtime via sync chain!');
  } else {
    console.log(`\n✗ FAILED: Expected ${expectedUrl}, got ${deployEndpoint.endpoint}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
