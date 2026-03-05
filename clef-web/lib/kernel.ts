import { createConceptRegistry } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../framework-handlers/sync-engine.handler';
import type { Kernel } from '../runtime/self-hosted';
import { contentNodeHandler } from '../handlers/ts/content-node.handler';
import { contentStorageHandler } from '../handlers/ts/content-storage.handler';
import { contentParserHandler } from '../handlers/ts/content-parser.handler';
import { outlineHandler } from '../handlers/ts/outline.handler';
import { versionHandler } from '../handlers/ts/version.handler';
import { templateHandler } from '../handlers/ts/template.handler';
import { registryProxyHandler } from '../handlers/ts/registry-proxy.handler';

let _kernel: Kernel | null = null;

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/ContentNode', contentNodeHandler);
  kernel.registerConcept('urn:clef/ContentStorage', contentStorageHandler);
  kernel.registerConcept('urn:clef/ContentParser', contentParserHandler);
  kernel.registerConcept('urn:clef/Outline', outlineHandler);
  kernel.registerConcept('urn:clef/Version', versionHandler);
  kernel.registerConcept('urn:clef/Template', templateHandler);
  kernel.registerConcept('urn:clef/RegistryProxy', registryProxyHandler);

  _kernel = kernel;
  return kernel;
}
