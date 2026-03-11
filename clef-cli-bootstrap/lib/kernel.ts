import { createConceptRegistry } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../framework-handlers/sync-engine.handler';
import type { Kernel } from '../runtime/self-hosted';
import { selfUpdateHandler } from '../handlers/ts/self-update.handler';
import { fetcherHandler } from '../handlers/ts/fetcher.handler';
import { downloadProxyHandler } from '../handlers/ts/download-proxy.handler';

let _kernel: Kernel | null = null;

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/SelfUpdate', selfUpdateHandler);
  kernel.registerConcept('urn:clef/Fetcher', fetcherHandler);
  kernel.registerConcept('urn:clef/DownloadProxy', downloadProxyHandler);

  _kernel = kernel;
  return kernel;
}
