import { createConceptRegistry } from '../runtime/adapters/transport';
import { createSelfHostedKernel } from '../runtime/self-hosted';
import { createSyncEngineHandler } from '../framework-handlers/sync-engine.handler';
import type { Kernel } from '../runtime/self-hosted';
import { accountProxyHandler } from '../handlers/ts/account-proxy.handler';
import { registryProxyHandler } from '../handlers/ts/registry-proxy.handler';
import { componentManifestProxyHandler } from '../handlers/ts/component-manifest-proxy.handler';
import { downloadProxyHandler } from '../handlers/ts/download-proxy.handler';
import { sessionHandler } from '../handlers/ts/session.handler';
import { commentHandler } from '../handlers/ts/comment.handler';
import { flagHandler } from '../handlers/ts/flag.handler';
import { attributionHandler } from '../handlers/ts/attribution.handler';
import { contentNodeHandler } from '../handlers/ts/content-node.handler';
import { contentParserHandler } from '../handlers/ts/content-parser.handler';

let _kernel: Kernel | null = null;

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registry = createConceptRegistry();
  const { handler: syncEngine, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngine, log, registry);

  kernel.registerConcept('urn:clef/AccountProxy', accountProxyHandler);
  kernel.registerConcept('urn:clef/RegistryProxy', registryProxyHandler);
  kernel.registerConcept('urn:clef/ComponentManifestProxy', componentManifestProxyHandler);
  kernel.registerConcept('urn:clef/DownloadProxy', downloadProxyHandler);
  kernel.registerConcept('urn:clef/Session', sessionHandler);
  kernel.registerConcept('urn:clef/Comment', commentHandler);
  kernel.registerConcept('urn:clef/Flag', flagHandler);
  kernel.registerConcept('urn:clef/Attribution', attributionHandler);
  kernel.registerConcept('urn:clef/ContentNode', contentNodeHandler);
  kernel.registerConcept('urn:clef/ContentParser', contentParserHandler);

  _kernel = kernel;
  return kernel;
}
