import { createConceptRegistry } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../framework-handlers/sync-engine.handler';
import type { Kernel } from '../runtime/self-hosted';
import { registryHandler } from '../handlers/ts/registry.handler';
import { publisherHandler } from '../handlers/ts/publisher.handler';
import { contentStoreHandler } from '../handlers/ts/content-store.handler';
import { downloadHandler } from '../handlers/ts/download.handler';
import { componentManifestHandler } from '../handlers/ts/component-manifest.handler';
import { auditorHandler } from '../handlers/ts/auditor.handler';
import { accountProxyHandler } from '../handlers/ts/account-proxy.handler';

let _kernel: Kernel | null = null;

export function getKernel(): Kernel {
  if (_kernel) return _kernel;
  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/Registry', registryHandler);
  kernel.registerConcept('urn:clef/Publisher', publisherHandler);
  kernel.registerConcept('urn:clef/ContentStore', contentStoreHandler);
  kernel.registerConcept('urn:clef/Download', downloadHandler);
  kernel.registerConcept('urn:clef/ComponentManifest', componentManifestHandler);
  kernel.registerConcept('urn:clef/Auditor', auditorHandler);
  kernel.registerConcept('urn:clef/AccountProxy', accountProxyHandler);

  _kernel = kernel;
  return kernel;
}
