import { createConceptRegistry } from '../../runtime/adapters/transport';
import { createSelfHostedKernel } from '../../runtime/self-hosted';
import { createSyncEngineHandler } from '../../handlers/ts/framework/sync-engine.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';
import { contentNodeHandler } from '../handlers/ts/content-node.handler';
import { contentStorageHandler } from '../handlers/ts/content-storage.handler';
import { contentParserHandler } from '../handlers/ts/content-parser.handler';
import { outlineHandler } from '../handlers/ts/outline.handler';
import { versionHandler } from '../handlers/ts/version.handler';
import { templateHandler } from '../handlers/ts/template.handler';
import { registryProxyHandler } from '../handlers/ts/registry-proxy.handler';

let _kernel: Kernel | null = null;

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-web:${conceptName}`) ?? createInMemoryStorage();
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/ContentNode', contentNodeHandler, makeStorage('content'));
  kernel.registerConcept('urn:clef/ContentStorage', contentStorageHandler, makeStorage('storage'));
  kernel.registerConcept('urn:clef/ContentParser', contentParserHandler);
  kernel.registerConcept('urn:clef/Outline', outlineHandler, makeStorage('outline'));
  kernel.registerConcept('urn:clef/Version', versionHandler, makeStorage('version'));
  kernel.registerConcept('urn:clef/Template', templateHandler, makeStorage('template'));
  kernel.registerConcept('urn:clef/RegistryProxy', registryProxyHandler);

  _kernel = kernel;
  return kernel;
}
