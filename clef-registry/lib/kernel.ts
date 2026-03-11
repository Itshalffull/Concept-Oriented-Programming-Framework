import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';
import { registryHandler } from '../handlers/ts/registry.handler';
import { publisherHandler } from '../handlers/ts/publisher.handler';
import { contentStoreHandler } from '../handlers/ts/content-store.handler';
import { downloadHandler } from '../handlers/ts/download.handler';
import { componentManifestHandler } from '../handlers/ts/component-manifest.handler';
import { auditorHandler } from '../handlers/ts/auditor.handler';
import { accountProxyHandler } from '../handlers/ts/account-proxy.handler';

let _kernel: Kernel | null = null;

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-registry:${conceptName}`) ?? createInMemoryStorage();
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;
  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/Registry', registryHandler, makeStorage('registry'));
  kernel.registerConcept('urn:clef/Publisher', publisherHandler, makeStorage('publisher'));
  kernel.registerConcept('urn:clef/ContentStore', contentStoreHandler, makeStorage('content'));
  kernel.registerConcept('urn:clef/Download', downloadHandler, makeStorage('download'));
  kernel.registerConcept('urn:clef/ComponentManifest', componentManifestHandler, makeStorage('manifest'));
  kernel.registerConcept('urn:clef/Auditor', auditorHandler, makeStorage('auditor'));
  kernel.registerConcept('urn:clef/AccountProxy', accountProxyHandler);

  _kernel = kernel;
  return kernel;
}
